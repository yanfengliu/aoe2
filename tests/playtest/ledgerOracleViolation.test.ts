import {
  IMPROVEMENT_FINDING_SCHEMA_VERSION,
  type ImprovementFinding,
} from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { ledgerFindingToOracleViolation } from '../../src/game/playtest/ledgerOracleViolation';
import type { SelfImprovementLedgerFinding } from '../../src/game/playtest/selfImprovementLoop';

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

describe('ledgerFindingToOracleViolation', () => {
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
