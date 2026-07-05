import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { computeHealthBarLayout } from '../../src/phaser/scenes/gameScene/worldLayers';
import { isoBuildingHeightPx } from '../../src/phaser/scenes/gameScene/isoBuilding';
import { worldToIso } from '../../src/phaser/scenes/gameScene/isoProjection';

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
