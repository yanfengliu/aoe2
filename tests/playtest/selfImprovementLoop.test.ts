import { describe, expect, it } from 'vitest';

import { findingsToMarkers } from '../../src/game/playtest/findingsToMarkers';
import {
  buildSelfImprovementLedger,
  extractImprovementFindingsFromRun,
  formatSelfImprovementLedgerMarkdown,
  replaySelfCheckEvidenceFromResult,
} from '../../src/game/playtest/selfImprovementLoop';
import type { OracleViolation } from '../../src/game/playtest/types';
import {
  conformanceFinding,
  FIXED_NOW,
  improvementFinding,
  improvementMarker,
  runArtifacts,
  traceRow,
} from './selfImprovementLoopTestKit';

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
      schemaVersion: 1,
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

  it('unions marker AND oracle findings instead of letting a marker hide the oracle (full-review H6)', () => {
    // A single low-severity conformance marker used to SHORT-CIRCUIT the
    // extraction (markers-first), hiding a HIGH deterministic oracle violation
    // from the ledger + fix-candidate selection.
    const [marker] = findingsToMarkers(
      [conformanceFinding()],
      { anchorTick: 500, agentId: 'current / model', createdAt: FIXED_NOW },
    );
    const violation: OracleViolation = {
      oracle: 'no-tick-failures',
      severity: 'high',
      tick: 42,
      message: 'tick 42 failed',
    };

    const result = extractImprovementFindingsFromRun(
      runArtifacts({ markers: [marker], oracleViolations: [violation] }),
    );

    const ids = result.findings.map((finding) => finding.id);
    // The oracle finding is now SURFACED (was dropped pre-fix)...
    expect(ids).toContain('aoe2-oracle-no-tick-failures-42-0');
    // ...alongside the marker/conformance finding (not instead of it).
    expect(ids).toContain('aoe2-conformance-ux-gap-command-card-500-0');
    expect(result.findings).toHaveLength(2);
    // Two detectors contributed → provenance label is 'mixed'.
    expect(result.source).toBe('mixed');
  });

  it('dedups a conformance finding present in BOTH the markers and the envelope (full-review H6)', () => {
    // The same conformance finding written to bundle markers AND the envelope
    // (as playtest-findings.mjs does) must collapse to ONE finding by identity.
    const finding = conformanceFinding();
    const [marker] = findingsToMarkers(
      [finding],
      { anchorTick: 500, agentId: 'current / model', createdAt: FIXED_NOW },
    );
    const result = extractImprovementFindingsFromRun(
      runArtifacts({ markers: [marker], findings: [finding], traceRows: [traceRow()] }),
    );
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.id).toBe('aoe2-conformance-ux-gap-command-card-500-0');
  });

  it('keeps two DISTINCT conformance findings in the same category+area (iter-4 review)', () => {
    // The cross-run findingIdentityKey coarsens conformance to [category, area]
    // for resolved/introduced stability; reusing it for the WITHIN-run union
    // collapsed two genuinely different ux-gap/command-card defects into one, so
    // a later HIGH could vanish behind an earlier LOW. The union must keep both
    // (while the same-defect-from-two-sources case above still collapses to one).
    const first = conformanceFinding({ observed: 'No age-up button.', severity: 'low' });
    const second = conformanceFinding({ observed: 'Idle-villager button missing.', severity: 'high' });
    const result = extractImprovementFindingsFromRun(
      runArtifacts({ findings: [first, second], traceRows: [traceRow()] }),
    );
    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((f) => f.severity).sort()).toEqual(['high', 'low']);
  });

  it('converts deterministic oracle violations into shared ImprovementFindings', () => {
    const violation: OracleViolation = {
      oracle: 'match-completes',
      severity: 'high',
      tick: null,
      message: 'match did not complete: stopReason=maxTicks',
      details: { stopReason: 'maxTicks', ticksRun: 500 },
    };

    const result = extractImprovementFindingsFromRun(runArtifacts({
      id: 'fresh-smoke',
      traceRows: [],
      envelope: {
        stopReason: 'maxTicks',
        ticksRun: 500,
        seed: 'self-improve-smoke',
      },
      oracleViolations: [violation],
    }));

    expect(result.source).toBe('oracle-violations');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      id: 'aoe2-oracle-match-completes-run-0',
      title: 'match-completes',
      severity: 'high',
      category: 'regression',
      area: 'match-completes',
      observed: 'match did not complete: stopReason=maxTicks',
      verificationStatus: 'verified',
      nextAction: 'manualFix',
      disposition: 'candidate',
      evidence: [
        { kind: 'bundle', bundleId: 'session-1', sessionId: 'session-1' },
        { kind: 'metric', label: 'match-completes' },
      ],
      sourceRun: {
        schemaVersion: 1,
        id: 'fresh-smoke',
        sessionId: 'session-1',
        tags: ['aoe2', 'oracle'],
      },
    });
    expect(result.findings[0]?.data).toMatchObject({
      aoe2OracleViolation: {
        oracle: 'match-completes',
        severity: 'high',
        message: 'match did not complete: stopReason=maxTicks',
      },
    });
  });
});

describe('buildSelfImprovementLedger', () => {
  it('classifies findings, records replay-self-check evidence, and compares before/after metrics', () => {
    const baseline = runArtifacts({
      id: 'baseline',
      prefix: 'output/playtests-llm/baseline',
      markers: [
        improvementMarker(improvementFinding('resolved', 'manualFix')),
        improvementMarker(improvementFinding('persisted', 'manualFix')),
      ],
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
        improvementMarker(improvementFinding('persisted', 'manualFix')),
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
      ['persisted', 'fix', 'candidate'],
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
    expect(ledger.comparison?.findings).toEqual({
      baselineCount: 2,
      currentCount: 5,
      resolved: ['resolved'],
      persisted: ['persisted'],
      introduced: ['proposal', 'auto', 'observe', 'none'],
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

  it('formats rerun finding deltas in the Markdown summary', () => {
    const baseline = runArtifacts({
      id: 'baseline',
      markers: [
        improvementMarker(improvementFinding('resolved', 'manualFix')),
        improvementMarker(improvementFinding('persisted', 'manualFix')),
      ],
    });
    const current = runArtifacts({
      id: 'current',
      markers: [
        improvementMarker(improvementFinding('persisted', 'manualFix')),
        improvementMarker(improvementFinding('introduced', 'manualFix')),
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

    expect(formatSelfImprovementLedgerMarkdown(ledger)).toContain(
      'Finding delta: 1 introduced, 1 persisted, 1 resolved',
    );
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

  it('compares deterministic runs that have no LLM trace without NaN metrics', () => {
    const baseline = runArtifacts({
      id: 'baseline',
      traceRows: [],
      envelope: {
        stopReason: 'maxTicks',
        ticksRun: 250,
        seed: 'self-improve-smoke',
      },
    });
    const current = runArtifacts({
      id: 'current',
      traceRows: [],
      envelope: {
        stopReason: 'maxTicks',
        ticksRun: 500,
        seed: 'self-improve-smoke',
      },
      oracleViolations: [{
        oracle: 'match-completes',
        severity: 'high',
        tick: null,
        message: 'match did not complete: stopReason=maxTicks',
      }],
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

    expect(ledger.current).toMatchObject({
      decisionsRun: 0,
      commandsAttempted: 0,
      commandsAccepted: 0,
      commandsRejected: 0,
      stallDecisions: 0,
      findingSource: 'oracle-violations',
      standardizedFindingCount: 1,
    });
    expect(ledger.comparison?.metrics.ticksRun).toMatchObject({
      baseline: 250,
      current: 500,
      delta: 250,
    });
    expect(JSON.stringify(ledger)).not.toContain('NaN');
  });
});
