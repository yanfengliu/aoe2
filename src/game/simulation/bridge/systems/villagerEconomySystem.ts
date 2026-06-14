// Villager economy state machine. Each idle villager gets routed to its
// owner's nearest matching resource; once at the resource the gather loop
// counts ticks toward `gatherTicksFor(resourceType)` and drops carried
// resources at the nearest drop-off building. Drop-off retries are
// throttled so a stuck villager doesn't re-plan every tick.

import type { Position } from 'civ-engine';
import type {
  GathererComponent,
  ResourceComponent,
  UnitComponent,
} from '../../types';
import {
  manhattanDistance,
  type GameWorld,
} from '../pureHelpers';
import {
  gatherAmountFor,
  gatherTicksFor,
  resourceKindToEconomyResource,
} from '../../prototypeEconomyRules';
import { gatherMultiplier } from '../../ai';
import {
  aiStatesCodec,
  gathererDropOffStuckSinceTickCodec,
  playerResourcesCodec,
  sheepMoveOrdersCodec,
  unitCommandsCodec,
} from '../bridgeStateSerialize';
import type { UnitMovementPlan } from '../movementTypes';

type CivWorld = GameWorld;

const GATHER_DROPOFF_RETRY_INTERVAL = 30;
// Wood/gather gridlock fix (campaign-4): villagers piled onto the single
// nearest tree (14 of 18 stuck woodcutters targeted ONE tree) and, unlike
// the to-dropoff state, `to-resource` had no give-up path, so they jammed
// forever (0 gathering). Fix: a villager stuck walking to an
// OVER-SUBSCRIBED resource for GATHER_APPROACH_TIMEOUT_TICKS is reassigned
// to the nearest UNsaturated resource (fan-out). This is surgical —
// normal idle→assign stays nearest-first, so the AI's tuned economy is
// untouched and ONLY the piled-up extras redistribute. The approach timer
// reuses gatherProgressTicks (otherwise 0 during to-resource → no new save
// state).
const MAX_GATHERERS_PER_RESOURCE = 2;
const GATHER_APPROACH_TIMEOUT_TICKS = 80;
// Loop 1 follow-up (campaign-5 replay: 15 of 16 woodcutters STILL re-piled
// on the nearest tree because the give-up path freed them but idle→assign
// re-picked nearest). idle→assign now also fans out, but at a GENEROUS cap
// so it only caps extreme piles — the AI's natural 2-3-per-resource
// clustering is below this, so its tuned economy is unchanged (a cap of 2
// here over-spread the AI and broke its age-up; 4 clears normal clustering).
const IDLE_ASSIGN_SPREAD_CAP = 4;

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
  shouldMaintainGatheringOrder: (owner: number, gatherer: GathererComponent) => boolean;
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
    resource: 'food' | 'wood' | 'gold' | 'stone',
    position: Position,
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

  function assignNearestResource(
    activeWorld: CivWorld,
    villagerId: number,
    gatherer: GathererComponent,
    owner: number,
    // Live count of gatherers already targeting each resource this tick. The
    // chosen target is reserved (count++) so same-tick assignments stay in
    // sync.
    gatherTargetCounts: Map<number, number>,
    // When true, fan out: prefer resources with FEWER than `spreadCap`
    // gatherers. idle→assign uses a generous cap (IDLE_ASSIGN_SPREAD_CAP —
    // only caps extreme piles; the AI's natural clustering is below it), and
    // the stuck-villager redistribute uses the tight cap
    // (MAX_GATHERERS_PER_RESOURCE) to maximally spread a genuine pile-up.
    preferUnsaturated: boolean,
    spreadCap: number,
  ): void {
    const villagerPosition = activeWorld.getComponent<Position>(villagerId, 'position');
    if (!villagerPosition) return;

    // V4-9: filter inline before allocating wrappers. The previous chain
    // mapped every resource on the map to a {id, position, resource}
    // object before applying any filter, so a 12-villager simultaneous
    // drop-off allocated ~12 * 120 wrappers per tick. Now wrappers are
    // only built for the resources that pass the type + harvestability
    // gates, which is normally the small subset that can match.
    const matchingResources: Array<{
      id: number;
      position: Position;
      resource: ResourceComponent;
    }> = [];
    for (const id of activeWorld.query('position', 'resource')) {
      const position = activeWorld.getComponent<Position>(id, 'position');
      const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
      if (!position || !resource) continue;
      if (!isHarvestableResource(id, resource)) continue;
      if (resourceKindToEconomyResource(resource.resourceType) !== gatherer.desiredResource) continue;
      matchingResources.push({ id, position, resource });
    }
    matchingResources.sort((left, right) => {
        // Owner preference FIRST (own > home-base neutral > other), so
        // fan-out NEVER jumps to an enemy or far-off neutral resource just
        // because it is unsaturated — it stays within the player's own
        // forest (Codex gather-stall iter-1 HIGH).
        const leftPreferred =
          left.resource.owner === owner ? 0
          : left.resource.owner === null && left.resource.baseOwner === owner ? 1
          : 2;
        const rightPreferred =
          right.resource.owner === owner ? 0
          : right.resource.owner === null && right.resource.baseOwner === owner ? 1
          : 2;
        if (leftPreferred !== rightPreferred) {
          return leftPreferred - rightPreferred;
        }
        // Within the same owner tier, when redistributing a stuck villager,
        // push already-saturated resources to the back so it picks an
        // under-subscribed one; saturated resources stay a last resort.
        if (preferUnsaturated) {
          const leftSaturated =
            (gatherTargetCounts.get(left.id) ?? 0) >= spreadCap ? 1 : 0;
          const rightSaturated =
            (gatherTargetCounts.get(right.id) ?? 0) >= spreadCap ? 1 : 0;
          if (leftSaturated !== rightSaturated) {
            return leftSaturated - rightSaturated;
          }
        }
        const leftDistance = manhattanDistance(left.position, villagerPosition);
        const rightDistance = manhattanDistance(right.position, villagerPosition);
        return leftDistance - rightDistance;
      });

    const target = matchingResources[0];
    if (!target) {
      gatherer.task = 'idle';
      gatherer.targetResourceId = null;
      return;
    }

    // Reserve the chosen resource so other villagers assigned later THIS
    // tick already see it one fuller and spread to the next one.
    gatherTargetCounts.set(target.id, (gatherTargetCounts.get(target.id) ?? 0) + 1);
    gatherer.task = 'to-resource';
    gatherer.targetResourceId = target.id;
    gatherer.dropOffBuildingId = findNearestDropOffBuilding(
      activeWorld,
      owner,
      gatherer.desiredResource,
      target.position,
    );
    gatherer.gatherProgressTicks = 0;
  }

  world.registerSystem({
    name: 'prototypeVillagerEconomy',
    phase: 'update',
    after: ['prototypePlayerCommands'],
    execute(activeWorld) {
      // Phase 2D — get the cached Map once at the start; mutate directly
      // in the gather loop; mark dirty once at the end. This avoids
      // accessor.mutate's Set.add per gather step (~20 villagers @ 10 TPS
      // = 200 mutations/sec; the set-once pattern collapses to 1).
      //
      // The helpers ALSO short-circuit on no-op deletes (Map.delete returns
      // false when the key wasn't present). Without this gate, every
      // villager's regular drop-off step would mark the slot dirty even
      // though the map content didn't change, forcing unnecessary
      // flush+setState every tick. Both reviewers (Gemini + Claude impl-21)
      // converged on this finding.
      const unitCommands = accessor.get(unitCommandsCodec);
      const stuckMap = accessor.get(gathererDropOffStuckSinceTickCodec);
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

        if (gatherer.task === 'idle' && shouldMaintainGatheringOrder(unit.owner, gatherer)) {
          assignNearestResource(activeWorld, id, gatherer, unit.owner, gatherTargetCounts, true, IDLE_ASSIGN_SPREAD_CAP);
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
            || !resourceApproachPlan
          ) {
            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
            gatherer.targetResourceId = null;
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
              assignNearestResource(activeWorld, id, gatherer, unit.owner, gatherTargetCounts, true, MAX_GATHERERS_PER_RESOURCE);
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
              gatherer.gatherProgressTicks += 1;
              if (
                gatherer.gatherProgressTicks
                >= gatherTicksFor(targetResource.resourceType)
              ) {
                gatherer.gatherProgressTicks = 0;
                const carriedResource = resourceKindToEconomyResource(targetResource.resourceType);
                if (carriedResource === null) {
                  gatherer.task = 'idle';
                  gatherer.targetResourceId = null;
                  continue;
                }
                const gatherAmount = Math.min(
                  gatherAmountFor(targetResource.resourceType),
                  targetResource.amount,
                  gatherer.carryCapacity - gatherer.carriedAmount,
                );
                targetResource.amount -= gatherAmount;
                gatherer.carriedResource = carriedResource;
                gatherer.carriedAmount += gatherAmount;

                if (targetResource.amount <= 0) {
                  const depletedResourceId = gatherer.targetResourceId;
                  gatherer.targetResourceId = null;
                  if (depletedResourceId !== null) {
                    destroyResourceEntity(depletedResourceId);
                  }
                }

                if (targetResource.amount <= 0 || gatherer.carriedAmount >= gatherer.carryCapacity) {
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

          const dropOffId = findNearestDropOffBuilding(
            activeWorld,
            unit.owner,
            carriedResource,
            position,
          );
          gatherer.dropOffBuildingId = dropOffId;
          const dropOffPlan = dropOffId === null
            ? null
            : findBuildingApproachPlan(id, dropOffId, 1, activeWorld);

          if (!dropOffPlan) {
            setStuck(id, activeWorld.tick);
          } else if (isUnitAtTarget(id, dropOffPlan.destination, activeWorld)) {
            const stockpile = accessor.get(playerResourcesCodec).get(unit.owner);
            const aiState = accessor.get(aiStatesCodec).get(unit.owner);
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

        if (gatherer.task === 'idle' && shouldMaintainGatheringOrder(unit.owner, gatherer)) {
          assignNearestResource(activeWorld, id, gatherer, unit.owner, gatherTargetCounts, true, IDLE_ASSIGN_SPREAD_CAP);
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
