// Markdown presentation for the self-improvement ledger, split out of
// selfImprovementLoop.ts to keep that module under the 500-LOC cap (the ledger
// BUILDING logic and its PRESENTATION are separable concerns). Pure formatting:
// takes a built SelfImprovementLedger and renders the human-readable report the
// recursive/self-improve scripts write to disk.

import type { ReplaySelfCheckEvidence, SelfImprovementLedger } from './selfImprovementLoop';

export function formatSelfImprovementLedgerMarkdown(
  ledger: SelfImprovementLedger,
): string {
  const lines: string[] = [];
  lines.push(`# Self-improvement ledger - ${ledger.current.id}`);
  lines.push('');
  lines.push(`Generated: ${ledger.generatedAt}`);
  lines.push(`Current run: ${ledger.current.prefix}`);
  if (ledger.baseline) {
    lines.push(`Baseline run: ${ledger.baseline.prefix}`);
  }
  lines.push(
    `Replay self-check: ${ledger.verification.current.ok ? 'ok' : 'failed'}`
      + checkedSuffix(ledger.verification.current),
  );
  if (!ledger.verification.current.ok) {
    lines.push(`Replay evidence: ${verificationDetails(ledger.verification.current)}`);
  }
  lines.push(
    `Standardized improvement findings: ${ledger.current.standardizedFindingCount}`
      + ` (source: ${ledger.current.findingSource})`,
  );
  if (ledger.comparison) {
    lines.push(`Comparison: ${ledger.comparison.baselineRunId} -> ${ledger.comparison.currentRunId}`);
    lines.push(
      `Finding delta: ${ledger.comparison.findings.introduced.length} introduced, `
        + `${ledger.comparison.findings.persisted.length} persisted, `
        + `${ledger.comparison.findings.resolved.length} resolved`,
    );
  }
  lines.push('');
  lines.push('| ID | Severity | Category | Classification | Disposition |');
  lines.push('|---|---|---|---|---|');
  if (ledger.findings.length === 0) {
    lines.push('| (none) | - | - | - | - |');
  } else {
    for (const finding of ledger.findings) {
      lines.push(
        `| ${finding.id} | ${finding.severity} | ${finding.category}`
          + ` | ${finding.classification.kind} | ${finding.disposition} |`,
      );
    }
  }
  return lines.join('\n');
}

function checkedSuffix(evidence: ReplaySelfCheckEvidence): string {
  const checked = evidence.checkedSegments ?? 0;
  const skipped = evidence.skippedSegments ?? 0;
  return ` (${checked} checked, ${skipped} skipped)`;
}

function verificationDetails(evidence: ReplaySelfCheckEvidence): string {
  const parts = [
    `state divergences ${evidence.stateDivergences ?? 0}`,
    `event divergences ${evidence.eventDivergences ?? 0}`,
    `execution divergences ${evidence.executionDivergences ?? 0}`,
  ];
  if (evidence.error) parts.push(`error: ${evidence.error}`);
  return parts.join(', ');
}
