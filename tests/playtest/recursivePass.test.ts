import { describe, expect, it } from 'vitest';
import { assertImprovementRunManifest, type ImprovementFinding } from 'civ-engine';

import {
  buildRecursivePassManifest,
  findingOracleName,
  proveFixOutcome,
  qualifyInitialRun,
} from '../../src/game/playtest/recursivePass';

function oracleFinding(id: string, oracle: string, tick: number | null, message: string): ImprovementFinding {
  return {
    schemaVersion: 1,
    id,
    title: oracle,
    severity: 'high',
    category: 'regression',
    observed: message,
    evidence: [{ kind: 'tick', tick: tick ?? 0 }],
    verificationStatus: 'unverified',
    nextAction: 'manualFix',
    data: {
      aoe2OracleViolation: { oracle, severity: 'high', tick, message },
    },
  };
}

function markerFinding(id: string): ImprovementFinding {
  return {
    schemaVersion: 1,
    id,
    title: `Marker ${id}`,
    severity: 'medium',
    category: 'usability',
    observed: 'an agent-authored observation',
    verificationStatus: 'unverified',
    nextAction: 'proposalOnly',
  };
}

describe('recursive pass fix proving', () => {
  const candidate = oracleFinding('aoe2-oracle-match-completes-run-0', 'match-completes', null, 'match did not complete');

  it('proves a fix only when the rerun shows no violation of the candidate oracle', () => {
    const outcome = proveFixOutcome({
      candidateOracle: 'match-completes',
      candidateFinding: candidate,
      rerunVerified: true,
      rerunReachedHorizon: true,
      ledgerFindings: [markerFinding('unrelated-marker')],
      oracleFindings: [oracleFinding('other', 'no-perf-regression', 100, 'tick 100 took 40ms')],
    });
    expect(outcome).toBe('fixed-proven');
  });

  it('does not prove a fix when the same oracle fires again under a fresh tick/message identity', () => {
    const outcome = proveFixOutcome({
      candidateOracle: 'match-completes',
      candidateFinding: candidate,
      rerunVerified: true,
      rerunReachedHorizon: true,
      ledgerFindings: [],
      oracleFindings: [
        // Nondeterministic rerun: same bug class, different tick and message
        // → different identity key. Oracle-granularity matching must still
        // hold the fix unproven.
        oracleFinding('aoe2-oracle-match-completes-run-3', 'match-completes', 2054, 'match did not complete: stopReason=engineHalt'),
      ],
    });
    expect(outcome).toBe('fix-unproven');
  });

  it('does not prove a fix when the candidate identity survives in the rerun ledger findings', () => {
    const outcome = proveFixOutcome({
      candidateOracle: 'match-completes',
      candidateFinding: candidate,
      rerunVerified: true,
      rerunReachedHorizon: true,
      ledgerFindings: [oracleFinding('same-tuple-different-id', 'match-completes', null, 'match did not complete')],
      oracleFindings: [],
    });
    expect(outcome).toBe('fix-unproven');
  });

  it('judges against the union so marker-shadowed ledgers cannot fake resolution', () => {
    const outcome = proveFixOutcome({
      candidateOracle: 'match-completes',
      candidateFinding: candidate,
      rerunVerified: true,
      rerunReachedHorizon: true,
      // Ledger extraction chose markers (source priority) — no oracle rows.
      ledgerFindings: [markerFinding('llm-authored')],
      // Fresh oracle sweep over the rerun bundle still sees the violation.
      oracleFindings: [oracleFinding('fresh', 'match-completes', 1873, 'match did not complete: tick 1873')],
    });
    expect(outcome).toBe('fix-unproven');
  });

  it('does NOT prove a fix from a budget-truncated rerun even when the violation is absent (full-review M6-#6)', () => {
    const outcome = proveFixOutcome({
      candidateOracle: 'match-completes',
      candidateFinding: candidate,
      ledgerFindings: [],
      oracleFindings: [], // violation absent — but only because the rerun died early
      rerunVerified: true,
      rerunReachedHorizon: false, // costBudget/providerError/engineHalt
    });
    expect(outcome).toBe('fix-unproven');
  });

  it('does NOT prove a fix when the rerun replay self-check failed (full-review M6-#6)', () => {
    const outcome = proveFixOutcome({
      candidateOracle: 'match-completes',
      candidateFinding: candidate,
      ledgerFindings: [],
      oracleFindings: [], // violation absent — but the rerun did not verify
      rerunVerified: false,
      rerunReachedHorizon: true,
    });
    expect(outcome).toBe('fix-unproven');
  });

  it('extracts oracle names only from oracle-payload findings', () => {
    expect(findingOracleName(candidate)).toBe('match-completes');
    expect(findingOracleName(markerFinding('m'))).toBeNull();
  });
});

describe('qualifyInitialRun (iter-4 Finding A: refuse a clean pass over a degenerate initial run)', () => {
  it.each(['costBudget', 'engineHalt', 'providerError'])(
    'returns false for a verified run that died early on %s (no genuine horizon)',
    (stopReason) => {
      expect(qualifyInitialRun({ verified: true, stopReason })).toBe(false);
    },
  );

  it('returns false when the stopReason is undefined (no horizon recorded)', () => {
    expect(qualifyInitialRun({ verified: true, stopReason: undefined })).toBe(false);
  });

  it('returns false when the replay self-check did not verify, even at a genuine horizon', () => {
    expect(qualifyInitialRun({ verified: false, stopReason: 'maxTicks' })).toBe(false);
    expect(qualifyInitialRun({ verified: false, stopReason: 'stopWhen' })).toBe(false);
  });

  it('returns true only for a verified run that reached a genuine horizon (maxTicks|stopWhen)', () => {
    expect(qualifyInitialRun({ verified: true, stopReason: 'maxTicks' })).toBe(true);
    expect(qualifyInitialRun({ verified: true, stopReason: 'stopWhen' })).toBe(true);
  });
});

describe('recursive pass manifest', () => {
  it('builds a validated engine run manifest carrying the pass outcome and artifacts', () => {
    const manifest = buildRecursivePassManifest({
      id: 'recursive-aoe2-prototype-20260707T120000',
      seed: 'aoe2-prototype',
      startedAt: '2026-07-07T12:00:00.000Z',
      completedAt: '2026-07-07T12:20:00.000Z',
      gitCommit: 'abc1234',
      reviewer: 'claude',
      costUsd: 1.25,
      durationMs: 1_200_000,
      outcome: 'fixed-proven',
      candidateFindingId: 'aoe2-oracle-match-completes-run-0',
      branchName: 'recursive/aoe2-prototype-20260707120000',
      artifacts: [
        { kind: 'bundle', path: 'output/self-improvement/recursive/run.json' },
        { kind: 'ledger', path: 'output/self-improvement/recursive/run-ledger.json' },
      ],
      gates: [
        { name: 'typecheck', ok: true },
        { name: 'test', ok: true },
      ],
    });
    expect(() => assertImprovementRunManifest(manifest)).not.toThrow();
    expect(manifest.stopReason).toBe('fixed-proven');
    expect(manifest.seed).toBe('aoe2-prototype');
    expect(typeof manifest.engineVersion).toBe('string');
    expect(manifest.tags).toContain('recursive-pass');
    expect(manifest.data).toMatchObject({
      outcome: 'fixed-proven',
      reviewer: 'claude',
      candidateFindingId: 'aoe2-oracle-match-completes-run-0',
      branchName: 'recursive/aoe2-prototype-20260707120000',
    });
  });

  it('builds proposal-only manifests without branch or candidate data and drops empty git commits', () => {
    const manifest = buildRecursivePassManifest({
      id: 'recursive-x',
      seed: 's',
      startedAt: '2026-07-07T12:00:00.000Z',
      completedAt: '2026-07-07T12:01:00.000Z',
      gitCommit: '',
      outcome: 'no-fix-candidate',
      artifacts: [],
    });
    expect(() => assertImprovementRunManifest(manifest)).not.toThrow();
    expect(manifest.stopReason).toBe('no-fix-candidate');
    expect(Object.keys(manifest)).not.toContain('gitCommit');
    expect(manifest.data).toMatchObject({ outcome: 'no-fix-candidate' });
  });
});
