// Drivenness gate + unit-lifetime (id reuse) suites; confinement/churn
// suites live in pinnedUnitsOracle.confinement.test.ts (shared kit:
// pinnedOracleTestKit.ts).
import { describe, expect, it } from 'vitest';
import {
  AI_OWNER_2_STATE,
  diffWith,
  emptyTicks,
  makeBundle,
  pinnedViolations,
  tickEntry,
} from './pinnedOracleTestKit';

describe('no-pinned-or-oscillating-units — drivenness gate', () => {
  it('does not fire for units of an undriven owner (inert human class)', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 5, y: 5 }]],
        unit: [[1, { unitType: 'villager', owner: 1 }]],
      },
      ticks: emptyTicks(1, 1400),
      endTick: 1400,
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('fires for a hard-pinned unit of an AI-driven owner (idle scout class)', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 5, y: 5 }]],
        unit: [[1, { unitType: 'scout', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: emptyTicks(1, 1400),
      endTick: 1400,
    });
    const violations = pinnedViolations(bundle);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.details).toMatchObject({ entity: 1, position: { x: 5, y: 5 } });
  });

  it('finds AI drivenness in a later periodic snapshot, not only the initial one', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 5, y: 5 }]],
        unit: [[1, { unitType: 'scout', owner: 2 }]],
      },
      ticks: emptyTicks(1, 1400),
      endTick: 1400,
      snapshots: [{ tick: 500, snapshot: { state: AI_OWNER_2_STATE, components: {} } }],
    });
    expect(pinnedViolations(bundle)).toHaveLength(1);
  });

  it('treats a recorded command referencing the owner entity as drivenness', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 5, y: 5 }]],
        unit: [[1, { unitType: 'villager', owner: 1 }]],
      },
      ticks: emptyTicks(1, 1400),
      endTick: 1400,
      commands: [{ submissionTick: 3, sequence: 0, type: 'unit.move', data: { unitIds: [1], target: { x: 9, y: 9 } } }],
    });
    expect(pinnedViolations(bundle)).toHaveLength(1);
  });

  it('does not fire on stationary buildings/resources/terrain (no unit component)', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: { position: [[42, { x: 0, y: 0 }]] },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: emptyTicks(1, 1400),
      endTick: 1400,
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('ignores unit.attack commands and target references for drivenness (auto-retaliation)', () => {
    // The auto-aggression system issues unit.attack on behalf of ANY owner's
    // attacked units. An inert human whose villager retaliates (actor) or is
    // attacked (target) is still undriven — its stationary units stay quiet.
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 5, y: 5 }], [7, { x: 9, y: 9 }]],
        unit: [[1, { unitType: 'villager', owner: 1 }], [7, { unitType: 'militia', owner: 2 }]],
      },
      ticks: Array.from({ length: 1400 }, (_, i) =>
        tickEntry(i + 1, diffWith(i + 1, {
          position: { set: [[7, { x: (i + 9) % 14, y: 9 }]], removed: [] },
        }))),
      endTick: 1400,
      commands: [
        { submissionTick: 511, sequence: 0, type: 'unit.attack', data: { unitId: 7, targetEntityId: 1, targetEntityKind: 'unit' } },
        { submissionTick: 634, sequence: 1, type: 'unit.attack', data: { unitId: 1, targetEntityId: 7, targetEntityKind: 'unit' } },
      ],
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('resolves a command on a reused id to the owner at the command tick only', () => {
    // Entity 9: owner-1 villager dies at 300; id reused at 500 as an owner-2
    // villager that never moves. A command referencing 9 at tick 600 belongs
    // to owner 2's phase — owner 1 must NOT become driven through it
    // (lifetime-union leak observed on the real canary bundle), so owner-1's
    // stationary entity 1 stays quiet while owner-2's entity 9 fires.
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 5, y: 5 }], [9, { x: 7, y: 7 }]],
        unit: [[1, { unitType: 'villager', owner: 1 }], [9, { unitType: 'villager', owner: 1 }]],
      },
      ticks: [
        tickEntry(300, diffWith(300, {
          position: { set: [], removed: [9] },
          unit: { set: [], removed: [9] },
        })),
        tickEntry(500, diffWith(500, {
          position: { set: [[9, { x: 3, y: 3 }]], removed: [] },
          unit: { set: [[9, { unitType: 'villager', owner: 2 }]], removed: [] },
        })),
        ...emptyTicks(501, 1900),
      ],
      endTick: 1900,
      commands: [{ submissionTick: 600, sequence: 0, type: 'unit.move', data: { unitIds: [9], target: { x: 9, y: 9 } } }],
    });
    const violations = pinnedViolations(bundle);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.details).toMatchObject({ entity: 9, sinceTick: 500 });
  });
});

describe('no-pinned-or-oscillating-units — unit-lifetime segmentation (id reuse)', () => {
  it('does not conflate a reused id resource phase with its later moving unit phase', () => {
    // Entity 9 is a berry bush (position only) from tick 0; depleted at 400
    // (position removed); the id is reused at 500 for a trained villager that
    // then moves every other tick. The old whole-bundle timeline anchored a
    // stationary window at tick 0 and fired; per-lifetime evaluation is quiet.
    const moves = Array.from({ length: 100 }, (_, i) =>
      tickEntry(500 + i * 2, diffWith(500 + i * 2, {
        position: { set: [[9, { x: 3 + i, y: 3 }]], removed: [] },
        ...(i === 0 ? { unit: { set: [[9, { unitType: 'villager', owner: 2 }]], removed: [] } } : {}),
      })));
    const bundle = makeBundle({
      initialSnapshotComponents: { position: [[9, { x: 7, y: 7 }]] },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: [
        tickEntry(400, diffWith(400, { position: { set: [], removed: [9] } })),
        ...moves,
      ],
      endTick: 1400,
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('fires when the reused id unit phase itself wedges', () => {
    const bundle = makeBundle({
      initialSnapshotComponents: { position: [[9, { x: 7, y: 7 }]] },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: [
        tickEntry(400, diffWith(400, { position: { set: [], removed: [9] } })),
        tickEntry(500, diffWith(500, {
          position: { set: [[9, { x: 3, y: 3 }]], removed: [] },
          unit: { set: [[9, { unitType: 'villager', owner: 2 }]], removed: [] },
        })),
        ...emptyTicks(501, 1900),
      ],
      endTick: 1900,
    });
    const violations = pinnedViolations(bundle);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.details).toMatchObject({ entity: 9, sinceTick: 500 });
  });

  it('does not fire for the earlier unit phase when the unit died before pinnedStuckTicks', () => {
    // Unit lives stationary from 0 to 300 (destroyed), id reused as a bush
    // that persists to endTick. Old code: wasEverUnit + stationary-to-endTick
    // fired; per-lifetime: 300-tick span < 600 stays quiet.
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[9, { x: 7, y: 7 }]],
        unit: [[9, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: [
        tickEntry(300, diffWith(300, {
          position: { set: [], removed: [9] },
          unit: { set: [], removed: [9] },
        })),
        tickEntry(350, diffWith(350, { position: { set: [[9, { x: 2, y: 2 }]], removed: [] } })),
        ...emptyTicks(351, 1200),
      ],
      endTick: 1900,
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('splits lifetimes on a same-tick kill + reuse (netted remove+set, review probe)', () => {
    // The engine's ComponentStore.set() clears the removed mark, so a unit
    // destroyed and its id reused in the SAME tick emits a pure unit.set with
    // no removal. An owner (or unitType) change on an open interval is the
    // lifetime boundary: neither the 800-tick predecessor span nor the
    // 500-tick successor span reaches pinnedStuckTicks.
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[9, { x: 7, y: 7 }]],
        unit: [[9, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: { 'aoe2.aiStates': [[2, { difficulty: 'standard' }], [3, { difficulty: 'standard' }]] },
      ticks: [
        tickEntry(800, diffWith(800, {
          unit: { set: [[9, { unitType: 'villager', owner: 3 }]], removed: [] },
        })),
        ...emptyTicks(801, 1300),
      ],
      endTick: 1300,
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('keeps a value-replace unit.set (same owner and type) as one continuous lifetime', () => {
    // Serialization value-replaces (hp tick, stance change) must not reset
    // the confinement clock: a frozen unit with a mid-span same-owner
    // unit.set still fires anchored at tick 0.
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[9, { x: 7, y: 7 }]],
        unit: [[9, { unitType: 'villager', owner: 2 }]],
      },
      initialSnapshotState: AI_OWNER_2_STATE,
      ticks: [
        tickEntry(800, diffWith(800, {
          unit: { set: [[9, { unitType: 'villager', owner: 2 }]], removed: [] },
        })),
        ...emptyTicks(801, 1300),
      ],
      endTick: 1300,
    });
    const violations = pinnedViolations(bundle);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.details).toMatchObject({ entity: 9, sinceTick: 0 });
  });
});

describe('no-pinned-or-oscillating-units — drivenness actor whitelist (review probe)', () => {
  it('does not mark an owner driven through unit.gather resourceId (farm hybrid target)', () => {
    // unit.gather carries the TARGET resource id; farms are building+resource
    // hybrids whose entity has a building owner event, so the old suffix
    // heuristic leaked drivenness onto the farm's BUILDER. Owner 1 (inert,
    // farm builder) must stay undriven: its stationary villager 1 is quiet.
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[1, { x: 5, y: 5 }], [55, { x: 9, y: 9 }], [7, { x: 12, y: 12 }]],
        unit: [[1, { unitType: 'villager', owner: 1 }], [7, { unitType: 'villager', owner: 2 }]],
        building: [[55, { buildingType: 'farm', owner: 1 }]],
      },
      ticks: Array.from({ length: 1400 }, (_, i) =>
        tickEntry(i + 1, diffWith(i + 1, {
          position: { set: [[7, { x: (i + 1) % 14, y: 12 }]], removed: [] },
        }))),
      endTick: 1400,
      commands: [{ submissionTick: 10, sequence: 0, type: 'unit.gather', data: { unitId: 7, resourceId: 55 } }],
    });
    expect(pinnedViolations(bundle)).toHaveLength(0);
  });

  it('marks the owner driven directly from market.action playerId (owner number, not entity id)', () => {
    // playerId IS the driven owner; the old heuristic resolved it as an
    // ENTITY id (usually a terrain tile) and learned nothing. A market trade
    // is unambiguous driving: owner 2's frozen villager must fire.
    const bundle = makeBundle({
      initialSnapshotComponents: {
        position: [[9, { x: 7, y: 7 }]],
        unit: [[9, { unitType: 'villager', owner: 2 }]],
      },
      ticks: emptyTicks(1, 1400),
      endTick: 1400,
      commands: [{ submissionTick: 10, sequence: 0, type: 'market.action', data: { playerId: 2, actionType: 'sell-food' } }],
    });
    const violations = pinnedViolations(bundle);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.details).toMatchObject({ entity: 9 });
  });
});
