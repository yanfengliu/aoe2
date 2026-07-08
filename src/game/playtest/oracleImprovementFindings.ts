import {
  minimalImprovementFindingSchemaVersion,
  type ImprovementFinding,
  type SessionBundle,
} from 'civ-engine';

import type { JsonValue, OracleViolation } from './types';

export interface OracleImprovementRunContext {
  id: string;
  bundle: SessionBundle;
  oracleViolations?: readonly OracleViolation[];
}

export function oracleViolationsToImprovementFindings(
  run: OracleImprovementRunContext,
): ImprovementFinding[] {
  const violations = run.oracleViolations ?? [];
  return violations.map((violation, index) => {
    const sessionId = run.bundle.metadata.sessionId;
    const details = toJsonValue(violation.details);
    const tickPart = violation.tick === null ? 'run' : String(violation.tick);
    const evidence: NonNullable<ImprovementFinding['evidence']> = [
      { kind: 'bundle', bundleId: sessionId, sessionId },
      ...(violation.tick === null ? [] : [{ kind: 'tick' as const, tick: violation.tick }]),
      {
        kind: 'metric',
        label: violation.oracle,
        value: violation.message,
        ...(details !== undefined ? { data: details } : {}),
      },
    ];
    const nextAction = violation.severity === 'low' ? 'observeMore' : 'manualFix';
    return {
      schemaVersion: minimalImprovementFindingSchemaVersion(nextAction),
      id: ['aoe2-oracle', slugIdPart(violation.oracle), tickPart, String(index)].join('-'),
      title: violation.oracle,
      severity: violation.severity,
      category: oracleCategory(violation.oracle),
      area: violation.oracle,
      observed: violation.message,
      expected: `Oracle "${violation.oracle}" should pass for this run.`,
      suggestion: `Inspect the recorded bundle and address the ${violation.oracle} violation.`,
      evidence,
      verificationStatus: 'verified',
      nextAction,
      disposition: 'candidate',
      sourceRun: {
        schemaVersion: 1,
        id: run.id,
        sessionId,
        bundleId: sessionId,
        tags: ['aoe2', 'oracle'],
      },
      data: {
        aoe2OracleViolation: {
          oracle: violation.oracle,
          severity: violation.severity,
          tick: violation.tick,
          message: violation.message,
          ...(details !== undefined ? { details } : {}),
        },
      },
    };
  });
}

function oracleCategory(oracle: string): ImprovementFinding['category'] {
  switch (oracle) {
    case 'no-perf-regression':
      return 'performance';
    case 'match-completes':
      return 'regression';
    case 'no-tick-failures':
    case 'no-pinned-or-oscillating-units':
      return 'bug';
    default:
      return 'regression';
  }
}

// Exported: also the shared path-safe segment for proposal directories, so
// propose-fix and playtest-recursive derive identical on-disk layouts even
// for free-text (marker-derived) oracle names.
export function slugIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return String(value);
  }
}
