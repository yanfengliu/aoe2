import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  computeTerrainSignature,
  createTerrainCache,
} from '../../src/phaser/scenes/gameScene/terrainCache';

// The terrain-layer cache (v0.1.131) skips the per-frame redraw while this
// signature is stable and forces a redraw when it changes. The contract: same
// terrain → same signature (skip the ~2160 iso-diamond fills), any real change
// → different signature (redraw), and non-terrain churn (units moving) must
// NOT flip it.

function terrain(x: number, y: number, tint = 0x5a8f52): ProjectedEntityView {
  return {
    id: y * 1000 + x,
    kind: 'tile',
    layer: 'terrain',
    entityType: 'grass',
    owner: null,
    x,
    y,
    tint,
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

function unit(x: number, y: number): ProjectedEntityView {
  return { ...terrain(x, y), id: 99000 + x, kind: 'unit', layer: 'unit', entityType: 'villager' };
}

describe('computeTerrainSignature', () => {
  const grid = [terrain(0, 0), terrain(1, 0, 0x6a9f62), terrain(0, 1), terrain(1, 1, 0x3a6f42)];

  it('is stable for identical terrain', () => {
    expect(computeTerrainSignature(grid)).toBe(computeTerrainSignature([...grid]));
  });

  it('does not change when a non-terrain entity moves (units churn every frame)', () => {
    const before = computeTerrainSignature([...grid, unit(2, 2)]);
    const after = computeTerrainSignature([...grid, unit(5, 7)]);
    expect(after).toBe(before);
    // …and matches the terrain-only signature (units contribute nothing).
    expect(before).toBe(computeTerrainSignature(grid));
  });

  it('changes when a terrain cell is re-tinted in place', () => {
    const recoloured = grid.map((cell, index) =>
      index === 1 ? { ...cell, tint: 0x112233 } : cell,
    );
    expect(computeTerrainSignature(recoloured)).not.toBe(computeTerrainSignature(grid));
  });

  it('changes when a terrain cell moves (different map layout)', () => {
    const moved = grid.map((cell, index) => (index === 2 ? { ...cell, x: 9, y: 9 } : cell));
    expect(computeTerrainSignature(moved)).not.toBe(computeTerrainSignature(grid));
  });

  it('changes when the terrain cell count changes (map swap)', () => {
    expect(computeTerrainSignature([...grid, terrain(2, 0)])).not.toBe(
      computeTerrainSignature(grid),
    );
  });

  it('is empty-stable (no terrain yet → forces the first real draw later)', () => {
    expect(computeTerrainSignature([unit(0, 0)])).toBe('0:0');
    expect(computeTerrainSignature([])).toBe('0:0');
  });
});

describe('createTerrainCache (skip / redraw / reset gate)', () => {
  const grid = [terrain(0, 0), terrain(1, 0, 0x6a9f62), terrain(0, 1)];

  it('redraws on the first frame with only the terrain subset', () => {
    const cache = createTerrainCache();
    const redraws: ProjectedEntityView[][] = [];
    const drew = cache.renderIfChanged([...grid, unit(2, 2)], (cells) => redraws.push(cells));
    expect(drew).toBe(true);
    expect(redraws).toHaveLength(1);
    expect(redraws[0]!.every((c) => c.layer === 'terrain')).toBe(true);
    expect(redraws[0]!).toHaveLength(3);
  });

  it('SKIPS the redraw when terrain is unchanged (the perf contract)', () => {
    const cache = createTerrainCache();
    let redraws = 0;
    cache.renderIfChanged(grid, () => { redraws += 1; });
    const drew = cache.renderIfChanged([...grid], () => { redraws += 1; });
    expect(drew).toBe(false);
    expect(redraws).toBe(1);
  });

  it('does not redraw when only non-terrain entities move (units churn every frame)', () => {
    const cache = createTerrainCache();
    let redraws = 0;
    cache.renderIfChanged([...grid, unit(2, 2)], () => { redraws += 1; });
    cache.renderIfChanged([...grid, unit(9, 9)], () => { redraws += 1; });
    expect(redraws).toBe(1);
  });

  it('redraws when terrain changes (a cell re-tints)', () => {
    const cache = createTerrainCache();
    let redraws = 0;
    cache.renderIfChanged(grid, () => { redraws += 1; });
    const recoloured = grid.map((c, i) => (i === 0 ? { ...c, tint: 0x112233 } : c));
    cache.renderIfChanged(recoloured, () => { redraws += 1; });
    expect(redraws).toBe(2);
  });

  it('redraws again after reset() even when terrain is identical (bridge swap)', () => {
    const cache = createTerrainCache();
    let redraws = 0;
    cache.renderIfChanged(grid, () => { redraws += 1; });
    cache.renderIfChanged(grid, () => { redraws += 1; }); // skipped
    cache.reset();
    const drew = cache.renderIfChanged(grid, () => { redraws += 1; });
    expect(drew).toBe(true);
    expect(redraws).toBe(2);
  });
});
