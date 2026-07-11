import type { JsonValue, OracleViolation } from './types';
import type {
  SelfImprovementLedger,
  SelfImprovementLedgerFinding,
} from './selfImprovementLoop';

export interface LedgerFixSelectionOptions {
  findingId?: string | null;
  oracle?: string | null;
}

export interface LedgerFixCandidate {
  prefix: string;
  findingId: string;
  finding: SelfImprovementLedgerFinding;
  violation: OracleViolation;
}

const SEVERITY_RANK: Record<OracleViolation['severity'], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// M6-#5: oracles whose violations are NOT a code bug the loop can patch — a
// non-completion (match-completes fires on maxTicks/costBudget/halt) or a perf
// regression is a signal about the RUN, not a defect to auto-fix. They must be
// excluded from auto-apply candidate selection, else the loop preferentially
// tries to code-patch them (match-completes is HIGH, so it sorts first).
const NON_AUTOFIX_ORACLES = new Set<string>(['match-completes', 'no-perf-regression']);

export function selectLedgerFixCandidate(
  ledger: SelfImprovementLedger,
  options: LedgerFixSelectionOptions = {},
): LedgerFixCandidate | null {
  const candidates = ledger.findings
    .filter((finding) => finding.classification.kind === 'fix')
    .map((finding) => ({
      prefix: ledger.current.prefix,
      findingId: finding.id,
      finding,
      violation: ledgerFindingToOracleViolation(finding),
    }))
    .filter((candidate) =>
      !NON_AUTOFIX_ORACLES.has(candidate.violation.oracle)
        && (!options.findingId || candidate.findingId === options.findingId)
        && (!options.oracle || candidate.violation.oracle === options.oracle),
    )
    .sort((a, b) => SEVERITY_RANK[b.violation.severity] - SEVERITY_RANK[a.violation.severity]);

  return candidates[0] ?? null;
}

export function ledgerFindingToOracleViolation(
  ledgerFinding: SelfImprovementLedgerFinding,
): OracleViolation {
  const finding = ledgerFinding.finding;
  const embedded = oracleViolationPayload(finding.data);
  if (embedded) {
    return {
      oracle: stringValue(embedded.oracle, ledgerFinding.area ?? ledgerFinding.category),
      severity: severityValue(embedded.severity, normalizedSeverity(ledgerFinding.severity)),
      tick: tickValue(embedded.tick, tickFromEvidence(ledgerFinding.evidence)),
      message: stringValue(embedded.message, finding.observed || ledgerFinding.title),
      ...(isRecord(embedded.details) ? { details: embedded.details } : {}),
    };
  }

  return {
    oracle: ledgerFinding.area ?? ledgerFinding.category,
    severity: normalizedSeverity(ledgerFinding.severity),
    tick: tickFromEvidence(ledgerFinding.evidence),
    message: finding.observed || ledgerFinding.title,
    details: {
      findingId: ledgerFinding.id,
      category: ledgerFinding.category,
      nextAction: ledgerFinding.nextAction,
    },
  };
}

function oracleViolationPayload(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const payload = value.aoe2OracleViolation;
  return isRecord(payload) ? payload : null;
}

function tickFromEvidence(
  evidence: SelfImprovementLedgerFinding['evidence'],
): number | null {
  if (!Array.isArray(evidence)) return null;
  for (const item of evidence) {
    if (!isRecord(item)) continue;
    if (item.kind === 'tick' && typeof item.tick === 'number' && Number.isFinite(item.tick)) {
      return item.tick;
    }
  }
  return null;
}

function tickValue(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function severityValue(
  value: unknown,
  fallback: OracleViolation['severity'],
): OracleViolation['severity'] {
  return value === 'high' || value === 'medium' || value === 'low'
    ? value
    : fallback;
}

function normalizedSeverity(value: unknown): OracleViolation['severity'] {
  if (value === 'critical') return 'high';
  return value === 'high' || value === 'medium' || value === 'low'
    ? value
    : 'low';
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
