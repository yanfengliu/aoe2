import { bundleHotspots, type SessionBundle } from 'civ-engine';
import type { OracleEnvelope, OracleThresholds, OracleViolation } from './types';
import { ORACLE_DEFAULTS } from './types';
import { noPinnedOrOscillatingUnits } from './pinnedUnitsOracle';
import { repairBundleEndTick } from './bundleEndTick';

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

const ORACLES: OracleFn[] = [
  matchCompletes,
  noTickFailures,
  noPerfRegression,
  noPinnedOrOscillatingUnits,
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
  // Full-review iter-2 (Codex H7): repair a frozen (0) endTick before scanning
  // so range-scanning oracles (pinned-units) see the recorded range. Centralized
  // in the entrypoint so no caller can forget it — `scripts/run-oracles.mjs`
  // did, producing 10 vs 32 findings on the campaign-4 bundle (22 pinned-unit
  // findings dropped). Idempotent: a bundle whose endTick is already > 0 is
  // untouched, so the callers that already repair (recursive / self-improve)
  // are unaffected.
  repairBundleEndTick(bundle);
  const merged = { ...ORACLE_DEFAULTS, ...thresholds };
  return ORACLES.flatMap((o) => o(bundle, envelope, merged));
}
