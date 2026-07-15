import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { computeOcclusionSilhouettes } from '../../src/rendering/voxel/aoeVoxelOcclusionSilhouettes';
import type { VoxelOverlayEntity } from '../../src/rendering/voxel/aoeVoxelOverlayParts';
import {
  staticVoxelPartsForEntity,
  voxelPartMaxY,
  VOXEL_VERTICAL_PIXELS_PER_WORLD_UNIT,
} from '../../src/rendering/voxel/aoeVoxelGeometry';
import { ISO_TILE_HEIGHT } from '../../src/rendering/isometricProjection';
import { SCREEN_LOCKED_DEPTH_LIFT } from '../../src/rendering/voxel/aoeVoxelOverlayParts';
import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import type { VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';

const SILHOUETTE_LIFT = 8;
const SCREEN_LOCKED_DEPTH_OFFSET = SILHOUETTE_LIFT
  * VOXEL_VERTICAL_PIXELS_PER_WORLD_UNIT / ISO_TILE_HEIGHT;

function view(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 1,
    generation: 0,
    kind: 'tile',
    layer: 'terrain',
    entityType: 'grass',
    owner: null,
    x: 0,
    y: 0,
    elevation: 0,
    tint: 0x587f4e,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: null,
    maxHp: null,
    isMemory: false,
    ...overrides,
  };
}

function overlay(
  entity: ProjectedEntityView,
  partsOverride?: readonly VoxelPart[],
): VoxelOverlayEntity {
  const identity = `${String(entity.id)}:${String(entity.generation)}`;
  const parts = partsOverride ?? staticVoxelPartsForEntity(entity, identity);
  // Mirror the adapter's real visualTop EXACTLY (aoeVoxelAdapter's
  // `voxelPartMaxY`, which is rotation-aware) — a fake or axis-aligned height
  // silently moves the mid-body cover anchor off painted truth. Review
  // iter-2: a rolled lance overestimates by ~8% under an axis-aligned max,
  // which would shift a knight's tested anchor ~3px up-screen.
  const visualTop = parts.reduce(
    (top, part) => (part.surface === 'shadow' ? top : Math.max(top, voxelPartMaxY(part))),
    0,
  );
  return {
    entity,
    identity,
    ground: 0,
    visualTop,
    parts,
  };
}

function townCenter(id: number, x: number, y: number, overrides: Partial<ProjectedEntityView> = {}): VoxelOverlayEntity {
  return overlay(view({
    id,
    generation: 1,
    kind: 'building',
    layer: 'building',
    entityType: 'town-center',
    owner: 2,
    x,
    y,
    tint: 0xcc3333,
    footprintWidth: 4,
    footprintHeight: 4,
    currentHp: 2400,
    maxHp: 2400,
    ...overrides,
  }));
}

function villager(id: number, x: number, y: number, overrides: Partial<ProjectedEntityView> = {}): VoxelOverlayEntity {
  return overlay(view({
    id,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x,
    y,
    tint: 0x3f6fd0,
    size: 0.8,
    currentHp: 25,
    maxHp: 25,
    ...overrides,
  }));
}

describe('computeOcclusionSilhouettes', () => {
  it('flags a unit behind the town center and mirrors its non-shadow parts as white ui silhouettes', () => {
    const unit = villager(7, 7, 7);
    const result = computeOcclusionSilhouettes([unit, townCenter(20, 8, 8)]);

    expect(result.occluded).toEqual([{ id: 7, x: 7, y: 7, entityType: 'villager' }]);
    const mirrored = unit.parts.filter((part) => part.surface !== 'shadow');
    expect(result.parts).toHaveLength(mirrored.length);
    expect(result.parts.length).toBeGreaterThan(0);
    for (const [index, part] of result.parts.entries()) {
      const source = mirrored[index]!;
      expect(part.key).toBe(`ui:occlusion:${source.key}`);
      expect(part.surface).toBe('ui');
      expect(part.tint).toBe(0xffffff);
      expect(part.centerX).toBeCloseTo(source.centerX + SCREEN_LOCKED_DEPTH_OFFSET, 10);
      expect(part.centerY).toBeCloseTo(source.centerY + SILHOUETTE_LIFT, 10);
      expect(part.centerZ).toBeCloseTo(source.centerZ + SCREEN_LOCKED_DEPTH_OFFSET, 10);
      expect(part.width).toBe(source.width);
      expect(part.height).toBe(source.height);
      expect(part.depth).toBe(source.depth);
      expect(part.animation).toBeUndefined();
    }
  });

  it('preserves the posed orientation fields and strips animation from mirrored parts', () => {
    const posed: VoxelPart = {
      key: '9:2:tool',
      surface: 'metal',
      tint: 0x333333,
      centerX: 7.62,
      centerY: 0.94,
      centerZ: 7.31,
      width: 0.2,
      height: 0.22,
      depth: 0.2,
      yaw: 1.25,
      pitch: 0.4,
      pitchHeadingRadians: 0.7,
      roll: -0.12,
      animation: {
        periodMs: 900,
        phaseRadians: 0.3,
        translationAmplitude: { x: 0, y: 0.02, z: 0 },
        rotationAmplitude: { x: 0, y: 0, z: 0.01 },
        scaleAmplitude: { x: 0, y: 0, z: 0 },
      },
    };
    const unit = villager(9, 7, 7, { generation: 2 });
    const result = computeOcclusionSilhouettes([
      { ...unit, parts: [posed] },
      townCenter(20, 8, 8),
    ]);

    expect(result.parts).toHaveLength(1);
    const mirror = result.parts[0]!;
    expect(mirror.key).toBe('ui:occlusion:9:2:tool');
    expect(mirror.yaw).toBe(posed.yaw);
    expect(mirror.pitch).toBe(posed.pitch);
    expect(mirror.pitchHeadingRadians).toBe(posed.pitchHeadingRadians);
    expect(mirror.roll).toBe(posed.roll);
    expect(mirror.animation).toBeUndefined();
    expect('animation' in mirror).toBe(false);
  });

  it('reports displayed fractional coordinates for occluded units', () => {
    const unit = villager(7, 7.25, 7.4);
    const result = computeOcclusionSilhouettes([unit, townCenter(20, 8, 8)]);
    expect(result.occluded).toEqual([{ id: 7, x: 7.25, y: 7.4, entityType: 'villager' }]);
  });

  it('flags a unit on the deep flank where an origin-depth gate would miss the cover', () => {
    // Castle (8,8) 4x4: unit depth (7+10=17) EXCEEDS the origin depth (16), so
    // an origin-based gate would skip the building — but the south-west corner
    // tower (max corner depth 22) genuinely paints over the unit's mid-body
    // (probed 2026-07-15: covering part = fortress-tower-south-west).
    const castle = overlay(view({
      id: 21,
      generation: 1,
      kind: 'building',
      layer: 'building',
      entityType: 'castle',
      owner: 2,
      x: 8,
      y: 8,
      tint: 0xcc3333,
      footprintWidth: 4,
      footprintHeight: 4,
      currentHp: 4800,
      maxHp: 4800,
    }));
    const result = computeOcclusionSilhouettes([villager(7, 7, 10), castle]);
    expect(result.occluded).toEqual([{ id: 7, x: 7, y: 10, entityType: 'villager' }]);
  });

  it('never cues a unit standing beside the town center plinth (raised base is ankle mass)', () => {
    // Review iter-1 follow-through: at (7,9) the TC's tall hall is inset from
    // the footprint edge; only the 0.3wu plinth and hairline flag geometry
    // touch that flank, and a ~95%-visible unit must not white-ghost.
    const result = computeOcclusionSilhouettes([villager(7, 7, 9), townCenter(20, 8, 8)]);
    expect(result.occluded).toEqual([]);
  });

  it('does not flag a unit in front of the building', () => {
    const result = computeOcclusionSilhouettes([villager(7, 13, 13), townCenter(20, 8, 8)]);
    expect(result.occluded).toEqual([]);
    expect(result.parts).toEqual([]);
  });

  it('does not flag a unit standing clear of the building silhouette', () => {
    const result = computeOcclusionSilhouettes([villager(7, 2, 2), townCenter(20, 8, 8)]);
    expect(result.occluded).toEqual([]);
  });

  it('does not flag a unit whose anchor a short building cannot cover', () => {
    const house = overlay(view({
      id: 21,
      generation: 1,
      kind: 'building',
      layer: 'building',
      entityType: 'house',
      owner: 2,
      x: 8,
      y: 8,
      tint: 0xcc3333,
      footprintWidth: 2,
      footprintHeight: 2,
      currentHp: 550,
      maxHp: 550,
    }));
    const result = computeOcclusionSilhouettes([villager(7, 5, 5), house]);
    expect(result.occluded).toEqual([]);
  });

  it('never cues a unit standing beside a farm (ankle-high geometry cannot cover a body)', () => {
    // Review iter-1 HIGH: the ground-pixel anchor let a farm's 0.51wu team
    // marker white-ghost a fully visible farmer on the up-screen diagonal.
    const farm = overlay(view({
      id: 40,
      generation: 1,
      kind: 'building',
      layer: 'building',
      entityType: 'farm',
      owner: 1,
      x: 8,
      y: 8,
      tint: 0x3f6fd0,
      footprintWidth: 1,
      footprintHeight: 1,
      currentHp: 480,
      maxHp: 480,
    }));
    const result = computeOcclusionSilhouettes([villager(7, 7, 7), farm]);
    expect(result.occluded).toEqual([]);
  });

  it('never cues builders beside a construction site (knee-high framing cannot cover a body)', () => {
    // Review iter-1 MED: foundation slab + wall course + scaffold rails fired
    // the full-body cue on the sim's own north-row approach cells.
    const site = overlay(view({
      id: 41,
      generation: 1,
      kind: 'building',
      layer: 'building',
      entityType: 'house',
      owner: 1,
      x: 8,
      y: 8,
      tint: 0x3f6fd0,
      footprintWidth: 2,
      footprintHeight: 2,
      visualVariant: 'construction',
      currentHp: 60,
      maxHp: 550,
    }));
    const result = computeOcclusionSilhouettes([villager(7, 8, 7), site]);
    expect(result.occluded).toEqual([]);
  });

  it('never cues through hairline accents (flag poles) cells behind the town center', () => {
    // Review iter-1 MED: the 0.072wu-wide TC flag pole projected a 2.3px
    // screen corridor that full-body-flashed units on open ground at (5.5,5.5).
    const result = computeOcclusionSilhouettes([villager(7, 5.5, 5.5), townCenter(20, 8, 8)]);
    expect(result.occluded).toEqual([]);
  });

  it('never cues a unit whose legs alone are hidden behind a low stone wall', () => {
    // Review iter-2: a stone wall (0.76 wu base) paints over ~40% of an
    // adjacent unit's body span but leaves it readable — AoE2 shows no cue
    // there, and the spec records this as a deliberate class.
    const wall = overlay(view({
      id: 50,
      generation: 1,
      kind: 'building',
      layer: 'building',
      entityType: 'stone-wall',
      owner: 1,
      x: 8,
      y: 8,
      tint: 0x3f6fd0,
      footprintWidth: 1,
      footprintHeight: 1,
      currentHp: 900,
      maxHp: 900,
    }));
    const result = computeOcclusionSilhouettes([villager(7, 7, 7), wall]);
    expect(result.occluded).toEqual([]);
  });

  it('contributes no occluder regions at all for palisades (every stake is hairline)', () => {
    const palisade = overlay(view({
      id: 51,
      generation: 1,
      kind: 'building',
      layer: 'building',
      entityType: 'palisade-wall',
      owner: 1,
      x: 8,
      y: 8,
      tint: 0x3f6fd0,
      footprintWidth: 1,
      footprintHeight: 1,
      currentHp: 250,
      maxHp: 250,
    }));
    const result = computeOcclusionSilhouettes([villager(7, 7, 7), palisade]);
    expect(result.occluded).toEqual([]);
  });

  it('ignores memory-ghost buildings as occluders', () => {
    const ghost = townCenter(20, 8, 8, { isMemory: true });
    const result = computeOcclusionSilhouettes([villager(7, 7, 7), ghost]);
    expect(result.occluded).toEqual([]);
  });

  it('never flags memory units', () => {
    const ghostUnit = villager(7, 7, 7, { isMemory: true });
    const result = computeOcclusionSilhouettes([ghostUnit, townCenter(20, 8, 8)]);
    expect(result.occluded).toEqual([]);
  });

  it('never flags buildings or resources as occludees', () => {
    const tree = overlay(view({
      id: 30,
      generation: 0,
      kind: 'resource',
      layer: 'resource',
      entityType: 'tree',
      x: 7,
      y: 7,
      tint: 0x39703e,
    }));
    const rearBuilding = overlay(view({
      id: 31,
      generation: 1,
      kind: 'building',
      layer: 'building',
      entityType: 'house',
      owner: 2,
      x: 6,
      y: 6,
      tint: 0xcc3333,
      footprintWidth: 2,
      footprintHeight: 2,
    }));
    const result = computeOcclusionSilhouettes([tree, rearBuilding, townCenter(20, 8, 8)]);
    expect(result.occluded).toEqual([]);
    expect(result.parts).toEqual([]);
  });

  it('returns empty when no buildings exist', () => {
    const result = computeOcclusionSilhouettes([villager(7, 7, 7)]);
    expect(result.occluded).toEqual([]);
    expect(result.parts).toEqual([]);
  });

  it('emits one silhouette set even when two buildings cover the unit', () => {
    const unit = villager(7, 7, 7);
    const result = computeOcclusionSilhouettes([
      unit,
      townCenter(20, 8, 8),
      townCenter(22, 8, 9),
    ]);
    expect(result.occluded).toHaveLength(1);
    expect(result.parts).toHaveLength(unit.parts.filter((part) => part.surface !== 'shadow').length);
  });

  it('is deterministic for identical inputs', () => {
    const entities = [villager(7, 7, 7), townCenter(20, 8, 8)];
    expect(computeOcclusionSilhouettes(entities)).toEqual(computeOcclusionSilhouettes(entities));
  });

  it('keeps every completed building recipe under the silhouette camera-ray lift', () => {
    // Review iter-1: the lift (8 wu along the camera ray) must clear the
    // tallest part of every occluder or the silhouette clips into it. This
    // guards future taller recipes against silently breaking the cue.
    for (const [buildingType, footprint] of Object.entries(AUTHORITATIVE_BUILDING_FOOTPRINTS)) {
      const building = overlay(view({
        id: 60,
        generation: 1,
        kind: 'building',
        layer: 'building',
        entityType: buildingType as ProjectedEntityView['entityType'],
        owner: 1,
        x: 8,
        y: 8,
        tint: 0x3f6fd0,
        footprintWidth: footprint.width,
        footprintHeight: footprint.height,
      }));
      const top = building.parts.reduce((max, part) => (
        part.surface === 'shadow' ? max : Math.max(max, voxelPartMaxY(part))
      ), 0);
      expect(top, `${buildingType} tallest part must stay under the lift`)
        .toBeLessThan(SCREEN_LOCKED_DEPTH_LIFT);
    }
  });
});
