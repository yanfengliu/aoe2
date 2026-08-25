import type { Position } from 'civ-engine';

import type { ResourceKind } from '../../types';
import type { PlayerStartSpec } from '../../prototypeScenario';
import { type MapSize, sizeOfTerrain, standardMapSize } from '../constants';
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

/** How many players a standard map can seat — spec §4.2's own range, now that
 *  §4's size ladder grows the map underneath them (`standardMapSize`). It was
 *  4 while the map was fixed at 60x36, a two-player size on which a fifth seat
 *  would have opened inside someone else's base. */
export const MAX_STANDARD_PLAYERS = 8;

// One civilization per seat, in a fixed order so a match is reproducible from
// its seed and its count alone. The first two are the established pair.
const START_CIVILIZATIONS = [
  'Britons', 'Franks', 'Byzantines', 'Japanese',
  'Celts', 'Teutons', 'Chinese', 'Persians',
] as const;

// The established 1v1, cell for cell: every existing map, screenshot and test
// that assumed these two openings still holds.
const TWO_PLAYER_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 8, y: 8 },
  { x: 48, y: 24 },
];

/** How far in from the edge a seat sits, as a share of the map. A Town Center
 *  is 4x4 and its opening reaches about six cells past that, so the inset has
 *  to grow with the map rather than stay a constant. */
function insetFor(size: MapSize): { x: number; y: number } {
  return { x: Math.round(size.width * 0.13), y: Math.round(size.height * 0.2) };
}

/**
 * Where each seat opens, for a count and the map that count is played on.
 *
 * Three and four get the shapes they have always had — a triangle and the four
 * corners. Five and up walk the inset rectangle's perimeter at equal arc
 * length, which is what keeps eight players the same distance apart as four:
 * evenly spaced around the edge, nobody in the middle, and every seat the same
 * distance from the edge as every other.
 */
function seatPositions(count: number, size: MapSize): Array<{ x: number; y: number }> {
  if (count <= 2) return TWO_PLAYER_POSITIONS.map((position) => ({ ...position }));

  const inset = insetFor(size);
  const left = inset.x;
  const right = size.width - 1 - inset.x;
  const top = inset.y;
  const bottom = size.height - 1 - inset.y;

  if (count === 3) {
    return [
      { x: left, y: top },
      { x: right, y: top },
      { x: Math.round(size.width / 2), y: bottom },
    ];
  }
  if (count === 4) {
    return [
      { x: left, y: top },
      { x: right, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom },
    ];
  }

  const spanX = right - left;
  const spanY = bottom - top;
  const perimeter = 2 * (spanX + spanY);
  const positions: Array<{ x: number; y: number }> = [];
  for (let seat = 0; seat < count; seat += 1) {
    const walked = (perimeter * seat) / count;
    if (walked <= spanX) {
      positions.push({ x: Math.round(left + walked), y: top });
    } else if (walked <= spanX + spanY) {
      positions.push({ x: right, y: Math.round(top + (walked - spanX)) });
    } else if (walked <= 2 * spanX + spanY) {
      positions.push({ x: Math.round(right - (walked - spanX - spanY)), y: bottom });
    } else {
      positions.push({ x: left, y: Math.round(bottom - (walked - 2 * spanX - spanY)) });
    }
  }
  return positions;
}

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
  return seatPositions(count, standardMapSize(count)).map((townCenter, index) => ({
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
  const size = sizeOfTerrain(terrain);
  for (const offset of offsets) {
    const position = projectOffset(center, offset, size);
    if (!isInBounds(position.x, position.y, size)) {
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
  const size = sizeOfTerrain(terrain);
  for (const offset of offsets) {
    const position = projectOffset(center, offset, size);
    setTerrainKind(terrain, position.x, position.y, 'forest');
    if (!isInBounds(position.x, position.y, size)) {
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
  const size = sizeOfTerrain(terrain);
  for (let y = 0; y < size.height; y += 1) {
    for (let x = 0; x < size.width; x += 1) {
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
