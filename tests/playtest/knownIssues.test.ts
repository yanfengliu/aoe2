import { describe, expect, it } from 'vitest';

import { selectKnownIssues } from '../../src/game/playtest/knownIssues';
import type { SelfImprovementLedger } from '../../src/game/playtest/selfImprovementLoop';

function ledgerWith(findings: Array<Record<string, unknown>>): SelfImprovementLedger {
  return {
    schemaVersion: 1,
    generatedAt: '2026-07-08T12:00:00.000Z',
    current: {
      id: 'current',
      prefix: 'output/playtests-llm/current',
      stopReason: 'maxTicks',
      ticksRun: 500,
      decisionsRun: 1,
      commandsAttempted: 1,
      commandsAccepted: 1,
      commandsRejected: 0,
      stallDecisions: 0,
      findingSource: 'markers',
      standardizedFindingCount: findings.length,
    },
    verification: {
      current: { kind: 'replay-self-check', ok: true, checkedSegments: 1, skippedSegments: 0 },
    },
    findings,
  } as unknown as SelfImprovementLedger;
}

function finding(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'f-1',
    title: 'a finding',
    severity: 'medium',
    category: 'bug',
    verificationStatus: 'unverified',
    nextAction: 'proposalOnly',
    disposition: 'candidate',
    classification: { kind: 'proposal', autoFixEligible: false },
    finding: { observed: 'observed detail' },
    ...overrides,
  };
}

describe('selectKnownIssues', () => {
  it('formats open findings ordered by severity and caps the list', () => {
    const ledger = ledgerWith([
      finding({ id: 'low-1', severity: 'low', title: 'low issue' }),
      finding({ id: 'crit-1', severity: 'critical', title: 'critical issue' }),
      finding({ id: 'high-1', severity: 'high', title: 'high issue' }),
    ]);
    const issues = selectKnownIssues(ledger, { limit: 2 });
    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain('critical issue');
    expect(issues[0]).toContain('[critical/bug]');
    expect(issues[1]).toContain('high issue');
  });

  it('skips rejected and wontFix dispositions', () => {
    const ledger = ledgerWith([
      finding({ id: 'r-1', disposition: 'rejected', title: 'rejected issue' }),
      finding({ id: 'w-1', disposition: 'wontFix', title: 'wontfix issue' }),
      finding({ id: 'open-1', title: 'open issue' }),
    ]);
    const issues = selectKnownIssues(ledger);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('open issue');
  });

  it('returns an empty list for a ledger without findings', () => {
    expect(selectKnownIssues(ledgerWith([]))).toEqual([]);
  });
});
