// The starvation clock counts contested WAITING, not standing still, and every
// member of a jam reads the same clocks.
//
// Review E1 and E2 (docs/threads/current/concurrency-review-2026-09-02): the
// v0.3.175 clock was stamped on cell change alone, so it also ran while a unit
// built a Town Centre, sat garrisoned, or stood parked. Such a unit, retasked
// through a one-wide gap, was elected over units that had been asking for
// hundreds of ticks — on its FIRST ask. The reviewer's trace: builder 500
// stamped at (10,10), builds a TC for ~1,500 ticks, walks into the gap beside
// it and wins the election outright. And the election read each member's
// clock LIVE while every other input came from the tick-start snapshot, so on
// the tick after a relieved unit crossed a cell, the members that asked before
// its own consult saw it still starved and yielded, while it yielded to the
// lowest id — a lost tick that depended on consult order.
//
// Shape of these tests: the reviewer's R1 and R3 reproductions, promoted.

import { World, type Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { unitCommandsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { trafficProgressClock } from '../../src/game/simulation/bridge/movementTrafficElection';
import { createMovementTrafficOps } from '../../src/game/simulation/bridge/movementTrafficOps';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitTransformComponent } from '../../src/game/simulation/types';

// A one-wide lane along y=3: traffic arbitration only engages in a passage
// whose flanks are blocked, so every scenario here lives in this row.
const ROW = new Set<string>();
for (let x = 0; x < 8; x += 1) ROW.add(`${String(x)},3`);

function createTrafficWorld(): GameWorld {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 8,
    gridHeight: 8,
    seed: 'movement-traffic-starvation-clock',
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
  world.addComponent(id, 'unitTransform', { fineX: position.x * 4, fineY: position.y * 4 });
  return id;
}

function transformOf(world: GameWorld, id: number): UnitTransformComponent {
  const transform = world.getComponent<UnitTransformComponent>(id, 'unitTransform');
  if (!transform) throw new Error(`unit ${String(id)} has no transform`);
  return transform;
}

function patchTransform(world: GameWorld, id: number, patch: Partial<UnitTransformComponent>): void {
  world.runMaintenance(() => {
    world.setComponent(id, 'unitTransform', { ...transformOf(world, id), ...patch });
  });
}

type Ask = (id: number, step: Position) => string;

function resolverFor(world: GameWorld, orders: ReadonlyArray<readonly [number, Position]>): Ask {
  const accessor = new BridgeStateAccessor(() => world);
  accessor.mutate(unitCommandsCodec, (commands) => {
    for (const [id, target] of orders) commands.set(id, { type: 'move', target });
  });
  const { resolveMovementTraffic } = createMovementTrafficOps({
    world,
    accessor,
    isCellPassableForUnit: (_id, x, y) => ROW.has(`${String(x)},${String(y)}`),
  });
  return (id, step) => {
    let kind = '';
    world.runMaintenance(() => { kind = resolveMovementTraffic(id, step, world).kind; });
    return kind;
  };
}

function stepTicks(world: GameWorld, count: number): void {
  for (let index = 0; index < count; index += 1) world.step();
}

describe('the starvation clock counts contested waiting, not standing still', () => {
  // `low` (created first, so the lower id) stands in (5,3) heading west;
  // `parked` stands in (4,3) heading east. `parked` asks ONCE — seeding its
  // clock at (4,3) — then stands there without asking for `idleTicks`. For the
  // last `attemptingTicks` of those, `low` asks every tick to step into (4,3)
  // and is refused: a normal occupied lane, since `parked` is not trying to
  // move, so `low`'s clock ages while `parked`'s record sits untouched.
  function parkedThenContested(
    idleTicks: number,
    attemptingTicks: number,
  ): { world: GameWorld; low: number; parked: number; ask: Ask } {
    const world = createTrafficWorld();
    const low = addUnit(world, { x: 5, y: 3 });
    const parked = addUnit(world, { x: 4, y: 3 });
    const ask = resolverFor(world, [[low, { x: 0, y: 3 }], [parked, { x: 7, y: 3 }]]);
    ask(parked, { x: 5, y: 3 });
    world.step();
    for (let index = 0; index < idleTicks; index += 1) {
      if (index >= idleTicks - attemptingTicks) {
        expect(ask(low, { x: 4, y: 3 }), 'the lane was not occupied').toBe('wait');
      }
      world.step();
    }
    return { world, low, parked, ask };
  }

  it('does not elect a unit that stood still for 2,000 ticks over one that has asked for 800', () => {
    const { low, parked, ask } = parkedThenContested(2000, 800);
    // `parked` resumes, closing a head-on pair, and asks first.
    expect(ask(parked, { x: 5, y: 3 }), 'the parked unit was relieved on its first ask').toBe('wait');
    expect(ask(low, { x: 4, y: 3 }), 'the unit that waited 800 ticks was not relieved').toBe('proceed');
  });

  it('reaches the same answer when the waiting unit asks first', () => {
    const { world, low, parked, ask } = parkedThenContested(2000, 800);
    // Before `parked` has attempted this tick it is not part of a closed jam,
    // so `low` waits behind it exactly as it did on every earlier tick …
    expect(ask(low, { x: 4, y: 3 })).toBe('wait');
    expect(ask(parked, { x: 5, y: 3 }), 'the parked unit was relieved on its first ask').toBe('wait');
    world.step();
    // … and is relieved on the next tick, once the pair has closed.
    expect(ask(low, { x: 4, y: 3 }), 'the unit that waited 800 ticks was not relieved').toBe('proceed');
    expect(ask(parked, { x: 5, y: 3 })).toBe('wait');
  });

  it('is the one rule behind both the stamp and the snapshot', () => {
    // Pinned directly so a reader can see what "waiting" means without a jam.
    const at = { x: 4, y: 3 };
    const record = {
      trafficProgressTick: 100,
      trafficProgressCellX: 4,
      trafficProgressCellY: 3,
      trafficAttemptTick: 899,
    };
    // Asking on every tick from the recorded cell: the clock ages.
    expect(trafficProgressClock(record, at, 900)).toBe(100);
    // Two ticks without an attempt: the unit was standing still by choice.
    expect(trafficProgressClock({ ...record, trafficAttemptTick: 897 }, at, 900)).toBe(900);
    // Never attempted since the record: same.
    expect(trafficProgressClock({ ...record, trafficAttemptTick: undefined }, at, 900)).toBe(900);
    // Changed cell since the record: it is getting somewhere.
    expect(trafficProgressClock(record, { x: 5, y: 3 }, 900)).toBe(900);
    // No record at all: never arbitrated, not starving.
    expect(trafficProgressClock({ ...record, trafficProgressTick: undefined }, at, 900)).toBeUndefined();
  });
});

describe('every member of a jam reads the same clocks', () => {
  // A (lower id) at (3,3) heading east, Z (higher id) at (4,3) heading west —
  // a closed head-on pair. Z is the relief case one tick on: it starved in
  // (5,3), was elected, and crossed into (4,3) during last tick's movement,
  // so its record still names (5,3) at an old tick. Every member must read
  // that record the same way, whatever order they consult the arbiter in.
  function reliefCrossingPair(): { a: number; z: number; ask: Ask } {
    const world = createTrafficWorld();
    const a = addUnit(world, { x: 3, y: 3 });
    const z = addUnit(world, { x: 4, y: 3 });
    const ask = resolverFor(world, [[a, { x: 7, y: 3 }], [z, { x: 0, y: 3 }]]);
    stepTicks(world, 1000);
    ask(a, { x: 4, y: 3 });
    ask(z, { x: 3, y: 3 });
    world.step();
    patchTransform(world, a, {
      trafficProgressTick: world.tick - 1, trafficProgressCellX: 3, trafficProgressCellY: 3,
    });
    patchTransform(world, z, {
      trafficProgressTick: world.tick - 900, trafficProgressCellX: 5, trafficProgressCellY: 3,
    });
    return { a, z, ask };
  }

  it('admits the lowest id whichever member asks first', () => {
    // Z changed cell, so its clock restarted: it is no longer starved and the
    // ordinary lowest-id rule admits A — in both consult orders, with no tick
    // lost to members disagreeing.
    const first = reliefCrossingPair();
    expect([
      first.ask(first.a, { x: 4, y: 3 }),
      first.ask(first.z, { x: 3, y: 3 }),
    ], 'A then Z').toEqual(['proceed', 'wait']);
    const second = reliefCrossingPair();
    expect([
      second.ask(second.z, { x: 3, y: 3 }),
      second.ask(second.a, { x: 4, y: 3 }),
    ], 'Z then A').toEqual(['wait', 'proceed']);
  });
});
