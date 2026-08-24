import type { Position } from 'civ-engine';

import type { ResourceKind } from '../../types';
import type { PlayerStartSpec } from '../../prototypeScenario';
import { MAP_HEIGHT, MAP_WIDTH } from '../constants';
import { type SpawnList } from '../spawnList';
import {
  distanceSquared,
  isAccessibleShorelineCell,
  isInBounds,
  projectOffset,
  seedToNumber,
  setTerrainKind,
  type Offset,
  type TerrainCellSpec,
} from '../sharedTerrainHelpers';
import { SHORE_FISH_AMOUNT } from '../startingOffsets';

/** How many players a standard map can seat. AoE2 allows eight; this map is
 *  60x36, which is a two-player size, so more than four would start players
 *  inside each other's opening — the spec's own size ladder (§4) is what has to
 *  grow before that changes. */
export const MAX_STANDARD_PLAYERS = 4;

// Where each player opens, by how many are playing. The two-player row is the
// established 1v1, cell for cell, so every existing map, screenshot and test
// that assumed it still holds; three and four spread into the corners the same
// distance apart.
const START_POSITIONS: Readonly<Record<number, ReadonlyArray<{ x: number; y: number }>>> = {
  2: [{ x: 8, y: 8 }, { x: 48, y: 24 }],
  3: [{ x: 8, y: 8 }, { x: 48, y: 8 }, { x: 28, y: 26 }],
  4: [{ x: 8, y: 8 }, { x: 48, y: 8 }, { x: 8, y: 26 }, { x: 48, y: 26 }],
};

// One civilization per seat, in a fixed order so a match is reproducible from
// its seed alone. The first two are the established pair.
const START_CIVILIZATIONS = ['Britons', 'Franks', 'Byzantines', 'Japanese'] as const;

/**
 * The players a standard map opens with. Defaults to two, so every caller that
 * has not been told otherwise generates exactly the map it always did.
 *
 * A count outside 2..MAX_STANDARD_PLAYERS is clamped rather than throwing: this
 * runs during map generation, where refusing to build a map is a worse answer
 * to a bad URL than building a playable one.
 */
export function createPlayerStarts(playerCount = 2): PlayerStartSpec[] {
  const count = Math.max(2, Math.min(MAX_STANDARD_PLAYERS, Math.floor(playerCount)));
  const positions = START_POSITIONS[count] ?? START_POSITIONS[2]!;
  return positions.map((townCenter, index) => ({
    owner: index + 1,
    townCenter: { ...townCenter },
    civilization: START_CIVILIZATIONS[index] ?? START_CIVILIZATIONS[0],
  }));
}

export function applyResourcePatch(
  terrain: TerrainCellSpec[][],
  center: Position,
  offsets: Offset[],
  kind: ResourceKind,
  amount: number,
  baseOwner: number,
  spawns: SpawnList,
): void {
  for (const offset of offsets) {
    const position = projectOffset(center, offset);
    if (!isInBounds(position.x, position.y)) {
      continue;
    }

    setTerrainKind(terrain, position.x, position.y, 'grass');
    spawns.addResourceSpawn({
      kind,
      x: position.x,
      y: position.y,
      owner: null,
      baseOwner,
      amount,
    });
  }
}

export function applyForestPatch(
  terrain: TerrainCellSpec[][],
  center: Position,
  offsets: Offset[],
  baseOwner: number,
  spawns: SpawnList,
): void {
  for (const offset of offsets) {
    const position = projectOffset(center, offset);
    setTerrainKind(terrain, position.x, position.y, 'forest');
    if (!isInBounds(position.x, position.y)) {
      continue;
    }
    spawns.addResourceSpawn({
      kind: 'tree',
      x: position.x,
      y: position.y,
      owner: null,
      baseOwner,
      amount: 100,
    });
  }
}

export function applyShoreFishPatches(
  terrain: TerrainCellSpec[][],
  starts: PlayerStartSpec[],
  seed: string,
  spawns: SpawnList,
): void {
  const candidates: Position[] = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (!isAccessibleShorelineCell(terrain, x, y)) {
        continue;
      }
      if (starts.some((start) => distanceSquared(start.townCenter, { x, y }) <= 81)) {
        continue;
      }
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    return;
  }

  const placed: Position[] = [];
  const targetCount = Math.min(14, Math.max(4, Math.floor(candidates.length / 12)));
  const startIndex = seedToNumber(seed) % candidates.length;
  const stride = Math.max(3, Math.floor(candidates.length / Math.max(targetCount, 1)));

  for (let attempt = 0; attempt < candidates.length && placed.length < targetCount; attempt += 1) {
    const candidate = candidates[(startIndex + attempt * stride) % candidates.length];
    if (placed.some((position) => distanceSquared(position, candidate) < 9)) {
      continue;
    }

    spawns.addResourceSpawn({
      kind: 'fish',
      x: candidate.x,
      y: candidate.y,
      owner: null,
      baseOwner: null,
      amount: SHORE_FISH_AMOUNT,
    });
    placed.push(candidate);
  }

  if (placed.length === 0) {
    const fallback = candidates[0];
    spawns.addResourceSpawn({
      kind: 'fish',
      x: fallback.x,
      y: fallback.y,
      owner: null,
      baseOwner: null,
      amount: SHORE_FISH_AMOUNT,
    });
  }
}

// Iter-3 V3-16: this used to be a byte-for-byte duplicate of
// applyShoreFishPatches. Both already used the spawn list — no
// procedural-vs-non-procedural divergence — so kept the original name
// for callers and aliased the body. Adding logic to one location will
// continue to apply to all callers.
export const applyShoreFishPatchesProcedural = applyShoreFishPatches;

// Slice 11: helper shared by the alternate maps. Re-uses the default
// starting-resource / villager / scout patches so each map has the same
// economic baseline as Arabia. Everything is placed via the existing
// projectOffset + applyResourcePatch + applyForestPatch helpers, so the
