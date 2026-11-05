import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { convexPolygonIntersectsRect, isDrawnInView, isVillagerGroup } from '../../src/input/selectionMembers';
import { worldToIso } from '../../src/rendering/isometricProjection';
import { voxelEntityHitRegions } from '../../src/rendering/voxel/aoeVoxelHitProxy';

// Work 142, review rounds 0 and 1. A double-click takes what is drawn on
// screen, so the test is the drawn body, not a circle at the feet: a villager
// whose feet are just below the bottom edge shows its body, one whose feet are
// just above the top edge shows nothing, and one whose polygons' bounding
// boxes only graze a corner of the view is outside it. And a group of
// villagers with a sheep is still a villager group to the rules that serve one.
// BOUND: one villager of the selection-controls fixture, its recipe's still
// polygons standing in for the presented ones, views built around it; the
// double-click is in voxelSelectionController.test.ts and the real page in
// selection-controls.spec.ts.
const entities = createSimulationBridge('selection-controls-fixture').getRenderState().entities;
const villager = entities.find((entity) => entity.entityType === 'villager' && Math.floor(entity.x) === 13)!;
const polygons = voxelEntityHitRegions(villager).map(({ polygon }) => polygon);
const feet = worldToIso(villager.x + 0.5, villager.y + 0.5);
const ys = polygons.flatMap((polygon) => polygon.map((point) => point.y));
const head = Math.min(...ys);
const sole = Math.max(...ys);

describe('the body a double-click looks for', () => {
  it('stands well above the feet, and barely below them', () => {
    expect(feet.y - head).toBeGreaterThan(20);
    expect(sole - feet.y).toBeLessThan(8);
  });

  it('is on screen when the feet are 15 iso px below the bottom edge', () => {
    expect(isDrawnInView(polygons, { minX: feet.x - 300, maxX: feet.x + 300, minY: feet.y - 300, maxY: feet.y - 15 })).toBe(true);
  });

  it('is off screen when the feet are 8 iso px above the top edge', () => {
    expect(isDrawnInView(polygons, { minX: feet.x - 300, maxX: feet.x + 300, minY: feet.y + 8, maxY: feet.y + 300 })).toBe(false);
  });

  // Round 1's case: a view whose corner the polygons' bounding boxes overlap
  // while no polygon reaches into it.
  it('is off screen when only the bounding boxes of its polygons reach a corner of the view', () => {
    const grazing = { minX: -130.8333, minY: 62.5, maxX: 202.5, maxY: 312.5 };
    const fixtureVillager = entities.find((entity) => entity.id === 2162)!;
    const its = voxelEntityHitRegions(fixtureVillager).map(({ polygon }) => polygon);
    const boxesOverlap = its.some((polygon) => {
      const xs = polygon.map((point) => point.x);
      const yy = polygon.map((point) => point.y);
      return Math.max(...xs) >= grazing.minX && Math.min(...xs) <= grazing.maxX
        && Math.max(...yy) >= grazing.minY && Math.min(...yy) <= grazing.maxY;
    });
    expect(boxesOverlap, 'the case no longer has a bounding box reaching the corner').toBe(true);
    expect(isDrawnInView(its, grazing)).toBe(false);
  });

  it('meets a rectangle a polygon crosses with no corner inside either', () => {
    const bar = [{ x: -10, y: 4 }, { x: 10, y: 4 }, { x: 10, y: 6 }, { x: -10, y: 6 }];
    expect(convexPolygonIntersectsRect(bar, { minX: -2, minY: 0, maxX: 2, maxY: 10 })).toBe(true);
  });
});

describe('a villager group', () => {
  const ids = (predicate: (entity: (typeof entities)[number]) => boolean) => entities.filter(predicate).map((entity) => entity.id);
  const villagers = ids((entity) => entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager');
  const sheep = ids((entity) => entity.entityType === 'sheep');
  const town = ids((entity) => entity.entityType === 'town-center' && entity.owner === 1);

  it('is villagers, with or without sheep among them', () => {
    expect(isVillagerGroup(villagers, entities)).toBe(true);
    expect(isVillagerGroup([...villagers, ...sheep], entities)).toBe(true);
  });

  it('is not sheep alone, nor villagers with anything else', () => {
    expect(isVillagerGroup(sheep, entities)).toBe(false);
    expect(isVillagerGroup([...villagers, ...town], entities)).toBe(false);
  });
});
