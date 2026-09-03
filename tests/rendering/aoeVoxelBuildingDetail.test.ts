// Building texture/detail pass (spec §14.5, user directive 2026-07-14):
// completed buildings gain a further per-face detail pass toward the AoE2-HD
// read at default zoom — masonry/timber relief, trim, and role props — still
// strictly original/procedural, inside each footprint, render-only.

import { describe, expect, it } from 'vitest';

import type { BuildingType, ProjectedEntityView } from '../../src/game/simulation/types';
import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import { createBuildingParts } from '../../src/rendering/voxel/aoeVoxelBuildingRecipes';
import { voxelPartWorldCorners } from '../../src/rendering/voxel/aoeVoxelGeometry';
import {
  matrixForPart,
  type VoxelPart,
} from '../../src/rendering/voxel/aoeVoxelRecipeTypes';

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
  'barracks', 'blacksmith', 'market', 'monastery', 'university', 'castle',
];

const TYPE_DETAIL_SIGNATURES = {
  'town-center': ['detail-town-center-roof-ridge', 'detail-town-center-bell'],
  house: ['detail-house-roof-ridge', 'detail-house-shutter-left'],
  mill: ['detail-mill-blade-hub', 'detail-mill-grain-sack-left'],
  'lumber-camp': ['detail-lumber-camp-log-low', 'detail-lumber-camp-axe-head'],
  'mining-camp': ['detail-mining-camp-ore-bin', 'detail-mining-camp-ore-glint'],
  barracks: ['detail-barracks-shield', 'detail-barracks-spear-head'],
  'watch-tower': ['detail-watch-tower-arrow-slit-front', 'detail-watch-tower-brace'],
  'bombard-tower': ['detail-bombard-tower-barrel', 'detail-bombard-tower-muzzle'],
  stable: ['detail-stable-hitch-rail', 'detail-stable-hay-bale'],
  'archery-range': ['detail-archery-range-bow-rack', 'detail-archery-range-arrow-head'],
  blacksmith: ['detail-blacksmith-chimney-band', 'detail-blacksmith-tongs-left'],
  market: ['detail-market-pot-left', 'detail-market-counter-goods'],
  'siege-workshop': ['detail-siege-workshop-spare-wheel', 'detail-siege-workshop-axle'],
  monastery: ['detail-monastery-rose-window', 'detail-monastery-buttress-left'],
  university: ['detail-university-quadrant-arc', 'detail-university-scroll-rack-left'],
  dock: ['detail-dock-net-rack', 'detail-dock-fish-crate'],
  outpost: ['detail-outpost-ladder', 'detail-outpost-rail'],
  'fish-trap': ['detail-fish-trap-net', 'detail-fish-trap-float'],
  castle: ['detail-castle-portcullis-bar-left', 'detail-castle-arrow-slit'],
  wonder: ['detail-wonder-relief-left', 'detail-wonder-finial'],
  'stone-wall': ['detail-stone-wall-course-low', 'detail-stone-wall-cap'],
  'palisade-wall': ['detail-palisade-wall-lashing', 'detail-palisade-wall-brace'],
  'stone-gate': ['detail-stone-gate-hinge-band', 'detail-stone-gate-track'],
  'palisade-gate': ['detail-palisade-gate-lashing', 'detail-palisade-gate-track'],
  farm: ['detail-farm-scarecrow-post', 'detail-farm-scarecrow-head'],
} as const satisfies Record<BuildingType, readonly string[]>;

describe('building detail pass (spec §14.5)', () => {
  it('gives every concrete building type a recognizable bounded detail set', () => {
    for (const entityType of Object.keys(TYPE_DETAIL_SIGNATURES) as BuildingType[]) {
      const buildingSuffixes = suffixes(entityType);
      const detailSuffixes = buildingSuffixes.filter((suffix) => suffix.startsWith('detail-'));

      expect(buildingSuffixes, entityType).toEqual(
        expect.arrayContaining([...TYPE_DETAIL_SIGNATURES[entityType]]),
      );
      expect(detailSuffixes.length, `${entityType} detail instance budget`).toBeGreaterThanOrEqual(2);
      expect(detailSuffixes.length, `${entityType} detail instance budget`).toBeLessThanOrEqual(7);
      expect(parts(entityType).length, `${entityType} total instance budget`).toBeLessThanOrEqual(48);
    }
  });

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
      // The cast shadow is the one part that is MEANT to leave the footprint:
      // it falls on the neighbouring ground, is never picked, and is pinned
      // by tests/rendering/aoeVoxelCastShadows.test.ts instead.
      for (const part of parts(entityType).filter((candidate) => candidate.surface !== 'shadow')) {
        for (const corner of voxelPartWorldCorners(part)) {
          expect(corner.x, `${entityType}:${part.key} escapes -x`)
            .toBeGreaterThanOrEqual(8 - 0.02);
          expect(corner.x, `${entityType}:${part.key} escapes +x`)
            .toBeLessThanOrEqual(8 + footprint.width + 0.02);
          expect(corner.z, `${entityType}:${part.key} escapes -z`)
            .toBeGreaterThanOrEqual(8 - 0.02);
          expect(corner.z, `${entityType}:${part.key} escapes +z`)
            .toBeLessThanOrEqual(8 + footprint.height + 0.02);
        }
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
    for (const entityType of Object.keys(TYPE_DETAIL_SIGNATURES) as BuildingType[]) {
      expect(
        parts(entityType, 'construction').some((part) => part.key.includes(':detail-')),
        `${entityType} construction gained completed facade details`,
      ).toBe(false);
    }
  });

  it('is deterministic', () => {
    for (const entityType of WALLED) {
      expect(parts(entityType)).toEqual(parts(entityType));
    }
  });

  it('puts no shadow-surface part anywhere but the cast shadow', () => {
    // The detail pass adds accents, never shade: every `shadow` part a walled
    // building emits belongs to the one cast shadow, whose piece count is the
    // silhouette's own business (`aoeVoxelShadowShape`).
    for (const entityType of WALLED) {
      const shade = parts(entityType).filter((part) => part.surface === 'shadow');
      expect(shade.length).toBeGreaterThan(0);
      for (const part of shade) {
        expect(part.key).toMatch(/:building-shadow(-\d+)?$/);
      }
    }
  });

  it('uses the exact presented detail geometry for building picking', () => {
    const entity = building('castle');
    const expected = parts('castle').filter((part) => part.surface !== 'shadow');
    const adapter = new AoeVoxelAdapter();
    const snapshot = adapter.createSnapshot([entity], 0);
    const prepared = adapter.latestHitState()!.entities[0]!;

    expect(prepared.parts).toEqual(expected);
    for (const detail of prepared.parts.filter((part) => part.key.includes(':detail-'))) {
      const batch = snapshot.batches.find((candidate) => candidate.instanceKeys.includes(detail.key));
      expect(batch, detail.key).toBeDefined();
      const instanceIndex = batch!.instanceKeys.indexOf(detail.key);
      const presentedMatrix = batch!.matrices.slice(instanceIndex * 16, instanceIndex * 16 + 16);
      matrixForPart(detail).forEach((value, index) => {
        expect(presentedMatrix[index], `${detail.key} matrix[${String(index)}]`)
          .toBeCloseTo(value, 5);
      });
    }
  });
});

describe('construction scaffold grows with build progress (v0.3.99)', () => {
  function scaffoldAt(progressHp: number): VoxelPart[] {
    const entity = { ...building('house', 'construction'), currentHp: progressHp, maxHp: 100 };
    return createBuildingParts(entity, '60:1', 0);
  }

  it('withholds the rails early and adds them past two-thirds', () => {
    const early = scaffoldAt(10);
    const late = scaffoldAt(80);
    expect(early.some((part) => part.key.includes('scaffold-rail'))).toBe(false);
    expect(late.some((part) => part.key.includes('scaffold-rail'))).toBe(true);
  });

  it('raises the wall course as the work advances', () => {
    const course = (progressHp: number) => scaffoldAt(progressHp)
      .find((part) => part.key.includes('wall-course'))!;
    expect(course(10).height).toBeLessThan(course(50).height);
    expect(course(50).height).toBeLessThan(course(95).height);
  });
});
