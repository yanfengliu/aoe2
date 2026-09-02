// A villager already committed to a node under enemy arrows is re-assigned on
// its next decision (§6.4). "Already committed" happens three ways: the node
// was safe when it was assigned and a tower or Castle has since completed
// beside it; a save from before the rule; or a truce ended. The check costs a
// few footprint distances against the cached enemy-defence list, and the
// re-assignment only runs when the check says danger, on the same staggered
// cadence the reachability probe uses — so eighty villagers walking safely
// pay almost nothing, and one walking into arrows turns around within a
// second of game time.
//
// A player's EXPLICIT gather order is never overridden: the player chose that
// node, and AoE2 obeys a right-click.

import type { Position } from 'civ-engine';
import type { GathererComponent } from '../types';
import { shouldRetryReachability } from './idleGatherAssignment';
import { isInsideDefenceReach, type StaticDefenceView } from './enemyDefenceRange';
import type { GameWorld } from './pureHelpers';
import type { AssignNearestResourceOptions, AssignmentOutcome } from './villagerGatherAssignment';

export interface RetargetOutOfEnemyDefenceArgs {
  activeWorld: GameWorld;
  id: number;
  owner: number;
  gatherer: GathererComponent;
  gatherTargetCounts: Map<number, number>;
  /** Where the current target stands. */
  targetPosition: Position;
  enemyDefences: readonly StaticDefenceView[];
  spreadCap: number;
  assignResource: (
    activeWorld: GameWorld,
    villagerId: number,
    gatherer: GathererComponent,
    owner: number,
    gatherTargetCounts: Map<number, number>,
    options: AssignNearestResourceOptions,
  ) => AssignmentOutcome;
}

/**
 * Moves an automatically-assigned gatherer off a target under enemy static
 * defences, onto a SAFE node of the same kind, when one exists. Returns true
 * when the gatherer now holds a new target; false leaves it exactly as it was
 * — including when the dangerous node is the only one of its kind, which is
 * the exception the rule grants, and which must not become an idle/assign
 * oscillation that never gathers.
 */
export function retargetOutOfEnemyDefence(args: RetargetOutOfEnemyDefenceArgs): boolean {
  const { activeWorld, id, owner, gatherer, gatherTargetCounts, targetPosition } = args;
  if (gatherer.hasExplicitGatherOrder) return false;
  if (args.enemyDefences.length === 0) return false;
  if (!shouldRetryReachability(activeWorld.tick, id)) return false;
  if (!isInsideDefenceReach(targetPosition, args.enemyDefences)) return false;

  const previousTarget = gatherer.targetResourceId;
  const previousTask = gatherer.task;
  const previousProgress = gatherer.gatherProgressTicks;
  // Release the slot first so the count stays honest for the ranking; it is
  // put back if nothing safe turns up.
  if (previousTarget !== null) {
    gatherTargetCounts.set(
      previousTarget,
      Math.max(0, (gatherTargetCounts.get(previousTarget) ?? 1) - 1),
    );
  }
  const outcome = args.assignResource(activeWorld, id, gatherer, owner, gatherTargetCounts, {
    preferUnsaturated: true,
    spreadCap: args.spreadCap,
    requireSafe: true,
  });
  if (outcome === 'assigned') return true;

  gatherer.task = previousTask;
  gatherer.targetResourceId = previousTarget;
  gatherer.gatherProgressTicks = previousProgress;
  if (previousTarget !== null) {
    gatherTargetCounts.set(previousTarget, (gatherTargetCounts.get(previousTarget) ?? 0) + 1);
  }
  return false;
}
