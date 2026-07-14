import { describe, expect, it } from 'vitest';
import { DensePaletteChunk, raycastDensePaletteChunks } from 'voxel/meshing';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  AOE_TERRAIN_CHUNK_SIZE,
  AoeVoxelAdapter,
} from '../../src/rendering/voxel/aoeVoxelAdapter';

function terrain(id: number, x: number, z: number): ProjectedEntityView {
  return {
    id,
    generation: 0,
    kind: 'tile',
    layer: 'terrain',
    entityType: 'grass',
    owner: null,
    x,
    y: z,
    elevation: 0,
    tint: 0x587f4e,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: null,
    maxHp: null,
    isMemory: false,
  };
}

describe('AoE voxel terrain raycast compatibility', () => {
  it('exposes uniform dense chunks to the portable occupancy query across a missing seam', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([
      terrain(1, AOE_TERRAIN_CHUNK_SIZE, 0),
    ]);
    const chunks = new Map(snapshot.chunks.map((chunk) => {
      const dense = new DensePaletteChunk({
        origin: chunk.origin,
        size: chunk.size,
        voxels: chunk.voxels,
      });
      const coordinate = {
        x: chunk.origin.x / AOE_TERRAIN_CHUNK_SIZE,
        y: chunk.origin.y,
        z: chunk.origin.z / AOE_TERRAIN_CHUNK_SIZE,
      };
      return [`${String(coordinate.x)}:${String(coordinate.y)}:${String(coordinate.z)}`, dense] as const;
    }));

    const hit = raycastDensePaletteChunks({
      origin: { x: AOE_TERRAIN_CHUNK_SIZE - 0.5, y: -0.5, z: 0.5 },
      direction: { x: 1, y: 0, z: 0 },
      maxDistance: 1,
      chunkSize: { x: AOE_TERRAIN_CHUNK_SIZE, y: 1, z: AOE_TERRAIN_CHUNK_SIZE },
      getChunk: (x, y, z) => chunks.get(`${String(x)}:${String(y)}:${String(z)}`),
    });

    expect(hit).toMatchObject({
      cell: { x: AOE_TERRAIN_CHUNK_SIZE, y: -1, z: 0 },
      distance: 0.5,
      chunkCoordinate: { x: 1, y: -1, z: 0 },
      localCoordinate: { x: 0, y: 0, z: 0 },
    });
  });
});
