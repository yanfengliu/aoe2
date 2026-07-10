// Confinement semantics suites (hard-pinned span, gather exemption,
// lifecycle clamps, churn); drivenness/id-reuse suites live in
// pinnedUnitsOracle.test.ts (shared kit: pinnedOracleTestKit.ts).
import { describe, expect, it } from 'vitest';
import { ORACLE_DEFAULTS } from '../../src/game/playtest/types';
import {
  AI_OWNER_2_STATE,
  diffWith,
  emptyTicks,
  makeBundle,
  pinnedViolations,
  tickEntry,
} from './pinnedOracleTestKit';

describe('no-pinned-or-oscillating-units — hard-pinned span and gather exemption', () => {
  function stationaryGathererBundle(taskAtSnapshots: string, endTick = 3000) {
    return makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 8, y: 8 }]],
        unit: [[1, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: emptyTicks(1, endTick),
      endTick,
      snapshots: [1000, 2000, 3000].filter((t) => t <= endTick).map((tick) => ({
        tick,
        snapshot: {
          components: {
            gatherer: [[1, {
              desiredResource: 'gold',
              hasExplicitGatherOrder: false,
              task: taskAtSnapshots,
              targetResourceId: 77,
              dropOffBuildingId: 78,
              carriedResource: 'gold',
              carriedAmount: 5,
              carryCapacity: 10,
              gatherProgressTicks: 2,
            }]],
          },
        },
      })),
    });
  }

  it('exempts a stationary unit actively gathering at every interior snapshot (zero-walk miner)', () => {
    expect(pinnedViolations(stationaryGathererBundle('gathering'))).toHaveLength(0);
  });

  function retaskSnapshot(bundle: ReturnType<typeof stationaryGathererBundle>, index: number, task: string) {
    const snapshots = (bundle as unknown as {
      snapshots: Array<{ tick: number; snapshot: { components: { gatherer: Array<[number, { task: string }]> } } }>;
    }).snapshots;
    snapshots[index]!.snapshot.components.gatherer[0]![1]!.task = task;
  }

  it('exempts while the LATEST gathering sample keeps the stuck-suffix under pinnedStuckTicks', () => {
    // Duty-cycle sampling catches a healthy loop's walk legs: gathering@1000,
    // to-dropoff@2000, gathering@3000 -> the suffix after the latest
    // 'gathering' evidence is 0 ticks. Quiet.
    const bundle = stationaryGathererBundle('gathering');
    retaskSnapshot(bundle, 1, 'to-dropoff');
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('fires when a once-gathering unit freezes afterward (stale-sample review probe P1)', () => {
    // gathering@1000, then to-dropoff@2000 AND @3000 while never moving: the
    // unit stopped working 2000 ticks before bundle end. One old 'gathering'
    // sample must not exempt the whole frozen suffix.
    const bundle = stationaryGathererBundle('to-dropoff');
    retaskSnapshot(bundle, 0, 'gathering');
    const violations = pinnedViolations(bundle);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toMatch(/stayed at \(8, 8\)/);
  });

  it('ignores bounding samples when the span has interior ones (review probe P2)', () => {
    // Unit gathers at (8,8) (snapshot@1000 'gathering'), walks 6 cells at
    // t1050 (re-anchor), then freezes in 'to-resource' until t3000 with BOTH
    // interior samples showing the frozen task. The pre-span bounding
    // 'gathering' sample is stale evidence about the PREVIOUS span and must
    // not exempt this one.
    const bundle = stationaryGathererBundle('to-resource');
    retaskSnapshot(bundle, 0, 'gathering');
    const ticks = (bundle as unknown as { ticks: unknown[] }).ticks as ReturnType<typeof tickEntry>[];
    ticks[1049] = tickEntry(1050, diffWith(1050, {
      position: { set: [[1, { x: 14, y: 8 }]], removed: [] },
    }));
    const violations = pinnedViolations(bundle);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.details).toMatchObject({ entity: 1, sinceTick: 1050 });
  });

  it('still fires when snapshots show the unit frozen in to-resource (canary freeze class)', () => {
    const violations = pinnedViolations(stationaryGathererBundle('to-resource'));
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toMatch(/stayed at \(8, 8\)/);
  });

  it('fires for a stationary unit with no gatherer at all (military)', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 8, y: 8 }]],
        unit: [[1, { unitType: 'scout', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: emptyTicks(1, 1400),
      endTick: 1400,
    });
    expect(pinnedViolations(bundle)).toHaveLength(1);
  });

  it('does not fire below pinnedStuckTicks even with zero movement', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 8, y: 8 }]],
        unit: [[1, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: emptyTicks(1, 400),
      endTick: 400,
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('respects a custom pinnedStuckTicks threshold', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 8, y: 8 }]],
        unit: [[1, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: emptyTicks(1, 400),
      endTick: 400,
    });
    expect(pinnedViolations(bundle, { ...ORACLE_DEFAULTS, pinnedStuckTicks: 100 })).toHaveLength(1);
  });

  it('uses bounding snapshots as fuzzy evidence when the span contains none', () => {
    // Pinned span 0..1400 with the only snapshot at 1500 ('gathering'): no
    // interior sample exists, the bounding one shows active gathering -> exempt.
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 8, y: 8 }]],
        unit: [[1, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: emptyTicks(1, 1400),
      endTick: 1400,
      snapshots: [{
        tick: 1500,
        snapshot: {
          components: {
            gatherer: [[1, {
              desiredResource: 'gold',
              hasExplicitGatherOrder: false,
              task: 'gathering',
              targetResourceId: 77,
              dropOffBuildingId: 78,
              carriedResource: 'gold',
              carriedAmount: 5,
              carryCapacity: 10,
              gatherProgressTicks: 2,
            }]],
          },
        },
      }],
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('fires when a driven unit moved one cell then wedged past pinnedStuckTicks', () => {
    // The wedged-scout shape: spawn, one in-box step, frozen ever after. The
    // confinement span anchors at the spawn event (the unit never left the
    // box), with the single step counted as an in-box move.
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 0, y: 0 }]],
        unit: [[1, { unitType: 'scout', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: [
        tickEntry(15, diffWith(15, { position: { set: [[1, { x: 1, y: 0 }]], removed: [] } })),
        ...emptyTicks(16, 1400),
      ],
      endTick: 1400,
    });
    const violations = pinnedViolations(bundle);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.details).toMatchObject({ entity: 1, sinceTick: 0, movesInSpan: 1 });
  });
});

describe('no-pinned-or-oscillating-units — lifecycle clamps', () => {
  it('does not fire when a unit garrisons (position removed) before the span elapses', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 0, y: 0 }]],
        unit: [[1, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: [
        tickEntry(5, diffWith(5, { position: { set: [], removed: [1] } })),
        ...emptyTicks(6, 1400),
      ],
      endTick: 1400,
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('does not fire when a unit is destroyed before the span elapses', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 0, y: 0 }]],
        unit: [[1, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: [
        tickEntry(5, diffWith(5, {
          position: { set: [], removed: [1] },
          unit: { set: [], removed: [1] },
        })),
        ...emptyTicks(6, 1400),
      ],
      endTick: 1400,
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('still fires when a unit was destroyed but had been pinned past pinnedStuckTicks before', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 0, y: 0 }]],
        unit: [[1, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: [
        ...emptyTicks(1, 1299),
        tickEntry(1300, diffWith(1300, {
          position: { set: [], removed: [1] },
          unit: { set: [], removed: [1] },
        })),
      ],
      endTick: 1500,
    });
    const violations = pinnedViolations(bundle);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.details).toMatchObject({ entity: 1 });
  });

  it('does not count garrisoned time as confinement on a garrison round-trip (review probe)', () => {
    // Villager garrisons at t200 (position removed), ungarrisons at the SAME
    // cell at t1600, walks off at t1650. It had no world position for 1400 of
    // those ticks — neither the 200-tick pre-garrison span nor the 50-tick
    // post-ungarrison span is a pin.
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 5, y: 5 }]],
        unit: [[1, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: [
        tickEntry(200, diffWith(200, { position: { set: [], removed: [1] } })),
        tickEntry(1600, diffWith(1600, { position: { set: [[1, { x: 5, y: 5 }]], removed: [] } })),
        tickEntry(1650, diffWith(1650, { position: { set: [[1, { x: 11, y: 5 }]], removed: [] } })),
        ...emptyTicks(1651, 1900),
      ],
      endTick: 1900,
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('fires when a unit ungarrisons and then freezes past pinnedStuckTicks', () => {
    // The confinement clock restarts at the ungarrison re-set; a real freeze
    // after coming back out still fires, anchored at the reactivation.
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 5, y: 5 }]],
        unit: [[1, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: [
        tickEntry(100, diffWith(100, { position: { set: [], removed: [1] } })),
        tickEntry(200, diffWith(200, { position: { set: [[1, { x: 5, y: 5 }]], removed: [] } })),
        ...emptyTicks(201, 1500),
      ],
      endTick: 1500,
    });
    const violations = pinnedViolations(bundle);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.details).toMatchObject({ entity: 1, sinceTick: 200 });
  });
});

describe('no-pinned-or-oscillating-units — confinement churn (oscillation)', () => {
  function pingPongBundle(ticks: number) {
    return makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 5, y: 5 }]],
        unit: [[1, { unitType: 'scout', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: Array.from({ length: ticks }, (_, i) =>
        tickEntry(i + 1, diffWith(i + 1, {
          position: { set: [[1, { x: i % 2 === 0 ? 6 : 5, y: 5 }]], removed: [] },
        }))),
      endTick: ticks,
    });
  }

  it('fires when a unit churns inside the box past pinnedStuckTicks (wedge ping-pong)', () => {
    const violations = pinnedViolations(pingPongBundle(1300));
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toMatch(/stayed within .* moves inside the box/);
    expect(violations[0]!.details).toMatchObject({ entity: 1, sinceTick: 0, movesInSpan: 1300 });
  });

  it('does not fire for a transient ping-pong shorter than pinnedStuckTicks', () => {
    expect(pinnedViolations(pingPongBundle(400))).toHaveLength(0);
  });

  it('does not fire for sparse position events (stand-and-gather stretches between moves)', () => {
    // A villager that arrives, stands gathering ~60 ticks, walks a few cells,
    // stands again: few events per window, displacement grows, tail short.
    const events: Array<[number, { x: number; y: number }]> = [
      [10, { x: 2, y: 0 }],
      [70, { x: 2, y: 1 }],
      [72, { x: 3, y: 1 }],
      [130, { x: 4, y: 1 }],
      [190, { x: 5, y: 2 }],
      [250, { x: 6, y: 2 }],
    ];
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 0, y: 0 }]],
        unit: [[1, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: events.map(([tick, pos]) =>
        tickEntry(tick, diffWith(tick, { position: { set: [[1, pos]], removed: [] } }))),
      endTick: 300,
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('does not fire when a driven unit makes steady progress', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 0, y: 0 }]],
        unit: [[1, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: Array.from({ length: 700 }, (_, i) =>
        tickEntry(i + 1, diffWith(i + 1, {
          position: { set: [[1, { x: (i + 1) % 15, y: Math.floor((i + 1) / 15) }]], removed: [] },
        }))),
      endTick: 1400,
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });
});

describe('no-pinned-or-oscillating-units — wide-box oscillation (review probe)', () => {
  // Shuttle between two poles `amplitude` cells apart, one leg per `period`
  // ticks, stepping cell-by-cell (realistic per-cell position diffs).
  function shuttleBundle(amplitude: number, ticks: number, withGatherSnapshots = false) {
    const entries = [];
    for (let t = 1; t <= ticks; t++) {
      const phase = t % (2 * amplitude);
      const x = 5 + (phase < amplitude ? phase : 2 * amplitude - phase);
      entries.push(tickEntry(t, diffWith(t, {
        position: { set: [[1, { x, y: 5 }]], removed: [] },
      })));
    }
    return makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 5, y: 5 }]],
        unit: [[1, { unitType: 'scout', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: entries,
      endTick: ticks,
      snapshots: withGatherSnapshots
        ? [1000, 2000, 3000].filter((t) => t <= ticks).map((tick) => ({
          tick,
          snapshot: {
            components: {
              gatherer: [[1, {
                desiredResource: 'wood',
                hasExplicitGatherOrder: false,
                task: 'gathering',
                targetResourceId: 77,
                dropOffBuildingId: 78,
                carriedResource: 'wood',
                carriedAmount: 5,
                carryCapacity: 10,
                gatherProgressTicks: 2,
              }]],
            },
          },
        }))
        : [],
    });
  }

  it('fires on a sustained amplitude-4 shuttle the tight box cannot see (livelock class)', () => {
    // Each leg exceeds pinnedNetProgressCells (3) so the tight span re-anchors
    // every leg and the pinned verdict is blind; the unit is still trapped in
    // a 4-cell corridor for the whole run.
    const violations = pinnedViolations(shuttleBundle(4, 3000));
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toMatch(/oscillat/);
    expect(violations[0]!.details).toMatchObject({ entity: 1 });
  });

  it('stays quiet for a working gatherer shuttling with fresh gathering samples', () => {
    expect(pinnedViolations(shuttleBundle(4, 3000, true))).toHaveLength(0);
  });

  it('stays quiet for a shuttle shorter than pinnedStuckTicks', () => {
    expect(pinnedViolations(shuttleBundle(4, 900))).toHaveLength(0);
  });

  it('stays quiet for wide patrol loops that leave the oscillation box', () => {
    // A 10-cell corridor sweep exceeds pinnedOscillationBoxCells (6) each
    // leg, re-anchoring the wide span — long patrols are healthy movement.
    expect(pinnedViolations(shuttleBundle(10, 3000))).toHaveLength(0);
  });

  it('reports a frozen unit once (pinned), not once per box', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 8, y: 8 }]],
        unit: [[1, { unitType: 'scout', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: emptyTicks(1, 1400),
      endTick: 1400,
    });
    expect(pinnedViolations(bundle)).toHaveLength(1);
  });
});
