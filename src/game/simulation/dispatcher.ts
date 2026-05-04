// AI intention dispatcher (DESIGN v17 §6.5).
//
// civ-engine's determinism contract forbids systems calling
// `world.submitWithResult` during their `execute` phase — submissions made
// mid-tick record `submissionTick = K-1` but execute at the start of step
// K+1, while `openAt` re-applies them at iter `t = K-1` BEFORE step,
// causing a one-step offset between live and replay.
//
// Pattern: AI-decision systems push intentions to `pendingCommands` during
// their `execute` phase. Before the next `world.step()` call, the main game
// loop calls `drainPendingCommands(world, queue)` BETWEEN ticks. The recorder
// captures these submissions with `submissionTick = K` (the post-previous-step
// world.tick); they process at start of step K+1. Replay re-applies recorded
// commands at the same boundary.

import type { GameCommands } from './commands';
import type { GameWorld } from './bridge/pureHelpers';

// One intention = a deferred submitWithResult call. AI systems push to the
// queue during their execute phase; the dispatcher drains between ticks.
// Heterogeneous-typed array: each entry carries its own command type +
// matching payload via the GameCommands key map.
export type PendingCommand = {
  [K in keyof GameCommands]: { type: K; data: GameCommands[K] };
}[keyof GameCommands];

export type PendingCommandsQueue = PendingCommand[];

export function createPendingCommandsQueue(): PendingCommandsQueue {
  return [];
}

export function clonePendingCommand(command: PendingCommand): PendingCommand {
  return { type: command.type, data: structuredClone(command.data) } as PendingCommand;
}

/** Drains all pending intentions and submits each to the world. Called before
 *  each `world.step()` in the main game loop. Returns the number of commands
 *  submitted (useful for tests). */
export function drainPendingCommands(
  world: GameWorld,
  queue: PendingCommandsQueue,
): number {
  if (queue.length === 0) return 0;
  let count = 0;
  for (const cmd of queue) {
    world.submitWithResult(cmd.type, cmd.data);
    count += 1;
  }
  queue.length = 0;
  return count;
}
