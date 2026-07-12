// Shared fixtures for the self-improvement-loop tests (extractImprovement-
// FindingsFromRun + buildSelfImprovementLedger). Extracted from
// selfImprovementLoop.test.ts so that file stays under the 500-LOC budget.
import {
  IMPROVEMENT_FINDING_SCHEMA_VERSION,
  type ImprovementFinding,
  type Marker,
  type SessionBundle,
} from 'civ-engine';

import type { ConformanceFinding, ConformanceTraceRow } from '../../src/game/playtest/conformanceProbe';
import type { SelfImprovementRunArtifacts } from '../../src/game/playtest/selfImprovementLoop';
import type { OracleViolation } from '../../src/game/playtest/types';

export const FIXED_NOW = '2026-07-08T12:00:00.000Z';

export function conformanceFinding(overrides: Partial<ConformanceFinding> = {}): ConformanceFinding {
  return {
    category: 'ux-gap',
    area: 'command-card',
    observed: 'No visible age-up command.',
    expected: 'The Town Center exposes age-up when prerequisites are met.',
    severity: 'medium',
    suggestion: 'Expose age-up in the command card.',
    ...overrides,
  };
}

export function traceRow(overrides: Partial<ConformanceTraceRow> = {}): ConformanceTraceRow {
  return {
    decisionIndex: 0,
    tickBefore: 250,
    tickAfter: 500,
    thought: 'Inspect command card.',
    commands: [{ type: 'queue.research' }],
    costUsd: 0.1,
    stopReason: 'normal',
    dispatchEvents: [{ commandType: 'queue.research', accepted: true }],
    ...overrides,
  };
}

export function bundle(markers: Marker[] = [], endTick = 1000): SessionBundle {
  return {
    schemaVersion: 1,
    metadata: {
      sessionId: 'session-1',
      startTick: 0,
      endTick,
      durationTicks: endTick,
      engineVersion: '1.4.0',
      nodeVersion: process.version,
    },
    initialSnapshot: {},
    ticks: [],
    commands: [],
    executions: [],
    failures: [],
    snapshots: [],
    markers,
    attachments: [],
  } as unknown as SessionBundle;
}

export function runArtifacts(
  overrides: Partial<SelfImprovementRunArtifacts> & {
    markers?: Marker[];
    findings?: ConformanceFinding[];
    traceRows?: ConformanceTraceRow[];
    oracleViolations?: OracleViolation[];
  } = {},
): SelfImprovementRunArtifacts {
  const traceRows = overrides.traceRows ?? [traceRow()];
  return {
    id: overrides.id ?? 'current',
    prefix: overrides.prefix ?? 'output/playtests-llm/current',
    bundle: overrides.bundle ?? bundle(overrides.markers ?? []),
    envelope: overrides.envelope ?? {
      stopReason: 'maxTicks',
      ticksRun: 500,
      decisionsRun: 1,
      totalCostUsd: 0.1,
      maxTicks: 1000,
      ...(overrides.findings ? { findings: overrides.findings } : {}),
    },
    traceRows,
    ...(overrides.oracleViolations ? { oracleViolations: overrides.oracleViolations } : {}),
  };
}

export function improvementFinding(
  id: string,
  nextAction: ImprovementFinding['nextAction'],
  overrides: Partial<ImprovementFinding> = {},
): ImprovementFinding {
  return {
    schemaVersion: IMPROVEMENT_FINDING_SCHEMA_VERSION,
    id,
    title: `Finding ${id}`,
    severity: 'high',
    category: 'bug',
    area: 'loop',
    observed: 'A loop issue was observed.',
    expected: 'The loop should classify it.',
    suggestion: 'Classify and route it.',
    evidence: [{ kind: 'tick', tick: 500 }],
    verificationStatus: 'unverified',
    nextAction,
    ...overrides,
  };
}

export function improvementMarker(finding: ImprovementFinding): Marker {
  return {
    id: `marker-${finding.id}`,
    tick: 500,
    kind: 'annotation',
    provenance: 'game',
    text: finding.title,
    data: {
      author: 'agent',
      severity: 'bug',
      category: 'ai',
      improvementLoop: {
        schemaVersion: IMPROVEMENT_FINDING_SCHEMA_VERSION,
        type: 'finding',
        finding,
      },
    } as unknown as Marker['data'],
  };
}
