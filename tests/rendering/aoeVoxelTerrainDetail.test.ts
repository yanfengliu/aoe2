import { describe, expect, it } from 'vitest';
import { MAX_ACTIVE_INSTANCE_ANIMATIONS_V1 } from 'voxel/core';

import type { ProjectedEntityView, TerrainKind } from '../../src/game/simulation/types';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import {
  voxelPartWorldCorners,
  voxelPartWorldCornersAtTime,
} from '../../src/rendering/voxel/aoeVoxelGeometry';
import { copyAoeVoxelResources, makePartBatches } from '../../src/rendering/voxel/aoeVoxelResources';
import { createTerrainDetailParts } from '../../src/rendering/voxel/aoeVoxelTerrain';

function terrain(kind: TerrainKind, x: number, z: number): ProjectedEntityView {
  return {
    id: z * 64 + x,
    generation: 0,
    kind: 'tile',
    layer: 'terrain',
    entityType: kind,
    owner: null,
    x,
    y: z,
    elevation: 0,
    tint: kind === 'water' ? 0x39788a : kind === 'hill' ? 0x817460 : 0x587f4e,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: null,
    maxHp: null,
    isMemory: false,
  };
}

function patch(kind: TerrainKind, size = 16): ProjectedEntityView[] {
  return Array.from({ length: size * size }, (_, index) => (
    terrain(kind, index % size, Math.floor(index / size))
  ));
}

describe('AoE voxel terrain surface detail', () => {
  it('uses a distinct deterministic detail grammar for every terrain family', () => {
    const entities = (['grass', 'forest', 'hill', 'water'] as const)
      .flatMap((kind, row) => patch(kind, 12).map((entity) => ({
        ...entity,
        y: entity.y + row * 12,
      })));
    const forward = createTerrainDetailParts(entities);
    const reverse = createTerrainDetailParts([...entities].reverse());

    expect(reverse).toEqual(forward);
    const keys = forward.map((part) => part.key);
    expect(keys.some((key) => key.includes('grass-fleck'))).toBe(true);
    expect(keys.some((key) => key.includes('grass-tuft'))).toBe(true);
    expect(keys.some((key) => key.includes('forest-leaf-litter'))).toBe(true);
    expect(keys.some((key) => key.includes('forest-log'))).toBe(true);
    expect(keys.some((key) => key.includes('hill-strata'))).toBe(true);
    expect(keys.some((key) => key.includes('hill-rock'))).toBe(true);
    expect(keys.some((key) => key.includes('water-ripple'))).toBe(true);
    expect(keys.some((key) => key.includes('water-reflection'))).toBe(true);
    expect(keys.some((key) => key.includes('water-shore-foam'))).toBe(true);
  });

  it('drives spatially phased wave crests through the pinned instance-animation contract', () => {
    const parts = createTerrainDetailParts(patch('water'));
    const waves = parts.filter((part) => part.surface === 'water' && part.animation);

    expect(waves.length).toBeGreaterThan(20);
    expect(waves.length).toBeLessThanOrEqual(patch('water').length);
    expect(new Set(waves.map((part) => part.key.split(':').slice(0, 3).join(':'))).size)
      .toBe(waves.length);
    expect(new Set(waves.map((part) => part.animation!.phaseRadians)).size)
      .toBeGreaterThan(8);
    expect(waves.every((part) => part.animation!.translationAmplitude.y > 0)).toBe(true);
    expect(waves.every((part) => part.animation!.scaleAmplitude.x > 0)).toBe(true);
    for (const wave of waves) {
      const yaw = wave.yaw ?? 0;
      const translation = wave.animation!.translationAmplitude;
      const alongCrest = translation.x * Math.cos(yaw) - translation.z * Math.sin(yaw);
      const acrossCrest = translation.x * Math.sin(yaw) + translation.z * Math.cos(yaw);
      expect(Math.abs(alongCrest)).toBeLessThan(1e-10);
      expect(acrossCrest).toBeCloseTo(0.022, 10);
    }

    const batch = makePartBatches(parts, 7)
      .find((candidate) => candidate.key === 'aoe2:batch:water-animated-parts');
    expect(batch).toMatchObject({
      revision: 7,
      materialKey: 'aoe2:material:water',
    });
    expect(batch?.animation?.schemaVersion).toBe('voxel.instance-transform-animation/1');
    expect(batch?.animation?.periodsMs.length).toBe(waves.length);
    const staticWater = new Set(parts
      .filter((part) => part.surface === 'water' && !part.animation)
      .map((part) => part.key.split(':').slice(0, 3).join(':')));
    expect(waves.every((part) => (
      staticWater.has(part.key.split(':').slice(0, 3).join(':'))
    ))).toBe(true);
  });

  it('uses a low-roughness standard material for restrained sky-and-sun reflection cues', () => {
    const water = copyAoeVoxelResources().find(
      (resource) => resource.kind === 'material' && resource.key === 'aoe2:material:water',
    );

    expect(water).toMatchObject({
      shading: 'standard',
      transparent: false,
      vertexColors: false,
      roughness: 0.18,
      metalness: 0.06,
    });
  });

  it('degrades excess water crests into the static fallback lane without dropping them', () => {
    const crest = createTerrainDetailParts(patch('water'))
      .find((part) => part.key.endsWith(':water-ripple-crest'))!;
    const input = Array.from(
      { length: MAX_ACTIVE_INSTANCE_ANIMATIONS_V1 + 1 },
      (_, index) => ({ ...crest, key: `terrain:overflow:${String(index)}:water-ripple-crest` }),
    );
    const batches = makePartBatches(input, 11);
    const animated = batches.find((batch) => batch.key === 'aoe2:batch:water-animated-parts')!;
    const fallback = batches.find((batch) => batch.key === 'aoe2:batch:water-parts')!;

    expect(animated.instanceKeys).toHaveLength(MAX_ACTIVE_INSTANCE_ANIMATIONS_V1);
    expect(fallback.instanceKeys).toHaveLength(1);
    expect(new Set([...animated.instanceKeys, ...fallback.instanceKeys])).toEqual(
      new Set(input.map((part) => part.key)),
    );
    expect(fallback.animation).toBeUndefined();
  });

  it('rebuilds identical wave data and produces repeatable equal-time poses', () => {
    const first = createTerrainDetailParts(patch('water'));
    const second = createTerrainDetailParts([...patch('water')].reverse());
    expect(second).toEqual(first);

    const wave = first.find((part) => part.animation)!;
    const rebuilt = second.find((part) => part.key === wave.key)!;
    const sampleTimeMs = 731;
    expect(voxelPartWorldCornersAtTime(rebuilt, sampleTimeMs))
      .toEqual(voxelPartWorldCornersAtTime(wave, sampleTimeMs));
    expect(voxelPartWorldCornersAtTime(wave, sampleTimeMs + wave.animation!.periodMs / 4))
      .not.toEqual(voxelPartWorldCornersAtTime(wave, sampleTimeMs));
  });

  it('keeps detail inside each flat cell and out of the terrain picking state', () => {
    const entities = Array.from({ length: 64 }, (_, index) => {
      const x = index % 8;
      const z = Math.floor(index / 8);
      const kind: TerrainKind = z < 4
        ? (x < 4 ? 'grass' : 'water')
        : (x < 4 ? 'forest' : 'hill');
      return terrain(kind, x, z);
    });
    const details = createTerrainDetailParts(entities);
    for (const entity of entities) {
      const prefix = `terrain:${String(entity.x)}:${String(entity.y)}:`;
      for (const part of details.filter((candidate) => candidate.key.startsWith(prefix))) {
        const samples = part.animation
          ? Array.from({ length: 65 }, (_, index) => (
              index / 64 * part.animation!.periodMs
            )).flatMap((time) => voxelPartWorldCornersAtTime(part, time))
          : voxelPartWorldCorners(part);
        for (const corner of samples) {
          expect(corner.x).toBeGreaterThanOrEqual(entity.x - 0.01);
          expect(corner.x).toBeLessThanOrEqual(entity.x + 1.01);
          expect(corner.z).toBeGreaterThanOrEqual(entity.y - 0.01);
          expect(corner.z).toBeLessThanOrEqual(entity.y + 1.01);
          expect(corner.y).toBeGreaterThanOrEqual(-0.02);
          expect(corner.y).toBeLessThan(0.5);
        }
        if (part.surface === 'water') {
          expect(Math.min(...samples.map((corner) => corner.y))).toBeGreaterThan(0.005);
          expect(Math.max(...samples.map((corner) => corner.y))).toBeLessThan(0.12);
        }
      }
    }

    const adapter = new AoeVoxelAdapter();
    const snapshot = adapter.createSnapshot(patch('water', 8), 500);
    expect(snapshot.chunks.every((chunk) => chunk.origin.y === -1 && chunk.size.y === 1))
      .toBe(true);
    expect(adapter.latestHitState()?.entities).toEqual([]);
  });

  it('does not animate or reveal water detail in explored fog', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot(patch('water', 8), 500, {
      frame: {
        tick: 10,
        playerId: 1,
        seed: 'terrain-detail-fog',
        mapWidth: 8,
        mapHeight: 8,
        visibleCells: [],
        exploredCells: Array.from({ length: 64 }, (_, index) => index),
        recentUnitDeaths: [],
      },
      placementPreview: null,
      selectionPreviewEntityIds: [],
    });
    const terrainKeys = snapshot.batches
      .flatMap((batch) => batch.instanceKeys)
      .filter((key) => key.startsWith('terrain:'));

    expect(terrainKeys).toEqual([]);
    expect(snapshot.batches.find((batch) => (
      batch.key === 'aoe2:batch:water-animated-parts'
    ))?.instanceKeys).toEqual([]);
  });
});
