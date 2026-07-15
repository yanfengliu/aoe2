// Building texture/detail pass (spec §14.5, user directive 2026-07-14):
// completed buildings gain a further per-face detail pass toward the AoE2-HD
// read at default zoom — masonry/timber relief, trim, and role props — still
// strictly original/procedural, inside each footprint, render-only.

import { describe, expect, it } from 'vitest';

import type { BuildingType, ProjectedEntityView } from '../../src/game/simulation/types';
import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import { createBuildingParts } from '../../src/rendering/voxel/aoeVoxelBuildingRecipes';
import type { VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';

function building(entityType: BuildingType, variant: 'complete' | 'construction' = 'complete'): ProjectedEntityView {
  const footprint = AUTHORITATIVE_BUILDING_FOOTPRINTS[entityType];
  return {
    id: 60,
    generation: 1,
    kind: 'building',
    layer: 'building',
    entityType,
    owner: 1,
    x: 8,
    y: 8,
    elevation: 0,
    tint: 0x3f6fd0,
    size: 1,
    footprintWidth: footprint.width,
    footprintHeight: footprint.height,
    visualVariant: variant,
    selected: false,
    currentHp: 100,
    maxHp: 100,
    isMemory: false,
  };
}

function parts(entityType: BuildingType, variant: 'complete' | 'construction' = 'complete'): VoxelPart[] {
  return createBuildingParts(building(entityType, variant), '60:1', 0);
}

function suffixes(entityType: BuildingType): string[] {
  return parts(entityType).map((part) => part.key.slice(part.key.lastIndexOf(':') + 1));
}

// Buildings whose walls should read as built material rather than flat slabs.
const WALLED: readonly BuildingType[] = [
  'town-center', 'house', 'mill', 'lumber-camp', 'mining-camp',
  'barracks', 'blacksmith', 'market', 'monastery', 'castle',
];

describe('building detail pass (spec §14.5)', () => {
  for (const entityType of WALLED) {
    it(`gives ${entityType} masonry or timber relief courses`, () => {
      expect(
        suffixes(entityType).some((suffix) => /course|beam|trim|timber|stud/u.test(suffix)),
        `${entityType} walls have no material relief`,
      ).toBe(true);
    });
  }

  it('keeps every completed building part inside its footprint', () => {
    for (const entityType of Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS) as BuildingType[]) {
      const footprint = AUTHORITATIVE_BUILDING_FOOTPRINTS[entityType];
      for (const part of parts(entityType)) {
        const minX = 8 - 0.02;
        const maxX = 8 + footprint.width + 0.02;
        const minZ = 8 - 0.02;
        const maxZ = 8 + footprint.height + 0.02;
        expect(part.centerX - part.width / 2, `${entityType}:${part.key} escapes -x`)
          .toBeGreaterThanOrEqual(minX - 0.25);
        expect(part.centerX + part.width / 2, `${entityType}:${part.key} escapes +x`)
          .toBeLessThanOrEqual(maxX + 0.25);
        expect(part.centerZ - part.depth / 2).toBeGreaterThanOrEqual(minZ - 0.25);
        expect(part.centerZ + part.depth / 2).toBeLessThanOrEqual(maxZ + 0.25);
      }
    }
  });

  it('leaves the construction (scaffold) look role-agnostic and undetailed', () => {
    // Detail is a COMPLETED-building read; a site under construction keeps
    // its existing scaffold silhouette so progress stays legible. Compared at
    // an equal footprint (house and mill are both 2x2), since the scaffold
    // legitimately scales with footprint size.
    expect(parts('house', 'construction')).toEqual(parts('mill', 'construction'));
    expect(suffixes('house').length).toBeGreaterThan(
      parts('house', 'construction').length,
    );
  });

  it('is deterministic', () => {
    for (const entityType of WALLED) {
      expect(parts(entityType)).toEqual(parts(entityType));
    }
  });

  it('adds no shadow-surface parts beyond the authored contact shadow', () => {
    for (const entityType of WALLED) {
      expect(parts(entityType).filter((part) => part.surface === 'shadow')).toHaveLength(1);
    }
  });
});
