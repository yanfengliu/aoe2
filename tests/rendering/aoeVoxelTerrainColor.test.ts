import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, TerrainKind } from '../../src/game/simulation/types';
import { terrainCells } from '../../src/rendering/voxel/aoeVoxelTerrain';

function terrain(kind: TerrainKind, x: number, z: number): ProjectedEntityView {
  return {
    id: z * 64 + x,
    generation: 0,
    kind: 'tile',
    layer: 'terrain',
    entityType: kind,
    owner: null,
    x,
    y: z,
    elevation: 0,
    tint: kind === 'water' ? 0x39788a : kind === 'hill' ? 0x817460 : 0x587f4e,
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

function channels(tint: number): { r: number; g: number; b: number } {
  return { r: (tint >>> 16) & 0xff, g: (tint >>> 8) & 0xff, b: tint & 0xff };
}

function brightness(tint: number): number {
  const { r, g, b } = channels(tint);
  return r + g + b;
}

function field(kind: TerrainKind, size: number): Map<string, number> {
  const cells = terrainCells(Array.from({ length: size * size }, (_, index) => (
    terrain(kind, index % size, Math.floor(index / size))
  )));
  return new Map(cells.map((cell) => [`${String(cell.x)}:${String(cell.z)}`, cell.tint]));
}

describe('terrain cell colour fields', () => {
  it('gives grass patch-scale colour variation, smooth up close and varied at range', () => {
    const tints = field('grass', 32);
    expect(new Set(tints.values()).size).toBeGreaterThanOrEqual(40);
    // Neighbouring cells stay close in colour while distant cells drift —
    // patches, not per-cell confetti and not one flat field.
    let adjacentSum = 0;
    let adjacentCount = 0;
    let farSum = 0;
    let farCount = 0;
    for (let z = 0; z < 32; z += 1) {
      for (let x = 0; x < 31; x += 1) {
        adjacentSum += Math.abs(
          brightness(tints.get(`${String(x)}:${String(z)}`)!)
          - brightness(tints.get(`${String(x + 1)}:${String(z)}`)!),
        );
        adjacentCount += 1;
      }
    }
    for (let z = 0; z < 32; z += 4) {
      for (let x = 0; x < 16; x += 2) {
        farSum += Math.abs(
          brightness(tints.get(`${String(x)}:${String(z)}`)!)
          - brightness(tints.get(`${String(x + 13)}:${String((z + 17) % 32)}`)!),
        );
        farCount += 1;
      }
    }
    expect(adjacentSum / adjacentCount).toBeLessThan((farSum / farCount) * 0.75);
    // The variation shifts hue, not just brightness: the red:green balance
    // moves between warm and cool greens.
    const ratios = [...tints.values()].map((tint) => {
      const { r, g } = channels(tint);
      return r / g;
    });
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeGreaterThanOrEqual(0.05);
    // Every cell still reads as grass: green stays the dominant channel.
    for (const tint of tints.values()) {
      const { r, g, b } = channels(tint);
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
    }
  });

  it('gives open water patch-scale variation that stays blue', () => {
    const tints = field('water', 32);
    expect(new Set(tints.values()).size).toBeGreaterThanOrEqual(30);
    for (const tint of tints.values()) {
      const { r, g, b } = channels(tint);
      expect(b).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(r);
    }
    const sums = [...tints.values()].map(brightness);
    expect(Math.max(...sums) - Math.min(...sums)).toBeGreaterThanOrEqual(30);
  });

  it('lightens shallow water near land and deepens open water', () => {
    // Land column x<2, water x>=2 on a 16-wide strip.
    const cells = terrainCells(Array.from({ length: 16 * 16 }, (_, index) => {
      const x = index % 16;
      const z = Math.floor(index / 16);
      return terrain(x < 2 ? 'grass' : 'water', x, z);
    }));
    const byDistance = (distance: number) => cells
      .filter((cell) => cell.kind === 'water' && cell.x === 2 + distance)
      .map((cell) => brightness(cell.tint));
    const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    const shore = average(byDistance(0));
    const second = average(byDistance(1));
    const deep = average([...byDistance(8), ...byDistance(9), ...byDistance(10)]);
    expect(shore).toBeGreaterThan(deep * 1.08);
    expect(second).toBeGreaterThan(deep * 1.02);
    expect(shore).toBeGreaterThan(second);
  });

  it('softens the meeting line between kinds instead of a clear cut', () => {
    // Grass x<8, hill x>=8: boundary cells pull toward each other.
    const cells = terrainCells(Array.from({ length: 16 * 16 }, (_, index) => {
      const x = index % 16;
      const z = Math.floor(index / 16);
      return terrain(x < 8 ? 'grass' : 'hill', x, z);
    }));
    const average = (kind: TerrainKind, column: number) => {
      const values = cells
        .filter((cell) => cell.kind === kind && cell.x === column)
        .map((cell) => brightness(cell.tint));
      return values.reduce((a, b) => a + b, 0) / values.length;
    };
    const interiorContrast = Math.abs(average('grass', 2) - average('hill', 13));
    const boundaryContrast = Math.abs(average('grass', 7) - average('hill', 8));
    expect(boundaryContrast).toBeLessThan(interiorContrast * 0.8);
  });

  it('warms grass at the waterline toward a sandy wet edge', () => {
    // Grass x<8, water x>=8.
    const cells = terrainCells(Array.from({ length: 16 * 16 }, (_, index) => {
      const x = index % 16;
      const z = Math.floor(index / 16);
      return terrain(x < 8 ? 'grass' : 'water', x, z);
    }));
    const ratio = (column: number) => {
      const values = cells
        .filter((cell) => cell.kind === 'grass' && cell.x === column)
        .map((cell) => {
          const { r, g } = channels(cell.tint);
          return r / g;
        });
      return values.reduce((a, b) => a + b, 0) / values.length;
    };
    // The boundary column is measurably warmer (sandier) than the interior.
    expect(ratio(7)).toBeGreaterThan(ratio(2) * 1.04);
  });

  it('stays deterministic across input order', () => {
    const entities = Array.from({ length: 24 * 24 }, (_, index) => {
      const x = index % 24;
      const z = Math.floor(index / 24);
      const kind: TerrainKind = x < 8 ? 'grass' : x < 16 ? 'water' : 'hill';
      return terrain(kind, x, z);
    });
    expect(terrainCells([...entities].reverse())).toEqual(terrainCells(entities));
  });
});
