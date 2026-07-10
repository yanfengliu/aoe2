import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, ProjectedFrameView } from '../../src/game/simulation/types';
import {
  computeHealthBarLayout,
  createWorldLayersRenderer,
} from '../../src/phaser/scenes/gameScene/worldLayers';
import { isoBuildingHeightPx } from '../../src/phaser/scenes/gameScene/isoBuilding';
import { worldToIso } from '../../src/phaser/scenes/gameScene/isoProjection';

// Records the draw primitives each world layer emits so we can assert the fog
// mask and health bars are placed in ISO space (fillPoints diamonds / iso
// centres), not the pre-iso top-down square grid (fillRect at x*cellSize).
function createLayerSpy() {
  const calls: Array<{ op: string; args: number[]; pts?: Array<{ x: number; y: number }> }> = [];
  const layer = {
    clear: () => {},
    fillStyle: () => {},
    lineStyle: () => {},
    fillRect: (x: number, y: number, w: number, h: number) =>
      calls.push({ op: 'fillRect', args: [x, y, w, h] }),
    fillPoints: (pts: Array<{ x: number; y: number }>) =>
      calls.push({ op: 'fillPoints', args: [], pts: pts.map((p) => ({ x: p.x, y: p.y })) }),
    fillRoundedRect: (x: number, y: number, w: number, h: number) =>
      calls.push({ op: 'fillRoundedRect', args: [x, y, w, h] }),
  } as unknown as Phaser.GameObjects.Graphics;
  return { layer, calls };
}

function frame(overrides: Partial<ProjectedFrameView>): ProjectedFrameView {
  return {
    tick: 1,
    playerId: 1,
    seed: 's',
    mapWidth: 3,
    mapHeight: 3,
    visibleCells: [],
    exploredCells: [],
    recentUnitDeaths: [],
    ...overrides,
  };
}

const CELL_SIZE = 24;

function entity(overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return {
    id: 1,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 10,
    y: 10,
    tint: 0,
    size: 0.5,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 10,
    maxHp: 10,
    isMemory: false,
    ...overrides,
  };
}

describe('computeHealthBarLayout — iso positioning', () => {
  it('sits a building bar above the extruded volume, centred on the footprint iso centre', () => {
    const tc = entity({
      kind: 'building',
      entityType: 'town-center',
      footprintWidth: 4,
      footprintHeight: 4,
      x: 10,
      y: 10,
    });
    // px/py are ignored for buildings (the volume is placed from the cell coords).
    const layout = computeHealthBarLayout(tc, 999, 999, CELL_SIZE);

    const footCentre = worldToIso(12, 12);
    expect(layout.barX + layout.barWidthPx / 2).toBeCloseTo(footCentre.x, 5);
    // Top = the roof back corner (worldToIso(x,y) lifted by the wall height) minus
    // a small accent margin; the bar sits above that.
    const expectedTop = worldToIso(10, 10).y - isoBuildingHeightPx('town-center') - CELL_SIZE * 0.4;
    expect(layout.entityTopPx).toBeCloseTo(expectedTop, 5);
    expect(layout.barY).toBeLessThan(layout.entityTopPx);
    // Above the roof's back corner (worldToIso(x,y).y), and NOT the old top-down
    // anchor (the passed py = 999, which the iso fix must ignore).
    expect(layout.entityTopPx).toBeLessThan(worldToIso(10, 10).y);
    expect(layout.entityTopPx).not.toBeCloseTo(999, 0);
  });

  it('keeps a unit bar at the unit iso top (px/py based), unchanged by the iso building fix', () => {
    const villager = entity({ kind: 'unit', size: 0.5, x: 10, y: 10 });
    const px = 100;
    const py = 200;
    const layout = computeHealthBarLayout(villager, px, py, CELL_SIZE);
    const cy = py + CELL_SIZE * 0.5;
    expect(layout.entityTopPx).toBeCloseTo(cy - CELL_SIZE * 0.5 * 0.5, 5); // cy - r
    expect(layout.barX + layout.barWidthPx / 2).toBeCloseTo(px + CELL_SIZE * 0.5, 5);
  });
});

describe('renderFog — iso fog mask (not the pre-iso square grid)', () => {
  it('paints fog cells as iso diamonds (fillPoints), never axis-aligned squares', () => {
    const fog = createLayerSpy();
    const hb = createLayerSpy();
    const renderer = createWorldLayersRenderer({
      healthBarLayer: hb.layer,
      fogLayer: fog.layer,
      cellSize: CELL_SIZE,
    });
    // 2x2 map, only cell 0 (0,0) explored+visible → the other three are masked.
    renderer.renderFog(frame({ mapWidth: 2, mapHeight: 2, visibleCells: [0], exploredCells: [0] }));
    expect(fog.calls.some((c) => c.op === 'fillRect')).toBe(false);
    const diamonds = fog.calls.filter((c) => c.op === 'fillPoints');
    expect(diamonds.length).toBeGreaterThan(0);
    for (const d of diamonds) expect(d.pts).toHaveLength(4);
  });

  it('projects a masked cell to its worldToIso diamond corners', () => {
    const fog = createLayerSpy();
    const hb = createLayerSpy();
    const renderer = createWorldLayersRenderer({
      healthBarLayer: hb.layer,
      fogLayer: fog.layer,
      cellSize: CELL_SIZE,
    });
    // 2x2 map: cells 0,1,2 explored+visible → only index 3 = (1,1) is masked.
    renderer.renderFog(
      frame({ mapWidth: 2, mapHeight: 2, visibleCells: [0, 1, 2], exploredCells: [0, 1, 2] }),
    );
    const diamonds = fog.calls.filter((c) => c.op === 'fillPoints');
    expect(diamonds).toHaveLength(3);
    expect(diamonds[0].pts).toEqual([
      worldToIso(1, 1),
      worldToIso(2, 1),
      worldToIso(2, 2),
      worldToIso(1, 2),
    ]);
  });

  it('adds a soft edge fade on visible cells that border fog', () => {
    const fog = createLayerSpy();
    const hb = createLayerSpy();
    const renderer = createWorldLayersRenderer({
      healthBarLayer: hb.layer,
      fogLayer: fog.layer,
      cellSize: CELL_SIZE,
    });
    renderer.renderFog(frame({ mapWidth: 3, mapHeight: 3, visibleCells: [4], exploredCells: [4] }));
    // Eight non-visible cells are masked, plus the visible centre cell gets a
    // light shroud pass because it borders fog on every side.
    expect(fog.calls.filter((c) => c.op === 'fillPoints')).toHaveLength(9);
  });

  it('keeps fully visible areas clear of fog edge fade', () => {
    const fog = createLayerSpy();
    const hb = createLayerSpy();
    const renderer = createWorldLayersRenderer({
      healthBarLayer: hb.layer,
      fogLayer: fog.layer,
      cellSize: CELL_SIZE,
    });
    const all = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    renderer.renderFog(frame({ mapWidth: 3, mapHeight: 3, visibleCells: all, exploredCells: all }));
    expect(fog.calls.filter((c) => c.op === 'fillPoints')).toHaveLength(0);
  });
});

describe('renderEntityHealthBars — iso anchoring (not the pre-iso square grid)', () => {
  it('centres a unit health bar on the unit ISO centre, not the top-down cell position', () => {
    const hb = createLayerSpy();
    const fog = createLayerSpy();
    const renderer = createWorldLayersRenderer({
      healthBarLayer: hb.layer,
      fogLayer: fog.layer,
      cellSize: CELL_SIZE,
    });
    const villager = entity({ kind: 'unit', x: 20, y: 20, size: 0.5, currentHp: 10, maxHp: 10 });
    const [state] = renderer.renderEntityHealthBars([villager]);
    const isoCentreX = worldToIso(20.5, 20.5).x;
    expect(state.barX + state.barWidthPx / 2).toBeCloseTo(isoCentreX, 3);
    // and NOT the old top-down centre (20*cellSize + cellSize/2).
    expect(state.barX + state.barWidthPx / 2).not.toBeCloseTo(20 * CELL_SIZE + CELL_SIZE / 2, 0);
  });
});
