// The drop-off walk field: true 4-connected walk distance from every cell to
// the nearest drop-off of a kind, which is what the gather comparator ranks
// by (register entry 2026-09-01, "The gather comparator measures a distance
// the units cannot walk").
//
// BOUND: these grids are hand-built and small. They pin the metric (a wall
// makes Manhattan and walk disagree, and walk wins), the unreachable answer,
// which drop-off a haul ends at, and the cache's invalidation inputs — the
// structural revision, the drop-off SET (a camp completing bumps nothing), the
// owner, the movement domain, and the world. They say nothing about cost on a
// real map; `scripts/aiGatherWalk.mjs` measures that.

import { describe, expect, it } from 'vitest';

import type { Position } from 'civ-engine';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import {
  createDropOffWalkFields,
  type DropOffSource,
  type DropOffWalkField,
} from '../../src/game/simulation/bridge/dropOffWalkField';

//  y\x 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
//   0  . . . . . B # . . . .  .  .  .  .  .     B = tree B (5,0)
//   1  . . . . . . # . . . .  .  .  .  .  .     # = forest wall, x=6 y0..5
//   2  . . . . . . # . . . .  .  .  .  .  .     C = tree C (14,3), sealed in
//   3  . c c . . . # A . . .  .  .  #  C  #     A = tree A (7,3)
//   4  . c c . . . # . . . .  T  T  .  #  .     c = camp (1,3) 2x2 [id 10]
//   5  . . . . . . # . . . .  T  T  .  .  .     T = town centre (11,4) 2x2 [id 11]
//   6  . . . . . . . . . . .  .  .  .  .  .
const WIDTH = 16;
const HEIGHT = 7;
const CAMP: DropOffSource = { id: 10, position: { x: 1, y: 3 }, footprint: { width: 2, height: 2 } };
const TOWN_CENTRE: DropOffSource = { id: 11, position: { x: 11, y: 4 }, footprint: { width: 2, height: 2 } };
const TREE_A: Position = { x: 7, y: 3 };
const TREE_B: Position = { x: 5, y: 0 };
const TREE_C: Position = { x: 14, y: 3 };

const VILLAGER = 1;
const SHIP = 2;

function blockedCells(): Set<string> {
  const blocked = new Set<string>();
  const block = (x: number, y: number): void => { blocked.add(`${String(x)},${String(y)}`); };
  for (let y = 0; y <= 5; y += 1) block(6, y);
  for (const tree of [TREE_A, TREE_B, TREE_C]) block(tree.x, tree.y);
  block(13, 3); block(15, 3); block(14, 2); block(14, 4);
  for (const source of [CAMP, TOWN_CENTRE]) {
    for (let y = source.position.y; y < source.position.y + source.footprint.height; y += 1) {
      for (let x = source.position.x; x < source.position.x + source.footprint.width; x += 1) block(x, y);
    }
  }
  return blocked;
}

function makeWorld(): GameWorld {
  const units: Record<number, { owner: number; unitType: string }> = {
    [VILLAGER]: { owner: 1, unitType: 'villager' },
    [SHIP]: { owner: 1, unitType: 'fishing-ship' },
  };
  return {
    getComponent: (id: number, name: string) => (name === 'unit' ? units[id] : undefined),
    query: () => [],
  } as unknown as GameWorld;
}

interface Harness {
  fields: ReturnType<typeof createDropOffWalkFields>;
  world: GameWorld;
  revision: { value: number };
  sources: { list: DropOffSource[] };
  passabilityCalls: { count: number };
}

function harness(initialSources: DropOffSource[] = [CAMP]): Harness {
  const blocked = blockedCells();
  const revision = { value: 7 };
  const sources = { list: initialSources };
  const passabilityCalls = { count: 0 };
  const world = makeWorld();
  const fields = createDropOffWalkFields({
    mapWidth: WIDTH,
    mapHeight: HEIGHT,
    isCellPassableForUnit: (_unitId, x, y) => {
      passabilityCalls.count += 1;
      return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && !blocked.has(`${String(x)},${String(y)}`);
    },
    structuralRevision: () => revision.value,
    listDropOffBuildings: () => sources.list,
  });
  return { fields, world, revision, sources, passabilityCalls };
}

describe('the drop-off walk field', () => {
  it('measures the walk around a wall, where Manhattan is wrong', () => {
    const { fields, world } = harness();
    const field = fields.fieldFor(world, 1, 'wood', VILLAGER);
    expect(field).not.toBeNull();
    // Camp nearest cell (2,3) -> A (7,3) is Manhattan 5; -> B (5,0) is 6. The
    // wall makes A an 8-cell walk from the ring cell (3,4): down to (3,6),
    // across to (7,6), back up to (7,4). B is a 4-cell one from the ring cell
    // (2,2): (3,2), (4,2), (5,2), (5,1). Manhattan puts A first; the walk
    // puts B first.
    expect(field!.haulDistance(TREE_A)).toBe(8);
    expect(field!.haulDistance(TREE_B)).toBe(4);
  });

  it('answers Infinity for a node no drop-off can reach', () => {
    const { fields, world } = harness();
    const field = fields.fieldFor(world, 1, 'wood', VILLAGER)!;
    expect(field.haulDistance(TREE_C)).toBe(Number.POSITIVE_INFINITY);
    expect(field.nearestDropOffId(TREE_C)).toBeNull();
  });

  it('names the drop-off the shortest WALK ends at, not the Manhattan-nearest', () => {
    const { fields, world } = harness([CAMP, TOWN_CENTRE]);
    const field = fields.fieldFor(world, 1, 'wood', VILLAGER)!;
    // The Town Centre's nearest cell (11,4) is Manhattan 6 from A against the
    // camp's 5, but the walk is 3 (ring cell (11,3) -> (10,3) -> (9,3) ->
    // (8,3)) against the camp's 8.
    expect(field.haulDistance(TREE_A)).toBe(3);
    expect(field.nearestDropOffId(TREE_A)).toBe(TOWN_CENTRE.id);
    expect(field.nearestDropOffId(TREE_B)).toBe(CAMP.id);
  });

  it('is null when the owner has no drop-off of that kind', () => {
    const { fields, world } = harness([]);
    expect(fields.fieldFor(world, 1, 'wood', VILLAGER)).toBeNull();
  });

  it('is computed once per structural revision and drop-off set, then served from cache', () => {
    const h = harness();
    h.fields.fieldFor(h.world, 1, 'wood', VILLAGER);
    const firstPass = h.passabilityCalls.count;
    expect(firstPass).toBeGreaterThan(0);
    h.fields.fieldFor(h.world, 1, 'wood', VILLAGER);
    expect(h.passabilityCalls.count).toBe(firstPass);
    expect(h.fields.stats.computed).toBe(1);
    expect(h.fields.stats.served).toBe(1);
  });

  it('recomputes when topology changes (the structural revision moves)', () => {
    const h = harness();
    h.fields.fieldFor(h.world, 1, 'wood', VILLAGER);
    h.revision.value += 1;
    h.fields.fieldFor(h.world, 1, 'wood', VILLAGER);
    expect(h.fields.stats.computed).toBe(2);
  });

  it('recomputes when a drop-off completes, which bumps no revision', () => {
    // A camp claims its cells as a foundation; finishing it changes nothing
    // the occupancy grid can see, so the set of sources is its own key.
    const h = harness([CAMP]);
    const before = h.fields.fieldFor(h.world, 1, 'wood', VILLAGER)!;
    expect(before.haulDistance(TREE_A)).toBe(8);
    h.sources.list = [CAMP, TOWN_CENTRE];
    const after = h.fields.fieldFor(h.world, 1, 'wood', VILLAGER)!;
    expect(h.fields.stats.computed).toBe(2);
    expect(after.haulDistance(TREE_A)).toBe(3);
  });

  it('keeps one field per owner, kind and movement domain', () => {
    const h = harness();
    h.fields.fieldFor(h.world, 1, 'wood', VILLAGER);
    h.fields.fieldFor(h.world, 2, 'wood', VILLAGER);
    h.fields.fieldFor(h.world, 1, 'food', VILLAGER);
    // A fishing ship reads a different passability (water), so it cannot
    // share a villager's field even for the same owner and kind.
    h.fields.fieldFor(h.world, 1, 'food', SHIP);
    expect(h.fields.stats.computed).toBe(4);
    h.fields.fieldFor(h.world, 1, 'wood', VILLAGER);
    expect(h.fields.stats.computed).toBe(4);
  });

  it('does not answer one world from the field of another', () => {
    const h = harness();
    h.fields.fieldFor(h.world, 1, 'wood', VILLAGER);
    h.fields.fieldFor(makeWorld(), 1, 'wood', VILLAGER);
    expect(h.fields.stats.computed).toBe(2);
  });
});

// The delivery walk. On Nomad the approach search handed a loaded villager at
// (14,14) a 27-step loop around its base to the Manhattan-nearest ring cell of
// the Town Centre while its neighbour at (15,14) got the 10-step route to the
// next ring cell THROUGH (14,14); the two groups shuffled into each other for
// 21,000 ticks. Descending the field cannot do that: every unit on a cell
// walks the same gradient to the walk-nearest ring cell.
describe('descending the field from a cell a unit stands on', () => {
  //  y\x 0 1 2 3 4 5 6 7 8 9
  //   0  . . . . . # . . . .     T = town centre 2x2 at (2,2) [id 30]
  //   1  . . r r . # . . . .     r = its ring; the east ring (4,2),(4,3) is
  //   2  . r T T r # . V . .         walled off from V by column x=5, open
  //   3  . r T T r # . . . .         only at y=5, so the Manhattan-nearest
  //   4  . . r r . # . . . .         ring cells cost a loop and the walk-
  //   5  . . . . . . . . . .         nearest is the bottom ring, (3,4)/(2,4)
  const TC: DropOffSource = { id: 30, position: { x: 2, y: 2 }, footprint: { width: 2, height: 2 } };
  function walledField(): DropOffWalkField {
    const blocked = new Set<string>(['2,2', '3,2', '2,3', '3,3', '5,0', '5,1', '5,2', '5,3', '5,4']);
    return createDropOffWalkFields({
      mapWidth: 10,
      mapHeight: 6,
      isCellPassableForUnit: (_unitId, x, y) =>
        x >= 0 && x < 10 && y >= 0 && y < 6 && !blocked.has(`${String(x)},${String(y)}`),
      structuralRevision: () => 1,
      listDropOffBuildings: () => [TC],
    }).fieldFor(makeWorld(), 1, 'wood', VILLAGER)!;
  }

  it('walks the true shortest route, step by step, to the walk-nearest ring cell', () => {
    const field = walledField();
    // From (7,2): down to (7,5), west to (4,5), north to (4,4)... no — (4,4)
    // is not a ring cell; the bottom ring is (2,4),(3,4). (7,2)->(7,5) is 3,
    // (7,5)->(3,5) is 4, (3,5)->(3,4) is 1: eight steps. The east ring cell
    // (4,3) is Manhattan 3 away and also eight steps; both are walk-nearest,
    // and the point is that NO route of nine or more is ever handed out.
    let cell: Position = { x: 7, y: 2 };
    const first = field.descendFrom(cell)!;
    expect(first.dropOffId).toBe(TC.id);
    let steps = 0;
    for (;;) {
      const descent = field.descendFrom(cell)!;
      if (descent.destination.x === cell.x && descent.destination.y === cell.y) break;
      cell = descent.nextStep;
      steps += 1;
      expect(steps, 'the descent must terminate').toBeLessThan(50);
    }
    expect(steps).toBe(8);
    // It ends on a ring cell of the Town Centre.
    const ring = ['2,1', '3,1', '2,4', '3,4', '1,2', '1,3', '4,2', '4,3'];
    expect(ring).toContain(`${String(cell.x)},${String(cell.y)}`);
  });

  it('is the same route for every unit on the cell, so two groups never walk through each other', () => {
    const field = walledField();
    const a = field.descendFrom({ x: 7, y: 2 })!;
    const b = field.descendFrom({ x: 7, y: 2 })!;
    expect(a).toEqual(b);
    // And a unit one cell further along the route takes the continuation of
    // it, never the reverse of it.
    const next = field.descendFrom(a.nextStep)!;
    expect(next.nextStep).not.toEqual({ x: 7, y: 2 });
  });

  it('returns the unit its own cell when it already stands beside the drop-off', () => {
    const field = walledField();
    expect(field.descendFrom({ x: 4, y: 3 })).toEqual({
      destination: { x: 4, y: 3 },
      nextStep: { x: 4, y: 3 },
      dropOffId: TC.id,
    });
  });

  it('is null off the field: a blocked cell, or one no drop-off can reach', () => {
    const field = walledField();
    expect(field.descendFrom({ x: 5, y: 2 })).toBeNull();
    expect(field.descendFrom({ x: 2, y: 2 })).toBeNull();
    expect(field.descendFrom({ x: -1, y: 0 })).toBeNull();
  });
});

// The instrument check. On OPEN ground a 4-connected walk IS the Manhattan
// distance, so the walk metric must rank exactly as the Manhattan metric did
// there — a difference on open ground would be a metric bug, not an
// improvement. The haul runs from the cell beside the node to the cell beside
// the drop-off, so it is the Manhattan distance to the footprint minus the two
// end cells (zero for a node touching the ring).
describe('the drop-off walk field on open ground', () => {
  const OPEN = 30;
  const TOWN_CENTRE: DropOffSource = { id: 20, position: { x: 12, y: 12 }, footprint: { width: 4, height: 4 } };
  // Each node in its own quadrant and clear of every other, so nothing stands
  // between any node and the footprint — the first draft put the touching
  // node at (16,13), on the row (28,13) walks in along, and measured its own
  // obstruction as a one-cell "error". Manhattan distances to the footprint
  // are all distinct, so the order is unambiguous.
  const NODES: Position[] = [
    { x: 2, y: 25 }, { x: 25, y: 3 }, { x: 27, y: 27 }, { x: 3, y: 3 }, { x: 14, y: 2 },
    { x: 1, y: 14 }, { x: 28, y: 13 }, { x: 13, y: 29 }, { x: 11, y: 15 },
  ];
  const manhattanToFootprint = (node: Position): number => {
    const { x, y } = TOWN_CENTRE.position;
    const { width, height } = TOWN_CENTRE.footprint;
    const nearestX = Math.min(Math.max(node.x, x), x + width - 1);
    const nearestY = Math.min(Math.max(node.y, y), y + height - 1);
    return Math.abs(node.x - nearestX) + Math.abs(node.y - nearestY);
  };

  function openField(): ReturnType<typeof createDropOffWalkFields> {
    const blocked = new Set<string>(NODES.map((n) => `${String(n.x)},${String(n.y)}`));
    for (let y = 12; y < 16; y += 1) for (let x = 12; x < 16; x += 1) blocked.add(`${String(x)},${String(y)}`);
    return createDropOffWalkFields({
      mapWidth: OPEN,
      mapHeight: OPEN,
      isCellPassableForUnit: (_unitId, x, y) =>
        x >= 0 && x < OPEN && y >= 0 && y < OPEN && !blocked.has(`${String(x)},${String(y)}`),
      structuralRevision: () => 1,
      listDropOffBuildings: () => [TOWN_CENTRE],
    });
  }

  it('measures Manhattan distance minus the two end cells', () => {
    const field = openField().fieldFor(makeWorld(), 1, 'wood', VILLAGER)!;
    for (const node of NODES) {
      expect(field.haulDistance(node), `node (${String(node.x)},${String(node.y)})`)
        .toBe(Math.max(0, manhattanToFootprint(node) - 2));
    }
  });

  it('ranks exactly as the Manhattan metric ranked', () => {
    const field = openField().fieldFor(makeWorld(), 1, 'wood', VILLAGER)!;
    const byWalk = [...NODES].sort((a, b) => field.haulDistance(a) - field.haulDistance(b));
    const byManhattan = [...NODES].sort((a, b) => manhattanToFootprint(a) - manhattanToFootprint(b));
    expect(byWalk).toEqual(byManhattan);
  });
});
