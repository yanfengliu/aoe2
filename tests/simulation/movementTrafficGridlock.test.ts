import { World, type Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { unitCommandsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createMovementTrafficOps } from '../../src/game/simulation/bridge/movementTrafficOps';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';

// Traffic arbitration only engages inside a one-cell-wide corridor, which is
// what the gaps between an AI's own buildings are. An open field never reaches
// these rules at all, so every scenario here is a lane with blocked flanks.
const ROW = new Set<string>();
for (let x = 0; x < 8; x += 1) ROW.add(`${String(x)},3`);

function createTrafficWorld(): GameWorld {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 8,
    gridHeight: 8,
    seed: 'movement-traffic-gridlock',
    tps: 10,
  });
  world.registerComponent('position');
  world.registerComponent('unit');
  world.registerComponent('unitTransform');
  world.registerComponent('gatherer');
  return world;
}

function addUnit(world: GameWorld, position: Position, owner = 1): number {
  const id = world.createEntity();
  world.setPosition(id, position);
  world.addComponent(id, 'unit', { owner, unitType: 'villager' });
  world.addComponent(id, 'unitTransform', { fineX: position.x * 4, fineY: position.y * 4 });
  return id;
}

function resolverFor(
  world: GameWorld,
  orders: ReadonlyArray<readonly [number, Position]>,
  passable: ReadonlySet<string> = ROW,
): (id: number, step: Position) => string {
  const accessor = new BridgeStateAccessor(() => world);
  accessor.mutate(unitCommandsCodec, (commands) => {
    for (const [id, target] of orders) commands.set(id, { type: 'move', target });
  });
  const { resolveMovementTraffic } = createMovementTrafficOps({
    world,
    accessor,
    isCellPassableForUnit: (_id, x, y) => passable.has(`${String(x)},${String(y)}`),
  });
  return (id, step) => {
    let kind = '';
    world.runMaintenance(() => { kind = resolveMovementTraffic(id, step, world).kind; });
    return kind;
  };
}

describe('a head-on jam where several units share one cell', () => {
  // Observed in a real match at tick 25000: five AI villagers stood in (52,23)
  // all stepping west into (51,23), and the single villager in (51,23) stepped
  // east into their cell. Every one of the six was refused on every tick for
  // the rest of the match, and the AI's entire food and wood income was those
  // six units. The set is mutually blocking and closed, so admitting its
  // lowest-id member is what unjams it.
  function fiveVersusOne(): {
    round: () => number[];
    crowd: number[];
    single: number;
  } {
    const world = createTrafficWorld();
    const crowd = [0, 1, 2, 3, 4].map(() => addUnit(world, { x: 5, y: 3 }));
    const single = addUnit(world, { x: 4, y: 3 });
    const ask = resolverFor(world, [
      ...crowd.map((id) => [id, { x: 0, y: 3 }] as const),
      [single, { x: 7, y: 3 }] as const,
    ]);
    // One round is every member asking once, in id order, exactly as the
    // movement systems do each tick. A peer's heading only counts once it has
    // attempted, so the first round is priming and the second is the steady
    // state a stuck match sits in for thousands of ticks.
    const round = (): number[] => {
      const admitted = [
        ...crowd.filter((id) => ask(id, { x: 4, y: 3 }) === 'proceed'),
        ...(ask(single, { x: 5, y: 3 }) === 'proceed' ? [single] : []),
      ];
      world.step();
      return admitted;
    };
    return { round, crowd, single };
  }

  it('admits exactly one of the six, not none of them', () => {
    const { round } = fiveVersusOne();
    round();
    expect(round(), 'the whole jam was refused').toHaveLength(1);
  });

  it('admits the lowest id, so every member agrees on the same winner', () => {
    const { round, crowd, single } = fiveVersusOne();
    round();
    expect(round()).toEqual([Math.min(...crowd, single)]);
  });
});

describe('the unit a head-on jam elects to go first', () => {
  // The election is the only thing in the arbiter that sees the whole jam, and
  // it names exactly one winner. Re-judging that winner by a local rule vetoes
  // it: two wood carriers in (45,24) and two villagers in (45,25) each elected
  // a winner, and each winner was then refused for standing behind a
  // better-placed peer in its own cell. All four waited for ten thousand ticks
  // one step from the lumber camp, and the AI's wood income stayed at seven.
  it('is not then refused for sharing its cell with a better-placed peer', () => {
    const world = createTrafficWorld();
    // Both pairs face each other across the lane, and within each cell one unit
    // stands further along the shared heading than the other.
    const westPair = [addUnit(world, { x: 3, y: 3 }), addUnit(world, { x: 3, y: 3 })];
    const eastPair = [addUnit(world, { x: 4, y: 3 }), addUnit(world, { x: 4, y: 3 })];
    world.runMaintenance(() => {
      for (const [index, id] of [...westPair, ...eastPair].entries()) {
        const transform = world.getComponent(id, 'unitTransform');
        world.setComponent(id, 'unitTransform', {
          ...transform,
          fineX: (index < 2 ? 3 : 4) * 4 + (index % 2 === 0 ? 0 : 3),
        });
      }
    });
    const ask = resolverFor(world, [
      ...westPair.map((id) => [id, { x: 7, y: 3 }] as const),
      ...eastPair.map((id) => [id, { x: 0, y: 3 }] as const),
    ]);
    const round = (): number[] => {
      const admitted = [
        ...westPair.filter((id) => ask(id, { x: 4, y: 3 }) === 'proceed'),
        ...eastPair.filter((id) => ask(id, { x: 3, y: 3 }) === 'proceed'),
      ];
      world.step();
      return admitted;
    };

    round();
    expect(round(), 'the jam elected a winner and then refused it').toHaveLength(1);
  });
});

describe('a unit whose own path is clear', () => {
  // The third jam in the same match: 2237 stood in (40,23) with an EMPTY cell
  // ahead of it, and was refused because a lower-id unit sharing its cell had
  // priority for a different heading — while that unit was itself permanently
  // blocked. Yielding is only meaningful to a peer that can actually take its
  // turn.
  it('does not yield to a co-located peer that is itself blocked', () => {
    const world = createTrafficWorld();
    const blockedPeer = addUnit(world, { x: 3, y: 3 }); // lower id, heads east
    const clearMover = addUnit(world, { x: 3, y: 3 }); // higher id, heads west
    const blockers = [0, 1, 2].map(() => addUnit(world, { x: 4, y: 3 }));
    const ask = resolverFor(world, [
      [blockedPeer, { x: 7, y: 3 }],
      [clearMover, { x: 0, y: 3 }],
      ...blockers.map((id) => [id, { x: 0, y: 3 }] as const),
    ]);

    expect(ask(blockedPeer, { x: 4, y: 3 }), 'the peer should be blocked').toBe('wait');
    expect(ask(clearMover, { x: 2, y: 3 })).toBe('proceed');
  });

  it('still yields to a co-located peer that can move', () => {
    const world = createTrafficWorld();
    const movingPeer = addUnit(world, { x: 3, y: 3 });
    const follower = addUnit(world, { x: 3, y: 3 });
    const ask = resolverFor(world, [
      [movingPeer, { x: 7, y: 3 }],
      [follower, { x: 0, y: 3 }],
    ]);

    expect(ask(movingPeer, { x: 4, y: 3 })).toBe('proceed');
    expect(ask(follower, { x: 2, y: 3 })).toBe('wait');
  });
});
