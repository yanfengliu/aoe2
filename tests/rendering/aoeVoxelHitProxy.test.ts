import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  findPreparedVoxelEntitiesAtIsoPoint,
  findVoxelEntitiesAtIsoPoint,
  preparedVoxelEntityHitRegions,
  voxelEntityHitRegions,
} from '../../src/rendering/voxel/aoeVoxelHitProxy';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import { pointInConvexPolygon } from '../../src/rendering/voxel/aoeVoxelGeometry';

function entity(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 1,
    generation: 0,
    kind: 'building',
    layer: 'building',
    entityType: 'town-center',
    owner: 1,
    x: 10,
    y: 10,
    elevation: 0,
    tint: 0x3366cc,
    size: 1,
    footprintWidth: 4,
    footprintHeight: 4,
    visualVariant: 'complete',
    selected: false,
    currentHp: 100,
    maxHp: 100,
    isMemory: false,
    ...overrides,
  };
}

function centroid(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

describe('AoE voxel recipe hit proxy', () => {
  it('hits a town-center roof point whose ground-plane inverse is outside its footprint', () => {
    const townCenter = entity();
    const roof = voxelEntityHitRegions(townCenter)
      .find((region) => region.key.endsWith(':town-center-tower-roof'))!;
    const point = centroid(roof.polygon);
    const hit = findVoxelEntitiesAtIsoPoint([townCenter], point.x, point.y, 'selection');

    expect(hit.map((candidate) => candidate.id)).toEqual([townCenter.id]);
    // The visible roof is lifted far enough that a ground-plane inverse no
    // longer resolves inside the 4x4 simulation footprint.
    const halfW = 32;
    const halfH = 16;
    const groundX = (point.x / halfW + point.y / halfH) / 2;
    const groundY = (point.y / halfH - point.x / halfW) / 2;
    expect(groundX < townCenter.x || groundY < townCenter.y).toBe(true);
  });

  it('prefers units and the human owner on overlapping visible silhouettes', () => {
    const human = entity({
      id: 2,
      kind: 'unit',
      layer: 'unit',
      entityType: 'villager',
      x: 12,
      y: 12,
      size: 0.7,
      footprintWidth: 1,
      footprintHeight: 1,
    });
    const enemy = { ...human, id: 3, owner: 2 };
    const body = voxelEntityHitRegions(human).find((region) => region.key.endsWith(':villager-tunic'))!;
    const point = centroid(body.polygon);

    expect(findVoxelEntitiesAtIsoPoint([human, enemy], point.x, point.y, 'selection')[0]?.id)
      .toBe(human.id);
    expect(findVoxelEntitiesAtIsoPoint([human, enemy], point.x, point.y, 'command')[0]?.id)
      .toBe(enemy.id);
  });

  it('never makes fog-memory geometry interactive', () => {
    const memory = entity({ isMemory: true });
    expect(voxelEntityHitRegions(memory)).toEqual([]);
    expect(findVoxelEntitiesAtIsoPoint([memory], 0, 0, 'selection')).toEqual([]);
  });

  it('uses the exact moving recipe pose and renderer-clock animation in prepared hit data', () => {
    const adapter = new AoeVoxelAdapter();
    const idle = entity({
      id: 14,
      kind: 'unit',
      layer: 'unit',
      entityType: 'villager',
      x: 2,
      y: 3,
      size: 0.7,
      footprintWidth: 1,
      footprintHeight: 1,
    });
    adapter.createSnapshot([idle], 0);
    const moving = { ...idle, x: 3.25, y: 3.4 };
    adapter.createSnapshot([moving], 100);
    const state = adapter.latestHitState();
    const prepared = state?.entities[0];
    expect(prepared).toBeDefined();
    const exact = preparedVoxelEntityHitRegions(prepared!, 350);
    const idleRecipe = voxelEntityHitRegions(moving);

    const exactOnlyPoint = exact.flatMap((region) => {
      const xs = region.polygon.map((point) => point.x);
      const ys = region.polygon.map((point) => point.y);
      const candidates: Array<{ x: number; y: number }> = [];
      for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.1) {
        for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.1) {
          const point = { x, y };
          if (
            pointInConvexPolygon(point, region.polygon)
            && !idleRecipe.some((candidate) => pointInConvexPolygon(point, candidate.polygon))
          ) candidates.push(point);
        }
      }
      return candidates;
    })[0];

    expect(exactOnlyPoint).toBeDefined();
    expect(findPreparedVoxelEntitiesAtIsoPoint(
      state!.entities,
      exactOnlyPoint!.x,
      exactOnlyPoint!.y,
      'selection',
      350,
    ).map((candidate) => candidate.id)).toEqual([moving.id]);
  });
});
