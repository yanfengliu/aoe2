// Fog of war on the world canvas: nothing about an unexplored cell may reach
// the picture, in any art style.
//
// The defect (register, 2026-09-23): unexplored ground was drawn at 12% of its
// colour, so raising a screen's contrast showed every lake and forest on the
// map. Definitive Edition draws unexplored ground black. A second path leaked
// the same thing one cell deep: the terrain colour pipeline blends each cell
// toward neighbours of a DIFFERENT kind (seams, wet sand, the shallow-water
// band), and it read the true kind of an unexplored neighbour, so the rim of
// the explored area outlined what lay past it.
//
// The class this gates is "the drawn world depends on the content of an
// unexplored cell", so the main case is NON-INTERFERENCE: change any one
// unexplored cell to every other terrain kind and the whole render snapshot
// (chunks, palette, batches) must come out identical. That catches the dim
// ground, the rim blend, and any future path (a decor part, a shore stroke)
// that reads unexplored terrain, without naming any of them.
//
// Bound: one 8x8 map with one fog frame, terrain only. Entities in unexplored
// cells are the bridge's to withhold (it never projects them), so they are not
// exercised here; the browser suite's art-style spec checks the drawn pixels.
import { describe, expect, it } from 'vitest';
import type { PaletteResourceV1, RenderSnapshotV1 } from 'voxel/core';

import { TERRAIN_TINTS } from '../../src/game/simulation/terrainTints';
import type { ProjectedEntityView, TerrainKind } from '../../src/game/simulation/types';
import { ART_STYLES } from '../../src/rendering/artStyles';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import type { AoeVoxelOverlayInput } from '../../src/rendering/voxel/aoeVoxelOverlayParts';
import { AOE_TERRAIN_CHUNK_SIZE } from '../../src/rendering/voxel/aoeVoxelTerrain';

const SIZE = 8;
const KINDS: readonly TerrainKind[] = ['grass', 'forest', 'water', 'hill'];

// A patchy map, so unexplored cells of every kind border known cells of every
// other kind (the rim blend only fires across a change of kind).
function kindAt(x: number, y: number): TerrainKind {
  return KINDS[(Math.floor(x / 2) + Math.floor(y / 3) * 3 + ((x * y) % 3)) % KINDS.length]!;
}

function tile(x: number, y: number, kind: TerrainKind): ProjectedEntityView {
  return {
    id: 1 + y * SIZE + x,
    generation: 0,
    kind: 'tile',
    layer: 'terrain',
    entityType: kind,
    owner: null,
    x,
    y,
    elevation: 0,
    tint: TERRAIN_TINTS[kind],
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

function map(override?: { x: number; y: number; kind: TerrainKind }): ProjectedEntityView[] {
  const tiles: ProjectedEntityView[] = [];
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const kind = override && override.x === x && override.y === y ? override.kind : kindAt(x, y);
      tiles.push(tile(x, y, kind));
    }
  }
  return tiles;
}

// Visible: the 3x3 block at (2..4, 2..4). Explored: the 5x5 block around it,
// so the explored ring has a rim on all four sides. Unexplored: the rest.
const cellIndex = (x: number, y: number) => y * SIZE + x;
const VISIBLE = new Set<number>();
const EXPLORED = new Set<number>();
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    if (x >= 2 && x <= 4 && y >= 2 && y <= 4) VISIBLE.add(cellIndex(x, y));
    if (x >= 1 && x <= 5 && y >= 1 && y <= 5) EXPLORED.add(cellIndex(x, y));
  }
}
const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const UNEXPLORED: { x: number; y: number }[] = [];
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    if (!EXPLORED.has(cellIndex(x, y))) UNEXPLORED.push({ x, y });
  }
}

const OVERLAYS: AoeVoxelOverlayInput = {
  frame: {
    tick: 1,
    playerId: 1,
    seed: 'fog-fairness',
    mapWidth: SIZE,
    mapHeight: SIZE,
    visibleCells: [...VISIBLE],
    exploredCells: [...EXPLORED],
    recentUnitDeaths: [],
    projectiles: [],
  },
  placementPreview: null,
  selectionPreviewEntityIds: [],
};

// A second frame where VISIBLE ground touches unexplored ground, as it does at
// the edge of first sight: every cell of the 5x5 block is visible and there is
// no explored ring between it and the dark. Detail parts (grass tufts, shore
// surf) are built only for visible cells, so this is the frame in which a
// detail part that read an unexplored neighbour would show.
const EDGE_OVERLAYS: AoeVoxelOverlayInput = {
  ...OVERLAYS,
  frame: { ...OVERLAYS.frame!, visibleCells: [...EXPLORED] },
};

function snapshotFor(
  exploredGround: number,
  entities: readonly ProjectedEntityView[],
  overlays: AoeVoxelOverlayInput = OVERLAYS,
): RenderSnapshotV1 {
  const adapter = new AoeVoxelAdapter();
  adapter.setExploredGround(exploredGround);
  return adapter.createSnapshot(entities, 1_000, overlays);
}

// The colour the ground voxel of cell (x, y) is drawn with.
function groundColour(snapshot: RenderSnapshotV1, x: number, y: number) {
  const chunkX = Math.floor(x / AOE_TERRAIN_CHUNK_SIZE);
  const chunkZ = Math.floor(y / AOE_TERRAIN_CHUNK_SIZE);
  const chunk = snapshot.chunks.find((candidate) => (
    candidate.origin.x === chunkX * AOE_TERRAIN_CHUNK_SIZE
    && candidate.origin.z === chunkZ * AOE_TERRAIN_CHUNK_SIZE
  ))!;
  const localX = x - chunk.origin.x;
  const localZ = y - chunk.origin.z;
  const index = (chunk.voxels as Uint16Array)[localX + chunk.size.x * localZ]!;
  const palette = snapshot.resources.find(
    (resource): resource is PaletteResourceV1 => resource.kind === 'palette',
  )!;
  return palette.entries[index]!.color;
}

describe('fog of war on the world canvas', () => {
  it('builds a map whose explored rim crosses every kind of boundary the pipeline blends', () => {
    // Guards the fixture: each blend path fires only across a change of kind,
    // so without these boundaries on the rim the main case would pass vacuously.
    const rimKinds = new Set<string>();
    let wetSand = 0;
    let shallowBand = 0;
    for (const { x, y } of UNEXPLORED) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inMap(nx, ny) || !EXPLORED.has(cellIndex(nx, ny))) continue;
        if (kindAt(x, y) !== kindAt(nx, ny)) rimKinds.add(`${kindAt(x, y)}|${kindAt(nx, ny)}`);
        if (kindAt(x, y) === 'water' && kindAt(nx, ny) !== 'water') wetSand += 1;
      }
      // The shallow-water band reads land up to two cells away, diagonals too.
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inMap(nx, ny) || !EXPLORED.has(cellIndex(nx, ny))) continue;
          if (kindAt(x, y) !== 'water' && kindAt(nx, ny) === 'water') shallowBand += 1;
        }
      }
    }
    expect(rimKinds.size, [...rimKinds].join(' ')).toBeGreaterThanOrEqual(9);
    expect(wetSand).toBeGreaterThan(0);
    // In the edge frame, visible water borders unexplored land: that is where
    // surf would grow if the detail parts read unexplored neighbours.
    let visibleWaterByUnexploredLand = 0;
    for (const index of EXPLORED) {
      const x = index % SIZE;
      const y = Math.floor(index / SIZE);
      if (kindAt(x, y) !== 'water') continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (inMap(nx, ny) && !EXPLORED.has(cellIndex(nx, ny)) && kindAt(nx, ny) !== 'water') {
          visibleWaterByUnexploredLand += 1;
        }
      }
    }
    expect(visibleWaterByUnexploredLand).toBeGreaterThan(0);
    expect(shallowBand).toBeGreaterThan(0);
    expect(UNEXPLORED.length).toBe(SIZE * SIZE - 25);
  });

  for (const style of ART_STYLES) {
    describe(`in the ${style.id} style`, () => {
      it('draws every unexplored cell exactly black', () => {
        const snapshot = snapshotFor(style.exploredGround, map());
        for (const { x, y } of UNEXPLORED) {
          expect(groundColour(snapshot, x, y), `cell ${String(x)},${String(y)}`)
            .toEqual({ r: 0, g: 0, b: 0, a: 255 });
        }
      });

      const frames = [
        ['behind an explored ring', OVERLAYS],
        ['beside visible ground', EDGE_OVERLAYS],
      ] as const;
      for (const [frameName, overlays] of frames) {
        it(`draws the same world whatever an unexplored cell holds, ${frameName}`, () => {
          const baseline = snapshotFor(style.exploredGround, map(), overlays);
          const leaks: string[] = [];
          for (const { x, y } of UNEXPLORED) {
            for (const kind of KINDS) {
              if (kind === kindAt(x, y)) continue;
              const changed = snapshotFor(style.exploredGround, map({ x, y, kind }), overlays);
              try {
                expect(changed).toEqual(baseline);
              } catch {
                leaks.push(`${String(x)},${String(y)} ${kindAt(x, y)}->${kind}`);
              }
            }
          }
          expect(leaks, 'unexplored cells whose content changed the snapshot').toEqual([]);
        });
      }

      it('still draws explored and visible ground in colour', () => {
        const snapshot = snapshotFor(style.exploredGround, map());
        for (const index of EXPLORED) {
          const colour = groundColour(snapshot, index % SIZE, Math.floor(index / SIZE));
          expect(Math.max(colour.r, colour.g, colour.b), `cell ${String(index)}`).toBeGreaterThan(8);
        }
      });
    });
  }

  it('dims explored ground by the style\'s own level', () => {
    // Cell (1, 1) is explored and not visible, and every known neighbour it
    // blends with is too, so its colour scales with the level: the ratio
    // between two levels is the ratio of levels, within per-channel rounding.
    const luma = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const dim = luma(groundColour(snapshotFor(0.32, map()), 1, 1));
    const bright = luma(groundColour(snapshotFor(0.5, map()), 1, 1));
    expect(Math.abs(bright / dim / (0.5 / 0.32) - 1)).toBeLessThan(0.06);
  });
});
