import { describe, expect, it } from 'vitest';
import { MAX_ACTIVE_INSTANCE_ANIMATIONS_V1 } from 'voxel/core';

import type { ProjectedEntityView, TerrainKind } from '../../src/game/simulation/types';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import {
  voxelPartWorldCorners,
  voxelPartWorldCornersAtTime,
} from '../../src/rendering/voxel/aoeVoxelGeometry';
import type { VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
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
    expect(keys.some((key) => key.includes('water-shore-surf'))).toBe(true);
    expect(keys.some((key) => key.includes('water-shore-foam'))).toBe(false);
  });

  describe('shoreline surf is a connected meandering curve', () => {
    // A straight 12-tile coastline: grass row at z=0, water at z=1..2.
    const coastline = () => [
      ...Array.from({ length: 12 }, (_, x) => terrain('grass', x, 0)),
      ...Array.from({ length: 12 }, (_, x) => terrain('water', x, 1)),
      ...Array.from({ length: 12 }, (_, x) => terrain('water', x, 2)),
    ];
    const surfOf = (entities: ProjectedEntityView[]) => createTerrainDetailParts(entities)
      .filter((part) => part.key.includes('water-shore-surf'));
    const surfByTile = (entities: ProjectedEntityView[]) => {
      const byTile = new Map<string, VoxelPart[]>();
      for (const part of surfOf(entities)) {
        const tile = part.key.split(':').slice(0, 3).join(':');
        byTile.set(tile, [...(byTile.get(tile) ?? []), part]);
      }
      return byTile;
    };

    it('chains overlapping segments that cover the edge with a wandering offset', () => {
      const byTile = surfByTile(coastline());
      expect(byTile.size).toBe(12);
      for (const boxes of byTile.values()) {
        expect(boxes.length).toBeGreaterThanOrEqual(5);
        const sorted = [...boxes].sort((a, b) => a.centerX - b.centerX);
        // Consecutive boxes overlap: the chain is connected, not dashed.
        for (let i = 1; i < sorted.length; i += 1) {
          const gap = sorted[i]!.centerX - sorted[i - 1]!.centerX;
          expect(gap).toBeLessThanOrEqual((sorted[i]!.width + sorted[i - 1]!.width) / 2 * 0.9);
        }
        // The chain spans nearly the whole edge.
        const first = sorted[0]!;
        const last = sorted[sorted.length - 1]!;
        expect((last.centerX + last.width / 2) - (first.centerX - first.width / 2))
          .toBeGreaterThanOrEqual(0.9);
        // The inshore offset wanders (a curve, not a straight line) and boxes
        // rotate to follow the local tangent.
        const offsets = sorted.map((part) => part.centerZ % 1);
        expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThanOrEqual(0.02);
        expect(sorted.some((part) => Math.abs(part.yaw ?? 0) > 0.01)).toBe(true);
      }
      // Different tiles bend differently: mid-edge offsets vary across the coast.
      const mids = [...byTile.values()].map((boxes) => {
        const sorted = [...boxes].sort((a, b) => a.centerX - b.centerX);
        return Math.round((sorted[Math.floor(sorted.length / 2)]!.centerZ % 1) * 1000);
      });
      expect(new Set(mids).size).toBeGreaterThanOrEqual(5);
    });

    it('agrees at shared tile corners so the curve continues across tiles', () => {
      const byTile = surfByTile(coastline());
      for (let x = 0; x < 11; x += 1) {
        const leftBoxes = [...byTile.get(`terrain:${String(x)}:1`)!]
          .sort((a, b) => a.centerX - b.centerX);
        const rightBoxes = [...byTile.get(`terrain:${String(x + 1)}:1`)!]
          .sort((a, b) => a.centerX - b.centerX);
        const leftEnd = leftBoxes[leftBoxes.length - 1]!;
        const rightStart = rightBoxes[0]!;
        // The terminal boxes approach the shared corner at the same inshore
        // offset (hashed from the corner, so both tiles compute it).
        expect(Math.abs((leftEnd.centerZ % 1) - (rightStart.centerZ % 1)))
          .toBeLessThanOrEqual(0.03);
        // And they nearly touch across the boundary.
        expect(rightStart.centerX - leftEnd.centerX)
          .toBeLessThanOrEqual((leftEnd.width + rightStart.width) / 2 + 0.06);
      }
    });

    it('rounds concave corners by joining the two chains inside the tile', () => {
      // Water at (1,1) with land north and east: the two chains must meet.
      const entities = [
        terrain('grass', 0, 0), terrain('grass', 1, 0), terrain('grass', 2, 0),
        terrain('water', 0, 1), terrain('water', 1, 1), terrain('grass', 2, 1),
        terrain('water', 0, 2), terrain('water', 1, 2), terrain('water', 2, 2),
      ];
      const parts = surfOf(entities).filter((part) => part.key.startsWith('terrain:1:1:'));
      const north = parts.filter((part) => part.key.includes('-north-'));
      const east = parts.filter((part) => part.key.includes('-east-'));
      expect(north.length).toBeGreaterThanOrEqual(5);
      expect(east.length).toBeGreaterThanOrEqual(5);
      const northEnd = [...north].sort((a, b) => a.centerX - b.centerX)[north.length - 1]!;
      const eastTop = [...east].sort((a, b) => a.centerZ - b.centerZ)[0]!;
      const distance = Math.hypot(
        northEnd.centerX - eastTop.centerX,
        northEnd.centerZ - eastTop.centerZ,
      );
      expect(distance).toBeLessThanOrEqual(0.24);
    });

    it('pinches to the land point at convex corners instead of stopping short', () => {
      // Land finger (x<=5, z=0) surrounded by water; the coast turns at x=6.
      const entities: ProjectedEntityView[] = [];
      for (let x = 0; x < 10; x += 1) {
        for (let z = 0; z < 3; z += 1) {
          entities.push(terrain(x <= 5 && z === 0 ? 'grass' : 'water', x, z));
        }
      }
      const parts = createTerrainDetailParts(entities);
      const northChain = parts
        .filter((part) => part.key.startsWith('terrain:5:1:') && part.key.includes('-north-'))
        .sort((a, b) => a.centerX - b.centerX);
      const westChain = parts
        .filter((part) => part.key.startsWith('terrain:6:0:') && part.key.includes('-west-'))
        .sort((a, b) => a.centerZ - b.centerZ);
      expect(northChain.length).toBeGreaterThanOrEqual(5);
      expect(westChain.length).toBeGreaterThanOrEqual(5);
      // Both chains run toward the shared land corner at (6, 1): the north
      // chain's right terminal hugs the waterline, as does the west chain's
      // bottom terminal.
      const northEnd = northChain[northChain.length - 1]!;
      const westEnd = westChain[westChain.length - 1]!;
      expect(northEnd.centerZ % 1).toBeLessThanOrEqual(0.09);
      expect(westEnd.centerX % 1).toBeLessThanOrEqual(0.09);
    });

    it('animates the whole curve with tapered ends so joints never tear', () => {
      const byTile = surfByTile(coastline());
      const phases = new Set<number>();
      for (const boxes of byTile.values()) {
        const sorted = [...boxes].sort((a, b) => a.centerX - b.centerX);
        for (const part of sorted) {
          const animation = part.animation!;
          expect(animation.periodMs).toBeGreaterThan(0);
          phases.add(animation.phaseRadians);
          // Travel stays perpendicular to this north-shore edge.
          expect(Math.abs(animation.translationAmplitude.x)).toBeLessThan(1e-9);
          // Connectedness survives the fade: length barely breathes while
          // thickness and height collapse.
          expect(animation.scaleAmplitude.x).toBeLessThanOrEqual(0.2);
          expect(animation.scaleAmplitude.z).toBeGreaterThanOrEqual(0.4);
          expect(animation.scaleAmplitude.y).toBeGreaterThanOrEqual(0.4);
        }
        // Ends are pinned (taper), the middle laps hardest.
        const middle = sorted[Math.floor(sorted.length / 2)]!;
        expect(Math.abs(middle.animation!.translationAmplitude.z))
          .toBeGreaterThanOrEqual(0.02);
        expect(Math.abs(sorted[0]!.animation!.translationAmplitude.z))
          .toBeLessThanOrEqual(0.015);
        expect(Math.abs(sorted[sorted.length - 1]!.animation!.translationAmplitude.z))
          .toBeLessThanOrEqual(0.015);
      }
      expect(phases.size).toBeGreaterThanOrEqual(10);
    });
  });

  describe('ground decoration variant library', () => {
    it('pulls grass tufts from several distinct cluster variants with varied blades', () => {
      const parts = createTerrainDetailParts(patch('grass', 24));
      const blades = parts.filter((part) => part.key.includes('grass-tuft'));
      expect(blades.length).toBeGreaterThanOrEqual(80);
      const variants = new Set(blades.map((part) => /grass-tuft-v(\d+)/.exec(part.key)?.[1]));
      variants.delete(undefined);
      expect(variants.size).toBeGreaterThanOrEqual(4);
      // Cluster sizes differ between variants.
      const perTile = new Map<string, number>();
      for (const blade of blades) {
        const tile = blade.key.split(':').slice(0, 3).join(':');
        perTile.set(tile, (perTile.get(tile) ?? 0) + 1);
      }
      expect(new Set(perTile.values()).size).toBeGreaterThanOrEqual(3);
      // Blade geometry and colour vary, not one stamped pair.
      expect(new Set(blades.map((part) => part.height)).size).toBeGreaterThanOrEqual(6);
      expect(new Set(blades.map((part) => part.tint)).size).toBeGreaterThanOrEqual(3);
      expect(new Set(blades.map((part) => `${String(part.yaw ?? 0)}|${String(part.roll ?? 0)}`)).size)
        .toBeGreaterThanOrEqual(8);
    });

    it('scatters flecks with varied placement, size, and tint instead of one centered stamp', () => {
      const parts = createTerrainDetailParts(patch('grass', 24));
      const flecks = parts.filter((part) => part.key.includes('grass-fleck'));
      expect(flecks.length).toBeGreaterThanOrEqual(60);
      expect(new Set(flecks.map((part) => Math.round((part.centerX % 1) * 100))).size)
        .toBeGreaterThanOrEqual(8);
      expect(new Set(flecks.map((part) => part.width)).size).toBeGreaterThanOrEqual(4);
      expect(new Set(flecks.map((part) => part.tint)).size).toBeGreaterThanOrEqual(2);
    });

    it('drops occasional pebbles on grass with varied sizes and greys', () => {
      const parts = createTerrainDetailParts(patch('grass', 24));
      const pebbles = parts.filter((part) => part.key.includes('grass-pebble'));
      expect(pebbles.length).toBeGreaterThanOrEqual(12);
      expect(new Set(pebbles.map((part) => part.width)).size).toBeGreaterThanOrEqual(3);
      expect(new Set(pebbles.map((part) => part.tint)).size).toBeGreaterThanOrEqual(2);
    });

    it('builds hill stone from formation variants scattered inside the tile', () => {
      const parts = createTerrainDetailParts(patch('hill', 24));
      const rocks = parts.filter((part) => part.key.includes('hill-rock'));
      expect(rocks.length).toBeGreaterThanOrEqual(60);
      const variants = new Set(rocks.map((part) => /hill-rock-v(\d+)/.exec(part.key)?.[1]));
      variants.delete(undefined);
      expect(variants.size).toBeGreaterThanOrEqual(3);
      // Formation anchors move around the tile instead of sitting at one spot.
      expect(new Set(rocks.map((part) => Math.round((part.centerX % 1) * 50))).size)
        .toBeGreaterThanOrEqual(6);
      expect(new Set(rocks.map((part) => part.tint)).size).toBeGreaterThanOrEqual(3);
      expect(new Set(rocks.map((part) => part.width)).size).toBeGreaterThanOrEqual(6);
    });

    it('stays deterministic and bounded per tile', () => {
      const entities = patch('grass', 24);
      const forward = createTerrainDetailParts(entities);
      expect(createTerrainDetailParts([...entities].reverse())).toEqual(forward);
      const perTile = new Map<string, number>();
      for (const part of forward) {
        const tile = part.key.split(':').slice(0, 3).join(':');
        perTile.set(tile, (perTile.get(tile) ?? 0) + 1);
      }
      expect(Math.max(...perTile.values())).toBeLessThanOrEqual(12);
    });
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
