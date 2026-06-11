import { describe, it, expect, vi } from 'vitest';
import { LlmAgent } from '../../src/game/playtest/llmAgent';
import { MockProvider } from '../../src/game/playtest/llmProviders';
import type { AgentStateSnapshot, LlmContentBlock } from '../../src/game/playtest/types';

function makeSnapshot(tick = 0): AgentStateSnapshot {
  return {
    tick,
    elapsedMmSs: '00:00',
    perPlayer: [],
    selection: [],
    ownUnits: [],
    ownBuildings: [],
    nearbyResources: [],
    enemies: [],
    queuedProduction: [],
    screenMapping: {
      worldBbox: { minX: 0, minY: 0, maxX: 16, maxY: 16 },
      pixelBbox: { x: 0, y: 0, width: 800, height: 600 },
      worldToScreen: [],
    },
  };
}

const TACTICAL_OK: LlmContentBlock[] = [
  { type: 'text', text: 'Building a house and queueing a villager.' },
  {
    type: 'tool_use',
    toolName: 'building_placeConfirm',
    toolInput: {
      builderId: 5,
      buildingType: 'house',
      position: { x: 10, y: 10 },
    },
  },
  {
    type: 'tool_use',
    toolName: 'queue_train',
    toolInput: { buildingId: 7, unitType: 'villager' },
  },
];

const STRATEGY_OK: LlmContentBlock[] = [
  {
    type: 'tool_use',
    toolName: 'set_strategy',
    toolInput: {
      strategy: 'Boom to feudal then add scouts.',
      targetAge: 'feudal-age',
      targetUnitMix: 'scouts, archers',
    },
  },
];

function makeAgent(provider: MockProvider) {
  return new LlmAgent({
    provider,
    ownerId: 2,
    strategyModel: 'claude-opus-4-7',
    tacticalModel: 'claude-sonnet-4-6',
    strategyEveryNDecisions: 3,
    maxOutputTokensTactical: 1024,
    maxOutputTokensStrategy: 2048,
    costBudgetUsd: 5.0,
    maxImageBytes: 1_048_576,
    historyWindow: 5,
  });
}

describe('LlmAgent.decide — happy path', () => {
  it('first call refreshes strategy + emits tactical commands', async () => {
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK, tokensIn: 100, tokensOut: 50 },
        { content: TACTICAL_OK, tokensIn: 200, tokensOut: 80 },
      ],
    });
    const agent = makeAgent(provider);
    const decision = await agent.decide(makeSnapshot(0), undefined);

    expect(decision.stopReason).toBe('normal');
    expect(decision.strategyRefresh).toBeDefined();
    expect(decision.strategyRefresh!.targetAge).toBe('feudal-age');
    expect(decision.commands).toHaveLength(2);
    expect(decision.commands[0]).toEqual({
      type: 'building.placeConfirm',
      data: { builderId: 5, buildingType: 'house', position: { x: 10, y: 10 } },
    });
    expect(decision.commands[1]).toEqual({
      type: 'queue.train',
      data: { buildingId: 7, unitType: 'villager' },
    });
    expect(provider.receivedCalls).toHaveLength(2);
    // First call is strategy (Opus model); second is tactical (Sonnet).
    expect(provider.receivedCalls[0]!.model).toBe('claude-opus-4-7');
    expect(provider.receivedCalls[1]!.model).toBe('claude-sonnet-4-6');
  });

  it('subsequent calls within strategyEveryNDecisions only call tactical', async () => {
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK },
        { content: TACTICAL_OK },
        { content: TACTICAL_OK },
      ],
    });
    const agent = makeAgent(provider);
    await agent.decide(makeSnapshot(0), undefined); // strategy + tactical
    await agent.decide(makeSnapshot(250), undefined); // tactical only
    await agent.decide(makeSnapshot(500), undefined); // tactical only
    expect(provider.receivedCalls).toHaveLength(4); // 1 strategy + 3 tactical
  });

  it('strategy refreshes again after strategyEveryNDecisions calls', async () => {
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK },
        { content: TACTICAL_OK },
        { content: TACTICAL_OK },
        { content: STRATEGY_OK }, // refresh fires before the 4th tactical (decisionsSinceStrategyRefresh = 3)
        { content: TACTICAL_OK },
      ],
    });
    const agent = makeAgent(provider);
    await agent.decide(makeSnapshot(0), undefined);
    await agent.decide(makeSnapshot(250), undefined);
    await agent.decide(makeSnapshot(500), undefined);
    const refreshed = await agent.decide(makeSnapshot(750), undefined);
    expect(refreshed.strategyRefresh).toBeDefined();
  });

  it('caches strategy across tactical calls', async () => {
    const provider = new MockProvider({
      responses: [{ content: STRATEGY_OK }, { content: TACTICAL_OK }, { content: TACTICAL_OK }],
    });
    const agent = makeAgent(provider);
    await agent.decide(makeSnapshot(0), undefined);
    expect(agent.strategy).toContain('Boom to feudal');
    await agent.decide(makeSnapshot(250), undefined);
    expect(agent.strategy).toContain('Boom to feudal'); // unchanged
  });

  it('tracks rolling cost', async () => {
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK, tokensIn: 1000, tokensOut: 500 },
        { content: TACTICAL_OK, tokensIn: 1000, tokensOut: 500 },
      ],
    });
    const agent = makeAgent(provider);
    await agent.decide(makeSnapshot(0), undefined);
    // Opus 4.7: $5/Mtok in × 1k = $0.005 + $25/Mtok out × 500 = $0.0125 → $0.0175
    // Sonnet: $3/Mtok in × 1k = $0.003 + $15/Mtok out × 500 = $0.0075 → $0.0105
    // Total: ~$0.028 (table corrected 2026-06-09 to published 4.7 pricing)
    expect(agent.cumulativeCostUsd).toBeCloseTo(0.028, 4);
  });
});

describe('LlmAgent.decide — guards', () => {
  it('stops decision loop with cost-budget-exceeded when cost ≥ budget', async () => {
    // Pre-populate enough calls to push cost above budget.
    const expensive: LlmContentBlock[] = [{ type: 'text', text: '' }];
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK, tokensIn: 1_000_000, tokensOut: 1_000_000 }, // ~$90 over budget
        { content: TACTICAL_OK },
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
    void expensive; // silence unused
    const first = await agent.decide(makeSnapshot(0), undefined);
    // The within-call cost guard (impl-2 H1 fix) bails out AFTER the
    // strategy call when its cost alone exceeds the budget — so only
    // 1 provider call fires (strategy), not 2.
    expect(provider.receivedCalls).toHaveLength(1);
    expect(first.stopReason).toBe('cost-budget-exceeded');
    expect(first.commands).toEqual([]);
    expect(first.strategyRefresh).toBeDefined(); // the refresh result still surfaced

    const next = await agent.decide(makeSnapshot(250), undefined);
    // Subsequent decide() short-circuits at the entry-time guard.
    expect(next.stopReason).toBe('cost-budget-exceeded');
    expect(provider.receivedCalls).toHaveLength(1);
  });

  it('warns once at 80% budget, not repeatedly', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new MockProvider({
      responses: Array.from({ length: 10 }, () => ({
        content: TACTICAL_OK,
        tokensIn: 1_000_000,
        tokensOut: 100_000, // ~$4.5 per call (Sonnet $3 in + $1.5 out)
      })),
    });
    const agent = new LlmAgent({
      provider,
      ownerId: 2,
      strategyModel: 'claude-opus-4-7',
      tacticalModel: 'claude-sonnet-4-6',
      strategyEveryNDecisions: 999, // never refresh strategy
      maxOutputTokensTactical: 1024,
      maxOutputTokensStrategy: 2048,
      costBudgetUsd: 5.0,
      maxImageBytes: 1_048_576,
      historyWindow: 5,
    });
    await agent.decide(makeSnapshot(0), undefined); // ~$4.5 → over 80% → warn
    await agent.decide(makeSnapshot(250), undefined); // would warn again — but suppressed
    const warnings = warn.mock.calls.filter((c) => String(c[0]).includes('80% of budget'));
    expect(warnings).toHaveLength(1);
    warn.mockRestore();
  });

  it('drops the screenshot when over maxImageBytes (does not pass to provider)', async () => {
    const provider = new MockProvider({
      responses: [{ content: STRATEGY_OK }, { content: TACTICAL_OK }],
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
      maxImageBytes: 100, // tiny budget; the 1KB png exceeds
      historyWindow: 5,
    });
    const huge = new Uint8Array(2048);
    await agent.decide(makeSnapshot(0), huge);
    // The strategy + tactical call should have NO image block since the runner-side
    // budget was exceeded.
    for (const call of provider.receivedCalls) {
      const blocks = call.messages.flatMap((m) => m.content);
      expect(blocks.some((b) => b.type === 'image')).toBe(false);
    }
  });

  it('passes the screenshot when under budget', async () => {
    const provider = new MockProvider({
      responses: [{ content: STRATEGY_OK }, { content: TACTICAL_OK }],
    });
    const agent = makeAgent(provider);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await agent.decide(makeSnapshot(0), png);
    const blocks = provider.receivedCalls.flatMap((c) => c.messages.flatMap((m) => m.content));
    expect(blocks.filter((b) => b.type === 'image')).toHaveLength(2); // strategy + tactical
  });
});

describe('LlmAgent.decide — parsing', () => {
  it('returns thought from text blocks and commands from tool_use blocks', async () => {
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        {
          content: [
            { type: 'text', text: 'Reasoning here.' },
            {
              type: 'tool_use',
              toolName: 'unit_move',
              toolInput: { unitId: 1, target: { x: 5, y: 5 } },
            },
          ],
        },
      ],
    });
    const agent = makeAgent(provider);
    const decision = await agent.decide(makeSnapshot(0), undefined);
    expect(decision.thought).toBe('Reasoning here.');
    expect(decision.commands).toEqual([
      { type: 'unit.move', data: { unitId: 1, target: { x: 5, y: 5 } } },
    ]);
  });

  it('returns empty commands array when only text', async () => {
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: [{ type: 'text', text: 'Nothing to do.' }] },
      ],
    });
    const agent = makeAgent(provider);
    const decision = await agent.decide(makeSnapshot(0), undefined);
    expect(decision.commands).toEqual([]);
    expect(decision.thought).toBe('Nothing to do.');
  });

  it('warns on null strategy refresh AND resets cadence to avoid retry-loop budget burn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new MockProvider({
      responses: [
        // Bogus strategy refresh
        {
          content: [
            {
              type: 'tool_use',
              toolName: 'set_strategy',
              toolInput: { strategy: 'plan', targetAge: 'wonder-age', targetUnitMix: 'mix' },
            },
          ],
        },
        // Tactical OK
        { content: TACTICAL_OK },
        // Tactical OK (this would NOT fire if cadence were reset to refresh-eligible again)
        { content: TACTICAL_OK },
      ],
    });
    const agent = new LlmAgent({
      provider,
      ownerId: 2,
      strategyModel: 'claude-opus-4-7',
      tacticalModel: 'claude-sonnet-4-6',
      strategyEveryNDecisions: 100, // never re-refresh on cadence
      maxOutputTokensTactical: 1024,
      maxOutputTokensStrategy: 2048,
      costBudgetUsd: 5.0,
      maxImageBytes: 1_048_576,
      historyWindow: 5,
    });
    await agent.decide(makeSnapshot(0), undefined);
    await agent.decide(makeSnapshot(250), undefined);
    // After impl-2 fix: invalid strategy refresh logs a warn AND resets
    // the cadence counter. Second decide() is a tactical-only call.
    // Total: 1 strategy + 2 tactical = 3 provider calls.
    expect(provider.receivedCalls).toHaveLength(3);
    expect(provider.receivedCalls[0]!.model).toBe('claude-opus-4-7'); // strategy
    expect(provider.receivedCalls[1]!.model).toBe('claude-sonnet-4-6'); // tactical
    expect(provider.receivedCalls[2]!.model).toBe('claude-sonnet-4-6'); // tactical (no re-strategy)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('strategy refresh returned null'));
    warn.mockRestore();
  });

  it('rejects strategy refresh with bogus targetAge (returns null)', async () => {
    const provider = new MockProvider({
      responses: [
        {
          content: [
            {
              type: 'tool_use',
              toolName: 'set_strategy',
              toolInput: {
                strategy: 'plan',
                targetAge: 'wonder-age', // not a real age
                targetUnitMix: 'mix',
              },
            },
          ],
        },
        { content: TACTICAL_OK },
      ],
    });
    const agent = makeAgent(provider);
    const decision = await agent.decide(makeSnapshot(0), undefined);
    expect(decision.strategyRefresh).toBeUndefined();
    expect(agent.strategy).toBeNull();
  });
});

describe('LlmAgent.reportDispatchOutcome (playtest-fixes B)', () => {
  it('feeds engine rejections into the next tactical prompt', async () => {
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK, tokensIn: 100, tokensOut: 50 },
        { content: TACTICAL_OK, tokensIn: 200, tokensOut: 80 },
        { content: TACTICAL_OK, tokensIn: 200, tokensOut: 80 },
      ],
    });
    const agent = makeAgent(provider);
    await agent.decide(makeSnapshot(0), undefined);
    agent.reportDispatchOutcome([
      {
        commandType: 'queue.research',
        accepted: false,
        rejectionReason: 'not_a_building',
        rejectionMessage: 'Entity is not a building.',
      },
      { commandType: 'queue.train', accepted: true },
    ]);
    await agent.decide(makeSnapshot(250), undefined);

    // Last provider call is the second tactical prompt — it must carry
    // the engine verdicts from the first decision.
    const lastCall = provider.receivedCalls[provider.receivedCalls.length - 1]!;
    const textBlock = lastCall.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text block');
    expect(textBlock.text).toContain('not_a_building');
    expect(textBlock.text).toContain('Entity is not a building.');
    expect(textBlock.text).toContain('REJECTED');
    expect(textBlock.text).toContain('1 accepted, 1 rejected');
  });

  it('reports a clean outcome without the rejection warning', async () => {
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK, tokensIn: 100, tokensOut: 50 },
        { content: TACTICAL_OK, tokensIn: 200, tokensOut: 80 },
        { content: TACTICAL_OK, tokensIn: 200, tokensOut: 80 },
      ],
    });
    const agent = makeAgent(provider);
    await agent.decide(makeSnapshot(0), undefined);
    agent.reportDispatchOutcome([{ commandType: 'queue.train', accepted: true }]);
    await agent.decide(makeSnapshot(250), undefined);

    const lastCall = provider.receivedCalls[provider.receivedCalls.length - 1]!;
    const textBlock = lastCall.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text block');
    expect(textBlock.text).toContain('1 accepted, 0 rejected');
    expect(textBlock.text).not.toContain('REJECTED');
  });

  it('is a safe no-op before any decision exists', () => {
    const provider = new MockProvider({ responses: [] });
    const agent = makeAgent(provider);
    expect(() =>
      agent.reportDispatchOutcome([{ commandType: 'unit.move', accepted: true }]),
    ).not.toThrow();
  });
});
