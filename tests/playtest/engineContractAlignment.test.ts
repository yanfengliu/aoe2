import { describe, expect, it } from 'vitest';
import {
  assertImprovementFinding,
  IMPROVEMENT_FINDING_SCHEMA_VERSION,
  type ImprovementFinding,
  type Marker,
  type SessionBundle,
} from 'civ-engine';

import { oracleViolationsToImprovementFindings } from '../../src/game/playtest/oracleImprovementFindings';
import {
  buildSelfImprovementLedger,
  type SelfImprovementRunArtifacts,
} from '../../src/game/playtest/selfImprovementLoop';
import type { OracleViolation } from '../../src/game/playtest/types';

const FIXED_NOW = '2026-07-08T12:00:00.000Z';

function bundle(markers: Marker[] = []): SessionBundle {
  return {
    schemaVersion: 1,
    metadata: {
      sessionId: 'session-1',
      startTick: 0,
      endTick: 1000,
      durationTicks: 1000,
      engineVersion: '1.6.0',
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

function runArtifacts(overrides: {
  markers?: Marker[];
  oracleViolations?: OracleViolation[];
} = {}): SelfImprovementRunArtifacts {
  return {
    id: 'current',
    prefix: 'output/playtests-llm/current',
    bundle: bundle(overrides.markers ?? []),
    envelope: { stopReason: 'maxTicks', ticksRun: 500, decisionsRun: 1, totalCostUsd: 0.1 },
    traceRows: [],
    ...(overrides.oracleViolations ? { oracleViolations: overrides.oracleViolations } : {}),
  };
}

function improvementFinding(id: string, nextAction: ImprovementFinding['nextAction']): ImprovementFinding {
  return {
    schemaVersion: IMPROVEMENT_FINDING_SCHEMA_VERSION,
    id,
    title: `Finding ${id}`,
    severity: 'high',
    category: 'bug',
    observed: 'A loop issue was observed.',
    evidence: [{ kind: 'tick', tick: 500 }],
    verificationStatus: 'unverified',
    nextAction,
  };
}

function improvementMarker(finding: ImprovementFinding): Marker {
  return {
    id: `marker-${finding.id}`,
    tick: 500,
    kind: 'annotation',
    provenance: 'game',
    text: finding.title,
    data: {
      improvementLoop: {
        schemaVersion: finding.schemaVersion,
        type: 'finding',
        finding,
      },
    } as unknown as Marker['data'],
  };
}

describe('civ-engine 1.6 alignment', () => {
  it('classifies widened v2 next actions as proposal-only routing', () => {
    const current = runArtifacts({
      markers: [
        improvementMarker(improvementFinding('harness', 'improveHarness')),
        improvementMarker(improvementFinding('feedback', 'fileEngineFeedback')),
        improvementMarker(improvementFinding('regression', 'addRegression')),
        improvementMarker(improvementFinding('design', 'updateDesign')),
      ],
    });
    const ledger = buildSelfImprovementLedger({
      generatedAt: FIXED_NOW,
      current,
      verification: {
        current: { kind: 'replay-self-check', ok: true, checkedSegments: 1, skippedSegments: 0 },
      },
    });
    expect(ledger.findings.map((f) => [f.id, f.classification.kind, f.classification.autoFixEligible])).toEqual([
      ['harness', 'proposal', false],
      ['feedback', 'proposal', false],
      ['regression', 'proposal', false],
      ['design', 'proposal', false],
    ]);
  });

  it('gates oracle-sourced verified status on strong replay evidence and stamps the method', () => {
    const violation: OracleViolation = {
      oracle: 'match-completes',
      severity: 'high',
      tick: 500,
      message: 'Match did not complete.',
    };
    const strong = buildSelfImprovementLedger({
      generatedAt: FIXED_NOW,
      current: runArtifacts({ oracleViolations: [violation] }),
      verification: {
        current: { kind: 'replay-self-check', ok: true, checkedSegments: 1, skippedSegments: 0 },
      },
    });
    const strongFinding = strong.findings[0];
    expect(strongFinding?.verificationStatus).toBe('verified');
    expect(strongFinding?.finding.verificationMethod).toBe('metric');
    expect(() =>
      assertImprovementFinding(strongFinding?.finding, { requireVerificationEvidence: true }),
    ).not.toThrow();

    const weak = buildSelfImprovementLedger({
      generatedAt: FIXED_NOW,
      current: runArtifacts({ oracleViolations: [violation] }),
      verification: {
        current: { kind: 'replay-self-check', ok: false, error: 'state divergence at tick 12' },
      },
    });
    expect(weak.findings[0]?.verificationStatus).toBe('unverified');
    expect(weak.findings[0]?.finding.verificationMethod).toBeUndefined();
  });

  it('stamps the minimal schema version on oracle-sourced findings', () => {
    const findings = oracleViolationsToImprovementFindings({
      id: 'run',
      bundle: bundle(),
      oracleViolations: [
        { oracle: 'no-tick-failures', severity: 'medium', tick: 100, message: 'tick failed' },
      ],
    });
    expect(findings[0]?.schemaVersion).toBe(1);
    expect(findings[0]?.nextAction).toBe('manualFix');
  });
});
