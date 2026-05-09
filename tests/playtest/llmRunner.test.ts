import { describe, it, expect } from 'vitest';
import type { SessionBundle } from 'civ-engine';
import {
  runLlmPlaytest,
  type AgentDispatchEvent,
  type RunnerHost,
} from '../../src/game/playtest/llmRunner';
import { LlmAgent } from '../../src/game/playtest/llmAgent';
import { MockProvider } from '../../src/game/playtest/llmProviders';
import type {
  AgentDecisionCommand,
  AgentStateSnapshot,
  CommandDispatchResult,
  LlmContentBlock,
} from '../../src/game/playtest/types';

const STRATEGY_OK: LlmContentBlock[] = [
  {
    type: 'tool_use',
    toolName: 'set_strategy',
    toolInput: {
      strategy: 'plan',
      targetAge: 'feudal-age',
      targetUnitMix: 'scouts',
    },
  },
];

const TACTICAL_OK_NO_COMMANDS: LlmContentBlock[] = [{ type: 'text', text: 'thinking' }];

const TACTICAL_OK_ONE_COMMAND: LlmContentBlock[] = [
  { type: 'text', text: 'queueing villager' },
  {
    type: 'tool_use',
    toolName: 'queue_train',
    toolInput: { buildingId: 7, unitType: 'villager' },
  },
];

class StubHost implements RunnerHost {
  tickCounter = 0;
  dispatchedCommands: AgentDecisionCommand[] = [];
  advanceCalls: number[] = [];
  dispatchEvents: AgentDispatchEvent[][] = []; // one batch per drain call
  bundle: SessionBundle;
  bootResolved = false;
  failOn: keyof RunnerHost | null = null;

  constructor(bundle: SessionBundle) {
    this.bundle = bundle;
  }

  async waitForBoot(): Promise<void> {
    if (this.failOn === 'waitForBoot') throw new Error('boot failed');
    this.bootResolved = true;
  }
  async getCurrentTick(): Promise<number> {
    return this.tickCounter;
  }
  async snapshotForAgent(ownerId: number): Promise<AgentStateSnapshot> {
    if (this.failOn === 'snapshotForAgent') throw new Error('snapshot failed');
    void ownerId;
    return {
      tick: this.tickCounter,
      elapsedMmSs: '00:00',
      perPlayer: [],
      selection: [],
      enemies: [],
      queuedProduction: [],
      screenMapping: {
        worldBbox: { minX: 0, minY: 0, maxX: 16, maxY: 16 },
        pixelBbox: { x: 0, y: 0, width: 800, height: 600 },
        worldToScreen: [],
      },
    };
  }
  async captureScreenshot(): Promise<Uint8Array | undefined> {
    return new Uint8Array([1, 2, 3, 4]);
  }
  async dispatchCommand(cmd: AgentDecisionCommand): Promise<CommandDispatchResult> {
    if (this.failOn === 'dispatchCommand') throw new Error('dispatch failed');
    this.dispatchedCommands.push(cmd);
    return { accepted: true, commandKind: cmd.type, normalized: cmd.data };
  }
  async advanceTicks(count: number): Promise<void> {
    this.advanceCalls.push(count);
    this.tickCounter += count;
  }
  async drainDispatchLog(): Promise<AgentDispatchEvent[]> {
    return this.dispatchEvents.shift() ?? [];
  }
  async exportBundle(): Promise<SessionBundle> {
    return this.bundle;
  }
}

const MIN_BUNDLE = {
  schemaVersion: 1,
  metadata: {},
  initialSnapshot: {},
  ticks: [],
  commands: [],
  executions: [],
  failures: [],
  markers: [],
  attachments: [],
  snapshots: [],
} as unknown as SessionBundle;

function makeAgent(provider: MockProvider) {
  return new LlmAgent({
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
}

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

  it('halts on cost-budget-exceeded with stopReason=stopWhen + errorMessage', async () => {
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
    expect(result.envelope.stopReason).toBe('stopWhen');
    expect(result.envelope.errorMessage).toBe('cost-budget-exceeded');
    expect(result.envelope.ticksRun).toBeLessThan(1000);
    // After impl-2 fix: the within-call cost guard bails after the
    // strategy call alone exceeds budget. The runner sees stopReason=
    // cost-budget-exceeded on the first decide() and breaks — exactly
    // one trace entry rather than the previous 2+.
    expect(result.trace.length).toBe(1);
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
