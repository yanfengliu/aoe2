import { describe, expect, it } from 'vitest';
import type { SessionBundle } from 'civ-engine';
import { runOracles } from '../../src/game/playtest/oracles';
import { ORACLE_DEFAULTS, type OracleEnvelope } from '../../src/game/playtest/types';
import { reconstructPositions } from '../../src/game/playtest/positionReplay';

interface BundleOverrides {
  ticks?: SessionBundle['ticks'];
  failures?: SessionBundle['failures'];
  endTick?: number;
  initialSnapshotComponents?: Record<string, unknown>;
}

// Helper to build a minimal SessionBundle for oracle tests. Uses
// `as unknown as SessionBundle` so each test specifies only the fields its
// oracle actually inspects; the engine's bundle shape includes lots of
// fields (rng state, component options, attachments) that the oracle layer
// doesn't read.
function makeMinimalBundle(overrides: BundleOverrides = {}): SessionBundle {
  return {
    schemaVersion: 1,
    metadata: {
      sessionId: 'test',
      engineVersion: 'test',
      nodeVersion: 'test',
      startTick: 0,
      persistedEndTick: overrides.endTick ?? 0,
      durationTicks: overrides.endTick ?? 0,
      endTick: overrides.endTick ?? 0,
      sourceLabel: 'test',
      sourceKind: 'synthetic',
      recordedAt: new Date().toISOString(),
      failedTicks: [],
    },
    initialSnapshot: {
      version: 5,
      config: { gridWidth: 16, gridHeight: 16, tps: 10 },
      tick: 0,
      entities: { generations: [], alive: [], freeList: [] },
      components: overrides.initialSnapshotComponents ?? {},
      resources: {},
      state: {},
      tags: [],
      rng: { state: 0 },
      componentOptions: {},
      metadata: {},
    },
    ticks: overrides.ticks ?? [],
    commands: [],
    executions: [],
    failures: overrides.failures ?? [],
    markers: [],
    attachments: [],
    snapshots: [],
  } as unknown as SessionBundle;
}

const emptyBundle = makeMinimalBundle();

const baseEnvelope: OracleEnvelope = {
  stopReason: 'stopWhen',
  ticksRun: 100,
  seed: 'test',
  scenario: 'test',
  runStartedAt: '2026-05-08T00:00:00Z',
  runCompletedAt: '2026-05-08T00:01:00Z',
};

describe('match-completes oracle', () => {
  it('passes when stopReason is stopWhen', () => {
    const violations = runOracles(emptyBundle, baseEnvelope, ORACLE_DEFAULTS).filter(
      (v) => v.oracle === 'match-completes',
    );
    expect(violations).toHaveLength(0);
  });

  it('fails on maxTicks (match did not finish)', () => {
    const env = { ...baseEnvelope, stopReason: 'maxTicks' as const };
    const violations = runOracles(emptyBundle, env, ORACLE_DEFAULTS).filter(
      (v) => v.oracle === 'match-completes',
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.severity).toBe('high');
    expect(violations[0]!.message).toMatch(/maxTicks/);
  });

  it('fails on engineHalt with halt details surfaced', () => {
    const env: OracleEnvelope = {
      ...baseEnvelope,
      stopReason: 'engineHalt',
      errorMessage: 'engine halted at tick 42 during update',
      details: { tick: 42, phase: 'update', systemName: 'prototypeAi' },
    };
    const violations = runOracles(emptyBundle, env, ORACLE_DEFAULTS).filter(
      (v) => v.oracle === 'match-completes',
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.severity).toBe('high');
    expect(violations[0]!.message).toContain('engineHalt');
  });

  it('fails on costBudget — budget death is NOT a completion (full-review M13-#7)', () => {
    // Pre-fix, budget death was laundered into stopReason 'stopWhen', which this
    // oracle read as a clean completion. Now it reports honestly as 'costBudget'
    // and correctly fires the match-completes violation, like maxTicks/engineHalt.
    const env: OracleEnvelope = {
      ...baseEnvelope,
      stopReason: 'costBudget',
      errorMessage: 'cost-budget-exceeded',
    };
    const violations = runOracles(emptyBundle, env, ORACLE_DEFAULTS).filter(
      (v) => v.oracle === 'match-completes',
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.severity).toBe('high');
  });

  it('skips when matchCompleteRequired is false', () => {
    const env = { ...baseEnvelope, stopReason: 'maxTicks' as const };
    const violations = runOracles(emptyBundle, env, {
      ...ORACLE_DEFAULTS,
      matchCompleteRequired: false,
    }).filter((v) => v.oracle === 'match-completes');
    expect(violations).toHaveLength(0);
  });
});

describe('no-tick-failures oracle', () => {
  it('passes when bundle.failures is empty', () => {
    const violations = runOracles(emptyBundle, baseEnvelope, ORACLE_DEFAULTS).filter(
      (v) => v.oracle === 'no-tick-failures',
    );
    expect(violations).toHaveLength(0);
  });

  it('fires high-severity per failure', () => {
    const bundle = makeMinimalBundle({
      failures: [
        {
          tick: 7,
          schemaVersion: 1,
          phase: 'systems',
          subsystem: 'system',
          systemName: 's',
          code: 'system_throw',
          message: 'boom',
          commandType: null,
          submissionSequence: null,
          details: null,
          error: { name: 'Error', message: 'boom', stack: null },
        },
      ] as unknown as SessionBundle['failures'],
    });
    const violations = runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS).filter(
      (v) => v.oracle === 'no-tick-failures',
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.severity).toBe('high');
    expect(violations[0]!.tick).toBe(7);
  });
});

describe('no-perf-regression oracle', () => {
  function makeMetricBundle(durations: number[]): SessionBundle {
    return makeMinimalBundle({
      ticks: durations.map((dur, i) => ({
        tick: i + 1,
        diff: {
          tick: i + 1,
          components: {},
          state: { set: [], removed: [] },
          tags: [],
          entities: { created: [], destroyed: [] },
          resources: {},
          metadata: [],
        },
        events: [],
        metrics: { tick: i + 1, durationMs: { total: dur }, simulation: {}, output: {} },
        debug: null,
      })) as unknown as SessionBundle['ticks'],
      endTick: durations.length,
    });
  }

  it('returns no violations when bundle has fewer than 10 ticks (insufficient for z-score)', () => {
    const bundle = makeMetricBundle([5, 5, 5]);
    const violations = runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS).filter(
      (v) => v.oracle === 'no-perf-regression',
    );
    expect(violations).toHaveLength(0);
  });

  it('flags duration outliers above the warmup window', () => {
    const durations = Array.from({ length: 220 }, (_, i) => (i === 210 ? 100 : 5));
    const bundle = makeMetricBundle(durations);
    const violations = runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS).filter(
      (v) => v.oracle === 'no-perf-regression',
    );
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]!.tick).toBe(211);
  });

  it('skips outliers within the warmup window', () => {
    const durations = Array.from({ length: 220 }, (_, i) => (i === 5 ? 100 : 5));
    const bundle = makeMetricBundle(durations);
    const violations = runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS).filter(
      (v) => v.oracle === 'no-perf-regression',
    );
    expect(violations).toHaveLength(0);
  });
});

describe('reconstructPositions', () => {
  it('seeds from initialSnapshot then applies diffs', () => {
    const bundle = makeMinimalBundle({
      initialSnapshotComponents: { position: [[5, { x: 1, y: 1 }]] },
      ticks: [
        {
          tick: 1,
          diff: {
            tick: 1,
            components: { position: { set: [[5, { x: 2, y: 1 }]], removed: [] } },
            state: { set: [], removed: [] },
            tags: [],
            entities: { created: [], destroyed: [] },
            resources: {},
            metadata: [],
          },
          events: [],
          metrics: null,
          debug: null,
        },
        {
          tick: 2,
          diff: {
            tick: 2,
            components: { position: { set: [[5, { x: 3, y: 1 }]], removed: [] } },
            state: { set: [], removed: [] },
            tags: [],
            entities: { created: [], destroyed: [] },
            resources: {},
            metadata: [],
          },
          events: [],
          metrics: null,
          debug: null,
        },
      ] as unknown as SessionBundle['ticks'],
      endTick: 2,
    });
    const timeline = reconstructPositions(bundle);
    expect(timeline.byEntity.get(5)).toEqual([
      { tick: 0, pos: { x: 1, y: 1 } },
      { tick: 1, pos: { x: 2, y: 1 } },
      { tick: 2, pos: { x: 3, y: 1 } },
    ]);
  });

  it('records garrison round-trips as position gaps', () => {
    const gapDiff = (tick: number, position: Record<string, unknown>) => ({
      tick,
      diff: {
        tick,
        components: { position },
        state: { set: [], removed: [] },
        tags: [],
        entities: { created: [], destroyed: [] },
        resources: {},
        metadata: [],
      },
      events: [],
      metrics: null,
      debug: null,
    });
    const bundle = makeMinimalBundle({
      initialSnapshotComponents: { position: [[5, { x: 1, y: 1 }]] },
      ticks: [
        gapDiff(200, { set: [], removed: [5] }),
        gapDiff(900, { set: [[5, { x: 1, y: 1 }]], removed: [] }),
      ] as unknown as SessionBundle['ticks'],
      endTick: 1000,
    });
    const timeline = reconstructPositions(bundle);
    expect(timeline.gaps.get(5)).toEqual([{ from: 200, to: 900 }]);
    expect(timeline.activeUntil.has(5)).toBe(false);
  });
});

describe('runOracles repairs a frozen endTick (full-review H7)', () => {
  const tickAt = (tick: number) => ({
    tick,
    events: [],
    metrics: { durationMs: { total: 0 } },
    diff: { components: {} },
  });
  const ticksOf = (...t: number[]) => t.map(tickAt) as unknown as SessionBundle['ticks'];

  it('centralizes the endTick repair so range oracles see the recorded range', () => {
    const bundle = makeMinimalBundle({ endTick: 0, ticks: ticksOf(0, 8, 17) });
    expect(bundle.metadata.endTick).toBe(0); // frozen going in

    runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS);

    // Repaired from the recorded ticks — pre-fix this stayed 0, blinding the
    // range-scanning oracles (run-oracles.mjs saw 10 vs 32 findings).
    expect(bundle.metadata.endTick).toBe(17);
    expect(bundle.metadata.durationTicks).toBe(17);
  });

  it('leaves an already-finalized endTick untouched (idempotent)', () => {
    const bundle = makeMinimalBundle({ endTick: 42, ticks: ticksOf(0, 5) });
    runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS);
    expect(bundle.metadata.endTick).toBe(42);
  });
});
