import {
  assertImprovementFinding,
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
  withinRunUnionKey,
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
  | 'mixed'
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
  // H6: UNION all three detectors rather than returning the first non-empty
  // source. The old priority (markers → envelope → oracle) let a single
  // low-severity LLM/annotation marker SHADOW deterministic HIGH oracle findings
  // (tick-failure, pinned-units) — hiding them from the ledger AND the recursive
  // loop's fix-candidate selection (only oracle findings are ever fix-classified,
  // so a marker-only extraction yielded zero candidates and the loop bailed).
  const markerFindings = improvementFindingsFromMarkers(run.bundle.markers ?? []);
  const envelopeFindings = envelopeConformanceFindings(run);
  const oracleFindings = oracleViolationsToImprovementFindings(run);

  // Dedup by the WITHIN-run union key (finer than the cross-run findingIdentityKey
  // used by the prove stage + before/after comparison): conformance findings that
  // appear in BOTH markers and the envelope collapse by their per-finding id,
  // while oracle findings keep their violation tuple. Crucially, two DISTINCT
  // conformance defects in one [category, area] stay separate — the coarse
  // cross-run key would hide the second (iter-4 review). Keep first-seen (markers
  // win over the envelope re-derivation).
  const seen = new Set<string>();
  const findings: ImprovementFinding[] = [];
  for (const finding of [...markerFindings, ...envelopeFindings, ...oracleFindings]) {
    const key = withinRunUnionKey(finding);
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(finding);
  }

  // Provenance stays per-finding (data.aoe2OracleViolation / aoe2FindingCategory);
  // `source` is telemetry only — the single contributing detector, or 'mixed'.
  const contributing: ImprovementFindingSource[] = [];
  if (markerFindings.length > 0) contributing.push('markers');
  if (envelopeFindings.length > 0) contributing.push('envelope-findings');
  if (oracleFindings.length > 0) contributing.push('oracle-violations');
  const source: ImprovementFindingSource =
    contributing.length === 0
      ? 'none'
      : contributing.length === 1
        ? contributing[0]!
        : 'mixed';

  return { source, findings };
}

// Envelope conformance findings → markers → shared ImprovementFindings (the
// same transform the old envelope branch ran inline). Empty when the envelope
// carries no conformance findings.
function envelopeConformanceFindings(
  run: SelfImprovementRunArtifacts,
): ImprovementFinding[] {
  const conformance = readConformanceFindings(run.envelope.findings);
  if (conformance.length === 0) return [];
  const anchorTick = deriveAnchorTick(run.traceRows, run.bundle);
  const markers = findingsToMarkers(conformance, { anchorTick, agentId: run.id });
  return improvementFindingsFromMarkers(markers);
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

// The markdown presentation lives in ./selfImprovementLedgerFormat (split to
// keep this file under the 500-LOC cap); re-exported so existing importers
// (scripts + tests) keep resolving it from here.
export { formatSelfImprovementLedgerMarkdown } from './selfImprovementLedgerFormat';

function ledgerFinding(
  finding: ImprovementFinding,
  verification: ReplaySelfCheckEvidence,
): SelfImprovementLedgerFinding {
  const aligned = alignOracleVerification(finding, verification);
  const disposition = aligned.disposition ?? 'candidate';
  return {
    id: aligned.id,
    title: aligned.title,
    severity: aligned.severity,
    category: aligned.category,
    ...(aligned.area !== undefined ? { area: aligned.area } : {}),
    verificationStatus: aligned.verificationStatus,
    nextAction: aligned.nextAction,
    disposition,
    classification: classifyFinding(aligned, verification),
    evidence: aligned.evidence,
    finding: aligned,
  };
}

function alignOracleVerification(
  finding: ImprovementFinding,
  verification: ReplaySelfCheckEvidence,
): ImprovementFinding {
  const isOracleSourced =
    typeof finding.data === 'object' &&
    finding.data !== null &&
    !Array.isArray(finding.data) &&
    'aoe2OracleViolation' in finding.data;
  if (!isOracleSourced || finding.verificationStatus !== 'verified') return finding;
  if (verification.ok) {
    const upgraded: ImprovementFinding = {
      ...finding,
      verificationMethod: finding.verificationMethod ?? 'metric',
    };
    try {
      assertImprovementFinding(upgraded, { requireVerificationEvidence: true });
      return upgraded;
    } catch {
      return downgradeToUnverified(finding);
    }
  }
  return downgradeToUnverified(finding);
}

function downgradeToUnverified(finding: ImprovementFinding): ImprovementFinding {
  const downgraded: ImprovementFinding = { ...finding, verificationStatus: 'unverified' };
  delete downgraded.verificationMethod;
  return downgraded;
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
    case 'improveHarness':
    case 'fileEngineFeedback':
    case 'addRegression':
    case 'updateDesign':
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
