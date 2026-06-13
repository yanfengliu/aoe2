// Unit tests for the conformance capture (replaces observationOracle).
// Mocks the LLM provider so tests never hit the real Claude Code CLI.

import { describe, it, expect } from 'vitest';
import {
  buildConformanceDigest,
  computeRunMetrics,
  formatFindingsMarkdown,
  runConformanceProbe,
  SYSTEM_PROMPT_CONFORMANCE,
  type ConformanceEnvelopeLike,
  type ConformanceFinding,
  type ConformanceTraceRow,
} from '../../src/game/playtest/conformanceProbe';
import { MockProvider } from '../../src/game/playtest/llmProviders';

const rows: ConformanceTraceRow[] = [
  {
    decisionIndex: 0,
    tickBefore: 0,
    tickAfter: 250,
    thought: 'Fast-Feudal opening: 3 villagers to food, queue more villagers.',
    commands: [
      { type: 'unit.gather' },
      { type: 'unit.gather' },
      { type: 'unit.gather' },
      { type: 'queue.train' },
    ],
    costUsd: 0.6,
    stopReason: 'normal',
    dispatchEvents: [
      { commandType: 'unit.gather', accepted: true },
      { commandType: 'unit.gather', accepted: true },
      { commandType: 'unit.gather', accepted: true },
      { commandType: 'queue.train', accepted: true },
    ],
  },
  {
    decisionIndex: 1,
    tickBefore: 250,
    tickAfter: 500,
    thought: 'Place a barracks and start Loom.',
    commands: [{ type: 'building.placeConfirm' }, { type: 'research.start' }],
    costUsd: 0.6,
    stopReason: 'normal',
    dispatchEvents: [
      { commandType: 'building.placeConfirm', accepted: true },
      {
        commandType: 'research.start',
        accepted: false,
        rejectionReason: 'insufficient-resources',
        rejectionMessage: 'need 150 food',
      },
    ],
  },
  {
    decisionIndex: 2,
    tickBefore: 500,
    tickAfter: 750,
    thought: 'Nothing actionable this tick.',
    commands: [],
    costUsd: 0.6,
    stopReason: 'normal',
    dispatchEvents: [],
  },
];

const envelope: ConformanceEnvelopeLike = {
  ticksRun: 750,
  decisionsRun: 3,
  totalCostUsd: 1.8,
  stopReason: 'maxTicks',
  winner: { kind: 'in-progress', aliveOwners: [1, 2] },
};

describe('computeRunMetrics', () => {
  it('tallies attempts, accept/reject, reasons, distinct types, and stalls', () => {
    const m = computeRunMetrics(envelope, rows);
    expect(m.ticksRun).toBe(750);
    expect(m.decisionsRun).toBe(3);
    expect(m.commandsAttempted).toBe(6);
    expect(m.commandsAccepted).toBe(5);
    expect(m.commandsRejected).toBe(1);
    expect(m.rejectionReasonCounts).toEqual({ 'insufficient-resources': 1 });
    expect(m.commandTypeStats['unit.gather']).toEqual({ attempted: 3, accepted: 3, rejected: 0 });
    expect(m.commandTypeStats['research.start']).toEqual({ attempted: 1, accepted: 0, rejected: 1 });
    expect(m.distinctCommandTypes).toEqual([
      'building.placeConfirm',
      'queue.train',
      'research.start',
      'unit.gather',
    ]);
    expect(m.stallDecisions).toBe(1);
    expect(m.winner).toEqual({ kind: 'in-progress', aliveOwners: [1, 2] });
  });

  it('handles an empty trace without throwing', () => {
    const m = computeRunMetrics({ ...envelope, decisionsRun: 0, ticksRun: 0 }, []);
    expect(m.commandsAttempted).toBe(0);
    expect(m.distinctCommandTypes).toEqual([]);
    expect(m.stallDecisions).toBe(0);
  });

  it('does not count a cost-budget-exceeded zero-command row as a stall', () => {
    const budgetRow: ConformanceTraceRow = {
      decisionIndex: 3,
      tickBefore: 750,
      tickAfter: 750,
      thought: 'budget exhausted',
      commands: [],
      costUsd: 0,
      stopReason: 'cost-budget-exceeded',
      dispatchEvents: [],
    };
    // `rows` already has exactly one genuine stall (decision 2: normal +
    // no commands). The budget-gate row must NOT add to the count.
    const m = computeRunMetrics(envelope, [...rows, budgetRow]);
    expect(m.stallDecisions).toBe(1);
  });
});

describe('buildConformanceDigest', () => {
  it('includes metrics, the player thoughts, rejection reasons, and stalls', () => {
    const m = computeRunMetrics(envelope, rows);
    const d = buildConformanceDigest(m, rows);
    expect(d).toContain('Fast-Feudal');
    expect(d).toContain('insufficient-resources');
    expect(d).toContain('research.start');
    expect(d).toMatch(/stall|no commands/i);
    expect(d).toContain('in-progress');
  });
});

describe('runConformanceProbe', () => {
  it('parses findings from a record_findings tool call and passes cost through', async () => {
    const provider = new MockProvider({
      responses: [
        {
          content: [
            {
              type: 'tool_use',
              toolName: 'record_findings',
              toolInput: {
                findings: [
                  {
                    category: 'missing-feature',
                    area: 'castle-age',
                    observed: 'agent never advanced past feudal',
                    expected: 'castle age reachable ~tick 6000',
                    severity: 'high',
                    suggestion: 'wire castle age advancement',
                  },
                  {
                    category: 'functional-bug',
                    area: 'market',
                    observed: 'no market commands available',
                    expected: 'buy/sell commodities at 30% fee',
                    severity: 'medium',
                    suggestion: 'implement market trading',
                  },
                ],
              },
            },
          ],
          tokensIn: 1000,
          tokensOut: 200,
        },
      ],
    });
    const res = await runConformanceProbe({ provider, model: 'claude-opus-4-8', digest: 'd' });
    expect(res.findings).toHaveLength(2);
    expect(res.findings[0]).toMatchObject({ category: 'missing-feature', severity: 'high' });
    // 1000 in × $5/MTok + 200 out × $25/MTok = 0.005 + 0.005 = 0.01
    expect(res.costUsd).toBeCloseTo(0.01, 6);
    expect(res.note).toBeUndefined();
  });

  it('drops findings with an invalid category/severity but keeps valid ones', async () => {
    const provider = new MockProvider({
      responses: [
        {
          content: [
            {
              type: 'tool_use',
              toolName: 'record_findings',
              toolInput: {
                findings: [
                  { category: 'nonsense', area: 'x', observed: 'o', expected: 'e', severity: 'high', suggestion: 's' },
                  { category: 'spec-divergence', area: 'gather', observed: 'o', expected: 'e', severity: 'bogus', suggestion: 's' },
                  { category: 'spec-divergence', area: 'gather', observed: 'o', expected: 'e', severity: 'low', suggestion: 's' },
                ],
              },
            },
          ],
        },
      ],
    });
    const res = await runConformanceProbe({ provider, model: 'claude-opus-4-8', digest: 'd' });
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0].category).toBe('spec-divergence');
    expect(res.findings[0].severity).toBe('low');
  });

  it('returns a note when a non-empty record_findings array yields zero valid findings', async () => {
    const provider = new MockProvider({
      responses: [
        {
          content: [
            {
              type: 'tool_use',
              toolName: 'record_findings',
              toolInput: {
                findings: [
                  { category: 'nonsense', area: 'x', observed: 'o', expected: 'e', severity: 'high', suggestion: 's' },
                ],
              },
            },
          ],
        },
      ],
    });
    const res = await runConformanceProbe({ provider, model: 'claude-opus-4-8', digest: 'd' });
    expect(res.findings).toEqual([]);
    expect(res.note).toMatch(/invalid findings/);
  });

  it('does NOT set a note when the model legitimately returns an empty findings array', async () => {
    const provider = new MockProvider({
      responses: [
        { content: [{ type: 'tool_use', toolName: 'record_findings', toolInput: { findings: [] } }] },
      ],
    });
    const res = await runConformanceProbe({ provider, model: 'claude-opus-4-8', digest: 'd' });
    expect(res.findings).toEqual([]);
    expect(res.note).toBeUndefined();
  });

  it('falls back to empty findings + a note when the model emits no tool call', async () => {
    const provider = new MockProvider({
      responses: [{ content: [{ type: 'text', text: 'I could not analyze the run.' }] }],
    });
    const res = await runConformanceProbe({ provider, model: 'claude-opus-4-8', digest: 'd' });
    expect(res.findings).toEqual([]);
    expect(res.note).toMatch(/record_findings/);
  });

  it('attaches the final screenshot as an image block when provided', async () => {
    const provider = new MockProvider({
      responses: [
        { content: [{ type: 'tool_use', toolName: 'record_findings', toolInput: { findings: [] } }] },
      ],
    });
    await runConformanceProbe({
      provider,
      model: 'claude-opus-4-8',
      digest: 'd',
      finalScreenshotPng: new Uint8Array([1, 2, 3]),
    });
    const call = provider.receivedCalls[0]!;
    expect(call.systemPrompt).toBe(SYSTEM_PROMPT_CONFORMANCE);
    expect(call.messages[0]!.content.some((b) => b.type === 'image')).toBe(true);
  });
});

describe('formatFindingsMarkdown', () => {
  it('renders metrics + findings with highest severity first', () => {
    const m = computeRunMetrics(envelope, rows);
    const findings: ConformanceFinding[] = [
      { category: 'ux-gap', area: 'ui-panel', observed: 'o', expected: 'e', severity: 'low', suggestion: 's2' },
      { category: 'missing-feature', area: 'castle-age', observed: 'o', expected: 'e', severity: 'high', suggestion: 's1' },
    ];
    const md = formatFindingsMarkdown(m, findings, { prefix: 'campaign-4', model: 'claude-opus-4-8' });
    expect(md).toContain('# Conformance findings — campaign-4');
    expect(md).toContain('castle-age');
    expect(md).toContain('[high]');
    // high-severity finding rendered before the low one
    expect(md.indexOf('castle-age')).toBeLessThan(md.indexOf('ui-panel'));
  });

  it('handles the metrics-only (no findings, no model) case', () => {
    const m = computeRunMetrics(envelope, rows);
    const md = formatFindingsMarkdown(m, [], { prefix: 'campaign-4' });
    expect(md).toContain('metrics-only');
    expect(md).toContain('_No findings recorded._');
  });

  it('renders the probe note into the report when present', () => {
    const m = computeRunMetrics(envelope, rows);
    const md = formatFindingsMarkdown(m, [], {
      prefix: 'campaign-4',
      model: 'claude-opus-4-8',
      note: 'only invalid findings',
    });
    expect(md).toContain('probe note: only invalid findings');
  });
});
