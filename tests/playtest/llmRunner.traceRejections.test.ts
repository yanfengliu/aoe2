// Conformance-capture iter-1 (Gemini): host-level pre-queue rejections
// (not-owned / malformed-payload / unknown-kind) never reach the engine
// drain, so they must be merged into the trace entry's dispatchEvents —
// otherwise the conformance metrics + digest never see them, and
// `unknown-kind` (the primary "this command/feature is unimplemented"
// signal) is invisible.

import { describe, expect, it } from 'vitest';

import { runLlmPlaytest } from '../../src/game/playtest/llmRunner';
import { MockProvider } from '../../src/game/playtest/llmProviders';
import {
  makeAgent,
  MIN_BUNDLE,
  STRATEGY_OK,
  StubHost,
  TACTICAL_OK_ONE_COMMAND,
} from './llmRunnerTestKit';
import type {
  AgentDecisionCommand,
  CommandDispatchResult,
} from '../../src/game/playtest/types';

// Rejects every command at the HOST level (pre-queue) as if the command
// kind is unimplemented; the engine drain (drainDispatchLog) stays empty.
class UnknownKindHost extends StubHost {
  async dispatchCommand(cmd: AgentDecisionCommand): Promise<CommandDispatchResult> {
    this.dispatchedCommands.push(cmd);
    return { accepted: false, reason: 'unknown-kind', details: `no handler for ${cmd.type}` };
  }
}

const CONFIG = {
  ownerId: 2,
  maxTicks: 250,
  decisionIntervalTicks: 250,
  screenshotEnabled: false,
} as never;

describe('runLlmPlaytest — host-level rejections reach the trace', () => {
  it('merges pre-queue unknown-kind rejections into the trace entry dispatchEvents', async () => {
    // Decision 0 refreshes strategy (decisionIndex % strategyEvery === 0)
    // then issues one tactical command, which the host rejects pre-queue.
    const provider = new MockProvider({
      responses: [{ content: STRATEGY_OK }, { content: TACTICAL_OK_ONE_COMMAND }],
    });
    const host = new UnknownKindHost(MIN_BUNDLE);
    const { trace } = await runLlmPlaytest({ host, agent: makeAgent(provider), config: CONFIG });

    expect(trace).toHaveLength(1);
    const events = trace[0]!.dispatchEvents;
    // Engine drain was empty, but the unknown-kind host rejection must be
    // present — this is the signal conformance capture is built to surface.
    expect(events.some((e) => !e.accepted && e.rejectionReason === 'unknown-kind')).toBe(true);
  });
});
