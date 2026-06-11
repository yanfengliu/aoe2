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
  // `agentIssued` (playtest-fixes iter-1, Codex MED): runtime-only tag
  // set by `dispatchAgentCommand` so the dispatch observer can scope
  // the LLM agent's feedback log to its own submissions — AI /
  // auto-aggression intentions share this queue. Intentionally dropped
  // by `clonePendingCommand`, so it never reaches snapshots or saves.
  [K in keyof GameCommands]: { type: K; data: GameCommands[K]; agentIssued?: boolean };
}[keyof GameCommands];

export type PendingCommandsQueue = PendingCommand[];

export function createPendingCommandsQueue(): PendingCommandsQueue {
  return [];
}

export function clonePendingCommand(command: PendingCommand): PendingCommand {
  return { type: command.type, data: structuredClone(command.data) } as PendingCommand;
}

// LLM-agent harness (Phase 1 impl-1 H1): the existing
// `bridge.consumeCommandRejection()` is a shared FIFO already drained by the
// HUD render loop, and capped at 8 entries — incompatible with the agent
// runner that needs to correlate dispatched commands with downstream
// rejections. The agent's runner pushes a sink callback before each tick;
// drainPendingCommands forwards each command's CommandSubmissionResult into
// the sink. Sink is callback-shaped (not a global queue) so it composes
// cleanly with the per-runner trace logger and survives bridge swaps.
export type AgentDispatchObserver = (event: AgentDispatchEvent) => void;

export interface AgentDispatchEvent {
  commandType: keyof GameCommands;
  accepted: boolean;
  rejectionReason?: string;
  rejectionMessage?: string;
  // True only for commands pushed via dispatchAgentCommand. Consumers
  // building the agent's feedback loop must filter on this.
  agentIssued?: boolean;
}

/** Drains all pending intentions and submits each to the world. Called before
 *  each `world.step()` in the main game loop. Returns the number of commands
 *  submitted (useful for tests). The optional `observer` is invoked once per
 *  drained command with the world's CommandSubmissionResult — used by the
 *  LLM-agent runner to correlate dispatched commands with semantic
 *  rejections without competing with the HUD's consumeCommandRejection
 *  buffer. */
export function drainPendingCommands(
  world: GameWorld,
  queue: PendingCommandsQueue,
  observer?: AgentDispatchObserver,
): number {
  if (queue.length === 0) return 0;
  let count = 0;
  for (const cmd of queue) {
    const result = world.submitWithResult(cmd.type, cmd.data);
    if (observer) {
      observer({
        commandType: cmd.type,
        accepted: result.accepted,
        rejectionReason: result.accepted ? undefined : result.code,
        rejectionMessage: result.accepted ? undefined : result.message,
        agentIssued: cmd.agentIssued === true,
      });
    }
    count += 1;
  }
  queue.length = 0;
  return count;
}
