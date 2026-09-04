// Every forest cell carries a tree — for EVERY map, not just the one that
// happened to do it inline.
//
// The pass itself is `defaultMap`'s, and the reason for it is its: forest
// terrain is impassable, so a forest cell without a tree is a permanent wall
// rather than wood, and cutting the rim of a woodline leaves the rest walled
// in. The forest IS the trees, the way Age of Empires II works.
//
// It lives here because leaving it inline made a WORSE defect than the one it
// fixed. Four of the nine playable maps — arena, coastal, fortress and
// gold-rush — shipped with zero tree spawns, because only `defaultMap` ran the
// pass. A map with no wood is not a hard map: a house costs 25 wood and every
// age-up prerequisite building costs wood, so the population cap never leaves
// 10, no age is ever reached, and the match cannot resolve. Measured on arena,
// both AI players sat in the Dark Age at 10/10 population for a full 75-minute
// audit holding 701 food and 3,184 gold they could not spend. `fortress` even
// carried code to fell "a TREE on the wall line" that could never fire.
import {
  AUTHORITATIVE_BUILDING_FOOTPRINTS,
  getBuildingFootprint,
} from '../../content/buildingFootprints';
import type { Position } from 'civ-engine';

import type { MapSize } from './constants';
import type { SpawnList } from './spawnList';
import {
  createTerrainCell,
  isInBounds,
  paintDisc,
  seedToNumber,
  type TerrainCellSpec,
} from './sharedTerrainHelpers';

/** Wood per tree, matching the standard map's own nodes. */
export const TREE_WOOD = 100;

/**
 * Add a tree spawn to every forest cell that nothing else has claimed.
 *
 * Runs LAST in a generator, so first-write-wins leaves every curated spawn
 * untouched. A building spawn's footprint is not a resource claim, so those
 * cells are skipped explicitly — otherwise a tree lands under a Town Center
 * and the scenario validator rejects the map.
 */
export function seedForestTrees(
  terrain: TerrainCellSpec[][],
  spawns: SpawnList,
  size: MapSize,
): void {
  const claimedByBuilding = new Set<string>();
  for (const spawn of spawns.toArray()) {
    if (!(spawn.kind in AUTHORITATIVE_BUILDING_FOOTPRINTS)) continue;
    const footprint = getBuildingFootprint(
      spawn.kind as keyof typeof AUTHORITATIVE_BUILDING_FOOTPRINTS,
    );
    for (let dy = 0; dy < footprint.height; dy += 1) {
      for (let dx = 0; dx < footprint.width; dx += 1) {
        claimedByBuilding.add(`${String(spawn.x + dx)},${String(spawn.y + dy)}`);
      }
    }
  }
  for (let y = 0; y < size.height; y += 1) {
    for (let x = 0; x < size.width; x += 1) {
      if (terrain[y]?.[x]?.kind !== 'forest') continue;
      if (claimedByBuilding.has(`${String(x)},${String(y)}`)) continue;
      spawns.addResourceSpawn({
        kind: 'tree',
        x,
        y,
        owner: null,
        baseOwner: null,
        amount: TREE_WOOD,
      });
    }
  }
}

/**
 * Paint a small woodline INSIDE a walled start, so the base a script seals off
 * contains wood as well as food, gold and stone.
 *
 * Arena and Fortress shipped with none, and wood is the resource a start
 * cannot do without: every house that raises the population cap costs it and
 * so does every age-up prerequisite building. A walled player therefore had to
 * leave the wall in the first minutes and keep leaving it — which on `arena`
 * cost owner 2 four of its seven villagers to a raid, after which it rang the
 * town bell and sat with three villagers garrisoned and NO unit on the map
 * from tick 7,000 to tick 16,000 while its wall was taken apart. It never left
 * the Dark Age in a 60,000-tick match.
 *
 * The block is placed at the FIRST anchor in row-major order whose every cell
 * is plain unclaimed grass strictly inside `radius`, so it is deterministic
 * and does not depend on the order the caller seeded anything else. Trees are
 * IMPASSABLE, so `walledMapEconomy.test.ts` checks the enclosure is still one
 * connected place afterwards — a woodline that cuts a base in two strands the
 * villagers on the wrong side of it as surely as a wall would.
 *
 * Returns the number of cells painted, so a caller can fail loudly rather than
 * ship a base with no wood in it again.
 */
export function paintEnclosedWoodline(
  terrain: TerrainCellSpec[][],
  townCenter: Position,
  size: MapSize,
  options: { readonly radius: number; readonly target: number },
  claimed: ReadonlySet<string>,
  blocking: ReadonlySet<string>,
): number {
  const { radius, target } = options;
  const span = Math.ceil(radius);
  const inside = (x: number, y: number): boolean =>
    isInBounds(x, y, size) && Math.hypot(x - townCenter.x, y - townCenter.y) < radius;

  const painted = new Set<string>();
  // Would the enclosure still be ONE place? Trees are impassable, and a
  // villager on the far side of a woodline is as stranded as one outside the
  // wall. Checked directly rather than approximated with a margin, because
  // connectivity is the property wanted: flood from the Town Centre with the
  // patch so far treated as solid, and see whether anything open is left out.
  const strands = (candidate: string): boolean => {
    const solid = (x: number, y: number): boolean => {
      const key = `${String(x)},${String(y)}`;
      return key === candidate || painted.has(key) || blocking.has(key);
    };
    const open: string[] = [];
    for (let y = townCenter.y - span; y <= townCenter.y + span; y += 1) {
      for (let x = townCenter.x - span; x <= townCenter.x + span; x += 1) {
        if (inside(x, y) && !solid(x, y)) open.push(`${String(x)},${String(y)}`);
      }
    }
    const seen = new Set<string>();
    // Start from the first open cell rather than the Town Centre, whose own
    // footprint is solid ground: what matters is that the open cells are one
    // region, not which of them the fill happens to begin at.
    const first = open[0];
    if (first === undefined) return true;
    const [firstX, firstY] = first.split(',').map(Number);
    seen.add(first);
    const queue: Position[] = [{ x: firstX!, y: firstY! }];
    while (queue.length > 0) {
      const cell = queue.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        const key = `${String(x)},${String(y)}`;
        if (!inside(x, y) || seen.has(key) || solid(x, y)) continue;
        seen.add(key);
        queue.push({ x, y });
      }
    }
    return open.some((key) => !seen.has(key));
  };

  // ROW-MAJOR, and the three orderings this was measured against are the
  // reason. What a walled base needs is its woodline pushed against ONE EDGE,
  // leaving the rest of the enclosure as one contiguous piece of building
  // ground; row-major fills the top rows and does exactly that. The two
  // alternatives both fail, in opposite ways, and both were run to a result on
  // six seeds:
  //
  //   nearest the Town Centre  — the shortest carry, and it spends the ground
  //     the base builds on. BOTH `arena` owners sat in the Dark Age for the
  //     whole match, population-capped in 98% of samples at 10/10 with a peak
  //     cap of 10, holding 1,000 food they had nowhere to spend.
  //   farthest, grown from a seed — a blob in one corner that fans inward and
  //     fragments what is left. `arena` owner 1 fell from army 35 to 16 and
  //     the match stopped resolving.
  //
  // Row-major: owner 2 reaches the FEUDAL age with 786 food and a 25 cap,
  // where it had been dead in the Dark Age at 10, and owner 1's army goes 35
  // to 39. A cell joins only if the enclosure survives it.
  for (let y = townCenter.y - span; y <= townCenter.y + span && painted.size < target; y += 1) {
    for (let x = townCenter.x - span; x <= townCenter.x + span && painted.size < target; x += 1) {
      const key = `${String(x)},${String(y)}`;
      if (!inside(x, y)) continue;
      if (terrain[y]?.[x]?.kind !== 'grass') continue;
      if (claimed.has(key) || blocking.has(key)) continue;
      if (strands(key)) continue;
      painted.add(key);
    }
  }

  for (const key of painted) {
    const [x, y] = key.split(',').map(Number);
    // Through `createTerrainCell`, not a spread: a forest cell is NOT
    // buildable, and copying a grass cell's flags would leave a patch of
    // forest you could put a house on.
    terrain[y!]![x!] = createTerrainCell(x!, y!, 'forest');
  }
  return painted.size;
}

/**
 * Paint woodlines onto a grass map, for the scripts that build their own
 * terrain rather than the standard generator's.
 *
 * Kept well clear of every start, because these are the walled scripts: Arena
 * rings each start at 7 cells and Fortress squares it at 11, and both skip
 * ring cells that would sit on a resource — a woodline inside the ring would
 * punch holes in the wall that is the script's whole identity. `MIN_START_GAP`
 * is measured from that, not chosen for looks.
 */
export const MIN_START_GAP = 14;

export function paintWoodlines(
  terrain: TerrainCellSpec[][],
  starts: readonly { townCenter: Position }[],
  size: MapSize,
  seed: string,
): void {
  const PATCH_RADIUS = 3;
  const PATCHES = 14;
  let state = seedToNumber(seed) || 1;
  const nextRandom = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const farFromStarts = (x: number, y: number): boolean => starts.every((start) => (
    Math.hypot(x - start.townCenter.x, y - start.townCenter.y) >= MIN_START_GAP
  ));
  let placed = 0;
  for (let attempt = 0; attempt < PATCHES * 40 && placed < PATCHES; attempt += 1) {
    const cx = Math.floor(nextRandom() * size.width);
    const cy = Math.floor(nextRandom() * size.height);
    if (!farFromStarts(cx, cy)) continue;
    let clear = true;
    for (let dy = -PATCH_RADIUS; dy <= PATCH_RADIUS && clear; dy += 1) {
      for (let dx = -PATCH_RADIUS; dx <= PATCH_RADIUS; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (!isInBounds(x, y, size)) continue;
        // Only ever paint over plain grass, so a script's own water, hills and
        // walls are never eaten by a woodline.
        if (terrain[y]?.[x]?.kind !== 'grass' || !farFromStarts(x, y)) { clear = false; break; }
      }
    }
    if (!clear) continue;
    paintDisc(terrain, { x: cx, y: cy }, PATCH_RADIUS, 'forest');
    placed += 1;
  }
}
