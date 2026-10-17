// Gatherer economy state machine — villagers on land, Fishing Ships on water
// (see `gathersResources`). Each idle gatherer routes to its owner's nearest
// matching resource; the gather loop accumulates the owner's gather-rate
// multiplier each tick toward the base per-cycle cadence (gather-rate techs
// speed it) and drops the carried resource at the nearest valid drop-off.
// Retries are throttled so a stuck gatherer does not re-plan every tick.

import { runDropOffStep } from './dropOffStep';
import { runToResourceStep } from './toResourceStep';
import { runGatheringStep } from './gatheringStep';
import { assignIdleGatherer } from '../idleGatherAssignment';
import type { Position } from 'civ-engine';
import type {
  GathererComponent,
  ResourceComponent,
  UnitComponent, EconomyResourceKind,
} from '../../types';
import { type GameWorld } from '../pureHelpers';
import { gathersResources } from '../../unitDomain';
import {
  assignNearestResource,
  type AssignmentOutcome,
  type AssignNearestResourceOptions,
  type GatherAssignmentDeps,
} from '../villagerGatherAssignment';
import { createEnemyDefenceLookup } from '../enemyDefenceRange';
import {
  type DropOffAssignmentDeps,
} from '../villagerDropOffAssignment';
import {
  carryOnFromUnworkable,
  isPlayerTaskedVillager,
  resumePlayerGatherOrder,
} from '../gatherCarryOn';
import {
  aiStatesCodec,
  gathererDropOffStuckSinceTickCodec,
  playerCivilizationsCodec,
  researchedTechnologiesCodec,
  unitCommandsCodec,
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
export const IDLE_ASSIGN_SPREAD_CAP = 4;

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
  // Shift-queued entity orders (v0.3.141). When the villager's EXPLICIT
  // target ENDS while a chain waits, the explicit-order flag drops so the
  // auto-rotate stands down; the watcher system (pinned to run before this
  // one) then fires the chain, with the post-maintain pops below as a
  // second line for same-pass idles.
  popQueuedEntityOrder: (unitId: number) => boolean;
  hasQueuedEntityOrders: (unitId: number) => boolean;
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
  /** The walk from every node to the owner's nearest drop-off of a kind —
   *  what gather assignment ranks by (dropOffWalkField.ts). */
  findDropOffWalkField: GatherAssignmentDeps['findDropOffWalkField'];
  ensurePlayerScoreCounters: (owner: number) => PlayerScoreCountersLike;
}

export function registerVillagerEconomySystem(deps: VillagerEconomySystemDeps): void {
  const {
    popQueuedEntityOrder,
    hasQueuedEntityOrders,
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
    findDropOffWalkField,
    ensurePlayerScoreCounters,
  } = deps;

  // The enemy's static defences, cached per tick: every assignment below keeps
  // its target out of their reach (§6.4, the 2026-09-02 register entry).
  const enemyStaticDefences = createEnemyDefenceLookup(accessor);
  const assignmentDeps: GatherAssignmentDeps = {
    isHarvestableResource,
    isLandCell,
    findNearestDropOffBuilding,
    findResourceApproachPlan,
    enemyStaticDefences,
    findDropOffWalkField,
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
  ): AssignmentOutcome {
    return assignNearestResource(
      assignmentDeps,
      activeWorld,
      villagerId,
      gatherer,
      owner,
      gatherTargetCounts,
      options,
    );
  }

  // The CLICKED target ending ends the explicit order when a shift-queued
  // chain waits (v0.3.141): the flag drops so same-type auto-rotate stands
  // down and the chain fires once the villager is idle. Called from EVERY
  // target-ended path — own-swing depletion, a co-gatherer landing the last
  // unit, and arrival at an already-dead target — because the critic proved
  // the single-site version lost the race whenever someone else swung last.
  function endExplicitOrderIfChained(id: number, gatherer: GathererComponent): void {
    if (hasQueuedEntityOrders(id)) {
      gatherer.hasExplicitGatherOrder = false;
    }
  }

  world.registerSystem({
    name: 'prototypeVillagerEconomy',
    phase: 'update',
    // prototypeQueuedEntityOrders MUST precede this system: the shift-chain
    // watcher fires a freshly-idled villager's next order before this pass's
    // maintain branch could re-rotate it (pinned v0.3.141 — it previously
    // held only by registration order).
    after: ['prototypePlayerCommands', 'prototypeQueuedEntityOrders'],
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
      const creditDeps = { accessor, aiStates, civilizations: playerCivilizations, ensurePlayerScoreCounters };

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

        // The human player's villager is re-tasked by the player alone: between
        // trips it goes back to its node, and the carry-on (gatherCarryOn.ts)
        // is all it does by itself. The computer's are re-tasked at once.
        const playerTasked = isPlayerTaskedVillager(unit.owner, unit.unitType, aiStates.has(unit.owner));
        const maintainIdle = (): void => {
          if (gatherer.task !== 'idle' || !shouldMaintainGatheringOrder(unit.owner, gatherer, aiStates.has(unit.owner))) {
            return;
          }
          if (playerTasked) {
            resumePlayerGatherOrder(
              assignmentDeps, activeWorld, id, unit.owner, gatherer, gatherTargetCounts, IDLE_ASSIGN_SPREAD_CAP,
            );
            return;
          }
          assignIdleGatherer(gatherer, (safeOnly) => (
            assignResource(activeWorld, id, gatherer, unit.owner, gatherTargetCounts, {
              preferUnsaturated: true,
              spreadCap: IDLE_ASSIGN_SPREAD_CAP,
              requireSafe: safeOnly,
            })
          ));
        };
        maintainIdle();
        if (gatherer.task === 'idle') {
          popQueuedEntityOrder(id);
        }

        if (gatherer.task === 'to-resource') {
          runToResourceStep({
            activeWorld,
            accessor,
            id,
            unit,
            gatherer,
            endExplicitOrderIfChained,
            gatherTargetCounts,
            findResourceApproachPlan,
            isHarvestableResource,
            isUnitAtTarget,
            moveUnitOneSubgridStep,
            assignResource,
            enemyStaticDefences,
            playerCarryOn: playerTasked
              ? (from, spreadCap) => carryOnFromUnworkable(assignmentDeps, activeWorld, id, unit.owner, gatherer, from, gatherTargetCounts, spreadCap)
              : null,
          });
        }

        if (gatherer.task === 'gathering' && runGatheringStep({
          activeWorld, accessor, id, unit, gatherer, playerTasked, gatherTargetCounts,
          spreadCap: IDLE_ASSIGN_SPREAD_CAP, researchedTechnologies, playerCivilizations, creditDeps,
          carryOnDeps: assignmentDeps, enemyStaticDefences, assignResource,
          findResourceApproachPlan, isHarvestableResource, isUnitAtTarget,
          destroyResourceEntity, endExplicitOrderIfChained, hasQueuedEntityOrders,
        }) === 'skip') {
          continue;
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
            findDropOffWalkField,
            isUnitAtTarget,
            moveUnitOneSubgridStep,
            ensurePlayerScoreCounters,
          });
          if (result === 'handled') continue;
        }

        // The SECOND idle-assign site: a villager that has just delivered its
        // load is idle again this same tick, and this is where its next trip
        // is chosen. It used to call `assignResource` bare, which skipped the
        // safe-first walk over the other kinds — so a gold villager whose only
        // remaining gold stood under the enemy Town Centre was handed it again
        // on every delivery. That was ALL NINE of the deaths still inside
        // enemy reach on the boot map at 45,000 ticks (t=38,793-39,191, every
        // one `desired=gold`, target a mine three cells from owner 1's Town
        // Centre). It takes the same walk as the first site now. The human
        // player's villager goes back to the node it carried the load from.
        maintainIdle();
        if (gatherer.task === 'idle') {
          popQueuedEntityOrder(id);
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
