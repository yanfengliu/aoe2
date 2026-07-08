import type { SelfImprovementLedger, SelfImprovementLedgerFinding } from './selfImprovementLoop';

const SEVERITY_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
const CLOSED_DISPOSITIONS = new Set(['rejected', 'wontFix']);
const DEFAULT_LIMIT = 8;
const MAX_LINE_LENGTH = 220;

export interface SelectKnownIssuesOptions {
  limit?: number;
}

// Formats a prior ledger's open findings into short prompt lines so the next
// run's agent verifies known issues instead of rediscovering them.
export function selectKnownIssues(
  ledger: SelfImprovementLedger,
  options: SelectKnownIssuesOptions = {},
): string[] {
  const limit = Math.max(0, options.limit ?? DEFAULT_LIMIT);
  return [...ledger.findings]
    .filter((finding) => !CLOSED_DISPOSITIONS.has(finding.disposition))
    .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))
    .slice(0, limit)
    .map(formatKnownIssue);
}

function formatKnownIssue(finding: SelfImprovementLedgerFinding): string {
  // Collapse whitespace: observed text can be LLM-authored (marker findings)
  // and embedded newlines would break the one-line list format and let a
  // prior run inject free-form prompt lines.
  const observed = (finding.finding.observed ?? '').replace(/\s+/g, ' ').trim();
  const title = finding.title.replace(/\s+/g, ' ').trim();
  const line = `[${finding.severity}/${finding.category}] ${title}: ${observed} (nextAction: ${finding.nextAction})`;
  return line.length > MAX_LINE_LENGTH ? `${line.slice(0, MAX_LINE_LENGTH - 1)}…` : line;
}
