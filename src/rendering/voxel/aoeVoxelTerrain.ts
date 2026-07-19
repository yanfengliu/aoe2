import type { PaletteResourceV1 } from 'voxel/core';

import type { ProjectedEntityView, TerrainKind } from '../../game/simulation/types';
import {
  compareParts,
  hash01,
  makePart,
  shade,
  VOXEL_COLORS,
  type VoxelPart,
} from './aoeVoxelRecipeTypes';

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

export function terrainVoxelTint(
  tint: number,
  kind: TerrainKind,
  x: number,
  z: number,
): number {
  const bucket = Math.floor(hash01(x, z, 31) * 5) - 2;
  const step = kind === 'water' ? 0.018 : kind === 'hill' ? 0.035 : 0.027;
  return shade(tint, 1 + bucket * step);
}

export function terrainCells(entities: readonly ProjectedEntityView[]): TerrainCell[] {
  const cells = entities
    .filter((entity) => entity.layer === 'terrain')
    .map((entity) => {
      elevationOf(entity);
      const x = requireCoordinate('x', entity.x);
      const z = requireCoordinate('y', entity.y);
      const kind = entity.entityType as TerrainKind;
      return {
        x,
        z,
        elevation: 0,
        tint: terrainVoxelTint(entity.tint, kind, x, z),
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
    const noise = hash01(x, z, 79);
    const accent = hash01(x, z, 83);
    const yaw = (hash01(x, z, 89) - 0.5) * 0.72;
    if (kind === 'water') {
      // Pinned Voxel 0.1.4 has no texture or environment-map contract, and a
      // mixed terrain chunk has one material. Raised, sparse instances provide
      // standard-material highlights while the opaque chunk remains fallback.
      if (noise < 0.72) {
        parts.push(makePart(
          entity,
          identity,
          'water-ripple-dark',
          'water',
          VOXEL_COLORS.waterDark,
          x + 0.5,
          0.022,
          z + 0.5,
          0.54,
          0.018,
          0.034,
          { yaw },
        ));
      }
      if (noise < 0.34) {
        const crest = makePart(
          entity,
          identity,
          'water-ripple-crest',
          'water',
          VOXEL_COLORS.waterGlint,
          x + 0.5,
          0.041,
          z + 0.5,
          0.61,
          0.022,
          0.044,
          { yaw },
        );
        parts.push({
          ...crest,
          animation: {
            periodMs: 2_100 + Math.floor(hash01(x, z, 97) * 900),
            phaseRadians: hash01(x, z, 101) * Math.PI * 2,
            translationAmplitude: {
              x: Math.sin(yaw) * 0.022,
              y: 0.016,
              z: Math.cos(yaw) * 0.022,
            },
            rotationAmplitude: { x: 0.025, y: 0.04, z: 0.018 },
            scaleAmplitude: { x: 0.12, y: 0, z: 0.18 },
          },
        });
      }
      if (accent < 0.24) {
        parts.push(makePart(
          entity,
          identity,
          'water-reflection-sky',
          'water',
          VOXEL_COLORS.waterReflection,
          x + 0.5 + (accent - 0.12) * 1.2,
          0.034,
          z + 0.5 - (accent - 0.12) * 0.8,
          0.24,
          0.019,
          0.095,
          { yaw: -yaw * 0.62 },
        ));
      }
      const shores = [
        { suffix: 'north', dx: 0, dz: -1, centerX: x + 0.5, centerZ: z + 0.07, width: 0.72, depth: 0.045 },
        { suffix: 'east', dx: 1, dz: 0, centerX: x + 0.93, centerZ: z + 0.5, width: 0.045, depth: 0.72 },
        { suffix: 'south', dx: 0, dz: 1, centerX: x + 0.5, centerZ: z + 0.93, width: 0.72, depth: 0.045 },
        { suffix: 'west', dx: -1, dz: 0, centerX: x + 0.07, centerZ: z + 0.5, width: 0.045, depth: 0.72 },
      ] as const;
      for (const shore of shores) {
        const neighbour = terrainKinds.get(`${String(x + shore.dx)}:${String(z + shore.dz)}`);
        if (neighbour === undefined || neighbour === 'water') continue;
        parts.push(makePart(
          entity,
          identity,
          `water-shore-foam-${shore.suffix}`,
          'matte',
          VOXEL_COLORS.waterReflection,
          shore.centerX,
          0.027,
          shore.centerZ,
          shore.width,
          0.018,
          shore.depth,
        ));
      }
    } else if (kind === 'hill') {
      if (noise < 0.58) {
        parts.push(makePart(
          entity,
          identity,
          'hill-strata-dark',
          'matte',
          shade(entity.tint, 0.72),
          x + 0.5,
          0.021,
          z + 0.5,
          0.55,
          0.026,
          0.045,
          { yaw },
        ));
      }
      if (accent < 0.34) {
        parts.push(makePart(entity, identity, 'hill-rock', 'matte', VOXEL_COLORS.stoneDark, x + 0.3, 0.11, z + 0.58, 0.25, 0.22, 0.2, { yaw: noise * 0.7 }));
        parts.push(makePart(entity, identity, 'hill-rock-light', 'matte', VOXEL_COLORS.stone, x + 0.63, 0.08, z + 0.4, 0.18, 0.16, 0.16, { yaw: -noise * 0.5 }));
      }
    } else if (kind === 'grass') {
      if (noise < 0.38) {
        parts.push(makePart(
          entity,
          identity,
          'grass-fleck-light',
          'matte',
          shade(entity.tint, 1.16),
          x + 0.5,
          0.018,
          z + 0.5,
          0.26,
          0.023,
          0.04,
          { yaw },
        ));
      }
      if (accent < 0.16) {
        parts.push(makePart(entity, identity, 'grass-tuft-left', 'matte', VOXEL_COLORS.foliageDark, x + 0.42, 0.13, z + 0.52, 0.035, 0.26, 0.035, { roll: -0.24 }));
        parts.push(makePart(entity, identity, 'grass-tuft-right', 'matte', VOXEL_COLORS.foliageLight, x + 0.56, 0.11, z + 0.48, 0.035, 0.22, 0.035, { roll: 0.25 }));
      }
    } else if (kind === 'forest') {
      if (noise < 0.42) {
        parts.push(makePart(
          entity,
          identity,
          'forest-leaf-litter',
          'matte',
          accent < 0.5 ? VOXEL_COLORS.soilDark : VOXEL_COLORS.foliageDark,
          x + 0.5,
          0.018,
          z + 0.5,
          0.26,
          0.022,
          0.11,
          { yaw },
        ));
      }
      if (accent < 0.16) {
        parts.push(makePart(entity, identity, 'forest-log', 'matte', VOXEL_COLORS.timberDark, x + 0.5, 0.09, z + 0.5, 0.42, 0.14, 0.13, { yaw: noise * Math.PI }));
      }
    }
  }
  return parts.sort(compareParts);
}
