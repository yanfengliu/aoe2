// The Natural style's ground data (src/rendering/voxel/aoeDeGroundData.ts): what the ground shader knows about
// each cell. The fog-of-war rule it must keep is the one tests/rendering/aoeVoxelFogFairness.test.ts holds for
// the voxel ground: nothing about an unexplored cell may reach the picture. The shader draws a cell black when
// its kind is 0 and reads nothing else of it, so the class this gates is "the packed bytes depend on what an
// unexplored cell holds": change any unexplored cell to every other kind, or put a building on it, and the bytes
// must come out identical.
//
// Bound: CPU data only, on one 8x8 map with one fog frame. That the shader draws kind 0 black, and fades known
// ground toward it, is the browser suite's (tests/browser/de-ground.spec.ts).
import { describe, expect, it } from 'vitest';

import type { ProjectedFrameView } from '../../src/game/simulation/renderViewTypes';
import { TERRAIN_TINTS } from '../../src/game/simulation/terrainTints';
import type { ProjectedEntityView, TerrainKind } from '../../src/game/simulation/types';
import {
  DE_GROUND_DIRT_FOOTPRINT,
  DE_GROUND_DIRT_RING,
  DE_GROUND_KIND_CODE,
  DE_GROUND_UNEXPLORED,
  packDeGround,
} from '../../src/rendering/voxel/aoeDeGroundData';

const SIZE = 8;
const KINDS: readonly TerrainKind[] = ['grass', 'forest', 'water', 'hill'];

function kindAt(x: number, y: number): TerrainKind {
  return KINDS[(Math.floor(x / 2) + Math.floor(y / 3) * 3 + ((x * y) % 3)) % KINDS.length]!;
}

function entity(overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return {
    id: 1,
    generation: 0,
    kind: 'tile',
    layer: 'terrain',
    entityType: 'grass',
    owner: null,
    x: 0,
    y: 0,
    elevation: 0,
    tint: TERRAIN_TINTS.grass,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: null,
    maxHp: null,
    isMemory: false,
    ...overrides,
  };
}

function tile(x: number, y: number, kind: TerrainKind): ProjectedEntityView {
  return entity({ id: 1 + y * SIZE + x, x, y, entityType: kind, tint: TERRAIN_TINTS[kind] });
}

function building(x: number, y: number, width: number, height: number, isMemory = false): ProjectedEntityView {
  return entity({
    id: 1000 + y * SIZE + x,
    kind: 'building',
    layer: 'building',
    entityType: 'house',
    owner: 1,
    x,
    y,
    footprintWidth: width,
    footprintHeight: height,
    isMemory,
  });
}

function map(kind: (x: number, y: number) => TerrainKind = kindAt): ProjectedEntityView[] {
  const tiles: ProjectedEntityView[] = [];
  for (let y = 0; y < SIZE; y += 1) for (let x = 0; x < SIZE; x += 1) tiles.push(tile(x, y, kind(x, y)));
  return tiles;
}

// Visible: a 3x3 block at (1..3, 1..3). Explored: that block, plus x 4..5 on rows 1..4 and row 4 from x 1.
// Everything else is unexplored.
function fogFrame(): ProjectedFrameView {
  const visible: number[] = [];
  const explored: number[] = [];
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const index = y * SIZE + x;
      const inVision = x >= 1 && x <= 3 && y >= 1 && y <= 3;
      if (inVision) visible.push(index);
      if (inVision || (x >= 4 && x <= 5 && y >= 1 && y <= 4) || (y === 4 && x >= 1 && x <= 5)) explored.push(index);
    }
  }
  return {
    tick: 1,
    playerId: 1,
    seed: 'de-ground-test',
    mapWidth: SIZE,
    mapHeight: SIZE,
    visibleCells: visible,
    exploredCells: explored,
    recentUnitDeaths: [],
    projectiles: [],
  };
}

describe('Natural ground data', () => {
  it('packs each known cell\'s kind, and the fog level visible, explored and unexplored', () => {
    const frame = fogFrame();
    const data = packDeGround(map(), frame, 0.6);
    expect(data.width).toBe(SIZE);
    expect(data.height).toBe(SIZE);
    const explored = new Set(frame.exploredCells);
    const visible = new Set(frame.visibleCells);
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const index = y * SIZE + x;
        const code = data.cells[index * 4];
        if (explored.has(index)) expect(code, `cell (${x}, ${y})`).toBe(DE_GROUND_KIND_CODE[kindAt(x, y)]);
        else expect(code, `cell (${x}, ${y})`).toBe(DE_GROUND_UNEXPLORED);
        expect(data.fog[index], `fog at (${x}, ${y})`).toBe(visible.has(index) ? 255 : 153);
        expect(data.cells[index * 4 + 3]).toBe(255);
      }
    }
  });

  it('with no fog frame, knows and sees every cell', () => {
    const data = packDeGround(map(), null, 0.6);
    expect(data.width).toBe(SIZE);
    expect([...data.fog].every((level) => level === 255)).toBe(true);
    for (let index = 0; index < SIZE * SIZE; index += 1) {
      expect(data.cells[index * 4]).toBe(DE_GROUND_KIND_CODE[kindAt(index % SIZE, Math.floor(index / SIZE))]);
    }
  });

  it('lays dirt on a building\'s footprint and the ring of land around it, never on water', () => {
    const kinds = (x: number, y: number): TerrainKind => (x === 4 && y === 2 ? 'water' : 'grass');
    const data = packDeGround([...map(kinds), building(2, 2, 2, 2)], null, 0.6);
    const dirtAt = (x: number, y: number) => data.cells[(y * SIZE + x) * 4 + 1];
    expect(dirtAt(2, 2)).toBe(DE_GROUND_DIRT_FOOTPRINT);
    expect(dirtAt(3, 3)).toBe(DE_GROUND_DIRT_FOOTPRINT);
    expect(dirtAt(1, 1)).toBe(DE_GROUND_DIRT_RING);
    expect(dirtAt(4, 3)).toBe(DE_GROUND_DIRT_RING);
    expect(dirtAt(4, 2)).toBe(0);
    expect(dirtAt(5, 5)).toBe(0);
    expect(dirtAt(0, 0)).toBe(0);
  });

  it('packs the same bytes whatever an unexplored cell holds: kind, or a building on it', () => {
    const frame = fogFrame();
    const explored = new Set(frame.exploredCells);
    const baseline = packDeGround(map(), frame, 0.6);
    let unexplored = 0;
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (explored.has(y * SIZE + x)) continue;
        unexplored += 1;
        for (const other of KINDS) {
          if (other === kindAt(x, y)) continue;
          const changed = packDeGround(map((cx, cy) => (cx === x && cy === y ? other : kindAt(cx, cy))), frame, 0.6);
          expect(changed.cells, `cell (${x}, ${y}) as ${other}`).toEqual(baseline.cells);
          expect(changed.fog, `cell (${x}, ${y}) as ${other}`).toEqual(baseline.fog);
        }
        // A building standing only on unexplored ground: its ring would reach known cells beside it.
        const built = packDeGround([...map(), building(x, y, 1, 1)], frame, 0.6);
        expect(built.cells, `a building on cell (${x}, ${y})`).toEqual(baseline.cells);
      }
    }
    expect(unexplored).toBeGreaterThan(30);
  });

  it('packs kind codes 1 to 4, which the shader indexes a four-component weight by', () => {
    // aoeDeGroundShader.ts accumulates each surface's weight at kindWeight[kind - 1] of a vec4; a code outside
    // 1..4 would index past its end, which GLSL leaves undefined.
    expect(Object.values(DE_GROUND_KIND_CODE).sort()).toEqual([1, 2, 3, 4]);
    expect(DE_GROUND_UNEXPLORED).toBe(0);
  });

  it('keeps dirt off unexplored cells, so a remembered building beside them marks only known ground', () => {
    const frame = fogFrame();
    // A remembered 2x2 building on explored cells (4..5, 3..4); its ring reaches unexplored rows and columns.
    const data = packDeGround([...map(() => 'grass'), building(4, 3, 2, 2, true)], frame, 0.6);
    const explored = new Set(frame.exploredCells);
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const index = y * SIZE + x;
        if (!explored.has(index)) expect(data.cells[index * 4 + 1], `dirt at (${x}, ${y})`).toBe(0);
      }
    }
    expect(data.cells[(3 * SIZE + 4) * 4 + 1]).toBe(DE_GROUND_DIRT_FOOTPRINT);
  });

  it('refuses a terrain cell outside the map, and a brightness outside 0 to 1, naming what it got', () => {
    expect(() => packDeGround([tile(SIZE, 0, 'grass')], fogFrame(), 0.6)).toThrow(/Terrain cell \(8, 0\) is not a whole cell inside the 8x8 map/);
    expect(() => packDeGround(map(), fogFrame(), 1.5)).toThrow(/from 0 to 1; got 1.5/);
  });
});
