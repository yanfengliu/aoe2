// A continuously-replenished head-on jam, driven through the real arbiter with
// fine-grid movement modelled at the real walk speed, must admit only the
// lowest id for exactly the starvation threshold and then relieve the unit it
// was starving.
//
// Why this test exists (review E8): the shipped fairness tests supply each
// member's clock as an oracle and never derive it from cell state, so two
// one-line mutants of the arbiter passed every movement gate in the repo —
// stamping the clock on every consult (the rejected attempt 2, behaviourally
// the pre-fix lowest-id rule), and a threshold of 1 (the rotation engaging on
// every healthy jam, the regression attempt 1 was rejected for). This is the
// gate that fails under both. Verified by running them against the movement
// subset (nine files, 42 tests) on 2026-09-02:
//
//   M1 — stamp on every consult (`const clock = activeWorld.tick;` in the
//   arbiter's stamp, in place of `trafficProgressClock(...)`):
//     × admits only the lowest id for the whole threshold, then relieves the
//       waiter within a few crossings
//       → the waiter was never admitted in 1200 ticks — it starved for the
//         whole run: expected null not to be null        (1 failed | 41 passed)
//   M2 — `TRAFFIC_STARVATION_TICKS = 1`:
//     × (same case)
//       → the waiter was admitted before it had starved past the threshold:
//         expected 79 to be greater than 750
//     × movementTrafficFairness: is tuned to 750 ticks of contested waiting
//       → the threshold moved: re-derive this file: expected 1 to be 750
//     × movementTrafficFairness: the two boundary cases
//       → expected 2460 to be 2432                       (4 failed | 38 passed)
//   M1c — plain lowest-id election (`return true` for `starved === -1` in
//   `electTrafficWinnerDetailed`, the pre-v0.3.175 rule outright):
//     × (same case)
//       → the waiter was never admitted in 1200 ticks — it starved for the
//         whole run: expected null not to be null
//     × movementTrafficFairness: admits every member / bounds the wait /
//       both relief cases
//       → these jam members are never admitted — they starve: expected
//         [ 2434, 2436, 2443, … ] to deeply equal []     (5 failed | 37 passed)
//
// All three re-run on 2026-09-02 by a second session against the same nine
// files with identical results, and the source restored bit-for-bit after
// each (the runner: apply with sed, run, copy the backup back, `cmp`).
//
// The jam is the seed-2 geometry in miniature: a one-wide lane, three
// westbound villagers stacked in one cell against one eastbound villager in
// the next, and every westbound villager that gets through is put back at the
// head of the stream, so the eastbound one is never admitted by lowest-id.
// Movement is modelled as the game does it — 0.32 fine units per admitted
// tick, a cell every 13 grants — so "crossing a cell" is the same event the
// arbiter stamps on.

import { World, type Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { unitCommandsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createMovementTrafficOps } from '../../src/game/simulation/bridge/movementTrafficOps';
import {
  UNIT_SUBGRID_RESOLUTION,
  UNIT_SUBGRID_STEP_PER_TICK,
  type GameCommands,
  type GameComponents,
  type GameEvents,
  type GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitTransformComponent } from '../../src/game/simulation/types';

/** Admitted ticks a unit needs to cross one cell at the base walk speed: 13. */
const GRANTS_PER_CELL = Math.ceil(UNIT_SUBGRID_RESOLUTION / UNIT_SUBGRID_STEP_PER_TICK);
/** The tuned threshold as a LITERAL, so that the "not before" assertion pins
 *  the number instead of following a mutated constant; the fairness file
 *  ties `TRAFFIC_STARVATION_TICKS` to this same figure. */
const STARVATION_TICKS = 750;

const LANE_Y = 3;
const WAITER_CELL: Position = { x: 4, y: LANE_Y };
const CROWD_CELL: Position = { x: 5, y: LANE_Y };
/** A westbound villager that gets this far past the waiter rejoins the stream. */
const RECYCLE_X = 2;

const ROW = new Set<string>();
for (let x = 0; x < 8; x += 1) ROW.add(`${String(x)},${String(LANE_Y)}`);

function createTrafficWorld(): GameWorld {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 8,
    gridHeight: 8,
    seed: 'movement-traffic-replenished-jam',
    tps: 10,
  });
  world.registerComponent('position');
  world.registerComponent('unit');
  world.registerComponent('unitTransform');
  world.registerComponent('gatherer');
  return world;
}

function addUnit(world: GameWorld, position: Position): number {
  const id = world.createEntity();
  world.setPosition(id, position);
  world.addComponent(id, 'unit', { owner: 1, unitType: 'villager' });
  world.addComponent(id, 'unitTransform', {
    fineX: position.x * UNIT_SUBGRID_RESOLUTION,
    fineY: position.y * UNIT_SUBGRID_RESOLUTION,
  });
  return id;
}

interface Mover {
  readonly id: number;
  readonly dx: 1 | -1;
  x: number;
  /** Fine units advanced into the current cell, in the direction of travel. */
  progress: number;
}

function jam(): {
  tick: () => { waiterAdmitted: boolean; crowdCrossings: number };
  waiter: Mover;
} {
  const world = createTrafficWorld();
  const crowd: Mover[] = [0, 1, 2].map(() => ({
    id: addUnit(world, CROWD_CELL), dx: -1, x: CROWD_CELL.x, progress: 0,
  }));
  const waiter: Mover = { id: addUnit(world, WAITER_CELL), dx: 1, x: WAITER_CELL.x, progress: 0 };
  const accessor = new BridgeStateAccessor(() => world);
  accessor.mutate(unitCommandsCodec, (commands) => {
    for (const mover of crowd) commands.set(mover.id, { type: 'move', target: { x: 0, y: LANE_Y } });
    commands.set(waiter.id, { type: 'move', target: { x: 7, y: LANE_Y } });
  });
  const { resolveMovementTraffic } = createMovementTrafficOps({
    world,
    accessor,
    isCellPassableForUnit: (_id, x, y) => ROW.has(`${String(x)},${String(y)}`),
  });

  // Publish a mover's cell and a fine position that advances with its
  // progress in its direction of travel, the way transformOps does.
  const place = (mover: Mover): void => {
    world.runMaintenance(() => {
      world.setPosition(mover.id, { x: mover.x, y: LANE_Y });
      const transform = world.getComponent<UnitTransformComponent>(mover.id, 'unitTransform');
      if (!transform) throw new Error(`mover ${String(mover.id)} has no transform`);
      world.setComponent(mover.id, 'unitTransform', {
        ...transform,
        fineX: mover.x * UNIT_SUBGRID_RESOLUTION + 2 + mover.dx * (mover.progress / 2),
        fineY: LANE_Y * UNIT_SUBGRID_RESOLUTION,
      });
    });
  };
  const advance = (mover: Mover): boolean => {
    mover.progress += UNIT_SUBGRID_STEP_PER_TICK;
    let crossed = false;
    if (mover.progress >= UNIT_SUBGRID_RESOLUTION) {
      mover.progress -= UNIT_SUBGRID_RESOLUTION;
      mover.x += mover.dx;
      crossed = true;
    }
    place(mover);
    return crossed;
  };

  const tick = (): { waiterAdmitted: boolean; crowdCrossings: number } => {
    let waiterAdmitted = false;
    let crowdCrossings = 0;
    // Every mover asks once per tick in id order, as the movement systems do.
    // A relieved waiter that has walked to the lane's end has nothing left to
    // prove and stops asking.
    for (const mover of [...crowd, waiter]) {
      if (mover === waiter && mover.x >= 7) continue;
      let kind = '';
      world.runMaintenance(() => {
        kind = resolveMovementTraffic(mover.id, { x: mover.x + mover.dx, y: LANE_Y }, world).kind;
      });
      if (kind === 'proceed') {
        const crossed = advance(mover);
        if (mover === waiter) waiterAdmitted = true;
        else if (crossed) crowdCrossings += 1;
      }
      if (mover !== waiter && mover.x <= RECYCLE_X) {
        mover.x = CROWD_CELL.x;
        mover.progress = 0;
        place(mover);
      }
    }
    world.step();
    return { waiterAdmitted, crowdCrossings };
  };
  return { tick, waiter };
}

describe('a replenished head-on jam through the real arbiter', () => {
  it('admits only the lowest id for the whole threshold, then relieves the waiter within a few crossings', () => {
    const { tick, waiter } = jam();
    const RUN_TICKS = 1200;
    let firstAdmission: number | null = null;
    let crossedAt: number | null = null;
    let totalCrowdCrossings = 0;
    for (let t = 0; t < RUN_TICKS; t += 1) {
      const { waiterAdmitted, crowdCrossings } = tick();
      totalCrowdCrossings += crowdCrossings;
      if (waiterAdmitted && firstAdmission === null) firstAdmission = t;
      if (waiter.x !== WAITER_CELL.x && crossedAt === null) crossedAt = t;
    }
    // The stream really flowed past the waiter: this is starvation, not
    // deadlock. (A fixed window, not one scaled by the threshold — a mutant
    // threshold of 1 would otherwise shrink the window to two ticks and fail
    // here instead of on the assertion that names it.)
    expect(totalCrowdCrossings, `the westbound stream did not flow in ${String(RUN_TICKS)} ticks`)
      .toBeGreaterThan(10);
    // The starvation rule does its job: the waiter is admitted at all …
    expect(
      firstAdmission,
      `the waiter was never admitted in ${String(RUN_TICKS)} ticks — it starved for the whole run`,
    ).not.toBeNull();
    // … but not before it has starved past the threshold: lowest-id is the
    // ordinary rule and nothing relieves the waiter early.
    expect(
      firstAdmission,
      'the waiter was admitted before it had starved past the threshold',
    ).toBeGreaterThan(STARVATION_TICKS);
    // And relief is prompt once due: one cell per ~13 admitted ticks,
    // interleaved with the crossings of the stream.
    expect(crossedAt, 'the waiter was admitted but never crossed a cell').not.toBeNull();
    expect(crossedAt).toBeLessThan(STARVATION_TICKS + GRANTS_PER_CELL * 3 + 25);
  });
});
