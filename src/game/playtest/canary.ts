import { createImprovementRunManifest, type ImprovementRunManifest } from 'civ-engine';
import { ledgerFindingToOracleViolation } from './fixProposalInput';
import type { SelfImprovementLedger } from './selfImprovementLoop';

// Canary drill: seeded-bug patches that prove the oracles still SEE. Each
// canary applies a known one-line bug on a throwaway branch, runs the
// LLM-free playtest + oracle sweep, and asserts its declared oracle fires.
// Prove-fixed made the loop's claims honest; canaries make its perception
// honest — an oracle that silently stops firing is caught within a drill
// cycle instead of never.

export interface CanarySpec {
  id: string;
  patch: string;
  expectedOracle: string;
  playtestArgs?: string[];
  note?: string;
}

export type CanaryOutcome = 'canary-ok' | 'canary-blind' | 'canary-stale' | 'canary-invalid' | 'run-failed';

export function assertCanaryManifest(value: unknown): asserts value is CanarySpec[] {
  if (!Array.isArray(value)) throw new Error('canary manifest must be an array');
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) throw new Error('canary manifest rows must be objects');
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== 'string' || row.id.trim().length === 0) throw new Error('canary id must be a non-empty string');
    if (typeof row.patch !== 'string' || row.patch.trim().length === 0) throw new Error(`canary '${row.id}' patch must be a non-empty string`);
    if (typeof row.expectedOracle !== 'string' || row.expectedOracle.trim().length === 0) {
      throw new Error(`canary '${row.id}' expectedOracle must be a non-empty string`);
    }
    if (row.playtestArgs !== undefined && (!Array.isArray(row.playtestArgs) || row.playtestArgs.some((arg) => typeof arg !== 'string'))) {
      throw new Error(`canary '${row.id}' playtestArgs must be an array of strings`);
    }
    if (seen.has(row.id)) throw new Error(`duplicate canary id '${row.id}'`);
    seen.add(row.id);
  }
}

// Decision matrix for one canary. baselineFired/patchedFired are null when
// that run produced no readable ledger. The baseline guard matters: an
// oracle that already fires on the unpatched build is always-red and cannot
// measure sensitivity, so reporting 'canary-ok' there would be a lie.
export function canaryOutcome(input: {
  applied: boolean;
  baselineFired: boolean | null;
  patchedFired: boolean | null;
}): CanaryOutcome {
  if (!input.applied) return 'canary-stale';
  if (input.baselineFired === null || input.patchedFired === null) return 'run-failed';
  if (input.baselineFired) return 'canary-invalid';
  return input.patchedFired ? 'canary-ok' : 'canary-blind';
}

export function ledgerFiresOracle(ledger: SelfImprovementLedger, oracle: string): boolean {
  return (ledger.findings ?? []).some(
    (finding) => ledgerFindingToOracleViolation(finding).oracle === oracle,
  );
}

export interface CanaryManifestInput {
  id: string;
  seed: string;
  startedAt: string;
  completedAt: string;
  outcome: CanaryOutcome;
  canaryId: string;
  expectedOracle: string;
  baselineFired: boolean | null;
  patchedFired: boolean | null;
  artifacts: readonly { kind: string; path: string }[];
  note?: string;
}

// Canary drills keep their own vocabulary (stopReason canary-ok/-blind/
// -stale/-invalid/run-failed) instead of widening the recursive pass's
// outcome union — a drill is a sensitivity measurement, not a fix attempt.
export function buildCanaryManifest(input: CanaryManifestInput): ImprovementRunManifest {
  return createImprovementRunManifest({
    id: input.id,
    gameId: 'aoe2',
    objective: `oracle canary drill (${input.canaryId})`,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    seed: input.seed,
    stopReason: input.outcome,
    artifacts: input.artifacts.map((artifact) => ({ ...artifact })),
    tags: ['aoe2', 'canary'],
    data: {
      outcome: input.outcome,
      canary: input.canaryId,
      expectedOracle: input.expectedOracle,
      baselineFired: input.baselineFired,
      patchedFired: input.patchedFired,
      ...(input.note !== undefined && input.note !== '' ? { note: input.note } : {}),
    },
  });
}
