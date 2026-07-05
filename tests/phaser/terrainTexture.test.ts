import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, TerrainKind } from '../../src/game/simulation/types';
import {
  TERRAIN_BASE_TINT,
  blendTint,
  drawTerrainCell,
  terrainCellTint,
} from '../../src/phaser/scenes/gameScene/terrainRenderer';
import { worldToIso } from '../../src/phaser/scenes/gameScene/isoProjection';

// Base terrain tints, mirroring scenarioSeedOps.seedTerrain. The renderer
// applies a deterministic per-cell jitter on top so adjacent same-kind cells
// stop reading as one flat block, and (v0.1.103) projects each cell as an
// isometric diamond (M7 graphics — original/procedural art only).
const GRASS = 0x587f4e;
const WATER = 0x295a75;

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

describe('terrainCellTint — per-cell terrain texture variation', () => {
  it('is deterministic per cell (no frame-to-frame shimmer)', () => {
    // Same cell must always map to the same tint; otherwise static terrain
    // would flicker every render frame.
    expect(terrainCellTint(GRASS, 3, 5)).toBe(terrainCellTint(GRASS, 3, 5));
    expect(terrainCellTint(GRASS, 12, 0)).toBe(terrainCellTint(GRASS, 12, 0));
  });

  it('returns a valid 24-bit colour with every channel in 0..255', () => {
    for (let y = 0; y < 36; y++) {
      for (let x = 0; x < 60; x++) {
        const tint = terrainCellTint(GRASS, x, y);
        expect(tint).toBeGreaterThanOrEqual(0);
        expect(tint).toBeLessThanOrEqual(0xffffff);
        for (const ch of channels(tint)) {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('handles edge tints without overflow and exercises the upper clamp', () => {
    // Pure black stays black for every cell (0 * any multiplier = 0); a
    // negative or NaN channel would surface here.
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(terrainCellTint(0x000000, x, y)).toBe(0x000000);
      }
    }
    // Pure white must never exceed the gamut, and cells whose jitter brightens
    // (multiplier > 1) must actually engage the upper clamp at 255 — the branch
    // the mid-tone GRASS/WATER cases never reach.
    let sawUpperClamp = false;
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const tint = terrainCellTint(0xffffff, x, y);
        expect(tint).toBeLessThanOrEqual(0xffffff);
        for (const ch of channels(tint)) {
          expect(ch).toBeLessThanOrEqual(255);
          if (ch === 255) sawUpperClamp = true;
        }
      }
    }
    expect(sawUpperClamp).toBe(true);
  });

  it('keeps the variation subtle (each channel within ~10% of the base)', () => {
    // The jitter must read as gentle texture, not garish noise. Guards
    // against someone cranking the jitter amplitude.
    const [br, bg, bb] = channels(GRASS);
    const bound = (base: number) => Math.ceil(base * 0.1) + 2;
    for (let y = 0; y < 36; y++) {
      for (let x = 0; x < 60; x++) {
        const [r, g, b] = channels(terrainCellTint(GRASS, x, y));
        expect(Math.abs(r - br)).toBeLessThanOrEqual(bound(br));
        expect(Math.abs(g - bg)).toBeLessThanOrEqual(bound(bg));
        expect(Math.abs(b - bb)).toBeLessThanOrEqual(bound(bb));
      }
    }
  });

  it('actually varies across cells (breaks up the flat block)', () => {
    const seen = new Set<number>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        seen.add(terrainCellTint(GRASS, x, y));
      }
    }
    // 400 cells yield many distinct shades — a flat fill would yield 1. The
    // jitter is a single brightness multiplier (hue preserved), so the three
    // channels move together and ±7% resolves to a few dozen distinct tints;
    // that is plenty to break the block while reading as light/shade.
    expect(seen.size).toBeGreaterThan(30);
  });

  it('is unbiased on average (preserves the designer-chosen base colour)', () => {
    // Symmetric jitter: the mean over a large field stays close to the base,
    // so terrain does not globally darken or brighten.
    const [br, bg, bb] = channels(WATER);
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const [r, g, b] = channels(terrainCellTint(WATER, x, y));
        sr += r;
        sg += g;
        sb += b;
        n++;
      }
    }
    expect(Math.abs(sr / n - br)).toBeLessThanOrEqual(3);
    expect(Math.abs(sg / n - bg)).toBeLessThanOrEqual(3);
    expect(Math.abs(sb / n - bb)).toBeLessThanOrEqual(3);
  });
});

describe('blendTint — two-kind transition colour', () => {
  it('is the per-channel average of the two tints', () => {
    expect(blendTint(0x000000, 0xffffff)).toBe(0x7f7f7f);
    expect(blendTint(0x102030, 0x102030)).toBe(0x102030);
  });

  it('is commutative and stays in gamut for the terrain palette', () => {
    const kinds = Object.keys(TERRAIN_BASE_TINT) as TerrainKind[];
    for (const a of kinds) {
      for (const b of kinds) {
        const ab = blendTint(TERRAIN_BASE_TINT[a], TERRAIN_BASE_TINT[b]);
        const ba = blendTint(TERRAIN_BASE_TINT[b], TERRAIN_BASE_TINT[a]);
        expect(ab).toBe(ba);
        expect(ab).toBeGreaterThanOrEqual(0);
        expect(ab).toBeLessThanOrEqual(0xffffff);
      }
    }
  });

  it('mirrors the seedTerrain base tints (the blend is derived from real kinds)', () => {
    // The renderer must derive transition colour from the SAME per-kind tints
    // the simulation seeds, not an unrelated palette.
    expect(TERRAIN_BASE_TINT.grass).toBe(0x587f4e);
    expect(TERRAIN_BASE_TINT.forest).toBe(0x2f5e34);
    expect(TERRAIN_BASE_TINT.water).toBe(0x295a75);
    expect(TERRAIN_BASE_TINT.hill).toBe(0x8c7d5a);
  });
});

// ---- drawTerrainCell: isometric diamond tile ----

const CELL_SIZE = 24;

interface DrawCall {
  op: string;
  args: number[];
}

// A Phaser.GameObjects.Graphics stand-in that records every primitive draw call.
// drawTerrainCell now emits fillStyle + fillPoints (a filled diamond); fillRect
// is still recorded so a regression that re-introduces the old square fill is
// caught rather than silently ignored.
function createGraphicsSpy() {
  const calls: DrawCall[] = [];
  const pointBatches: Array<Array<{ x: number; y: number }>> = [];
  const graphics = {
    fillStyle: (color: number, alpha?: number) => {
      calls.push({ op: 'fillStyle', args: [color, alpha ?? 1] });
    },
    lineStyle: (width: number, color: number, alpha?: number) => {
      calls.push({ op: 'lineStyle', args: [width, color, alpha ?? 1] });
    },
    fillPoints: (points: Array<{ x: number; y: number }>, closePath?: boolean) => {
      calls.push({ op: 'fillPoints', args: [points.length, closePath ? 1 : 0] });
      pointBatches.push(points.map((p) => ({ x: p.x, y: p.y })));
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      calls.push({ op: 'fillRect', args: [x, y, w, h] });
    },
  };
  return { graphics, calls, pointBatches };
}

// Build a terrain ProjectedEntityView for a cell of the given kind.
function terrainCell(x: number, y: number, kind: TerrainKind): ProjectedEntityView {
  return {
    id: y * 1000 + x,
    kind: 'tile',
    layer: 'terrain',
    entityType: kind,
    owner: null,
    x,
    y,
    tint: TERRAIN_BASE_TINT[kind],
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

// A 3x3 patch of terrain entities centred at (1,1); `center` is the centre
// cell's kind, `ring` fills the eight surrounding cells. Used to prove the iso
// tile ignores neighbour kinds (the square-edge feather was dropped).
function patch(center: TerrainKind, ring: TerrainKind): {
  entities: ProjectedEntityView[];
  centerCell: ProjectedEntityView;
} {
  const entities: ProjectedEntityView[] = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const kind = x === 1 && y === 1 ? center : ring;
      entities.push(terrainCell(x, y, kind));
    }
  }
  const centerCell = entities.find((e) => e.x === 1 && e.y === 1)!;
  return { entities, centerCell };
}

describe('drawTerrainCell — isometric diamond tile', () => {
  it('draws exactly one filled diamond (4 corner points, closed path)', () => {
    const cell = terrainCell(3, 5, 'grass');
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, [cell], cell, CELL_SIZE);
    const fills = spy.calls.filter((c) => c.op === 'fillPoints');
    expect(fills.length).toBe(1);
    expect(fills[0].args[0]).toBe(4); // four corners
    expect(fills[0].args[1]).toBe(1); // closed path
    // No leftover square-fill / square-feather fillRect from the pre-iso renderer.
    expect(spy.calls.some((c) => c.op === 'fillRect')).toBe(false);
  });

  it('projects the four cell corners with worldToIso (top, right, bottom, left)', () => {
    const cellX = 4;
    const cellY = 2;
    const cell = terrainCell(cellX, cellY, 'grass');
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, [cell], cell, CELL_SIZE);
    const pts = spy.pointBatches[0];
    expect(pts[0]).toEqual(worldToIso(cellX, cellY)); // top
    expect(pts[1]).toEqual(worldToIso(cellX + 1, cellY)); // right
    expect(pts[2]).toEqual(worldToIso(cellX + 1, cellY + 1)); // bottom
    expect(pts[3]).toEqual(worldToIso(cellX, cellY + 1)); // left
  });

  it('forms a 2:1 rhombus (opposite corners aligned, width:height = 2:1)', () => {
    // The iso projection of a unit cell is a 64x32 diamond: top & bottom share
    // the same screen x (its vertical axis), left & right share the same screen
    // y (its horizontal axis), and the diagonal spans are 2:1.
    const cell = terrainCell(7, 3, 'water');
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, [cell], cell, CELL_SIZE);
    const [top, right, bottom, left] = spy.pointBatches[0];
    expect(top.x).toBe(bottom.x);
    expect(left.y).toBe(right.y);
    expect(right.x - left.x).toBe(2 * (bottom.y - top.y));
  });

  it('fills with the jittered per-cell tint (not the raw entity.tint), opaque', () => {
    const cell = terrainCell(9, 1, 'grass');
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, [cell], cell, CELL_SIZE);
    const fillStyle = spy.calls.find((c) => c.op === 'fillStyle');
    expect(fillStyle?.args[0]).toBe(terrainCellTint(cell.tint, cell.x, cell.y));
    expect(fillStyle?.args[1]).toBe(1); // terrain is opaque
  });

  it('is deterministic — identical inputs produce identical draw calls', () => {
    const cellA = terrainCell(6, 6, 'forest');
    const cellB = terrainCell(6, 6, 'forest');
    const spyA = createGraphicsSpy();
    const spyB = createGraphicsSpy();
    drawTerrainCell(spyA.graphics as never, [cellA], cellA, CELL_SIZE);
    drawTerrainCell(spyB.graphics as never, [cellB], cellB, CELL_SIZE);
    expect(spyA.calls).toEqual(spyB.calls);
    expect(spyA.pointBatches).toEqual(spyB.pointBatches);
  });

  it('ignores neighbour kinds (the square-edge feather was dropped at v0.1.103)', () => {
    // Regression guard for the iso switch: the centre cell draws the SAME single
    // diamond whether its ring is its own kind or a different one — no per-edge
    // feather primitives remain, so draw calls depend only on the centre cell.
    const uniform = patch('grass', 'grass');
    const mixed = patch('grass', 'water');
    const spyU = createGraphicsSpy();
    const spyM = createGraphicsSpy();
    drawTerrainCell(spyU.graphics as never, uniform.entities, uniform.centerCell, CELL_SIZE);
    drawTerrainCell(spyM.graphics as never, mixed.entities, mixed.centerCell, CELL_SIZE);
    const countFills = (calls: DrawCall[]) => calls.filter((c) => c.op === 'fillPoints').length;
    expect(countFills(spyU.calls)).toBe(1);
    expect(countFills(spyM.calls)).toBe(1);
    expect(spyU.calls).toEqual(spyM.calls);
  });
});
