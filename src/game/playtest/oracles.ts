import { bundleHotspots, type SessionBundle } from 'civ-engine';
import type { OracleEnvelope, OracleThresholds, OracleViolation } from './types';
import { ORACLE_DEFAULTS } from './types';
import { netManhattanProgress, reconstructPositions } from './positionReplay';

type OracleFn = (
  bundle: SessionBundle,
  envelope: OracleEnvelope,
  thresholds: Required<OracleThresholds>,
) => OracleViolation[];

const matchCompletes: OracleFn = (_bundle, envelope, thresholds) => {
  if (!thresholds.matchCompleteRequired) return [];
  if (envelope.stopReason === 'stopWhen') return [];
  return [{
    oracle: 'match-completes',
    severity: 'high',
    tick: null,
    message:
      `match did not complete: stopReason=${envelope.stopReason}`
      + (envelope.errorMessage ? ` (${envelope.errorMessage})` : ''),
    details: {
      stopReason: envelope.stopReason,
      ticksRun: envelope.ticksRun,
      ...(envelope.details ?? {}),
    },
  }];
};

const noTickFailures: OracleFn = (bundle) =>
  bundle.failures.map((f) => ({
    oracle: 'no-tick-failures',
    severity: 'high' as const,
    tick: f.tick,
    message: `tick ${f.tick} failed: ${f.code} (${f.message})`,
    details: {
      code: f.code,
      message: f.message,
      systemName: f.systemName,
      phase: f.phase,
    },
  }));

const noPerfRegression: OracleFn = (bundle, _envelope, thresholds) => {
  const hotspots = bundleHotspots(bundle, { durationStdevThreshold: 3, includeMarkers: false });
  const violations: OracleViolation[] = [];
  for (const hot of hotspots) {
    if (hot.kind !== 'duration_outlier') continue;
    if (hot.tick < thresholds.perfP99WarmupTicks) continue;
    const hotDetails =
      typeof hot.details === 'object' && hot.details !== null && !Array.isArray(hot.details)
        ? (hot.details as Record<string, unknown>)
        : { raw: hot.details };
    violations.push({
      oracle: 'no-perf-regression',
      severity: 'low',
      tick: hot.tick,
      message: `tick ${hot.tick} duration outlier: ${hot.message}`,
      details: hotDetails,
    });
  }
  if (thresholds.perfP99BudgetMs !== 'auto') {
    const budget = thresholds.perfP99BudgetMs;
    for (const t of bundle.ticks) {
      if (t.tick < thresholds.perfP99WarmupTicks) continue;
      const dur = (t.metrics?.durationMs as { total?: number } | null | undefined)?.total;
      if (typeof dur === 'number' && dur > budget) {
        violations.push({
          oracle: 'no-perf-regression',
          severity: 'medium',
          tick: t.tick,
          message: `tick ${t.tick} took ${dur}ms (budget ${budget}ms)`,
          details: { durationMs: dur, budgetMs: budget },
        });
      }
    }
  }
  return violations;
};

const noPinnedOrOscillating: OracleFn = (bundle, _envelope, thresholds) => {
  const timeline = reconstructPositions(bundle);
  const violations: OracleViolation[] = [];
  const window = thresholds.pinnedWindowTicks;
  const minProgress = thresholds.pinnedNetProgressCells;
  const endTick = bundle.metadata.endTick ?? bundle.metadata.startTick;

  // Only consider unit entities. The bundle stores positions for terrain
  // tiles, resources, and buildings too — all stationary by design — so
  // checking position alone produces false positives. Build a set of
  // entity IDs that hold a `unit` component at any point in the bundle.
  const unitEntities = new Set<number>();
  const initialUnits = (bundle.initialSnapshot as { components?: Record<string, unknown> })
    .components?.unit;
  if (Array.isArray(initialUnits)) {
    for (const [id] of initialUnits as Array<[number, unknown]>) {
      unitEntities.add(id);
    }
  }
  for (const tickEntry of bundle.ticks) {
    const unitDiff = (tickEntry.diff.components as Record<string, unknown>)?.unit as
      | { set?: Array<[number, unknown]>; removed?: number[] }
      | undefined;
    if (!unitDiff) continue;
    for (const [id] of unitDiff.set ?? []) unitEntities.add(id);
    for (const id of unitDiff.removed ?? []) unitEntities.delete(id);
  }

  for (const [entity, events] of timeline.byEntity) {
    if (!unitEntities.has(entity)) continue;
    if (events.length === 0) continue;

    // Pinned-with-no-diffs case: the unit was seeded with an initial position
    // and never emitted a position change. If world ticks have elapsed past
    // (lastEvent.tick + window) without movement, that's a violation.
    if (events.length === 1) {
      const last = events[0]!;
      if (endTick - last.tick >= window) {
        violations.push({
          oracle: 'no-pinned-or-oscillating-units',
          severity: 'medium',
          tick: last.tick,
          message: `unit ${entity} stayed at (${last.pos.x}, ${last.pos.y}) for ${endTick - last.tick} ticks after tick ${last.tick}`,
          details: {
            entity,
            sinceTick: last.tick,
            durationTicks: endTick - last.tick,
            position: last.pos,
          },
        });
      }
      continue;
    }

    // Oscillating / pinned-with-diffs case: slide a window through the
    // events; report when net Manhattan progress within the window is below
    // minProgress.
    for (let i = 0; i < events.length; i++) {
      const start = events[i]!.tick;
      const end = start + window;
      if (end > events[events.length - 1]!.tick) break;
      const progress = netManhattanProgress(events, start, end);
      if (progress < minProgress) {
        violations.push({
          oracle: 'no-pinned-or-oscillating-units',
          severity: 'medium',
          tick: start,
          message:
            `unit ${entity} stayed within ${progress} cells of its starting position`
            + ` over ticks ${start}..${end}`,
          details: { entity, windowStart: start, windowEnd: end, progress },
        });
        break;
      }
    }
  }
  return violations;
};

const ORACLES: OracleFn[] = [
  matchCompletes,
  noTickFailures,
  noPerfRegression,
  noPinnedOrOscillating,
];

// economy-progression is intentionally NOT registered. Implementing it
// requires SessionReplayer.fromBundle(bundle).stateAtTick(T) reconstruction
// + economy-state extraction, which is materially more scope than the other
// oracles and depends on replay-bridge wiring beyond Phase 2. Filed as a
// Phase-6 follow-up in the plan.

export function runOracles(
  bundle: SessionBundle,
  envelope: OracleEnvelope,
  thresholds: OracleThresholds,
): OracleViolation[] {
  const merged = { ...ORACLE_DEFAULTS, ...thresholds };
  return ORACLES.flatMap((o) => o(bundle, envelope, merged));
}
