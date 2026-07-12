import {
  createImprovementRunManifest,
  type ImprovementFinding,
  type ImprovementRunManifest,
} from 'civ-engine';

import { findingIdentityKey } from './selfImprovementFindingComparison';

export type RecursivePassOutcome =
  | 'no-fix-candidate'
  | 'proposal-only'
  | 'proposal-failed'
  | 'apply-failed'
  | 'gate-failed'
  | 'fixed-proven'
  | 'fix-unproven'
  | 'initial-run-unqualified';

// iter-4 Finding A: a DEGENERATE initial run — one that died on
// costBudget/providerError/engineHalt — surfaces no auto-fixable candidate,
// because its only oracle signal (match-completes) is excluded from candidate
// selection by NON_AUTOFIX_ORACLES. Candidate selection then returns null and,
// without this gate, the pass is reported as a healthy 'no-fix-candidate' (exit
// 0), appending a CLEAN row to passes.jsonl that hides a broken run. This
// mirrors the rerun's prove-fixed qualification (rerunVerified +
// rerunReachedHorizon, added by commit 38a7ccc): an initial run only counts as a
// trustworthy "nothing to fix" pass when its replay self-check verified AND it
// reached a genuine horizon (maxTicks/stopWhen) rather than dying early. The
// horizon set is a WHITELIST, so any other/future stopReason defaults to
// unqualified. Kept pure so the script's gate is unit-testable (the .mjs is not).
export function qualifyInitialRun(input: { verified: boolean; stopReason: string | undefined }): boolean {
  return (
    input.verified === true
    && (input.stopReason === 'maxTicks' || input.stopReason === 'stopWhen')
  );
}

export interface RecursivePassArtifact {
  kind: string;
  path: string;
}

export interface RecursivePassGate {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface RecursivePassManifestInput {
  id: string;
  seed: string;
  startedAt: string;
  completedAt: string;
  gitCommit?: string;
  reviewer?: string;
  costUsd?: number;
  durationMs?: number;
  outcome: RecursivePassOutcome;
  candidateFindingId?: string;
  branchName?: string;
  artifacts: readonly RecursivePassArtifact[];
  gates?: readonly RecursivePassGate[];
}

export interface ProveFixInput {
  // Oracle name of the fix candidate (LedgerFixCandidate.violation.oracle).
  candidateOracle: string;
  candidateFinding: ImprovementFinding;
  // Findings the rerun ledger surfaced (whatever source priority chose).
  ledgerFindings: readonly ImprovementFinding[];
  // Oracle findings computed directly over the rerun bundle, so the ledger's
  // marker/envelope source priority cannot shadow persisting violations.
  oracleFindings: readonly ImprovementFinding[];
  // M6-#6: the rerun's replay self-check passed. "No violation" from a rerun
  // whose own replay didn't verify is not evidence of a fix.
  rerunVerified: boolean;
  // M6-#6: the rerun reached a genuine horizon (maxTicks/stopWhen) rather than
  // dying early (costBudget/providerError/engineHalt). A budget-truncated rerun
  // simply never reached the tick where the bug manifests, so its absence of the
  // candidate violation is meaningless — treat it as unproven, not proven.
  rerunReachedHorizon: boolean;
}

export function findingOracleName(finding: ImprovementFinding): string | null {
  const data = finding.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const payload = (data as Record<string, unknown>).aoe2OracleViolation;
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const oracle = (payload as Record<string, unknown>).oracle;
  return typeof oracle === 'string' && oracle.length > 0 ? oracle : null;
}

// Prove-fixed is deliberately coarse: oracle messages embed run-specific
// ticks/entities, so identity-key matching alone would let a nondeterministic
// rerun "resolve" the same bug class under a fresh identity (false-proven —
// the unsafe direction). A fix is proven only when the rerun shows NO
// violation of the candidate's oracle at all, and no finding with the
// candidate's exact identity either.
export function proveFixOutcome(
  input: ProveFixInput,
): Extract<RecursivePassOutcome, 'fixed-proven' | 'fix-unproven'> {
  // M6-#6: absence of the violation only proves a fix if the rerun actually
  // exercised the game — it must have passed its replay self-check AND reached a
  // genuine horizon. Otherwise a truncated / unverified rerun false-proves.
  if (!input.rerunVerified || !input.rerunReachedHorizon) return 'fix-unproven';
  const candidateKey = findingIdentityKey(input.candidateFinding);
  const rerunFindings = [...input.ledgerFindings, ...input.oracleFindings];
  const stillPresent = rerunFindings.some(
    (finding) =>
      findingOracleName(finding) === input.candidateOracle ||
      findingIdentityKey(finding) === candidateKey,
  );
  return stillPresent ? 'fix-unproven' : 'fixed-proven';
}

export function buildRecursivePassManifest(input: RecursivePassManifestInput): ImprovementRunManifest {
  return createImprovementRunManifest({
    id: input.id,
    gameId: 'aoe2',
    objective: `recursive self-improvement pass (${input.seed})`,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    seed: input.seed,
    ...(input.gitCommit !== undefined && input.gitCommit !== '' ? { gitCommit: input.gitCommit } : {}),
    ...(input.costUsd !== undefined ? { costUsd: input.costUsd } : {}),
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
    stopReason: input.outcome,
    artifacts: input.artifacts.map((artifact) => ({ ...artifact })),
    ...(input.gates !== undefined ? { gates: input.gates.map((gate) => ({ ...gate })) } : {}),
    tags: ['aoe2', 'recursive-pass'],
    data: {
      outcome: input.outcome,
      ...(input.reviewer !== undefined ? { reviewer: input.reviewer } : {}),
      ...(input.candidateFindingId !== undefined ? { candidateFindingId: input.candidateFindingId } : {}),
      ...(input.branchName !== undefined ? { branchName: input.branchName } : {}),
    },
  });
}
