// The `to-resource` leg of the gatherer state machine, extracted from
// villagerEconomySystem to keep that file inside the 500-line budget. It owns
// every way a walk to a resource can end: the target went away, the target
// cannot be reached, the villager arrived, or it takes one more step.

import type { Position } from 'civ-engine';

import type {
  GathererComponent,
  ResourceComponent,
  UnitComponent,
} from '../../types';
import type { GameWorld } from '../pureHelpers';
import type { UnitMovementPlan } from '../movementTypes';
import type { AssignNearestResourceOptions } from '../villagerGatherAssignment';
import { assignIdleGatherer, shouldRetryReachability } from '../idleGatherAssignment';
import { gatherApproachBudgetTicks } from './gatherApproachBudget';
import { sheepMoveOrdersCodec } from '../bridgeStateSerialize';

// Wood/gather gridlock fix (campaign-4): villagers piled onto ONE nearest tree
// (14/18 stuck) and to-resource had no give-up path, jamming forever. Fix: a
// villager stuck walking to an OVER-SUBSCRIBED resource for
// GATHER_APPROACH_TIMEOUT_TICKS reassigns to the nearest UNsaturated resource
// (fan-out). Surgical — normal idle→assign stays nearest-first (AI economy
// untouched); the approach timer reuses gatherProgressTicks (no new save state).
export const MAX_GATHERERS_PER_RESOURCE = 2;
// The fan-out budget is TRAVEL, not a tick count — see gatherApproachBudget.
// A flat 80 ticks was ~40 tiles under the old movement clock and is 6.4 tiles
// under §12.4.2, which made a villager abandon a 7-tile target just before
// arriving, forever.
// The over-subscription timeout above only rescues a villager that is queueing
// behind others. A villager walking ALONE to a target it never reaches waited
// forever, because "a long walk to an uncontended resource is NOT abandoned"
// was written for a legitimately distant tree — and a blocked one looks exactly
// the same from here. Measured on the default map: the AI's whole economy froze
// at around tick 6000 with every villager holding a target it never arrived at,
// several of them marching forty cells toward the OTHER player's berries.
//
// This is the unconditional backstop. It is much longer than the fan-out
// timeout, so a genuinely long walk finishes first, and it reassigns with
// `requireReachable` while EXCLUDING the target it gave up on — which is the
// machinery that already existed and was only ever reachable through the
// over-subscription branch.
const GATHER_UNREACHABLE_TIMEOUT_TICKS = 600;

export interface ToResourceStepDeps {
  /** v0.3.141: drops the explicit-gather flag when a shift-queued chain
   *  waits and the walked-to target turns out to be dead (a co-gatherer
   *  landed the last swing while this villager was still walking). */
  endExplicitOrderIfChained: (id: number, gatherer: GathererComponent) => void;
  activeWorld: GameWorld;
  accessor: import('../bridgeStateAccessor').BridgeStateAccessor;
  id: number;
  unit: UnitComponent;
  gatherer: GathererComponent;
  gatherTargetCounts: Map<number, number>;
  findResourceApproachPlan: (
    villagerId: number,
    resourceId: number,
    activeWorld: GameWorld,
  ) => UnitMovementPlan | null;
  isHarvestableResource: (id: number, resource: ResourceComponent) => boolean;
  isUnitAtTarget: (unitId: number, target: Position, activeWorld: GameWorld) => boolean;
  moveUnitOneSubgridStep: (
    entityId: number,
    nextStep: Position,
    activeWorld?: GameWorld,
    stepPerTick?: number,
  ) => void;
  assignResource: (
    activeWorld: GameWorld,
    villagerId: number,
    gatherer: GathererComponent,
    owner: number,
    gatherTargetCounts: Map<number, number>,
    options: AssignNearestResourceOptions,
  ) => void;
}

/** Advances one gatherer that is walking to its resource. */
/** The fan-out budget for THIS villager's current walk, in ticks. */
function approachBudgetFor(activeWorld: GameWorld, villagerId: number, destination: Position): number {
  const here = activeWorld.getComponent<Position>(villagerId, 'position');
  const distance = here ? Math.hypot(destination.x - here.x, destination.y - here.y) : 0;
  return gatherApproachBudgetTicks(distance);
}

export function runToResourceStep(deps: ToResourceStepDeps): void {
  const {
    activeWorld,
    accessor,
    id,
    unit,
    gatherer,
    gatherTargetCounts,
    findResourceApproachPlan,
    isHarvestableResource,
    endExplicitOrderIfChained,
    isUnitAtTarget,
    moveUnitOneSubgridStep,
    assignResource,
  } = deps;
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
          endExplicitOrderIfChained(id, gatherer);
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
            if (shouldRetryReachability(activeWorld.tick, id)) {
              // Fall through to another KIND when nothing of this one can be
              // reached. Without that, a villager whose only food is
              // unreachable was left idle here and the idle→assign at the top
              // of the loop — which does not check reachability — handed the
              // same resource straight back next tick: six of the AI's
              // villagers held one marooned sheep for the last thirteen
              // thousand ticks of a 30000-tick match while its wood sat at
              // nineteen. The kind fallback is the same one an idle gatherer
              // already uses, and it runs on the staggered probe tick only,
              // so the bounded pathfinding cost is unchanged.
              assignIdleGatherer(gatherer, () => {
                assignResource(activeWorld, id, gatherer, unit.owner, gatherTargetCounts, {
                  preferUnsaturated: true,
                  spreadCap: MAX_GATHERERS_PER_RESOURCE,
                  requireReachable: true,
                  excludeResourceId: unreachableTarget,
                });
              });
            }
          }
        } else if (isUnitAtTarget(id, resourceApproachPlan.destination, activeWorld)) {
          gatherer.task = 'gathering';
          gatherer.gatherProgressTicks = 0;
          // v0.3.113: raise a component diff for the transition — the unit is
          // STATIONARY from here, so without it the projector never re-reads
          // `activeVerb` and the work swing stays invisible. (Leaving
          // 'gathering' needs no mark: the unit moves, and movement diffs
          // reproject every tick.)
          activeWorld.setComponent(id, 'gatherer', gatherer);
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
          const givenUp =
            gatherer.gatherProgressTicks >= GATHER_UNREACHABLE_TIMEOUT_TICKS;
          if (givenUp) {
            // Give up on THIS target and take the nearest one we can prove a
            // path to. Excluding the old target is what stops it being picked
            // straight back.
            const abandoned = gatherer.targetResourceId;
            if (abandoned !== null) {
              gatherTargetCounts.set(
                abandoned,
                Math.max(0, (gatherTargetCounts.get(abandoned) ?? 1) - 1),
              );
            }
            gatherer.gatherProgressTicks = 0;
            assignResource(activeWorld, id, gatherer, unit.owner, gatherTargetCounts, {
              preferUnsaturated: true,
              spreadCap: MAX_GATHERERS_PER_RESOURCE,
              requireReachable: true,
              excludeResourceId: abandoned,
            });
          } else if (
            overSubscribed
            && gatherer.gatherProgressTicks >= approachBudgetFor(
              activeWorld, id, resourceApproachPlan.destination,
            )
          ) {
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
