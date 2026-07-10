// Shared scaffolding for the no-pinned-or-oscillating-units oracle suites
// (pinnedUnitsOracle.test.ts + pinnedUnitsOracle.confinement.test.ts).
// Semantics under test (2026-07-09 canary-drill fix):
//   - per unit-lifetime evaluation, so a reused entity id's resource phase is
//     never conflated with its later unit phase;
//   - only DRIVEN owners are evaluated (an AI state in any snapshot, or a
//     recorded command resolving to one of the owner's entities) — an inert
//     human's idle units are correct behavior, not pinning;
//   - ONE confinement rule: pinned = confined within a pinnedNetProgressCells
//     box for >= pinnedStuckTicks, frozen or churning alike. Productive
//     short-haul circuits break confinement as villagers re-target; a
//     confined span is exempt while snapshots show the unit actively
//     'gathering' (the zero-walk miner: mine and drop-off both adjacent),
//     while a unit frozen in 'to-resource'/'idle' still fires (canary
//     freeze class).

import type { SessionBundle } from 'civ-engine';
import { runOracles } from '../../src/game/playtest/oracles';
import { ORACLE_DEFAULTS, type OracleEnvelope } from '../../src/game/playtest/types';

export interface TickEntryish {
  tick: number;
  diff: Record<string, unknown>;
  events: unknown[];
  metrics: unknown;
  debug: unknown;
}

export interface BundleOverrides {
  ticks?: TickEntryish[];
  endTick?: number;
  initialSnapshotComponents?: Record<string, unknown>;
  initialSnapshotState?: Record<string, unknown>;
  snapshots?: Array<{ tick: number; snapshot: { components?: Record<string, unknown>; state?: Record<string, unknown> } }>;
  commands?: Array<Record<string, unknown>>;
}

export function makeBundle(overrides: BundleOverrides = {}): SessionBundle {
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
      state: overrides.initialSnapshotState ?? {},
      tags: [],
      rng: { state: 0 },
      componentOptions: {},
      metadata: {},
    },
    ticks: overrides.ticks ?? [],
    commands: overrides.commands ?? [],
    executions: [],
    failures: [],
    markers: [],
    attachments: [],
    snapshots: overrides.snapshots ?? [],
  } as unknown as SessionBundle;
}

export const baseEnvelope: OracleEnvelope = {
  stopReason: 'stopWhen',
  ticksRun: 100,
  seed: 'test',
  scenario: 'test',
  runStartedAt: '2026-07-09T00:00:00Z',
  runCompletedAt: '2026-07-09T00:01:00Z',
};

// Owner 2 driven via an AI state entry, mirroring the real bundle shape
// (state key 'aoe2.aiStates' holding serialized Map entries).
export const AI_OWNER_2_STATE = { 'aoe2.aiStates': [[2, { difficulty: 'standard' }]] };

export function emptyDiff(tick: number) {
  return {
    tick,
    components: {},
    state: { set: [], removed: [] },
    tags: [],
    entities: { created: [], destroyed: [] },
    resources: {},
    metadata: [],
  };
}

export function diffWith(tick: number, components: Record<string, unknown>) {
  return {
    tick,
    components,
    state: { set: [], removed: [] },
    tags: [],
    entities: { created: [], destroyed: [] },
    resources: {},
    metadata: [],
  };
}

export function tickEntry(tick: number, diff: Record<string, unknown>): TickEntryish {
  return { tick, diff, events: [], metrics: null, debug: null };
}

export function emptyTicks(fromTick: number, toTick: number): TickEntryish[] {
  return Array.from({ length: toTick - fromTick + 1 }, (_, i) =>
    tickEntry(fromTick + i, emptyDiff(fromTick + i)));
}

export function pinnedViolations(bundle: SessionBundle, thresholds = ORACLE_DEFAULTS) {
  return runOracles(bundle, baseEnvelope, thresholds).filter(
    (v) => v.oracle === 'no-pinned-or-oscillating-units',
  );
}
