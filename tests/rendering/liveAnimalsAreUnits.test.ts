import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  findCommandTargetEntityAtWorldPointInEntities,
  findEntitiesAtWorldPointInEntities,
} from '../../src/input/entityHitTest';
import {
  findPreparedVoxelEntitiesAtIsoPoint,
  findVoxelEntitiesAtIsoPoint,
  prepareVoxelHitEntity,
  voxelEntityHitRegions,
} from '../../src/rendering/voxel/aoeVoxelHitProxy';
import { computeOcclusionSilhouettes } from '../../src/rendering/voxel/aoeVoxelOcclusionSilhouettes';
import type { VoxelOverlayEntity } from '../../src/rendering/voxel/aoeVoxelOverlayParts';
import {
  pointInConvexPolygon,
  staticVoxelPartsForEntity,
  voxelPartMaxY,
} from '../../src/rendering/voxel/aoeVoxelGeometry';

// Work 142: a live animal is a unit in Definitive Edition — livestock are
// units the player selects and commands ("Learn to play", Lesson 10), and wild
// animals are nobody's units — and DE draws a unit a building hides as an
// outline. Here an animal is a resource entity, so until work 142 a sheep
// behind a Town Center had no outline and the Town Center took every click on
// its drawn body (the coordinator's play, 2026-11-04). A carcass is not a unit.
// BOUND: the selection-controls fixture's Town Center and the sheep it hides,
// read through the static recipe parts and the prepared (presented) parts; the
// real page is tests/browser/selection-controls.spec.ts.
function fixtureViews(): { townCenter: ProjectedEntityView; sheep: ProjectedEntityView } {
  const entities = createSimulationBridge('selection-controls-fixture').getRenderState().entities;
  const townCenter = entities.find((entity) => entity.entityType === 'town-center' && entity.owner === 1)!;
  const sheep = entities.find((entity) => entity.entityType === 'sheep' && Math.floor(entity.x) === 7 && Math.floor(entity.y) === 7)!;
  expect(townCenter).toBeDefined();
  expect(sheep).toBeDefined();
  return { townCenter, sheep };
}

function overlay(entity: ProjectedEntityView): VoxelOverlayEntity {
  const identity = `${String(entity.id)}:${String(entity.generation)}`;
  const parts = staticVoxelPartsForEntity(entity, identity);
  const visualTop = parts.reduce(
    (top, part) => (part.surface === 'shadow' ? top : Math.max(top, voxelPartMaxY(part))),
    0,
  );
  return { entity, identity, ground: 0, visualTop, parts };
}

function centroid(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

// Points of the animal's drawn body that the building's drawn body covers too.
function coveredBodyPoints(animal: ProjectedEntityView, building: ProjectedEntityView): Array<{ x: number; y: number }> {
  const cover = voxelEntityHitRegions(building);
  return voxelEntityHitRegions(animal)
    .map((region) => centroid(region.polygon))
    .filter((point) => cover.some((region) => pointInConvexPolygon(point, region.polygon)));
}

const carcass = (animal: ProjectedEntityView): ProjectedEntityView => ({
  ...animal,
  entityType: 'boar',
  owner: null,
  wildlifeAlive: false,
});

// Every live animal kind, standing where the fixture's sheep stands: a wild
// one is nobody's (review round 0 found only the sheep tested).
function animalAsKind(sheep: ProjectedEntityView, kind: 'sheep' | 'boar' | 'deer' | 'wolf'): ProjectedEntityView {
  return kind === 'sheep' ? sheep : { ...sheep, entityType: kind, owner: null, wildlifeAlive: true };
}

describe('a live animal is a unit for the behind-building outline and the hit test', () => {
  for (const kind of ['sheep', 'boar', 'deer', 'wolf'] as const) {
    it(`draws a live ${kind} the Town Center hides as an outline`, () => {
      const { townCenter, sheep } = fixtureViews();
      const animal = animalAsKind(sheep, kind);
      const live = computeOcclusionSilhouettes([overlay(townCenter), overlay(animal)]);
      expect(live.occluded.map((unit) => unit.id)).toEqual([animal.id]);
      expect(live.parts.length).toBeGreaterThan(0);
    });

    it(`lets a live ${kind}'s drawn body outrank the Town Center in front of it, for a click and a command`, () => {
      const { townCenter, sheep } = fixtureViews();
      const animal = animalAsKind(sheep, kind);
      const points = coveredBodyPoints(animal, townCenter);
      expect(points.length, `the Town Center no longer hides a ${kind} on the sheep's cell`).toBeGreaterThan(0);
      const prepared = [townCenter, animal].map((entity) => prepareVoxelHitEntity(
        entity,
        staticVoxelPartsForEntity(entity, `${String(entity.id)}:${String(entity.generation)}`),
      ));
      for (const purpose of ['selection', 'command'] as const) {
        for (const point of points) {
          expect(findVoxelEntitiesAtIsoPoint([townCenter, animal], point.x, point.y, purpose)[0]?.id).toBe(animal.id);
          expect(findPreparedVoxelEntitiesAtIsoPoint(prepared, point.x, point.y, purpose, 0)[0]?.id).toBe(animal.id);
        }
      }
    });
  }

  it('neither outlines a carcass nor lets it outrank the building drawn in front of it', () => {
    const { townCenter, sheep } = fixtureViews();
    const dead = carcass(sheep);
    expect(computeOcclusionSilhouettes([overlay(townCenter), overlay(dead)]).occluded).toEqual([]);
    const points = coveredBodyPoints(dead, townCenter);
    expect(points.length, 'the Town Center no longer hides a carcass on the sheep\'s cell').toBeGreaterThan(0);
    for (const point of points) {
      expect(findVoxelEntitiesAtIsoPoint([townCenter, dead], point.x, point.y, 'selection')[0]?.id).toBe(townCenter.id);
    }
  });

  it('lets a sheep\'s ground body outrank a building footprint it reaches into, on both ground tests', () => {
    const { townCenter, sheep } = fixtureViews();
    // A sheep (ground radius 0.42 x 0.55 of a cell) whose centre stands 0.1 of a
    // cell west of the footprint, so its body reaches 0.13 of a cell into it.
    const atEdge = { ...sheep, x: townCenter.x - 0.6, y: townCenter.y + 1 };
    // A point inside both the footprint and the sheep's ground circle.
    const cell = 24;
    const worldX = townCenter.x * cell + 1;
    const worldY = (atEdge.y + 0.5) * cell;
    expect(findEntitiesAtWorldPointInEntities([townCenter, atEdge], worldX, worldY, cell).map((entity) => entity.id))
      .toEqual([atEdge.id, townCenter.id]);
    expect(findCommandTargetEntityAtWorldPointInEntities([townCenter, atEdge], worldX, worldY, cell)?.id).toBe(atEdge.id);
  });
});
