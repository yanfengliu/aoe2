// Wildlife death carcass look (spec §14.5, user directive 2026-07-14): a
// killed huntable presents as a fallen carcass — body tipped onto its side,
// readable as dead at default zoom — for as long as the sim keeps its
// gatherable corpse. Render-only: same footprint, same part-derived hit
// silhouette source, static lane, deterministic.

import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { createResourceParts } from '../../src/rendering/voxel/aoeVoxelResourceRecipes';
import { voxelPartMaxY } from '../../src/rendering/voxel/aoeVoxelGeometry';
import type { VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';

function boar(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 90,
    generation: 2,
    kind: 'resource',
    layer: 'resource',
    entityType: 'boar',
    owner: null,
    x: 12,
    y: 8,
    elevation: 0,
    tint: 0x6b4a2f,
    size: 0.9,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 69,
    maxHp: 75,
    isMemory: false,
    ...overrides,
  };
}

const live = boar({ wildlifeAlive: true });
const corpse = boar({ wildlifeAlive: false, currentHp: null, maxHp: null });

function parts(entity: ProjectedEntityView): VoxelPart[] {
  return createResourceParts(entity, '90:2', 0);
}

function bodyTop(entity: ProjectedEntityView): number {
  return parts(entity)
    .filter((part) => part.surface !== 'shadow')
    .reduce((top, part) => Math.max(top, voxelPartMaxY(part)), 0);
}

describe('wildlife carcass look (spec §14.5)', () => {
  it('lays a killed boar on its side, lower than the standing body', () => {
    expect(bodyTop(corpse)).toBeLessThan(bodyTop(live) * 0.75);
  });

  it('rolls the carcass body so it reads as fallen, not standing', () => {
    const body = parts(corpse).find((part) => part.key.endsWith(':boar-body'))!;
    expect(Math.abs(body.roll ?? 0)).toBeGreaterThan(1);
  });

  it('keeps every carcass part inside the footprint cell', () => {
    // The cast shadow falls on the neighbouring ground by design; the claim
    // is about the body.
    for (const part of parts(corpse).filter((candidate) => candidate.surface !== 'shadow')) {
      expect(Math.abs(part.centerX - (corpse.x + 0.5))).toBeLessThan(0.75);
      expect(Math.abs(part.centerZ - (corpse.y + 0.5))).toBeLessThan(0.75);
    }
  });

  it('keeps the same part set (hit silhouette source) and a ground shadow', () => {
    // Scoped to the SOLID parts, which are what the hit proxy reads. The cast
    // shadow's piece count follows the carcass's own silhouette and so differs
    // from the standing animal's on purpose.
    const solid = (view: typeof live) => parts(view)
      .filter((part) => part.surface !== 'shadow').map((part) => part.key).sort();
    expect(solid(corpse)).toEqual(solid(live));
    expect(parts(corpse).some((part) => part.surface === 'shadow')).toBe(true);
  });

  it('leaves live wildlife and non-wildlife resources untouched', () => {
    expect(parts(live)).toEqual(parts(boar()));
    const tree = boar({ entityType: 'tree', wildlifeAlive: undefined });
    expect(parts(tree)).toEqual(parts(boar({ entityType: 'tree' })));
  });

  it('is deterministic', () => {
    expect(parts(corpse)).toEqual(parts(corpse));
  });
});
