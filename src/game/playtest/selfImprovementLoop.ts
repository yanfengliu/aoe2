import {
  compareMetricsResults,
  improvementFindingsFromMarkers,
  type ImprovementDisposition,
  type ImprovementFinding,
  type MetricsComparison,
  type MetricsResult,
  type SelfCheckResult,
  type SessionBundle,
} from 'civ-engine';

import {
  computeRunMetrics,
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  type ConformanceEnvelopeLike,
  type ConformanceFinding,
  type ConformanceTraceRow,
} from './conformanceProbe';
import { deriveAnchorTick, findingsToMarkers } from './findingsToMarkers';
import {
  compareSelfImprovementFindings,
  type SelfImprovementFindingComparison,
} from './selfImprovementFindingComparison';
import { oracleViolationsToImprovementFindings } from './oracleImprovementFindings';
import type { OracleViolation } from './types';

export interface SelfImprovementRunEnvelope {
  stopReason: string;
  ticksRun: number;
  decisionsRun?: number;
  totalCostUsd?: number;
  errorMessage?: string;
  winner?: ConformanceEnvelopeLike['winner'];
  seed?: string;
  maxTicks?: number;
  findings?: unknown;
}

export interface SelfImprovementRunArtifacts {
  id: string;
  prefix: string;
  bundle: SessionBundle;
  envelope: SelfImprovementRunEnvelope;
  traceRows: readonly ConformanceTraceRow[];
  oracleViolations?: readonly OracleViolation[];
}

export type ImprovementFindingSource =
  | 'markers'
  | 'envelope-findings'
  | 'oracle-violations'
  | 'none';

export interface ExtractedImprovementFindings {
  source: ImprovementFindingSource;
  findings: ImprovementFinding[];
}

export interface ReplaySelfCheckEvidence {
  kind: 'replay-self-check';
  ok: boolean;
  engineOk?: boolean;
  checkedSegments?: number;
  skippedSegments?: number;
  stateDivergences?: number;
  eventDivergences?: number;
  executionDivergences?: number;
  error?: string;
}

export function replaySelfCheckEvidenceFromResult(
  result: SelfCheckResult,
): ReplaySelfCheckEvidence {
  const skippedSegments = result.skippedSegments.length;
  const stateDivergences = result.stateDivergences.length;
  const eventDivergences = result.eventDivergences.length;
  const executionDivergences = result.executionDivergences.length;
  const strongOk = result.ok && result.checkedSegments > 0 && skippedSegments === 0;
  return {
    kind: 'replay-self-check',
    ok: strongOk,
    ...(result.ok !== strongOk ? { engineOk: result.ok } : {}),
    checkedSegments: result.checkedSegments,
    skippedSegments,
    stateDivergences,
    eventDivergences,
    executionDivergences,
    ...(!strongOk && result.ok
      ? { error: partialReplaySelfCheckReason(result.checkedSegments, skippedSegments) }
      : {}),
  };
}

export type ImprovementClassificationKind = 'proposal' | 'fix' | 'observe' | 'none';

export interface ImprovementClassification {
  kind: ImprovementClassificationKind;
  autoFixEligible: boolean;
}

export interface SelfImprovementLedgerFinding {
  id: string;
  title: string;
  severity: ImprovementFinding['severity'];
  category: ImprovementFinding['category'];
  area?: string;
  verificationStatus: ImprovementFinding['verificationStatus'];
  nextAction: ImprovementFinding['nextAction'];
  disposition: ImprovementDisposition;
  classification: ImprovementClassification;
  evidence: ImprovementFinding['evidence'];
  finding: ImprovementFinding;
}

export interface SelfImprovementRunSummary {
  id: string;
  prefix: string;
  seed?: string;
  stopReason: string;
  ticksRun: number;
  decisionsRun: number;
  commandsAttempted: number;
  commandsAccepted: number;
  commandsRejected: number;
  stallDecisions: number;
  findingSource: ImprovementFindingSource;
  standardizedFindingCount: number;
}

export interface SelfImprovementComparison {
  baselineRunId: string;
  currentRunId: string;
  comparator: 'civ-engine.compareMetricsResults';
  metrics: MetricsComparison;
  findings: SelfImprovementFindingComparison;
}

export interface SelfImprovementLedger {
  schemaVersion: 1;
  generatedAt: string;
  baseline?: SelfImprovementRunSummary;
  current: SelfImprovementRunSummary;
  verification: {
    baseline?: ReplaySelfCheckEvidence;
    current: ReplaySelfCheckEvidence;
  };
  findings: SelfImprovementLedgerFinding[];
  comparison?: SelfImprovementComparison;
}

export interface BuildSelfImprovementLedgerInput {
  generatedAt: string;
  current: SelfImprovementRunArtifacts;
  baseline?: SelfImprovementRunArtifacts;
  verification: {
    current: ReplaySelfCheckEvidence;
    baseline?: ReplaySelfCheckEvidence;
  };
}

export function extractImprovementFindingsFromRun(
  run: SelfImprovementRunArtifacts,
): ExtractedImprovementFindings {
  const markerFindings = improvementFindingsFromMarkers(run.bundle.markers ?? []);
  if (markerFindings.length > 0) {
    return { source: 'markers', findings: markerFindings };
  }

  const envelopeFindings = readConformanceFindings(run.envelope.findings);
  if (envelopeFindings.length > 0) {
    const anchorTick = deriveAnchorTick(run.traceRows, run.bundle);
    const markers = findingsToMarkers(envelopeFindings, {
      anchorTick,
      agentId: run.id,
    });
    return {
      source: 'envelope-findings',
      findings: improvementFindingsFromMarkers(markers),
    };
  }

  const oracleFindings = oracleViolationsToImprovementFindings(run);
  if (oracleFindings.length > 0) {
    return { source: 'oracle-violations', findings: oracleFindings };
  }

  return { source: 'none', findings: [] };
}

export function buildSelfImprovementLedger(
  input: BuildSelfImprovementLedgerInput,
): SelfImprovementLedger {
  const currentFindings = extractImprovementFindingsFromRun(input.current);
  const baselineFindings = input.baseline
    ? extractImprovementFindingsFromRun(input.baseline)
    : undefined;
  const currentMetrics = metricsForRun(input.current);
  const baselineMetrics = input.baseline ? metricsForRun(input.baseline) : undefined;

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    ...(input.baseline
      ? {
          baseline: summarizeRun(input.baseline, baselineFindings!, baselineMetrics!),
        }
      : {}),
    current: summarizeRun(input.current, currentFindings, currentMetrics),
    verification: {
      ...(input.verification.baseline ? { baseline: input.verification.baseline } : {}),
      current: input.verification.current,
    },
    findings: currentFindings.findings.map((finding) =>
      ledgerFinding(finding, input.verification.current),
    ),
    ...(input.baseline && baselineMetrics
      ? {
          comparison: {
            baselineRunId: input.baseline.id,
            currentRunId: input.current.id,
            comparator: 'civ-engine.compareMetricsResults',
            metrics: compareMetricsResults(baselineMetrics, currentMetrics),
            findings: compareSelfImprovementFindings(
              baselineFindings!.findings,
              currentFindings.findings,
            ),
          },
        }
      : {}),
  };
}

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

function ledgerFinding(
  finding: ImprovementFinding,
  verification: ReplaySelfCheckEvidence,
): SelfImprovementLedgerFinding {
  const disposition = finding.disposition ?? 'candidate';
  return {
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    category: finding.category,
    ...(finding.area !== undefined ? { area: finding.area } : {}),
    verificationStatus: finding.verificationStatus,
    nextAction: finding.nextAction,
    disposition,
    classification: classifyFinding(finding, verification),
    evidence: finding.evidence,
    finding,
  };
}

function classifyFinding(
  finding: ImprovementFinding,
  verification: ReplaySelfCheckEvidence,
): ImprovementClassification {
  switch (finding.nextAction) {
    case 'autoFix':
      return { kind: 'fix', autoFixEligible: verification.ok };
    case 'manualFix':
      return { kind: 'fix', autoFixEligible: false };
    case 'observeMore':
      return { kind: 'observe', autoFixEligible: false };
    case 'none':
      return { kind: 'none', autoFixEligible: false };
    case 'proposalOnly':
      return { kind: 'proposal', autoFixEligible: false };
    default: {
      const exhaustive: never = finding.nextAction;
      return exhaustive;
    }
  }
}

function summarizeRun(
  run: SelfImprovementRunArtifacts,
  extracted: ExtractedImprovementFindings,
  metrics: MetricsResult,
): SelfImprovementRunSummary {
  return {
    id: run.id,
    prefix: run.prefix,
    ...(run.envelope.seed !== undefined ? { seed: run.envelope.seed } : {}),
    stopReason: String(metrics.stopReason),
    ticksRun: Number(metrics.ticksRun),
    decisionsRun: Number(metrics.decisionsRun),
    commandsAttempted: Number(metrics.commandsAttempted),
    commandsAccepted: Number(metrics.commandsAccepted),
    commandsRejected: Number(metrics.commandsRejected),
    stallDecisions: Number(metrics.stallDecisions),
    findingSource: extracted.source,
    standardizedFindingCount: extracted.findings.length,
  };
}

function metricsForRun(run: SelfImprovementRunArtifacts): MetricsResult {
  const metrics = hasTraceMetrics(run)
    ? computeRunMetrics(normalizedConformanceEnvelope(run), [...run.traceRows])
    : deterministicMetrics(run);
  const findings = extractImprovementFindingsFromRun(run);
  return {
    stopReason: metrics.stopReason,
    ticksRun: metrics.ticksRun,
    decisionsRun: metrics.decisionsRun,
    commandsAttempted: metrics.commandsAttempted,
    commandsAccepted: metrics.commandsAccepted,
    commandsRejected: metrics.commandsRejected,
    stallDecisions: metrics.stallDecisions,
    findingsCount: findings.findings.length,
  };
}

function hasTraceMetrics(run: SelfImprovementRunArtifacts): boolean {
  return run.traceRows.length > 0
    || typeof run.envelope.decisionsRun === 'number'
    || typeof run.envelope.totalCostUsd === 'number';
}

function normalizedConformanceEnvelope(
  run: SelfImprovementRunArtifacts,
): ConformanceEnvelopeLike {
  return {
    ticksRun: finiteNumber(run.envelope.ticksRun, 0),
    decisionsRun: finiteNumber(run.envelope.decisionsRun, run.traceRows.length),
    totalCostUsd: finiteNumber(run.envelope.totalCostUsd, 0),
    stopReason: run.envelope.stopReason,
    ...(run.envelope.errorMessage !== undefined ? { errorMessage: run.envelope.errorMessage } : {}),
    ...(run.envelope.winner !== undefined ? { winner: run.envelope.winner } : {}),
    ...(run.envelope.seed !== undefined ? { seed: run.envelope.seed } : {}),
    ...(run.envelope.maxTicks !== undefined ? { maxTicks: run.envelope.maxTicks } : {}),
  };
}

function deterministicMetrics(run: SelfImprovementRunArtifacts): MetricsResult {
  return {
    stopReason: run.envelope.stopReason,
    ticksRun: finiteNumber(run.envelope.ticksRun, 0),
    decisionsRun: 0,
    commandsAttempted: 0,
    commandsAccepted: 0,
    commandsRejected: 0,
    stallDecisions: 0,
  };
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

function partialReplaySelfCheckReason(
  checkedSegments: number,
  skippedSegments: number,
): string {
  if (checkedSegments === 0) {
    return 'replay self-check did not verify any segments';
  }
  return `replay self-check skipped ${skippedSegments} segment(s)`;
}

function readConformanceFindings(value: unknown): ConformanceFinding[] {
  if (!Array.isArray(value)) return [];
  const out: ConformanceFinding[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const category = item.category;
    const severity = item.severity;
    if (!isStringInSet(category, FINDING_CATEGORIES)) continue;
    if (!isStringInSet(severity, FINDING_SEVERITIES)) continue;
    out.push({
      category,
      area: typeof item.area === 'string' ? item.area : '',
      observed: typeof item.observed === 'string' ? item.observed : '',
      expected: typeof item.expected === 'string' ? item.expected : '',
      severity,
      suggestion: typeof item.suggestion === 'string' ? item.suggestion : '',
    });
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringInSet<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}
