import { describe, expect, it } from 'vitest';
import { assertImprovementRunManifest } from 'civ-engine';
import {
  assertCanaryManifest,
  buildCanaryManifest,
  canaryOutcome,
  ledgerFiresOracle,
} from '../../src/game/playtest/canary';

describe('canaryOutcome', () => {
  it('is stale when the patch no longer applies', () => {
    expect(canaryOutcome({ applied: false, baselineFired: null, patchedFired: null })).toBe('canary-stale');
  });

  it('is run-failed when either run produced no ledger', () => {
    expect(canaryOutcome({ applied: true, baselineFired: null, patchedFired: true })).toBe('run-failed');
    expect(canaryOutcome({ applied: true, baselineFired: false, patchedFired: null })).toBe('run-failed');
  });

  it('is invalid when the oracle already fires on the unpatched build (always-red cannot measure sensitivity)', () => {
    expect(canaryOutcome({ applied: true, baselineFired: true, patchedFired: true })).toBe('canary-invalid');
    // The live path: a dirty baseline SKIPS the patched run entirely, so
    // patchedFired is null - that is still canary-invalid, not run-failed.
    // (First live drill mislabeled exactly this: 16 real pinned-unit
    // violations saturated the baseline.)
    expect(canaryOutcome({ applied: true, baselineFired: true, patchedFired: null })).toBe('canary-invalid');
  });

  it('is ok when the seeded bug is detected and blind when it is not', () => {
    expect(canaryOutcome({ applied: true, baselineFired: false, patchedFired: true })).toBe('canary-ok');
    expect(canaryOutcome({ applied: true, baselineFired: false, patchedFired: false })).toBe('canary-blind');
  });
});

describe('assertCanaryManifest', () => {
  it('accepts a valid manifest', () => {
    expect(() =>
      assertCanaryManifest([
        { id: 'pinned-units', patch: 'canaries/pinned-units.patch', expectedOracle: 'no-pinned-or-oscillating-units' },
        { id: 'b', patch: 'canaries/b.patch', expectedOracle: 'match-completes', playtestArgs: ['--game-length', '500'], note: 'n' },
      ]),
    ).not.toThrow();
  });

  it('rejects rows missing id, patch, or expectedOracle, and duplicate ids', () => {
    expect(() => assertCanaryManifest([{ id: '', patch: 'p', expectedOracle: 'o' }])).toThrow(/id/);
    expect(() => assertCanaryManifest([{ id: 'a', patch: '', expectedOracle: 'o' }])).toThrow(/patch/);
    expect(() => assertCanaryManifest([{ id: 'a', patch: 'p', expectedOracle: '' }])).toThrow(/expectedOracle/);
    expect(() =>
      assertCanaryManifest([
        { id: 'a', patch: 'p', expectedOracle: 'o' },
        { id: 'a', patch: 'q', expectedOracle: 'o2' },
      ]),
    ).toThrow(/duplicate/);
    expect(() => assertCanaryManifest('nope')).toThrow(/array/);
  });
});

describe('ledgerFiresOracle', () => {
  function ledgerWith(oracle: string) {
    return {
      current: { prefix: 'output/x' },
      findings: [
        {
          id: 'f1',
          title: 'violation',
          severity: 'high',
          category: 'regression',
          area: oracle,
          evidence: [],
          classification: { kind: 'fix' },
          finding: {
            observed: 'observed',
            data: { aoe2OracleViolation: { oracle, severity: 'high', tick: 12, message: 'm' } },
          },
        },
      ],
    } as never;
  }

  it('detects the expected oracle through the real violation extraction', () => {
    expect(ledgerFiresOracle(ledgerWith('match-completes'), 'match-completes')).toBe(true);
    expect(ledgerFiresOracle(ledgerWith('match-completes'), 'no-tick-failures')).toBe(false);
  });

  it('handles an empty or missing findings list', () => {
    expect(ledgerFiresOracle({ current: { prefix: 'x' }, findings: [] } as never, 'match-completes')).toBe(false);
  });
});

describe('buildCanaryManifest', () => {
  it('builds a validated engine manifest with the canary vocabulary and evidence', () => {
    const manifest = buildCanaryManifest({
      id: 'aoe2-canary-pinned-units-20260709',
      seed: 'aoe2-canary',
      startedAt: '2026-07-09T02:00:00.000Z',
      completedAt: '2026-07-09T02:04:00.000Z',
      outcome: 'canary-ok',
      canaryId: 'pinned-units',
      expectedOracle: 'no-pinned-or-oscillating-units',
      baselineFired: false,
      patchedFired: true,
      artifacts: [{ kind: 'canary-patch', path: 'canaries/pinned-units.patch' }],
    });
    expect(() => assertImprovementRunManifest(manifest)).not.toThrow();
    expect(manifest.stopReason).toBe('canary-ok');
    expect(manifest.tags).toContain('canary');
    expect(manifest.data).toMatchObject({
      outcome: 'canary-ok',
      canary: 'pinned-units',
      expectedOracle: 'no-pinned-or-oscillating-units',
      baselineFired: false,
      patchedFired: true,
    });
  });

  it('tolerates null run results (failed drills still leave honest rows)', () => {
    const manifest = buildCanaryManifest({
      id: 'x',
      seed: 's',
      startedAt: '2026-07-09T02:00:00.000Z',
      completedAt: '2026-07-09T02:01:00.000Z',
      outcome: 'run-failed',
      canaryId: 'match-never-completes',
      expectedOracle: 'match-completes',
      baselineFired: null,
      patchedFired: null,
      artifacts: [],
    });
    expect(() => assertImprovementRunManifest(manifest)).not.toThrow();
    expect(manifest.data).toMatchObject({ baselineFired: null, patchedFired: null });
  });
});
