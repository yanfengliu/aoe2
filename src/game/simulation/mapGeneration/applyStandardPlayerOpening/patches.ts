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

export function createPlayerStarts(): PlayerStartSpec[] {
  return [
    { owner: 1, townCenter: { x: 8, y: 8 }, civilization: 'Britons' },
    { owner: 2, townCenter: { x: 48, y: 24 }, civilization: 'Franks' },
  ];
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
