// The still-entity cache (work 130, src/rendering/voxel/aoeVoxelEntityPrep.ts) keeps a building's or a resource's
// parts while its projected view is unchanged. Two ways it could lie, each held here on the adapter itself:
//
//  1. A field of the view changes and the kept parts do not follow. Every field of a still building's view is
//     changed in turn, and each time the adapter must hand back parts equal to a fresh adapter's for the new view
//     (and a new array, not the kept one). A recipe that starts reading a field cannot be outrun by the cache,
//     because the key is the whole view rather than a list of the fields a recipe reads today.
//  2. A hit test reads geometry the frame did not draw. The hit state is built per snapshot and carries that
//     snapshot's revision; a still entity's hit parts are reused only with the very parts the batches drew. A
//     building moved across the map must be hit where it now stands and missed where it stood, on the next
//     snapshot, with the hit state's revision equal to that snapshot's.
//
// BOUND. One building type and one tree; a field change made one at a time. Moving entities are posed every frame
// and are not cached, so they are not exercised here (aoeVoxelLaneEquivalence.test.ts drives them).
import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import { findPreparedVoxelEntitiesAtIsoPoint } from '../../src/rendering/voxel/aoeVoxelHitProxy';
import { projectVoxelPointToIso } from '../../src/rendering/voxel/aoeVoxelGeometry';

function building(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 40,
    generation: 2,
    kind: 'building',
    layer: 'building',
    entityType: 'house',
    owner: 1,
    x: 6,
    y: 6,
    elevation: 0,
    tint: 0x3366cc,
    size: 1,
    footprintWidth: 2,
    footprintHeight: 2,
    visualVariant: 'complete',
    architecture: 'western-european',
    selected: false,
    currentHp: 550,
    maxHp: 550,
    isMemory: false,
    ...overrides,
  } as ProjectedEntityView;
}

/** Every instance the snapshot carries for one identity, keyed, as the GPU would receive them. */
function partsOf(snapshot: ReturnType<AoeVoxelAdapter['createSnapshot']>, identity: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const batch of snapshot.batches) {
    batch.instanceKeys.forEach((key, index) => {
      if (!key.startsWith(`${identity}:`)) return;
      out[key] = [...batch.matrices.slice(index * 16, index * 16 + 16), ...(batch.colors?.slice(index * 4, index * 4 + 4) ?? [])];
    });
  }
  return out;
}

describe('the still-entity cache', () => {
  // Each field of the view and a value that differs from the base view's.
  const changes: Array<[keyof ProjectedEntityView, unknown]> = [
    ['x', 9],
    ['y', 3],
    ['tint', 0xcc3333],
    ['owner', 2],
    ['entityType', 'mill'],
    ['footprintWidth', 3],
    ['footprintHeight', 3],
    ['visualVariant', 'construction'],
    ['architecture', 'middle-eastern'],
    ['selected', true],
    ['currentHp', 120],
    ['maxHp', 600],
    ['size', 1.2],
    ['isMemory', true],
  ];

  for (const [field, value] of changes) {
    it(`poses the building afresh when ${String(field)} changes`, () => {
      const adapter = new AoeVoxelAdapter();
      adapter.setVoxelGround(false);
      const before = building();
      const after = building({ [field]: value } as Partial<ProjectedEntityView>);
      adapter.createSnapshot([before], 100);
      const kept = adapter.createSnapshot([before], 116);
      const changed = adapter.createSnapshot([after], 132);
      // The cache noticed: a lane holding the building's parts was rebuilt, even for a field today's recipe ignores.
      const revisions = (snapshot: typeof kept) => Object.fromEntries(
        snapshot.batches.filter((batch) => /still|memory/.test(batch.key)).map((batch) => [batch.key, batch.revision]),
      );
      expect(revisions(changed), `a lane rebuilt after ${String(field)} changed`).not.toEqual(revisions(kept));
      const fresh = new AoeVoxelAdapter();
      fresh.setVoxelGround(false);
      const expected = fresh.createSnapshot([after], 132);
      expect(partsOf(changed, '40:2'), `parts after ${String(field)} changed`).toEqual(partsOf(expected, '40:2'));
      expect(Object.keys(partsOf(changed, '40:2')).length).toBeGreaterThan(0);
    });
  }

  it('keeps a still building\'s parts across frames where its view is unchanged, as a new equal view object', () => {
    const adapter = new AoeVoxelAdapter();
    adapter.setVoxelGround(false);
    const first = adapter.createSnapshot([building()], 100);
    const second = adapter.createSnapshot([building()], 116);
    const lane = (snapshot: typeof first) => snapshot.batches.find((batch) => batch.key === 'aoe2:batch:still-matte-parts')!;
    expect(lane(second).revision, 'the still lane kept its revision').toBe(lane(first).revision);
    expect(partsOf(second, '40:2')).toEqual(partsOf(first, '40:2'));
  });

  it('hits a moved building where it now stands and misses it where it stood, in the next snapshot\'s revision', () => {
    const adapter = new AoeVoxelAdapter();
    adapter.setVoxelGround(false);
    const at = (x: number, y: number) => projectVoxelPointToIso({ x: x + 1, y: 0.6, z: y + 1 });
    const hits = (point: { x: number; y: number }) => findPreparedVoxelEntitiesAtIsoPoint(
      adapter.latestHitState()!.entities, point.x, point.y, 'selection', 0,
    ).map((entity) => entity.id);

    const first = adapter.createSnapshot([building({ x: 6, y: 6 })], 100);
    adapter.createSnapshot([building({ x: 6, y: 6 })], 116);
    expect(adapter.latestHitState()!.revision).toBe(first.revision + 1);
    expect(hits(at(6, 6)), 'hit where it stands').toEqual([40]);

    const moved = adapter.createSnapshot([building({ x: 14, y: 3 })], 132);
    expect(adapter.latestHitState()!.revision, 'the hit state is the snapshot\'s').toBe(moved.revision);
    expect(hits(at(14, 3)), 'hit where it now stands').toEqual([40]);
    expect(hits(at(6, 6)), 'no hit where it stood').toEqual([]);
  });
});
