// `bridge.isCellPassableForUnit` reads the path search's own predicate (work
// 152 M1d).
//
// Why it exists. The class case in `aiEconomySelfPlay.test.ts` asks, of every
// builder a computer seat names, whether another villager had a shorter walk.
// That needs the ground as the path search sees it, and nothing on the bridge
// gave it: `staticGridOf` (walkDistanceProbe.ts) rebuilds land passability from
// components and reads a farm, a foundation nobody has started and a seat's own
// gate as walls, where a villager walks over all three. So the bridge hands out
// the predicate itself, as a read: no command, nothing a save holds, nothing
// the game reads back.
//
// What holds it to the search. On `builder-walk-ground-fixture` each of seven
// one-cell lanes holds one kind of ground on its middle cell, and a villager
// ordered down its lane walks straight through or goes round by the nearest
// lane it may pass. The read is compared with the walk the game itself made: the cells a
// villager entered are all open by the read, and the count of them equals the
// shortest walk over the read's own grid. A read wired to another predicate
// disagrees with the walk on a lane: terrain alone calls the tree and the wall
// open, and the spawn predicate calls the villager's own gate closed.
//
// BOUND: seven kinds, each on one cell, land walkers of one side, and a plain
// walk order, whose route is the move resolver's flood. The building approach
// that a builder walks is `findGridPath` over the same predicate, and the
// fixture cases of `aiBuilderWalk.test.ts` and the self-play class case show
// that walk agreeing with the read (a builder beside the site starts at once).
// Water, ships and a converted unit's change of side are not here.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  BUILDER_WALK_GROUND_LANES,
  BUILDER_WALK_GROUND_ROWS,
  BUILDER_WALK_GROUND_SEED,
} from '../../src/game/simulation/fixtures/aiBuilderWalk';
import { passabilityGrid, stepsBetween } from './builderWalkProbe';

const LANES = BUILDER_WALK_GROUND_LANES;
const ROWS = BUILDER_WALK_GROUND_ROWS;
/** The longest way round is 28 cells at about 12.4 ticks a cell. */
const WALK_WINDOW_TICKS = 900;

function boot() {
  const bridge = createSimulationBridge(BUILDER_WALK_GROUND_SEED, { renderProjection: 'on-read' });
  const villagers = bridge.getEconomyState().units
    .filter((unit) => unit.owner === 2 && unit.unitType === 'villager')
    .sort((a, b) => a.id - b.id);
  return { bridge, villagers };
}

describe('the bridge\'s read of the path search\'s passability', () => {
  it('reads each kind of ground as open or closed for the villagers who would walk it', () => {
    const { bridge, villagers } = boot();
    expect(villagers.map((villager) => ({ x: villager.x, y: villager.y })))
      .toEqual(LANES.map((lane) => ({ x: lane.x, y: ROWS.start })));
    const reader = villagers[0]!.id;
    for (const lane of LANES) {
      expect(bridge.isCellPassableForUnit(reader, lane.x, ROWS.middle), `the lane holding ${lane.holds}`).toBe(lane.open);
      expect(bridge.isCellPassableForUnit(reader, lane.x, ROWS.goal), 'open ground').toBe(true);
    }
    expect(bridge.isCellPassableForUnit(reader, LANES[0].x + 1, ROWS.middle), 'forest between two lanes').toBe(false);
    const { width, height } = bridge.getMapSize();
    for (const [x, y] of [[-1, 0], [0, -1], [width, 0], [0, height]] as const) {
      expect(bridge.isCellPassableForUnit(reader, x, y), `off the map at (${String(x)},${String(y)})`).toBe(false);
    }
  });

  it('admits through a finished gate only the side that built it, and nobody that is no unit', () => {
    const { bridge, villagers } = boot();
    const scout = bridge.getEconomyState().units.find((unit) => unit.owner === 1 && unit.unitType === 'scout')!;
    const [ownGate, enemyGate] = [LANES[1], LANES[2]];
    expect(bridge.isCellPassableForUnit(villagers[0]!.id, ownGate.x, ROWS.middle)).toBe(true);
    expect(bridge.isCellPassableForUnit(villagers[0]!.id, enemyGate.x, ROWS.middle)).toBe(false);
    expect(bridge.isCellPassableForUnit(scout.id, ownGate.x, ROWS.middle)).toBe(false);
    expect(bridge.isCellPassableForUnit(scout.id, enemyGate.x, ROWS.middle)).toBe(true);
    // An id that names no unit is a land walker no gate admits (aiSitePlacement.ts's probe).
    expect(bridge.isCellPassableForUnit(-1, ownGate.x, ROWS.middle)).toBe(false);
    expect(bridge.isCellPassableForUnit(-1, ownGate.x, ROWS.goal)).toBe(true);
  });

  it('agrees with the walk the game makes down every lane, cell for cell and step for step', () => {
    const { bridge, villagers } = boot();
    const grid = passabilityGrid(bridge, villagers[0]!.id);
    const walks = villagers.map((villager, index) => ({
      id: villager.id,
      lane: LANES[index]!,
      goal: { x: LANES[index]!.x, y: ROWS.goal },
      expected: stepsBetween(grid, villager, { x: LANES[index]!.x, y: ROWS.goal }),
      cells: [{ x: villager.x, y: villager.y }],
      arrived: false,
    }));
    // What the fixture is for: straight through, or round by the nearest lane
    // the villager may pass.
    const round = (x: number): number => 16 + 2 * Math.min(...LANES.filter((lane) => lane.open).map((lane) => Math.abs(lane.x - x)));
    expect(walks.map((walk) => walk.expected)).toEqual(LANES.map((lane) => (lane.open ? 8 : round(lane.x))));
    expect(walks.map((walk) => walk.expected)).toEqual([8, 8, 22, 8, 8, 22, 28]);

    for (const walk of walks) {
      bridge.pendingCommands.push({ type: 'unit.move', data: { unitId: walk.id, target: walk.goal } });
    }
    for (let tick = 0; tick < WALK_WINDOW_TICKS && walks.some((walk) => !walk.arrived); tick += 1) {
      bridge.step(100);
      const units = new Map(bridge.getEconomyState().units.map((unit) => [unit.id, unit]));
      for (const walk of walks) {
        // Once there, the order is done and the villager goes back to work.
        if (walk.arrived) continue;
        const unit = units.get(walk.id)!;
        const last = walk.cells[walk.cells.length - 1]!;
        if (unit.x !== last.x || unit.y !== last.y) {
          expect(Math.abs(unit.x - last.x) + Math.abs(unit.y - last.y), 'a step is one cell, orthogonally').toBe(1);
          walk.cells.push({ x: unit.x, y: unit.y });
        }
        walk.arrived = unit.x === walk.goal.x && unit.y === walk.goal.y;
      }
    }

    for (const walk of walks) {
      const label = `the villager whose lane holds ${walk.lane.holds}`;
      expect(walk.arrived, `${label} never reached its goal`).toBe(true);
      expect(walk.cells.length - 1, `${label}: cells walked against the shortest walk over the read`).toBe(walk.expected);
      const closed = walk.cells.slice(1).filter((cell) => !bridge.isCellPassableForUnit(walk.id, cell.x, cell.y));
      expect(closed, `${label} entered cells the read calls closed`).toEqual([]);
      expect(
        walk.cells.some((cell) => cell.x === walk.lane.x && cell.y === ROWS.middle),
        `${label}: walked over its lane's middle cell`,
      ).toBe(walk.lane.open);
    }
  });

  it('changes nothing a save holds, however much of the map is read', () => {
    const { bridge, villagers } = boot();
    const before = JSON.stringify(bridge.saveGame());
    passabilityGrid(bridge, villagers[0]!.id);
    passabilityGrid(bridge, -1);
    expect(JSON.stringify(bridge.saveGame())).toBe(before);
    expect(bridge.pendingCommands).toHaveLength(0);
  });
});
