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
  | 'fix-unproven';

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
