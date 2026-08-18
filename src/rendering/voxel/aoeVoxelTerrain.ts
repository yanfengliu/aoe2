import type { PaletteResourceV1 } from 'voxel/core';

import type { ProjectedEntityView, TerrainKind } from '../../game/simulation/types';
import { compareParts, type VoxelPart } from './aoeVoxelRecipeTypes';
import { terrainCellColor, type TerrainCellSample } from './aoeVoxelTerrainColor';
import { landDecorParts } from './aoeVoxelTerrainDecor';
import { waterDetailParts } from './aoeVoxelTerrainWaterDetail';

export const AOE_TERRAIN_CHUNK_SIZE = 16;
const MAX_TERRAIN_LEVELS = 64;
export const TERRAIN_PALETTE_KEY = 'aoe2:palette:terrain';
export const TERRAIN_MATERIAL_KEY = 'aoe2:material:terrain';

export interface TerrainCell {
  readonly x: number;
  readonly z: number;
  readonly elevation: number;
  readonly tint: number;
  readonly kind: TerrainKind;
}

export interface TerrainChunkDraft {
  readonly key: string;
  readonly origin: { readonly x: number; readonly y: number; readonly z: number };
  readonly size: { readonly x: number; readonly y: number; readonly z: number };
  readonly voxels: Uint16Array;
  readonly signature: string;
}

function requireCoordinate(name: string, value: number): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Terrain ${name} must be a safe integer.`);
  return value;
}

export function elevationOf(entity: ProjectedEntityView): number {
  const elevation = entity.elevation ?? 0;
  if (!Number.isSafeInteger(elevation) || elevation < 0 || elevation >= MAX_TERRAIN_LEVELS) {
    throw new RangeError(
      `Projected elevation must be an integer from 0 to ${String(MAX_TERRAIN_LEVELS - 1)}.`,
    );
  }
  return elevation;
}

function tintToColor(tint: number, alpha = 255) {
  return { r: (tint >>> 16) & 0xff, g: (tint >>> 8) & 0xff, b: tint & 0xff, a: alpha };
}

export function terrainCells(entities: readonly ProjectedEntityView[]): TerrainCell[] {
  const terrainEntities = entities.filter((entity) => entity.layer === 'terrain');
  // The colour pipeline reads neighbours (seam blending, the shallow-water
  // band), so gather every cell's kind and raw tint before colouring any.
  const samples = new Map<string, TerrainCellSample>(terrainEntities.map((entity) => [
    `${String(entity.x)}:${String(entity.y)}`,
    { kind: entity.entityType as TerrainKind, tint: entity.tint },
  ]));
  const cellAt = (x: number, z: number): TerrainCellSample | undefined => (
    samples.get(`${String(x)}:${String(z)}`)
  );
  const cells = terrainEntities
    .map((entity) => {
      elevationOf(entity);
      const x = requireCoordinate('x', entity.x);
      const z = requireCoordinate('y', entity.y);
      const kind = entity.entityType as TerrainKind;
      return {
        x,
        z,
        elevation: 0,
        tint: terrainCellColor(entity.tint, kind, x, z, cellAt),
        kind,
      };
    })
    .sort((a, b) => a.z - b.z || a.x - b.x || a.elevation - b.elevation || a.tint - b.tint);
  for (let index = 1; index < cells.length; index += 1) {
    const previous = cells[index - 1]!;
    const current = cells[index]!;
    if (previous.x === current.x && previous.z === current.z) {
      throw new Error(`Duplicate terrain cell at (${String(current.x)}, ${String(current.z)}).`);
    }
  }
  return cells;
}

export function makeTerrainPalette(
  cells: readonly TerrainCell[],
  revision: number,
): PaletteResourceV1 {
  const tints = [...new Set(cells.map((cell) => cell.tint))].sort((a, b) => a - b);
  return {
    kind: 'palette',
    key: TERRAIN_PALETTE_KEY,
    incarnation: 1,
    revision,
    entries: [
      { color: { r: 0, g: 0, b: 0, a: 0 } },
      ...tints.map((tint) => ({ color: tintToColor(tint) })),
    ],
  };
}

export function draftTerrainChunks(
  cells: readonly TerrainCell[],
  paletteSignature: string,
): TerrainChunkDraft[] {
  const tints = [...new Set(cells.map((cell) => cell.tint))].sort((a, b) => a - b);
  const paletteIndex = new Map(tints.map((tint, index) => [tint, index + 1]));
  const groups = new Map<string, { chunkX: number; chunkZ: number; cells: TerrainCell[] }>();
  for (const cell of cells) {
    const chunkX = Math.floor(cell.x / AOE_TERRAIN_CHUNK_SIZE);
    const chunkZ = Math.floor(cell.z / AOE_TERRAIN_CHUNK_SIZE);
    const key = `${String(chunkX)}:${String(chunkZ)}`;
    const group = groups.get(key) ?? { chunkX, chunkZ, cells: [] };
    group.cells.push(cell);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.chunkZ - b.chunkZ || a.chunkX - b.chunkX)
    .map((group) => {
      const height = Math.max(...group.cells.map((cell) => cell.elevation)) + 1;
      const size = { x: AOE_TERRAIN_CHUNK_SIZE, y: height, z: AOE_TERRAIN_CHUNK_SIZE };
      const voxels = new Uint16Array(size.x * size.y * size.z);
      for (const cell of group.cells) {
        const localX = cell.x - group.chunkX * AOE_TERRAIN_CHUNK_SIZE;
        const localZ = cell.z - group.chunkZ * AOE_TERRAIN_CHUNK_SIZE;
        const value = paletteIndex.get(cell.tint)!;
        for (let localY = 0; localY <= cell.elevation; localY += 1) {
          voxels[localX + size.x * (localZ + size.z * localY)] = value;
        }
      }
      const key = `aoe2:terrain:${String(group.chunkX)}:${String(group.chunkZ)}`;
      const cellSignature = group.cells
        .map((cell) => `${String(cell.x)},${String(cell.z)},${String(cell.elevation)},${String(cell.tint)}`)
        .join('|');
      return {
        key,
        origin: {
          x: group.chunkX * AOE_TERRAIN_CHUNK_SIZE,
          y: -1,
          z: group.chunkZ * AOE_TERRAIN_CHUNK_SIZE,
        },
        size,
        voxels,
        signature: `${paletteSignature}|${cellSignature}`,
      };
    });
}

export function createTerrainDetailParts(
  entities: readonly ProjectedEntityView[],
): VoxelPart[] {
  const parts: VoxelPart[] = [];
  const cells = entities
    .filter((entity) => entity.layer === 'terrain')
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const terrainKinds = new Map(cells.map((entity) => [
    `${String(entity.x)}:${String(entity.y)}`,
    entity.entityType as TerrainKind,
  ]));
  for (const entity of cells) {
    elevationOf(entity);
    const x = requireCoordinate('x', entity.x);
    const z = requireCoordinate('y', entity.y);
    const identity = `terrain:${String(x)}:${String(z)}`;
    const kind = entity.entityType as TerrainKind;
    if (kind === 'water') {
      parts.push(...waterDetailParts(entity, identity, x, z, terrainKinds));
    } else {
      parts.push(...landDecorParts(entity, identity, kind, x, z));
    }
  }
  return parts.sort(compareParts);
}
