import {
  IMPROVEMENT_FINDING_SCHEMA_VERSION,
  type ImprovementFinding,
} from 'civ-engine';
import { describe, expect, it } from 'vitest';

import {
  ledgerFindingToOracleViolation,
  selectLedgerFixCandidate,
} from '../../src/game/playtest/fixProposalInput';
import type {
  SelfImprovementLedger,
  SelfImprovementLedgerFinding,
} from '../../src/game/playtest/selfImprovementLoop';

function improvementFinding(
  id: string,
  overrides: Partial<ImprovementFinding> = {},
): ImprovementFinding {
  return {
    schemaVersion: IMPROVEMENT_FINDING_SCHEMA_VERSION,
    id,
    title: id,
    severity: 'medium',
    category: 'bug',
    observed: `${id} observed`,
    expected: `${id} expected`,
    suggestion: `${id} suggestion`,
    verificationStatus: 'verified',
    nextAction: 'manualFix',
    ...overrides,
  };
}

function ledgerFinding(
  id: string,
  overrides: Partial<SelfImprovementLedgerFinding> = {},
): SelfImprovementLedgerFinding {
  const finding = overrides.finding ?? improvementFinding(id);
  return {
    id,
    title: finding.title,
    severity: finding.severity,
    category: finding.category,
    ...(finding.area !== undefined ? { area: finding.area } : {}),
    verificationStatus: finding.verificationStatus,
    nextAction: finding.nextAction,
    disposition: overrides.disposition ?? 'candidate',
    classification: overrides.classification ?? { kind: 'fix', autoFixEligible: false },
    evidence: finding.evidence,
    finding,
    ...overrides,
  };
}

function ledger(findings: SelfImprovementLedgerFinding[]): SelfImprovementLedger {
  return {
    schemaVersion: 1,
    generatedAt: '2026-07-08T12:00:00.000Z',
    current: {
      id: 'fresh-smoke-current',
      prefix: 'output/self-improvement/fresh-smoke-current',
      seed: 'self-improve-smoke',
      stopReason: 'maxTicks',
      ticksRun: 700,
      decisionsRun: 0,
      commandsAttempted: 0,
      commandsAccepted: 0,
      commandsRejected: 0,
      stallDecisions: 0,
      findingSource: 'oracle-violations',
      standardizedFindingCount: findings.length,
    },
    verification: {
      current: {
        kind: 'replay-self-check',
        ok: true,
        checkedSegments: 1,
        skippedSegments: 0,
      },
    },
    findings,
  };
}

describe('fixProposalInput', () => {
  it('selects the highest-severity eligible fix finding from a self-improvement ledger', () => {
    const medium = ledgerFinding('medium-fix', {
      finding: improvementFinding('medium-fix', {
        severity: 'medium',
        area: 'no-pinned-or-oscillating-units',
        data: {
          aoe2OracleViolation: {
            oracle: 'no-pinned-or-oscillating-units',
            severity: 'medium',
            tick: 42,
            message: 'unit 99 stayed pinned',
            details: { unitId: 99 },
          },
        },
      }),
    });
    const observe = ledgerFinding('perf-observe', {
      classification: { kind: 'observe', autoFixEligible: false },
      finding: improvementFinding('perf-observe', {
        severity: 'low',
        nextAction: 'observeMore',
        area: 'no-perf-regression',
      }),
    });
    const high = ledgerFinding('match-fix', {
      finding: improvementFinding('match-fix', {
        severity: 'high',
        area: 'match-completes',
        data: {
          aoe2OracleViolation: {
            oracle: 'match-completes',
            severity: 'high',
            tick: null,
            message: 'match did not complete: stopReason=maxTicks',
            details: { stopReason: 'maxTicks', ticksRun: 700 },
          },
        },
      }),
    });

    const selected = selectLedgerFixCandidate(ledger([medium, observe, high]));

    // M6-#5: the HIGH match-completes finding is a non-completion SIGNAL, not a
    // code bug the loop can patch, so it is excluded from auto-fix selection —
    // the highest-severity ELIGIBLE fix (the medium pinned-units oracle) wins,
    // rather than the loop preferentially trying to code-patch a non-completion.
    expect(selected).toMatchObject({
      prefix: 'output/self-improvement/fresh-smoke-current',
      findingId: 'medium-fix',
      violation: {
        oracle: 'no-pinned-or-oscillating-units',
        severity: 'medium',
        tick: 42,
        message: 'unit 99 stayed pinned',
        details: { unitId: 99 },
      },
    });
  });

  it('excludes match-completes (a non-completion signal) from auto-fix selection (full-review M6-#5)', () => {
    const matchOnly = ledgerFinding('match-fix', {
      finding: improvementFinding('match-fix', {
        severity: 'high',
        area: 'match-completes',
        data: {
          aoe2OracleViolation: {
            oracle: 'match-completes',
            severity: 'high',
            tick: null,
            message: 'match did not complete',
            details: { stopReason: 'costBudget' },
          },
        },
      }),
    });
    // The ONLY fix-classified finding is match-completes → no eligible candidate.
    expect(selectLedgerFixCandidate(ledger([matchOnly]))).toBeNull();
  });

  it('honors finding id and oracle filters while ignoring non-fix findings', () => {
    const observe = ledgerFinding('perf-observe', {
      classification: { kind: 'observe', autoFixEligible: false },
      finding: improvementFinding('perf-observe', {
        nextAction: 'observeMore',
        area: 'no-perf-regression',
      }),
    });
    const pinned = ledgerFinding('pinned-fix', {
      finding: improvementFinding('pinned-fix', {
        area: 'no-pinned-or-oscillating-units',
        data: {
          aoe2OracleViolation: {
            oracle: 'no-pinned-or-oscillating-units',
            severity: 'medium',
            tick: 10,
            message: 'unit pinned',
          },
        },
      }),
    });
    const source = ledger([observe, pinned]);

    expect(selectLedgerFixCandidate(source, { findingId: 'perf-observe' })).toBeNull();
    expect(selectLedgerFixCandidate(source, { oracle: 'match-completes' })).toBeNull();
    expect(selectLedgerFixCandidate(source, { findingId: 'pinned-fix' })?.violation)
      .toMatchObject({ oracle: 'no-pinned-or-oscillating-units', tick: 10 });
  });

  it('synthesizes a violation shape for generic shared ImprovementFindings', () => {
    const finding = ledgerFinding('generic-fix', {
      finding: improvementFinding('generic-fix', {
        area: 'economy',
        observed: 'villagers stopped gathering',
        severity: 'medium',
        evidence: [{ kind: 'tick', tick: 123 }],
      }),
    });

    expect(ledgerFindingToOracleViolation(finding)).toEqual({
      oracle: 'economy',
      severity: 'medium',
      tick: 123,
      message: 'villagers stopped gathering',
      details: {
        category: 'bug',
        findingId: 'generic-fix',
        nextAction: 'manualFix',
      },
    });
  });

  it('normalizes informational shared findings to low-severity proposal input', () => {
    const finding = ledgerFinding('info-fix', {
      finding: improvementFinding('info-fix', {
        area: 'economy',
        observed: 'economy note',
        severity: 'info',
      }),
    });

    expect(ledgerFindingToOracleViolation(finding).severity).toBe('low');
  });
});
