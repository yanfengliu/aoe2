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
