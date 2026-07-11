import { describe, it, expect } from 'vitest';
import { runLlmPlaytest } from '../../src/game/playtest/llmRunner';
import { LlmAgent } from '../../src/game/playtest/llmAgent';
import { MockProvider } from '../../src/game/playtest/llmProviders';
import {
  MIN_BUNDLE,
  PausingStubHost,
  STRATEGY_OK,
  StubHost,
  TACTICAL_OK_NO_COMMANDS,
  TACTICAL_OK_ONE_COMMAND,
  makeAgent,
} from './llmRunnerTestKit';

describe('runLlmPlaytest', () => {
  it('runs maxTicks worth of decisions and returns a bundle', async () => {
    const host = new StubHost(MIN_BUNDLE);
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
        { content: TACTICAL_OK_NO_COMMANDS },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 750,
        decisionIntervalTicks: 250,
        screenshotEnabled: true,
      },
    });
    expect(result.bundle).toBe(MIN_BUNDLE);
    expect(result.trace).toHaveLength(3);
    expect(result.envelope.ticksRun).toBe(750);
    expect(result.envelope.decisionsRun).toBe(3);
    expect(result.envelope.stopReason).toBe('maxTicks');
    expect(host.advanceCalls).toEqual([250, 250, 250]);
  });

  it('dispatches each command emitted by the agent', async () => {
    const host = new StubHost(MIN_BUNDLE);
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_ONE_COMMAND },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(host.dispatchedCommands).toEqual([
      { type: 'queue.train', data: { buildingId: 7, unitType: 'villager' } },
    ]);
    expect(result.trace[0]!.dispatchResults).toHaveLength(1);
    expect(result.trace[0]!.dispatchResults[0]!.accepted).toBe(true);
  });

  it('captures screenshots only when screenshotEnabled is true', async () => {
    const host = new StubHost(MIN_BUNDLE);
    let screenshotCalls = 0;
    host.captureScreenshot = async () => {
      screenshotCalls += 1;
      return new Uint8Array(4);
    };
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(screenshotCalls).toBe(0);
  });

  it('halts on cost-budget-exceeded with stopReason=costBudget + errorMessage', async () => {
    const host = new StubHost(MIN_BUNDLE);
    const provider = new MockProvider({
      responses: [
        // First decide: strategy + tactical, both expensive
        { content: STRATEGY_OK, tokensIn: 1_000_000, tokensOut: 1_000_000 },
        { content: TACTICAL_OK_NO_COMMANDS, tokensIn: 1_000_000, tokensOut: 1_000_000 },
        // Subsequent decide() returns cost-budget-exceeded
      ],
    });
    const agent = new LlmAgent({
      provider,
      ownerId: 2,
      strategyModel: 'claude-opus-4-7',
      tacticalModel: 'claude-sonnet-4-6',
      strategyEveryNDecisions: 100,
      maxOutputTokensTactical: 1024,
      maxOutputTokensStrategy: 2048,
      costBudgetUsd: 5.0,
      maxImageBytes: 1_048_576,
      historyWindow: 5,
    });
    const result = await runLlmPlaytest({
      host,
      agent,
      config: {
        ownerId: 2,
        maxTicks: 1000,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    // M13-#7: budget death reports honestly as 'costBudget' (was laundered into
    // 'stopWhen', which the match-completes oracle read as a clean completion).
    expect(result.envelope.stopReason).toBe('costBudget');
    expect(result.envelope.errorMessage).toBe('cost-budget-exceeded');
    expect(result.envelope.ticksRun).toBeLessThan(1000);
    // After impl-2 fix: the within-call cost guard bails after the
    // strategy call alone exceeds budget. The runner sees stopReason=
    // cost-budget-exceeded on the first decide() and breaks — exactly
    // one trace entry rather than the previous 2+.
    expect(result.trace.length).toBe(1);
  });

  it('halts (engineHalt) when the sim does not advance — silent no-op advanceTicks (full-review M13-#2)', async () => {
    const host = new StubHost(MIN_BUNDLE);
    // Frozen page: advanceTicks does NOT throw, but the tick never moves.
    // Pre-fix, ticksRun still climbed to maxTicks and false-greened the run.
    host.advanceTicks = async () => {};
    const provider = new MockProvider({
      responses: [{ content: STRATEGY_OK }, { content: TACTICAL_OK_ONE_COMMAND }],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: { ownerId: 2, maxTicks: 1000, decisionIntervalTicks: 250, screenshotEnabled: false },
    });
    expect(result.envelope.stopReason).toBe('engineHalt');
    expect(result.envelope.ticksRun).toBeLessThan(1000);
    expect(result.envelope.errorMessage).toMatch(/did not advance/);
  });

  it('halts on host error with stopReason=engineHalt', async () => {
    const host = new StubHost(MIN_BUNDLE);
    host.failOn = 'snapshotForAgent';
    const provider = new MockProvider({ responses: [] });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(result.envelope.stopReason).toBe('engineHalt');
    expect(result.envelope.errorMessage).toContain('snapshot failed');
    expect(result.envelope.ticksRun).toBe(0);
  });

  it('drains agent dispatch log per decision', async () => {
    const host = new StubHost(MIN_BUNDLE);
    host.dispatchEvents = [
      [{ commandType: 'queue.train', accepted: false, rejectionReason: 'no-such-building' }],
    ];
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_ONE_COMMAND },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(result.trace[0]!.dispatchEvents).toEqual([
      { commandType: 'queue.train', accepted: false, rejectionReason: 'no-such-building' },
    ]);
  });

  it('clamps the last advance to remaining ticks', async () => {
    const host = new StubHost(MIN_BUNDLE);
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 350,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(host.advanceCalls).toEqual([250, 100]); // second call clamped
  });

  it('preserves envelope when both run AND export fail (impl-345 M1)', async () => {
    const host = new StubHost(MIN_BUNDLE);
    host.failOn = 'snapshotForAgent';
    host.exportBundle = async () => {
      throw new Error('export blew up too');
    };
    const provider = new MockProvider({ responses: [] });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(result.envelope.stopReason).toBe('engineHalt');
    // Original error preserved, with export failure appended for diagnostic.
    expect(result.envelope.errorMessage).toContain('snapshot failed');
    expect(result.envelope.errorMessage).toContain('export-bundle also failed');
    // A bundle stub is still returned so downstream serialization works.
    expect(result.bundle).toBeDefined();
  });

  it('synthesizes a bundle stub when only export fails (no prior error)', async () => {
    const host = new StubHost(MIN_BUNDLE);
    host.exportBundle = async () => {
      throw new Error('only export blew up');
    };
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(result.envelope.stopReason).toBe('engineHalt');
    expect(result.envelope.errorMessage).toContain('only export blew up');
    expect(result.bundle).toBeDefined();
  });

  it('fires onDecision callback per decision (for trace streaming)', async () => {
    const host = new StubHost(MIN_BUNDLE);
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const captured: number[] = [];
    await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 500,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
        onDecision: (entry) => captured.push(entry.decisionIndex),
      },
    });
    expect(captured).toEqual([0, 1]);
  });
});

// playtest-fixes C: with a pausing host, the sim is frozen before the
// first decision and advanceTicks is the only tick source — the
// 2026-06-09 run drifted to bridge tick 5413 on a maxTicks-2000 run
// because the page free-ran during ~60-100s claude calls.
describe('runLlmPlaytest — paused-sim decisions (playtest-fixes C)', () => {
  it('pauses exactly once after boot, before the first snapshot', async () => {
    const host = new PausingStubHost(MIN_BUNDLE);
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 500,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    const pauseCalls = host.callLog.filter((c) => c === 'setPaused:true');
    expect(pauseCalls).toHaveLength(1);
    expect(host.callLog.indexOf('setPaused:true')).toBeGreaterThan(host.callLog.indexOf('waitForBoot'));
    expect(host.callLog.indexOf('setPaused:true')).toBeLessThan(host.callLog.indexOf('snapshot'));
    expect(host.paused).toBe(true);
  });

  it('completes normally on hosts without setPaused (legacy free-run contract)', async () => {
    const host = new StubHost(MIN_BUNDLE);
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(result.envelope.stopReason).toBe('maxTicks');
    expect(host.callLog).not.toContain('setPaused:true');
  });
});

// playtest-fixes B: drained dispatch verdicts must reach the agent so
// the NEXT tactical prompt shows what the previous commands actually
// did (rejections were previously trace-only).
describe('runLlmPlaytest — dispatch outcome reporting (playtest-fixes B)', () => {
  it('reports drained dispatch events to the agent; the next tactical prompt carries them', async () => {
    const host = new StubHost(MIN_BUNDLE);
    host.dispatchEvents = [
      [
        {
          commandType: 'queue.train',
          accepted: false,
          rejectionReason: 'not_a_building',
          rejectionMessage: 'Entity is not a building.',
        },
      ],
      [],
    ];
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_ONE_COMMAND },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 500,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    // Calls: [0] strategy, [1] tactical #1, [2] tactical #2. The
    // second tactical prompt must carry decision #1's engine verdicts.
    const lastCall = provider.receivedCalls[provider.receivedCalls.length - 1]!;
    const textBlock = lastCall.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text block');
    expect(textBlock.text).toContain('not_a_building');
    expect(textBlock.text).toContain('REJECTED');
  });
});

// playtest-fixes iter-2 (Codex MED 1): host-level pre-queue rejections
// (not-owned, malformed-payload) must reach the agent's feedback loop —
// they never enter the engine queue, so the drained events alone would
// report an all-rejected decision as "0 accepted, 0 rejected".
describe('runLlmPlaytest — pre-queue rejection feedback (playtest-fixes iter-2)', () => {
  it('merges host dispatch rejections into the reported outcome', async () => {
    const host = new StubHost(MIN_BUNDLE);
    host.dispatchCommand = async (cmd) => ({
      accepted: false,
      reason: 'not-owned',
      details: `${cmd.type} actor is enemy-owned`,
    });
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_ONE_COMMAND },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 500,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    const lastCall = provider.receivedCalls[provider.receivedCalls.length - 1]!;
    const textBlock = lastCall.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text block');
    expect(textBlock.text).toContain('not-owned');
    expect(textBlock.text).toContain('REJECTED');
    expect(textBlock.text).toContain('0 accepted, 1 rejected');
  });
});
