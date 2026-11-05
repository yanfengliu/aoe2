import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { isDrawnInView, isVillagerGroup } from '../../src/input/selectionMembers';
import { worldToIso } from '../../src/rendering/isometricProjection';
import { voxelEntityHitRegions } from '../../src/rendering/voxel/aoeVoxelHitProxy';

// Work 142, review round 0. A double-click takes what is drawn on screen, so
// the test is the drawn body, not a circle at the feet: a villager whose feet
// are just below the bottom edge shows its body, and one whose feet are just
// above the top edge shows nothing. And a group of villagers with a sheep is
// still a villager group to the rules that serve one.
// BOUND: one villager of the selection-controls fixture, its recipe's still
// parts, views built around it; the double-click itself is in
// voxelSelectionController.test.ts and the real page in selection-controls.spec.ts.
const entities = createSimulationBridge('selection-controls-fixture').getRenderState().entities;
const villager = entities.find((entity) => entity.entityType === 'villager' && Math.floor(entity.x) === 13)!;
const feet = worldToIso(villager.x + 0.5, villager.y + 0.5);
const ys = voxelEntityHitRegions(villager).flatMap((region) => region.polygon.map((point) => point.y));
const head = Math.min(...ys);
const sole = Math.max(...ys);

describe('the body a double-click looks for', () => {
  it('stands well above the feet, and barely below them', () => {
    expect(feet.y - head).toBeGreaterThan(20);
    expect(sole - feet.y).toBeLessThan(8);
  });

  it('is on screen when the feet are 15 iso px below the bottom edge', () => {
    expect(isDrawnInView(villager, { minX: feet.x - 300, maxX: feet.x + 300, minY: feet.y - 300, maxY: feet.y - 15 })).toBe(true);
  });

  it('is off screen when the feet are 8 iso px above the top edge', () => {
    expect(isDrawnInView(villager, { minX: feet.x - 300, maxX: feet.x + 300, minY: feet.y + 8, maxY: feet.y + 300 })).toBe(false);
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
