// Villager economy state machine. Each idle villager gets routed to its
// owner's nearest matching resource; once at the resource the gather loop
// accumulates the owner's gather-rate multiplier each tick toward the base
// per-cycle cadence (gather-rate techs speed it) and drops carried
// resources at the nearest drop-off building. Drop-off retries are
// throttled so a stuck villager doesn't re-plan every tick.

import type { Position } from 'civ-engine';
import type {
  GathererComponent,
  ResearchableTechnologyType,
  ResourceComponent,
  UnitComponent, EconomyResourceKind,
} from '../../types';
import {
  type GameWorld,
} from '../pureHelpers';
import {
  gatherAmountFor,
  gatherTicksFor,
  resourceKindToEconomyResource,
} from '../../prototypeEconomyRules';
import {
  assignNearestResource,
  type AssignNearestResourceOptions,
  type GatherAssignmentDeps,
} from '../villagerGatherAssignment';
import {
  findReachableDropOff,
  type DropOffAssignmentDeps,
} from '../villagerDropOffAssignment';
import {
  effectiveCarryCapacity,
  gatherRateMultiplierForKind,
} from '../../economyTechEffects';
import { civGatherRateMultiplier } from '../../civBonusEffects';
import { gatherMultiplier } from '../../ai';
import { tryReseedFarm } from '../farmReseed';
import {
  aiStatesCodec,
  gathererDropOffStuckSinceTickCodec,
  playerCivilizationsCodec,
  playerResourcesCodec,
  researchedTechnologiesCodec,
  sheepMoveOrdersCodec,
  unitCommandsCodec,
} from '../bridgeStateSerialize';
import type { UnitMovementPlan } from '../movementTypes';

type CivWorld = GameWorld;

const GATHER_DROPOFF_RETRY_INTERVAL = 30;
// Wood/gather gridlock fix (campaign-4): villagers piled onto ONE nearest tree
// (14/18 stuck) and to-resource had no give-up path, jamming forever. Fix: a
// villager stuck walking to an OVER-SUBSCRIBED resource for
// GATHER_APPROACH_TIMEOUT_TICKS reassigns to the nearest UNsaturated resource
// (fan-out). Surgical — normal idle→assign stays nearest-first (AI economy
// untouched); the approach timer reuses gatherProgressTicks (no new save state).
const MAX_GATHERERS_PER_RESOURCE = 2;
const GATHER_APPROACH_TIMEOUT_TICKS = 80;
// Loop 1 follow-up (campaign-5 replay: 15 of 16 woodcutters STILL re-piled
// on the nearest tree because the give-up path freed them but idle→assign
// re-picked nearest). idle→assign now also fans out, but at a GENEROUS cap
// so it only caps extreme piles — the AI's natural 2-3-per-resource
// clustering is below this, so its tuned economy is unchanged (a cap of 2
// here over-spread the AI and broke its age-up; 4 clears normal clustering).
const IDLE_ASSIGN_SPREAD_CAP = 4;
// Stable empty-set sentinel for owners with no researched techs, so the
// per-gather-tick gatherRateMultiplierForKind lookup never allocates.
const NO_RESEARCHED_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();

interface PlayerScoreCountersLike {
  resourcesGathered: number;
}

export interface VillagerEconomySystemDeps {
  world: GameWorld;
  // Phase 2D: sheepMoveOrders migrated to world.state.aoe2.* via accessor.
  // Phase 2D — gathererDropOffStuckSinceTick now flows through the
  // accessor + codec. Hot-loop pattern: get the cached Map once at the
  // start of execute(), mutate directly, mark dirty once at the end.
  // The mutate-per-call alternative would add a Set.add per gather
  // step which doesn't scale to dozens of villagers @ 10 TPS.
  accessor: import('../bridgeStateAccessor').BridgeStateAccessor;
  // Phase 2D: playerResources migrated to world.state.aoe2.* via accessor.
  // Phase 2D: aiStates migrated to world.state.aoe2.* via accessor.
  shouldMaintainGatheringOrder: (owner: number, gatherer: GathererComponent, isAiControlled: boolean) => boolean;
  findResourceApproachPlan: (
    villagerId: number,
    resourceId: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  isHarvestableResource: (id: number, resource: ResourceComponent) => boolean;
  isUnitAtTarget: (
    unitId: number,
    target: Position,
    activeWorld: CivWorld,
  ) => boolean;
  moveUnitOneSubgridStep: (
    entityId: number,
    nextStep: Position,
    activeWorld?: CivWorld,
    stepPerTick?: number,
  ) => void;
  destroyResourceEntity: (id: number) => void;
  findNearestDropOffBuilding: (
    activeWorld: CivWorld,
    owner: number,
    resource: EconomyResourceKind,
    position: Position,
    excludeIds?: ReadonlySet<number>,
  ) => number | null;
  findBuildingApproachPlan: (
    unitId: number,
    targetId: number,
    range: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  ensurePlayerScoreCounters: (owner: number) => PlayerScoreCountersLike;
}

export function registerVillagerEconomySystem(deps: VillagerEconomySystemDeps): void {
  const {
    world,
    accessor,
    shouldMaintainGatheringOrder,
    findResourceApproachPlan,
    isHarvestableResource,
    isUnitAtTarget,
    moveUnitOneSubgridStep,
    destroyResourceEntity,
    findNearestDropOffBuilding,
    findBuildingApproachPlan,
    ensurePlayerScoreCounters,
  } = deps;

  const assignmentDeps: GatherAssignmentDeps = {
    isHarvestableResource,
    findNearestDropOffBuilding,
    findResourceApproachPlan,
  };
  const dropOffDeps: DropOffAssignmentDeps = {
    findNearestDropOffBuilding,
    findBuildingApproachPlan,
  };
  // Thin binding over the extracted assignNearestResource so the call sites
  // below stay terse. The two hot paths (idle→assign, over-subscription
  // give-up) pass only preferUnsaturated + spreadCap; the unreachable reroute
  // additionally passes requireReachable + excludeResourceId.
  function assignResource(
    activeWorld: CivWorld,
    villagerId: number,
    gatherer: GathererComponent,
    owner: number,
    gatherTargetCounts: Map<number, number>,
    options: AssignNearestResourceOptions,
  ): void {
    assignNearestResource(
      assignmentDeps,
      activeWorld,
      villagerId,
      gatherer,
      owner,
      gatherTargetCounts,
      options,
    );
  }

  world.registerSystem({
    name: 'prototypeVillagerEconomy',
    phase: 'update',
    after: ['prototypePlayerCommands'],
    execute(activeWorld) {
      // Phase 2D — cache the Map once, mutate directly in the gather loop, mark
      // dirty once at the end (avoids accessor.mutate's Set.add per gather step).
      // The helpers short-circuit no-op deletes (Map.delete false when absent),
      // so a regular drop-off step doesn't needlessly mark the slot dirty and
      // force a flush+setState every tick (Gemini + Claude impl-21 finding).
      const unitCommands = accessor.get(unitCommandsCodec);
      const stuckMap = accessor.get(gathererDropOffStuckSinceTickCodec);
      // Per-owner researched-tech sets drive the gather-rate multiplier
      // (gatherRateMultiplierForKind). Fetched once per tick like the other maps.
      const researchedTechnologies = accessor.get(researchedTechnologiesCodec);
      // Per-owner civilization drives the civ gather bonus (Britons shepherds).
      const playerCivilizations = accessor.get(playerCivilizationsCodec);
      let stuckMapDirty = false;
      function clearStuck(id: number): void {
        if (stuckMap.delete(id)) stuckMapDirty = true;
      }
      function setStuck(id: number, tick: number): void {
        stuckMap.set(id, tick);
        stuckMapDirty = true;
      }

      // Count gatherers already committed to each resource this tick so
      // assignment (below) can spread villagers across the forest instead of
      // piling them onto the single nearest tree (campaign-4 gridlock).
      const gatherTargetCounts = new Map<number, number>();
      for (const id of activeWorld.query('gatherer')) {
        const g = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
        if (g && g.targetResourceId !== null) {
          gatherTargetCounts.set(
            g.targetResourceId,
            (gatherTargetCounts.get(g.targetResourceId) ?? 0) + 1,
          );
        }
      }

      const aiStates = accessor.get(aiStatesCodec); // auto-gather gate's AI-control clause

      for (const id of activeWorld.query('position', 'unit', 'gatherer')) {
        if (unitCommands.has(id)) {
          continue;
        }

        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        const position = activeWorld.getComponent<Position>(id, 'position');
        const gatherer = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
        if (!unit || !position || !gatherer || unit.unitType !== 'villager') {
          continue;
        }

        if (gatherer.task === 'idle' && shouldMaintainGatheringOrder(unit.owner, gatherer, aiStates.has(unit.owner))) {
          assignResource(activeWorld, id, gatherer, unit.owner, gatherTargetCounts, {
            preferUnsaturated: true,
            spreadCap: IDLE_ASSIGN_SPREAD_CAP,
          });
        }

        if (gatherer.task === 'to-resource') {
          const targetResource = gatherer.targetResourceId === null
            ? null
            : activeWorld.getComponent<ResourceComponent>(gatherer.targetResourceId, 'resource');
          const resourceApproachPlan = gatherer.targetResourceId === null
            ? null
            : findResourceApproachPlan(id, gatherer.targetResourceId, activeWorld);

          if (
            !targetResource
            || !isHarvestableResource(gatherer.targetResourceId ?? -1, targetResource)
          ) {
            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
            gatherer.targetResourceId = null;
          } else if (!resourceApproachPlan) {
            // Unreachable target (campaign-11 gridlock): the resource exists and
            // is harvestable, but every approach cell is blocked (e.g. a sheep
            // boxed in by berries + buildings), so there is no path to it.
            // Pre-fix this fell to `idle`, then the bottom-of-loop idle→assign
            // re-picked the same nearest unreachable resource every tick —
            // never trying the reachable resources, so food income stayed 0.
            if (gatherer.carriedAmount > 0) {
              // Deposit a carry first (mirrors the depleted/gone branch above —
              // a villager CAN reach `to-resource` carrying, via an explicit
              // gather order issued mid-carry); the next idle→assign reroutes
              // from empty.
              gatherer.task = 'to-dropoff';
              gatherer.targetResourceId = null;
            } else {
              // Re-target the nearest REACHABLE resource, excluding this one, so
              // the villager falls through to a gatherable resource. Release the
              // slot first so the count stays honest; the reachability scan is
              // bounded (MAX_REACHABILITY_PROBES) and also skips any OTHER
              // unreachable candidate. If no resource of this kind is reachable
              // at all (a genuinely fully-boxed villager — pathological: it
              // would need every nearby resource walled off), the assignment
              // leaves it idle. The bottom idle→assign re-arms this branch next
              // tick, but the bounded probe count caps the per-tick pathfinding
              // cost so it never scans the whole map.
              const unreachableTarget = gatherer.targetResourceId;
              if (unreachableTarget !== null) {
                gatherTargetCounts.set(
                  unreachableTarget,
                  Math.max(0, (gatherTargetCounts.get(unreachableTarget) ?? 1) - 1),
                );
              }
              assignResource(activeWorld, id, gatherer, unit.owner, gatherTargetCounts, {
                preferUnsaturated: true,
                spreadCap: MAX_GATHERERS_PER_RESOURCE,
                requireReachable: true,
                excludeResourceId: unreachableTarget,
              });
            }
          } else if (isUnitAtTarget(id, resourceApproachPlan.destination, activeWorld)) {
            gatherer.task = 'gathering';
            gatherer.gatherProgressTicks = 0;
            // A villager that has reached a sheep to harvest pins the sheep in
            // place. Any outstanding player move order on that sheep would
            // otherwise keep walking the sheep away each tick.
            if (
              gatherer.targetResourceId !== null
              && targetResource.resourceType === 'sheep'
            ) {
              const tid = gatherer.targetResourceId;
              accessor.mutate(sheepMoveOrdersCodec, (m) => m.delete(tid));
            }
          } else {
            // Approach timer (reuses gatherProgressTicks, which is otherwise
            // 0 during to-resource). Redistribute ONLY when this target is
            // over-subscribed (more gatherers than the per-resource cap) AND
            // we've waited a while — i.e. a genuine pile-up where this
            // villager is an extra that cannot get an approach cell. It is
            // then reassigned to the nearest UNsaturated resource (fan-out).
            // A long walk to an UNcontended resource is NOT abandoned, and
            // normal idle→assign is untouched — so the AI's tuned economy is
            // unaffected; only piled-up extras spread out.
            gatherer.gatherProgressTicks += 1;
            const overSubscribed =
              (gatherTargetCounts.get(gatherer.targetResourceId ?? -1) ?? 0)
              > MAX_GATHERERS_PER_RESOURCE;
            if (overSubscribed && gatherer.gatherProgressTicks >= GATHER_APPROACH_TIMEOUT_TICKS) {
              // Reservation MOVE: release this villager's slot on the
              // over-subscribed target BEFORE reassigning. Once the excess
              // has left, the target is no longer over-subscribed, so the
              // remaining (within-cap) gatherers stay put — only the extras
              // redistribute (Codex gather-stall iter-1 MEDIUM).
              const previousTarget = gatherer.targetResourceId;
              if (previousTarget !== null) {
                gatherTargetCounts.set(
                  previousTarget,
                  Math.max(0, (gatherTargetCounts.get(previousTarget) ?? 1) - 1),
                );
              }
              gatherer.gatherProgressTicks = 0;
              assignResource(activeWorld, id, gatherer, unit.owner, gatherTargetCounts, {
                preferUnsaturated: true,
                spreadCap: MAX_GATHERERS_PER_RESOURCE,
              });
            } else {
              moveUnitOneSubgridStep(id, resourceApproachPlan.nextStep, activeWorld);
            }
          }
        }

        if (gatherer.task === 'gathering') {
          if (gatherer.targetResourceId === null) {
            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
          } else {
            const targetPosition = activeWorld.getComponent<Position>(
              gatherer.targetResourceId,
              'position',
            );
            const targetResource = activeWorld.getComponent<ResourceComponent>(
              gatherer.targetResourceId,
              'resource',
            );
            const resourceApproachPlan = findResourceApproachPlan(
              id,
              gatherer.targetResourceId,
              activeWorld,
            );

            if (
              !targetPosition
              || !targetResource
              || !isHarvestableResource(gatherer.targetResourceId, targetResource)
              || !resourceApproachPlan
              || !isUnitAtTarget(id, resourceApproachPlan.destination, activeWorld)
            ) {
              gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
              gatherer.targetResourceId = null;
              gatherer.gatherProgressTicks = 0;
            } else {
              // Rate accumulation: add the owner's gather-rate multiplier each
              // tick and complete a gather cycle when it crosses the base
              // cadence, carrying the remainder so stacked gather-rate techs
              // raise throughput faithfully even at tiny base cadences
              // (mirrors ticksToGatherCarry).
              const ownerTechs =
                researchedTechnologies.get(unit.owner) ?? NO_RESEARCHED_TECHS;
              // Tech gather-rate × civ gather bonus (Britons shepherds +25% on
              // sheep). Both DERIVED from persisted per-owner state; a non-bonus
              // civ multiplies by 1 so every other owner is byte-identical.
              gatherer.gatherProgressTicks += gatherRateMultiplierForKind(
                ownerTechs,
                targetResource.resourceType,
              ) * civGatherRateMultiplier(
                playerCivilizations.get(unit.owner),
                targetResource.resourceType,
              );
              const cycleGatherTicks = gatherTicksFor(targetResource.resourceType);
              if (gatherer.gatherProgressTicks >= cycleGatherTicks) {
                gatherer.gatherProgressTicks -= cycleGatherTicks;
                const carriedResource = resourceKindToEconomyResource(targetResource.resourceType);
                if (carriedResource === null) {
                  gatherer.task = 'idle';
                  gatherer.targetResourceId = null;
                  continue;
                }
                // Carry techs (Wheelbarrow / Hand Cart) raise effective carry,
                // derived from the owner's researched-tech set.
                const carryCapacity = effectiveCarryCapacity(ownerTechs, gatherer.carryCapacity);
                const gatherAmount = Math.min(
                  gatherAmountFor(targetResource.resourceType),
                  targetResource.amount,
                  carryCapacity - gatherer.carriedAmount,
                );
                targetResource.amount -= gatherAmount;
                gatherer.carriedResource = carriedResource;
                gatherer.carriedAmount += gatherAmount;

                // Capture depletion BEFORE a reseed refills `amount` (so the
                // villager still drops off its carry this cycle either way).
                // M1 Farms (slice 2): a depleted FARM whose owner affords the
                // 60-wood reseed is refilled in place (same entity, target kept)
                // so gathering continues; everything else is removed as before.
                const depleted = targetResource.amount <= 0;
                const depletedId = gatherer.targetResourceId; // non-null here
                if (depleted && !tryReseedFarm(activeWorld, accessor, depletedId, targetResource)) {
                  gatherer.targetResourceId = null;
                  destroyResourceEntity(depletedId);
                }
                if (depleted || gatherer.carriedAmount >= carryCapacity) {
                  gatherer.task = 'to-dropoff';
                }
              }
            }
          }
        }

        if (gatherer.task === 'to-dropoff') {
          const carriedResource = gatherer.carriedResource;
          if (carriedResource === null || gatherer.carriedAmount <= 0) {
            gatherer.task = 'idle';
            gatherer.carriedAmount = 0;
            gatherer.carriedResource = null;
            clearStuck(id);
            continue;
          }

          const stuckSince = stuckMap.get(id);
          const shouldRetry = stuckSince === undefined
            || (activeWorld.tick - stuckSince) >= GATHER_DROPOFF_RETRY_INTERVAL;
          if (!shouldRetry) {
            continue;
          }

          // Hot path: head for the nearest drop-off by distance (unchanged).
          const nearestId = findNearestDropOffBuilding(activeWorld, unit.owner, carriedResource, position);
          let dropOffBuildingId = nearestId;
          let dropOffPlan = nearestId === null ? null : findBuildingApproachPlan(id, nearestId, 1, activeWorld);

          // Reachability reroute (recovery path only): if the nearest drop-off
          // is unreachable AND the villager has been stuck a full retry interval
          // on it (stuckSince set → a retry, not the first block), look past it
          // for the nearest REACHABLE drop-off so a persistently boxed-in
          // villager isn't latched forever (AI-vs-AI grounding regression — the
          // symmetric twin of the v0.1.47 resource reroute). Transient blocking
          // (< one interval) still just waits → hot path byte-identical.
          if (!dropOffPlan && stuckSince !== undefined) {
            const reachable = findReachableDropOff(
              dropOffDeps, activeWorld, unit.owner, carriedResource, id, position,
            );
            if (reachable) {
              dropOffBuildingId = reachable.buildingId;
              dropOffPlan = reachable.plan;
            }
          }
          gatherer.dropOffBuildingId = dropOffBuildingId;

          if (!dropOffPlan) {
            setStuck(id, activeWorld.tick);
          } else if (isUnitAtTarget(id, dropOffPlan.destination, activeWorld)) {
            const stockpile = accessor.get(playerResourcesCodec).get(unit.owner);
            const aiState = aiStates.get(unit.owner);
            const multiplier = aiState ? gatherMultiplier(aiState.difficulty) : 1;
            const deposited = Math.round(gatherer.carriedAmount * multiplier);
            if (stockpile) {
              stockpile[carriedResource] += deposited;
              accessor.markDirty(playerResourcesCodec);
            }
            ensurePlayerScoreCounters(unit.owner).resourcesGathered += deposited;
            gatherer.task = 'idle';
            gatherer.carriedAmount = 0;
            gatherer.carriedResource = null;
            gatherer.targetResourceId = null;
            gatherer.gatherProgressTicks = 0;
            clearStuck(id);
          } else {
            clearStuck(id);
            moveUnitOneSubgridStep(id, dropOffPlan.nextStep, activeWorld);
          }
        }

        if (gatherer.task === 'idle' && shouldMaintainGatheringOrder(unit.owner, gatherer, aiStates.has(unit.owner))) {
          assignResource(activeWorld, id, gatherer, unit.owner, gatherTargetCounts, {
            preferUnsaturated: true,
            spreadCap: IDLE_ASSIGN_SPREAD_CAP,
          });
        }
      }

      // Phase 2D — mark the slot dirty once at end-of-tick if any
      // gather-loop iteration touched the cached Map. The output-phase
      // bridgeSnapshotSystem flushes via codec at end of tick.
      if (stuckMapDirty) {
        accessor.markDirty(gathererDropOffStuckSinceTickCodec);
      }
    },
  });
}
