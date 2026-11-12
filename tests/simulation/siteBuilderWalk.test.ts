// Which villager walks to a building site: the one with the shortest walk to a
// cell beside it, ties by entity order (work 152 M1d, spec §13.2).
//
// The computer sent its first villager in entity order to every site, wherever
// that villager stood: in the lobby's default all-AI match a House went to a
// woodcutter 6 cells away in a straight line and 56 by foot while six villagers
// stood on the site's own approach cell (plan 152). `siteBuilderWalk.ts` floods
// outward from the site's open approach cells over the path search's own
// predicate and takes the nearest candidate it reaches.
//
// Three checks. (1) The rule, on drawn maps: the walk and not the straight
// line, the tie by id, the cell a villager stands on counted as open, the
// placement rule's refusal, and null when nobody is reached. (2) Agreement with
// the mover: on seeded random maps the pick is the candidate whose shortest
// path, asked of the real path search (`findMovementPathToCandidates`) one
// approach cell at a time, is the least. (3) Cost: the flood stops at the
// nearest villager, reads no cell twice, and is kept between asks for one site.
//
// BOUND: a pure predicate on small maps. That the bridge hands this module the
// path search's predicate, and that the AI's two phases ask it, is
// `aiBuilderWalk.test.ts` and the class case in `aiEconomySelfPlay.test.ts`.
// The path search gives up after 10,000 iterations on a map past about 8,000
// cells (builderReachability.ts names the same boundary); no map here is near it.

import { World, type Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { createMovementPlanOps } from '../../src/game/simulation/bridge/movementPlanOps';
import type { GameCommands, GameComponents, GameEvents, GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { createSiteBuilderWalk, type BuildSite } from '../../src/game/simulation/bridge/siteBuilderWalk';

interface Scene {
  width: number;
  height: number;
  open: (x: number, y: number) => boolean;
  positions: Map<number, Position>;
  site: BuildSite;
}

/** A drawn map: `.` open ground, `#` closed, `S` the site (open ground when it
 *  is still to be placed, closed when it stands), `1`..`9` a villager of that
 *  id on open ground, `a`..`i` villagers 11..19 on a CLOSED cell. */
function draw(rows: string[], toBePlaced: boolean): Scene {
  const height = rows.length;
  const width = rows[0]!.length;
  const positions = new Map<number, Position>();
  const closed = new Set<number>();
  let minX = Infinity; let minY = Infinity; let maxX = -1; let maxY = -1;
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === '#') closed.add(y * width + x);
    if (cell === 'S') {
      if (!toBePlaced) closed.add(y * width + x);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    if (cell >= '1' && cell <= '9') positions.set(Number(cell), { x, y });
    if (cell >= 'a' && cell <= 'i') {
      positions.set(11 + cell.charCodeAt(0) - 97, { x, y });
      closed.add(y * width + x);
    }
  }));
  return {
    width, height, positions,
    open: (x, y) => !closed.has(y * width + x),
    site: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, toBePlaced },
  };
}

function harness(scene: Scene, refused: ReadonlySet<number> = new Set()) {
  const counter = { reads: 0, reachAsks: [] as number[], revision: 1 };
  const isPassable = (_id: number, x: number, y: number): boolean => {
    counter.reads += 1;
    return x >= 0 && y >= 0 && x < scene.width && y < scene.height && scene.open(x, y);
  };
  const world = {
    getComponent: (id: number, kind: string) => (
      kind === 'position' ? scene.positions.get(id) : kind === 'unit' ? { owner: 2, unitType: 'villager' } : undefined
    ),
  } as unknown as GameWorld;
  // The mover's own ring and its own search, over the same predicate.
  const ops = createMovementPlanOps({
    world: new World<GameEvents, GameCommands, GameComponents>({ gridWidth: scene.width, gridHeight: scene.height, seed: 'site-builder-walk', tps: 10 }),
    mapWidth: scene.width, mapHeight: scene.height, movePathCache: new Map(),
    isCellPassableForUnit: (_id, x, y) => x >= 0 && y >= 0 && x < scene.width && y < scene.height && scene.open(x, y),
    isCellPassableForWildlife: () => true,
  });
  const nearest = createSiteBuilderWalk({
    mapWidth: scene.width,
    mapHeight: scene.height,
    isCellPassableForUnit: isPassable,
    getApproachCellsForFootprint: ops.getApproachCellsForFootprint,
    canBuilderReachFootprint: (builderId) => {
      counter.reachAsks.push(builderId);
      return !refused.has(builderId);
    },
    structuralRevision: () => counter.revision,
  });
  /** The path search's own answer: the least path, in steps, from the
   *  villager's cell to an open approach cell; Infinity when there is none. */
  const searchedWalk = (id: number): number => {
    const start = scene.positions.get(id)!;
    let best = Number.POSITIVE_INFINITY;
    for (const cell of ops.getApproachCellsForFootprint(scene.site, scene.site.width, scene.site.height, 1)) {
      const found = ops.findMovementPathToCandidates(id, start, [cell], true);
      if (found) best = Math.min(best, found.path.length - 1);
    }
    return best;
  };
  return { counter, world, nearest, searchedWalk, ids: [...scene.positions.keys()].sort((a, b) => a - b) };
}

describe('the villager with the shortest walk to a site', () => {
  it('is not the first in entity order, nor the nearest in a straight line, when a wall stands between', () => {
    const scene = draw([
      '..#........',
      '.1#SS......',
      '..#SS....2.',
      '..#........',
      '..#........',
      '...........',
    ], true);
    const { nearest, world, searchedWalk } = harness(scene);
    // Villager 1 is two cells from the site and walks round the wall's foot.
    expect([searchedWalk(1), searchedWalk(2)]).toEqual([8, 4]);
    expect(nearest([1, 2], scene.site, world)).toBe(2);
  });

  it('breaks a tie by entity order', () => {
    const scene = draw([
      '...3.......',
      '...........',
      '...SS......',
      '.2.SS......',
      '...........',
      '.........1.',
    ], false);
    const { nearest, world, searchedWalk } = harness(scene);
    expect([searchedWalk(1), searchedWalk(2), searchedWalk(3)]).toEqual([6, 1, 1]);
    expect(nearest([1, 2, 3], scene.site, world)).toBe(2);
    expect(nearest([1, 3, 2], scene.site, world), 'the order the candidates are listed in decides nothing').toBe(2);
  });

  it('counts the cell a villager stands on as open, as the path search does', () => {
    // Villager 11 stands on a closed cell (a sheep stopped there, say)
    // one step from the site; villager 1 stands on open ground six steps away.
    const scene = draw([
      '...........',
      '...SS.a...1',
      '...SS......',
    ], false);
    const { nearest, world, searchedWalk } = harness(scene);
    expect([searchedWalk(1), searchedWalk(11)]).toEqual([6, 1]);
    expect(nearest([1, 11], scene.site, world)).toBe(11);
  });

  it('reads a villager walled in on every side as out of reach, and null when all of them are', () => {
    const scene = draw([
      '.....#.#...',
      '.SS..#2#.1.',
      '.SS..###...',
      '...........',
    ], false);
    const { nearest, world, searchedWalk } = harness(scene);
    expect(searchedWalk(2)).toBe(Number.POSITIVE_INFINITY);
    expect(nearest([1, 2], scene.site, world)).toBe(1);
    const sealed = draw([
      '.SS.#.#.#1#',
      '.SS.#2#.###',
      '....###....',
    ], false);
    const other = harness(sealed);
    expect(other.nearest([1, 2], sealed.site, other.world)).toBeNull();
  });

  it('passes over a villager the placement rule refuses as the builder of a site still to be placed', () => {
    const scene = draw([
      '...........',
      '.2.SS...1..',
      '...SS....3.',
    ], true);
    const refusing = harness(scene, new Set([2]));
    expect(refusing.nearest([1, 2, 3], scene.site, refusing.world)).toBe(1);
    expect(refusing.counter.reachAsks, 'the rule is asked only of a villager about to be chosen').toEqual([2, 1]);
    // A standing site was placed already: nothing is asked.
    const standing = draw([
      '...........',
      '.2.SS...1..',
      '...SS....3.',
    ], false);
    const none = harness(standing, new Set([2]));
    expect(none.nearest([1, 2, 3], standing.site, none.world)).toBe(2);
    expect(none.counter.reachAsks).toEqual([]);
  });

  it('answers for one candidate as for many: it, if the flood reaches it, and nobody if not', () => {
    const reached = draw(['.....', '.1.SS', '...SS'], false);
    const open = harness(reached);
    expect(open.nearest([1], reached.site, open.world)).toBe(1);
    // The caller asks it of a part of the seat's villagers (a resource's last
    // gatherer is passed over while another can be sent), so a lone villager
    // out of reach must read as nobody.
    const sealed = draw(['.1#SS', '###SS'], false);
    const shut = harness(sealed);
    expect(shut.nearest([1], sealed.site, shut.world)).toBeNull();
    expect(shut.nearest([], sealed.site, shut.world)).toBeNull();
    expect(shut.counter.reads, 'no villager, no flood').toBeLessThan(sealed.width * sealed.height);
  });

  it('is the candidate the path search would walk least, on 600 seeded random maps', () => {
    const next = random(152);
    let wallBetween = 0;
    let onClosedCell = 0;
    let nobody = 0;
    for (let round = 0; round < 600; round += 1) {
      const width = 5 + Math.floor(next() * 18);
      const height = 4 + Math.floor(next() * 12);
      const density = 0.1 + next() * 0.35;
      const siteWidth = 1 + Math.floor(next() * 4);
      const siteHeight = 1 + Math.floor(next() * 4);
      const siteX = Math.floor(next() * (width - siteWidth + 1));
      const siteY = Math.floor(next() * (height - siteHeight + 1));
      const toBePlaced = next() < 0.5;
      const inSite = (x: number, y: number) => x >= siteX && x < siteX + siteWidth && y >= siteY && y < siteY + siteHeight;
      const rows: string[] = [];
      for (let y = 0; y < height; y += 1) {
        let row = '';
        for (let x = 0; x < width; x += 1) row += inSite(x, y) ? 'S' : next() < density ? '#' : '.';
        rows.push(row);
      }
      const scene = draw(rows, toBePlaced);
      const count = 2 + Math.floor(next() * 7);
      for (let id = 1; id <= count; id += 1) {
        // Anywhere but inside a standing site: on open ground, or on a closed cell.
        let cell: Position;
        do cell = { x: Math.floor(next() * width), y: Math.floor(next() * height) };
        while (!toBePlaced && inSite(cell.x, cell.y));
        scene.positions.set(id, cell);
      }
      const { nearest, world, searchedWalk, ids } = harness(scene);
      const walks = ids.map((id) => ({ id, walk: searchedWalk(id) }));
      const reached = walks.filter((entry) => Number.isFinite(entry.walk)).sort((a, b) => a.walk - b.walk || a.id - b.id);
      const expected = reached[0]?.id ?? null;
      expect(
        nearest(ids, scene.site, world),
        `round ${String(round)}: site ${JSON.stringify(scene.site)}, walks ${JSON.stringify(walks)}\n${rows.join('\n')}`,
      ).toBe(expected);
      const straight = (id: number) => {
        const p = scene.positions.get(id)!;
        const dx = Math.max(siteX - p.x, 0, p.x - (siteX + siteWidth - 1));
        const dy = Math.max(siteY - p.y, 0, p.y - (siteY + siteHeight - 1));
        return Math.max(dx, dy);
      };
      const straightNearest = [...ids].sort((a, b) => straight(a) - straight(b) || a - b)[0]!;
      if (expected !== null && expected !== straightNearest) wallBetween += 1;
      if (expected !== null && !scene.open(scene.positions.get(expected)!.x, scene.positions.get(expected)!.y)) onClosedCell += 1;
      if (expected === null) nobody += 1;
    }
    // The cases the rule exists for must be in the sample, or the comparison
    // proves the open-ground half only.
    expect(wallBetween, 'rounds where the walk and the straight line disagree').toBeGreaterThan(100);
    expect(onClosedCell, 'rounds won by a villager standing on a closed cell').toBeGreaterThan(80);
    expect(nobody, 'rounds where no villager is reached').toBeGreaterThan(10);
  });

  it('stops at the nearest villager, and keeps the flood between asks for one site', () => {
    // 60x36, the size of aoe2-prototype, all open: a 2x2 site, a villager two
    // cells from it, another across the map.
    const rows = Array.from({ length: 36 }, () => '.'.repeat(60));
    const set = (x: number, y: number, cell: string) => { rows[y] = rows[y]!.slice(0, x) + cell + rows[y]!.slice(x + 1); };
    for (const [x, y] of [[20, 20], [21, 20], [20, 21], [21, 21]] as const) set(x, y, 'S');
    set(24, 20, '1');
    set(55, 3, '2');
    set(2, 30, '3');
    const scene = draw(rows, false);
    const { nearest, world, counter } = harness(scene);
    expect(nearest([1, 2, 3], scene.site, world)).toBe(1);
    const area = 60 * 36;
    expect(counter.reads, 'cells read to find a villager two cells from the site').toBeLessThan(area / 20);
    // The crew phase asks again for the same site with that villager taken: the
    // flood carries on from where it stopped, and no cell is read twice.
    expect(nearest([2, 3], scene.site, world)).toBe(3);
    expect(nearest([2], scene.site, world)).toBe(2);
    expect(nearest([2, 3], scene.site, world)).toBe(3);
    expect(nearest([3], scene.site, world), 'a nearer villager, already reached: nothing more is read').toBe(3);
    expect(counter.reads, 'every cell of the map read at most once across four asks').toBeLessThanOrEqual(area);
    // Ground changed: the flood is not the map any more.
    const before = counter.reads;
    counter.revision += 1;
    expect(nearest([1, 2, 3], scene.site, world)).toBe(1);
    expect(counter.reads, 'a structural change must flood afresh').toBeGreaterThan(before);
  });
});

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
