import { describe, expect, it } from 'vitest';
import {
  IMPROVEMENT_FINDING_SCHEMA_VERSION,
  type ImprovementFinding,
  type Marker,
  type SessionBundle,
} from 'civ-engine';

import type { ConformanceFinding, ConformanceTraceRow } from '../../src/game/playtest/conformanceProbe';
import { findingsToMarkers } from '../../src/game/playtest/findingsToMarkers';
import {
  buildSelfImprovementLedger,
  extractImprovementFindingsFromRun,
  formatSelfImprovementLedgerMarkdown,
  replaySelfCheckEvidenceFromResult,
  type SelfImprovementRunArtifacts,
} from '../../src/game/playtest/selfImprovementLoop';

const FIXED_NOW = '2026-07-08T12:00:00.000Z';

function conformanceFinding(overrides: Partial<ConformanceFinding> = {}): ConformanceFinding {
  return {
    category: 'ux-gap',
    area: 'command-card',
    observed: 'No visible age-up command.',
    expected: 'The Town Center exposes age-up when prerequisites are met.',
    severity: 'medium',
    suggestion: 'Expose age-up in the command card.',
    ...overrides,
  };
}

function traceRow(overrides: Partial<ConformanceTraceRow> = {}): ConformanceTraceRow {
  return {
    decisionIndex: 0,
    tickBefore: 250,
    tickAfter: 500,
    thought: 'Inspect command card.',
    commands: [{ type: 'queue.research' }],
    costUsd: 0.1,
    stopReason: 'normal',
    dispatchEvents: [{ commandType: 'queue.research', accepted: true }],
    ...overrides,
  };
}

function bundle(markers: Marker[] = [], endTick = 1000): SessionBundle {
  return {
    schemaVersion: 1,
    metadata: {
      sessionId: 'session-1',
      startTick: 0,
      endTick,
      durationTicks: endTick,
      engineVersion: '1.4.0',
      nodeVersion: process.version,
    },
    initialSnapshot: {},
    ticks: [],
    commands: [],
    executions: [],
    failures: [],
    snapshots: [],
    markers,
    attachments: [],
  } as unknown as SessionBundle;
}

function runArtifacts(
  overrides: Partial<SelfImprovementRunArtifacts> & {
    markers?: Marker[];
    findings?: ConformanceFinding[];
    traceRows?: ConformanceTraceRow[];
  } = {},
): SelfImprovementRunArtifacts {
  const traceRows = overrides.traceRows ?? [traceRow()];
  return {
    id: overrides.id ?? 'current',
    prefix: overrides.prefix ?? 'output/playtests-llm/current',
    bundle: overrides.bundle ?? bundle(overrides.markers ?? []),
    envelope: overrides.envelope ?? {
      stopReason: 'maxTicks',
      ticksRun: 500,
      decisionsRun: 1,
      totalCostUsd: 0.1,
      maxTicks: 1000,
      ...(overrides.findings ? { findings: overrides.findings } : {}),
    },
    traceRows,
  };
}

function improvementFinding(
  id: string,
  nextAction: ImprovementFinding['nextAction'],
  overrides: Partial<ImprovementFinding> = {},
): ImprovementFinding {
  return {
    schemaVersion: IMPROVEMENT_FINDING_SCHEMA_VERSION,
    id,
    title: `Finding ${id}`,
    severity: 'high',
    category: 'bug',
    area: 'loop',
    observed: 'A loop issue was observed.',
    expected: 'The loop should classify it.',
    suggestion: 'Classify and route it.',
    evidence: [{ kind: 'tick', tick: 500 }],
    verificationStatus: 'unverified',
    nextAction,
    ...overrides,
  };
}

function improvementMarker(finding: ImprovementFinding): Marker {
  return {
    id: `marker-${finding.id}`,
    tick: 500,
    kind: 'annotation',
    provenance: 'game',
    text: finding.title,
    data: {
      author: 'agent',
      severity: 'bug',
      category: 'ai',
      improvementLoop: {
        schemaVersion: IMPROVEMENT_FINDING_SCHEMA_VERSION,
        type: 'finding',
        finding,
      },
    } as unknown as Marker['data'],
  };
};

describe('extractImprovementFindingsFromRun', () => {
  it('recovers shared ImprovementFinding payloads from markers first', () => {
    const [marker] = findingsToMarkers(
      [conformanceFinding()],
      { anchorTick: 500, agentId: 'current / model', createdAt: FIXED_NOW },
    );

    const result = extractImprovementFindingsFromRun(runArtifacts({ markers: [marker] }));

    expect(result.source).toBe('markers');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      schemaVersion: IMPROVEMENT_FINDING_SCHEMA_VERSION,
      id: 'aoe2-conformance-ux-gap-command-card-500-0',
      verificationStatus: 'unverified',
      nextAction: 'proposalOnly',
      evidence: [{ kind: 'tick', tick: 500 }],
    });
  });

  it('falls back to envelope findings and creates shared ImprovementFindings when marker payloads are absent', () => {
    const result = extractImprovementFindingsFromRun(runArtifacts({
      findings: [conformanceFinding({ category: 'functional-bug', area: 'pathing', severity: 'high' })],
      traceRows: [traceRow({ tickAfter: 750 })],
    }));

    expect(result.source).toBe('envelope-findings');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      id: 'aoe2-conformance-functional-bug-pathing-750-0',
      severity: 'high',
      category: 'bug',
      area: 'pathing',
      verificationStatus: 'unverified',
      nextAction: 'proposalOnly',
    });
  });
});

describe('buildSelfImprovementLedger', () => {
  it('classifies findings, records replay-self-check evidence, and compares before/after metrics', () => {
    const baseline = runArtifacts({
      id: 'baseline',
      prefix: 'output/playtests-llm/baseline',
      traceRows: [
        traceRow({
          tickAfter: 500,
          commands: [{ type: 'unit.move' }],
          dispatchEvents: [{ commandType: 'unit.move', accepted: true }],
        }),
      ],
    });
    const current = runArtifacts({
      id: 'current',
      prefix: 'output/playtests-llm/current',
      markers: [
        improvementMarker(improvementFinding('proposal', 'proposalOnly')),
        improvementMarker(improvementFinding('auto', 'autoFix')),
        improvementMarker(improvementFinding('observe', 'observeMore')),
        improvementMarker(improvementFinding('none', 'none')),
      ],
      traceRows: [
        traceRow({
          tickAfter: 500,
          commands: [{ type: 'unit.move' }, { type: 'queue.research' }],
          dispatchEvents: [
            { commandType: 'unit.move', accepted: true },
            { commandType: 'queue.research', accepted: true },
          ],
        }),
      ],
    });

    const ledger = buildSelfImprovementLedger({
      generatedAt: FIXED_NOW,
      baseline,
      current,
      verification: {
        baseline: { kind: 'replay-self-check', ok: true, checkedSegments: 1, skippedSegments: 0 },
        current: { kind: 'replay-self-check', ok: true, checkedSegments: 1, skippedSegments: 0 },
      },
    });

    expect(ledger.schemaVersion).toBe(1);
    expect(ledger.generatedAt).toBe(FIXED_NOW);
    expect(ledger.current.findingSource).toBe('markers');
    expect(ledger.verification.current).toMatchObject({ kind: 'replay-self-check', ok: true });
    expect(ledger.findings.map((f) => [f.id, f.classification.kind, f.disposition])).toEqual([
      ['proposal', 'proposal', 'candidate'],
      ['auto', 'fix', 'candidate'],
      ['observe', 'observe', 'candidate'],
      ['none', 'none', 'candidate'],
    ]);
    expect(ledger.findings.find((f) => f.id === 'auto')?.classification.autoFixEligible)
      .toBe(true);
    expect(ledger.comparison).toMatchObject({
      baselineRunId: 'baseline',
      currentRunId: 'current',
      comparator: 'civ-engine.compareMetricsResults',
    });
    expect(ledger.comparison?.metrics.commandsAccepted).toMatchObject({
      baseline: 1,
      current: 2,
      delta: 1,
    });
  });

  it('formats a concise Markdown ledger summary', () => {
    const current = runArtifacts({
      markers: [improvementMarker(improvementFinding('proposal', 'proposalOnly'))],
    });
    const ledger = buildSelfImprovementLedger({
      generatedAt: FIXED_NOW,
      current,
      verification: {
        current: { kind: 'replay-self-check', ok: true, checkedSegments: 2, skippedSegments: 0 },
      },
    });

    const markdown = formatSelfImprovementLedgerMarkdown(ledger);

    expect(markdown).toContain('# Self-improvement ledger - current');
    expect(markdown).toContain('Replay self-check: ok');
    expect(markdown).toContain('| proposal | high | bug | proposal | candidate |');
  });

  it('treats skipped or vacuous self-check results as blocking evidence', () => {
    const weakEvidence = replaySelfCheckEvidenceFromResult({
      ok: true,
      checkedSegments: 0,
      skippedSegments: [{ fromTick: 0, toTick: 500, reason: 'failure_in_segment' }],
      stateDivergences: [],
      eventDivergences: [],
      executionDivergences: [],
    });
    const current = runArtifacts({
      markers: [improvementMarker(improvementFinding('auto', 'autoFix'))],
    });

    const ledger = buildSelfImprovementLedger({
      generatedAt: FIXED_NOW,
      current,
      verification: { current: weakEvidence },
    });

    expect(weakEvidence).toMatchObject({
      ok: false,
      engineOk: true,
      checkedSegments: 0,
      skippedSegments: 1,
      error: 'replay self-check did not verify any segments',
    });
    expect(ledger.findings[0].classification).toEqual({
      kind: 'fix',
      autoFixEligible: false,
    });
    expect(formatSelfImprovementLedgerMarkdown(ledger)).toContain('Replay self-check: failed');
  });
});
