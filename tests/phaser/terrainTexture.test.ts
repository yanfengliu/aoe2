import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, TerrainKind } from '../../src/game/simulation/types';
import {
  TERRAIN_BASE_TINT,
  blendTint,
  drawTerrainCell,
  terrainCellTint,
} from '../../src/phaser/scenes/gameScene/terrainRenderer';

// Base terrain tints, mirroring scenarioSeedOps.seedTerrain. The renderer
// applies a deterministic per-cell jitter on top so adjacent same-kind cells
// stop reading as one flat block, AND (v0.1.43) feathers the seam between
// adjacent cells of DIFFERENT kinds (M7 graphics — original/procedural art only).
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

// ---- drawTerrainCell: neighbour-aware blended transitions ----

const CELL_SIZE = 24;

interface DrawCall {
  op: string;
  args: number[];
}

// A Phaser.GameObjects.Graphics stand-in that records every primitive draw call
// + every (x, y) point, mirroring the spy in buildingRenderer.test.ts. Only the
// primitives drawTerrainCell uses (fillStyle + fillRect) need real handlers; the
// rest are present so an accidental new primitive does not throw.
function createGraphicsSpy() {
  const calls: DrawCall[] = [];
  const points: Array<{ x: number; y: number }> = [];
  const graphics = {
    fillStyle: (color: number, alpha?: number) => {
      calls.push({ op: 'fillStyle', args: [color, alpha ?? 1] });
    },
    lineStyle: (width: number, color: number, alpha?: number) => {
      calls.push({ op: 'lineStyle', args: [width, color, alpha ?? 1] });
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      calls.push({ op: 'fillRect', args: [x, y, w, h] });
      points.push({ x, y }, { x: x + w, y: y + h });
    },
  };
  return { graphics, calls, points };
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
// cell's kind, `ring` fills the eight surrounding cells (so a uniform patch is
// `ring === center`).
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

function fillRects(calls: DrawCall[]): DrawCall[] {
  return calls.filter((c) => c.op === 'fillRect');
}

describe('drawTerrainCell — kind-to-kind blended transitions', () => {
  it('draws ONLY the base fill for a cell surrounded by same-kind neighbours', () => {
    const { entities, centerCell } = patch('grass', 'grass');
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, entities, centerCell, CELL_SIZE);
    // Exactly one fillRect (the base cell), no transition specks.
    expect(fillRects(spy.calls).length).toBe(1);
    const base = fillRects(spy.calls)[0];
    expect(base.args[0]).toBe(centerCell.x * CELL_SIZE);
    expect(base.args[1]).toBe(centerCell.y * CELL_SIZE);
  });

  it('still applies the v0.1.30 jitter + 1px overdraw to the base fill', () => {
    const { entities, centerCell } = patch('grass', 'grass');
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, entities, centerCell, CELL_SIZE);
    // The base fillStyle colour is the jittered tint (regression guard: the
    // base fill must keep using terrainCellTint, not the raw entity.tint).
    const firstFillStyle = spy.calls.find((c) => c.op === 'fillStyle');
    expect(firstFillStyle?.args[0]).toBe(
      terrainCellTint(centerCell.tint, centerCell.x, centerCell.y),
    );
    const base = fillRects(spy.calls)[0];
    // +1px overdraw on width + height (unchanged from v0.1.30).
    expect(base.args[2]).toBe(CELL_SIZE + 1);
    expect(base.args[3]).toBe(CELL_SIZE + 1);
  });

  it('draws transition specks when a neighbour is a different kind', () => {
    const { entities, centerCell } = patch('grass', 'water');
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, entities, centerCell, CELL_SIZE);
    // Base fill + at least one transition speck per differing edge.
    expect(fillRects(spy.calls).length).toBeGreaterThan(1);
  });

  it('only feathers the edge whose neighbour differs (single differing side)', () => {
    // Centre grass; only the EAST neighbour (2,1) is water, the rest grass.
    const entities: ProjectedEntityView[] = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const kind: TerrainKind = x === 2 && y === 1 ? 'water' : 'grass';
        entities.push(terrainCell(x, y, kind));
      }
    }
    const centerCell = entities.find((e) => e.x === 1 && e.y === 1)!;
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, entities, centerCell, CELL_SIZE);

    const px = centerCell.x * CELL_SIZE;
    const py = centerCell.y * CELL_SIZE;
    const speckRects = fillRects(spy.calls).slice(1); // drop the base fill
    expect(speckRects.length).toBeGreaterThan(0);
    // Every speck must sit on the EAST half of the cell (x past the midline),
    // since only the east neighbour differs.
    const midX = px + CELL_SIZE * 0.5;
    for (const rect of speckRects) {
      const rectRight = rect.args[0] + rect.args[2];
      expect(rectRight).toBeGreaterThan(midX);
      // and entirely within the vertical extent of this cell.
      expect(rect.args[1]).toBeGreaterThanOrEqual(py - 0.001);
      expect(rect.args[1] + rect.args[3]).toBeLessThanOrEqual(py + CELL_SIZE + 0.001);
    }
  });

  it('uses the blend of the two kinds as the transition speck colour', () => {
    const { entities, centerCell } = patch('grass', 'water');
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, entities, centerCell, CELL_SIZE);
    const expectedBlend = blendTint(TERRAIN_BASE_TINT.grass, TERRAIN_BASE_TINT.water);
    // The transition fillStyle must be the grass/water blend, derived from the
    // two kinds — NOT a hardcoded unrelated colour.
    const usedBlend = spy.calls.some(
      (c) => c.op === 'fillStyle' && c.args[0] === expectedBlend && (c.args[1] as number) < 1,
    );
    expect(usedBlend).toBe(true);
  });

  it('is deterministic — identical inputs produce identical draw calls', () => {
    const a = patch('forest', 'grass');
    const b = patch('forest', 'grass');
    const spyA = createGraphicsSpy();
    const spyB = createGraphicsSpy();
    drawTerrainCell(spyA.graphics as never, a.entities, a.centerCell, CELL_SIZE);
    drawTerrainCell(spyB.graphics as never, b.entities, b.centerCell, CELL_SIZE);
    expect(spyA.calls).toEqual(spyB.calls);
  });

  it('keeps every drawn point within the cell rect (+1px overdraw tolerance)', () => {
    // Selection / fog / grid overlays sit on top and assume terrain occupies
    // exactly its cell rect. The transition must not bleed past it.
    const { entities, centerCell } = patch('grass', 'water'); // all 4 edges differ
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, entities, centerCell, CELL_SIZE);
    const px = centerCell.x * CELL_SIZE;
    const py = centerCell.y * CELL_SIZE;
    const tol = 1.001; // matches the base fill's +1px overdraw
    for (const point of spy.points) {
      expect(point.x).toBeGreaterThanOrEqual(px - tol);
      expect(point.x).toBeLessThanOrEqual(px + CELL_SIZE + tol);
      expect(point.y).toBeGreaterThanOrEqual(py - tol);
      expect(point.y).toBeLessThanOrEqual(py + CELL_SIZE + tol);
    }
  });

  it('draws no transition toward a map edge (missing neighbour = no blend)', () => {
    // A single isolated cell at the origin with no neighbours present: the
    // lookup returns null for all four sides → no transition specks, just base.
    const cell = terrainCell(0, 0, 'grass');
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, [cell], cell, CELL_SIZE);
    expect(fillRects(spy.calls).length).toBe(1);
  });

  it('treats a missing neighbour as no-transition even amid differing ones', () => {
    // Centre water at (0,1) on the WEST map edge: west neighbour missing (no
    // blend), east neighbour (1,1) grass (blend). Only the east edge feathers.
    const entities: ProjectedEntityView[] = [
      terrainCell(0, 0, 'water'),
      terrainCell(1, 0, 'water'),
      terrainCell(0, 1, 'water'),
      terrainCell(1, 1, 'grass'),
      terrainCell(0, 2, 'water'),
      terrainCell(1, 2, 'water'),
    ];
    const centerCell = entities.find((e) => e.x === 0 && e.y === 1)!;
    const spy = createGraphicsSpy();
    drawTerrainCell(spy.graphics as never, entities, centerCell, CELL_SIZE);
    const px = centerCell.x * CELL_SIZE;
    const speckRects = fillRects(spy.calls).slice(1);
    expect(speckRects.length).toBeGreaterThan(0);
    // All specks on the east half (toward the grass neighbour); none toward the
    // (missing) west edge.
    const midX = px + CELL_SIZE * 0.5;
    for (const rect of speckRects) {
      expect(rect.args[0] + rect.args[2]).toBeGreaterThan(midX);
    }
  });
});
