// Gatherer economy state machine — villagers on land, Fishing Ships on water
// (see `gathersResources`). Each idle gatherer routes to its owner's nearest
// matching resource; the gather loop accumulates the owner's gather-rate
// multiplier each tick toward the base per-cycle cadence (gather-rate techs
// speed it) and drops the carried resource at the nearest valid drop-off.
// Retries are throttled so a stuck gatherer does not re-plan every tick.

import { runDropOffStep } from './dropOffStep';
import { runToResourceStep } from './toResourceStep';
import { assignIdleGatherer } from '../idleGatherAssignment';
import type { Position } from 'civ-engine';
import type {
  GathererComponent,
  ResearchableTechnologyType,
  ResourceComponent,
  UnitComponent, EconomyResourceKind,
} from '../../types';
import { type GameWorld } from '../pureHelpers';
import { gathersResources } from '../../unitDomain';
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
  type DropOffAssignmentDeps,
} from '../villagerDropOffAssignment';
import {
  effectiveCarryCapacity,
  heavyPlowFarmCarryBonus,
  gatherRateMultiplierForKind,
} from '../../economyTechEffects';
import { civCarryBonus, civFishingShipRateMultiplier,
  civGatherRateMultiplier } from '../../civBonusEffects';
import { tryReseedFarm } from '../farmReseed';
import {
  aiStatesCodec,
  gathererDropOffStuckSinceTickCodec,
  playerCivilizationsCodec,
  researchedTechnologiesCodec,
  unitCommandsCodec,
  playerAgesCodec,
} from '../bridgeStateSerialize';
import type { UnitMovementPlan } from '../movementTypes';

type CivWorld = GameWorld;

// The `to-resource` leg and its timeouts live in `toResourceStep`.

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
  /** Whether a land unit can stand on this cell — the shore test for fish. */
  isLandCell: (x: number, y: number) => boolean;
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
    isLandCell,
    isUnitAtTarget,
    moveUnitOneSubgridStep,
    destroyResourceEntity,
    findNearestDropOffBuilding,
    findBuildingApproachPlan,
    ensurePlayerScoreCounters,
  } = deps;

  const assignmentDeps: GatherAssignmentDeps = {
    isHarvestableResource,
    isLandCell,
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
        // M5 naval: Fishing Ships run this loop too (gathersResources).
        if (!unit || !position || !gatherer || !gathersResources(unit.unitType)) {
          continue;
        }

        if (gatherer.task === 'idle' && shouldMaintainGatheringOrder(unit.owner, gatherer, aiStates.has(unit.owner))) {
          assignIdleGatherer(gatherer, () => {
            assignResource(activeWorld, id, gatherer, unit.owner, gatherTargetCounts, {
              preferUnsaturated: true,
              spreadCap: IDLE_ASSIGN_SPREAD_CAP,
            });
          });
        }

        if (gatherer.task === 'to-resource') {
          runToResourceStep({
            activeWorld,
            accessor,
            id,
            unit,
            gatherer,
            gatherTargetCounts,
            findResourceApproachPlan,
            isHarvestableResource,
            isUnitAtTarget,
            moveUnitOneSubgridStep,
            assignResource,
          });
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
              ) * civFishingShipRateMultiplier(
                playerCivilizations.get(unit.owner),
                unit.unitType,
                accessor.get(playerAgesCodec).get(unit.owner) ?? 'dark-age',
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
                // Carry techs (Wheelbarrow / Hand Cart) multiply; civilization
                // carry bonuses (Aztecs +5, Goth hunters +15) add to the BASE
                // first, AoE2's own order.
                const carryCapacity = effectiveCarryCapacity(
                  ownerTechs,
                  gatherer.carryCapacity
                    + civCarryBonus(playerCivilizations.get(unit.owner), targetResource.resourceType)
                    // Heavy Plow's "+1 food" carry clause, farms only.
                    + heavyPlowFarmCarryBonus(ownerTechs, targetResource.resourceType),
                );
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
          const result = runDropOffStep({
            world: activeWorld,
            accessor,
            id,
            unit,
            gatherer,
            position,
            aiStates,
            stuckMap,
            setStuck,
            clearStuck,
            dropOffDeps,
            findNearestDropOffBuilding,
            findBuildingApproachPlan,
            isUnitAtTarget,
            moveUnitOneSubgridStep,
            ensurePlayerScoreCounters,
          });
          if (result === 'handled') continue;
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
