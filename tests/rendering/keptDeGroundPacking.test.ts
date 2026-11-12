// The textured ground's bytes are packed once a tick and kept for the frames between
// (src/rendering/voxel/aoeDeGroundPacking.ts). Work 150 M2b stopped that cache from walking every map cell on every
// frame: when the list's two halves are known it compares the terrain half as one array. The decision must stay the
// one a comparison of every source makes, whichever way a list is known. Review round 0 found it did not (F2): two
// remembered lists holding the same cells in two arrays packed twice where two plain lists packed once. These cases
// hold the decision across both ways of knowing a list, and that kept bytes are the bytes a fresh packing gives.
import { describe, expect, it } from 'vitest';

import { joinProjectedEntityLists } from '../../src/game/simulation/projectedEntityLists';
import type { ProjectedEntityView, ProjectedFrameView } from '../../src/game/simulation/types';
import { packDeGround } from '../../src/rendering/voxel/aoeDeGroundData';
import { KeptDeGroundPacking } from '../../src/rendering/voxel/aoeDeGroundPacking';
import { terrain } from './helpers/fakeVoxelRuntime';

const tile = (x: number, entityType: ProjectedEntityView['entityType'] = 'grass'): ProjectedEntityView => ({ ...terrain(), id: 100 + x, x, y: 0, entityType });
const house = (x: number): ProjectedEntityView => ({
  ...terrain(), id: 9, kind: 'building', layer: 'building', entityType: 'house', owner: 1, x, y: 0, currentHp: 550, maxHp: 550,
});
const scout = (): ProjectedEntityView => ({ ...terrain(), id: 7, kind: 'unit', layer: 'unit', entityType: 'scout', owner: 1, x: 2, y: 0 });
const fog = (): ProjectedFrameView => ({ mapWidth: 4, mapHeight: 1, visibleCells: [0, 1], exploredCells: [0, 1, 2] } as unknown as ProjectedFrameView);

describe('the textured ground\'s kept packing', () => {
  // A hit keeps the packing that was kept, so what a list is compared WITH is whichever kind of list was packed
  // first. Each case therefore packs first from one kind, into a cache of its own, and then asks with every kind:
  // with one cache seeded from a plain list, a rule that demanded the same terrain array of two remembered lists
  // passed every case (review round 1, F3).
  const kinds: ReadonlyArray<readonly [string, (tiles: ProjectedEntityView[], building: ProjectedEntityView) => ProjectedEntityView[]]> = [
    ['a plain list', (tiles, building) => [...tiles, building]],
    ['a remembered list', (tiles, building) => joinProjectedEntityLists(tiles, [building])],
    ['a remembered list with a unit on it', (tiles, building) => joinProjectedEntityLists(tiles, [building, scout()])],
  ];
  for (const [seededFrom, seed] of kinds) {
    it(`is handed back for the same sources, however the list is known, when first packed from ${seededFrom}`, () => {
      const packing = new KeptDeGroundPacking();
      const frame = fog();
      const tiles = [tile(0), tile(1), tile(2), tile(3)];
      const building = house(1);
      const seeded = seed(tiles, building);
      const first = packing.pack(seeded, frame, 0.5);
      expect(first).toEqual(packDeGround(seeded, frame, 0.5));

      expect(packing.pack(seeded, frame, 0.5), 'the same list').toBe(first);
      expect(packing.pack([...tiles, building], frame, 0.5), 'a plain list of the same views').toBe(first);
      expect(packing.pack(joinProjectedEntityLists(tiles, [building]), frame, 0.5), 'a remembered list of the same views').toBe(first);
      // Round 0's F2: the same cells in another array are the same sources.
      expect(packing.pack(joinProjectedEntityLists([...tiles], [building]), frame, 0.5), 'the same cells in a new array').toBe(first);
      expect(packing.pack([...tiles, building], frame, 0.5), 'and a plain list again').toBe(first);
      // A unit is not something the ground is packed from.
      expect(packing.pack(joinProjectedEntityLists([...tiles], [building, scout()]), frame, 0.5), 'a unit more on the list').toBe(first);
      expect(packing.pack([...tiles, building, scout()], frame, 0.5)).toBe(first);
    });
  }

  it('packs again when a source, the fog or the brightness changes, and the bytes are a fresh packing\'s', () => {
    const packing = new KeptDeGroundPacking();
    const frame = fog();
    const tiles = [tile(0), tile(1), tile(2), tile(3)];
    const building = house(1);
    const first = packing.pack(joinProjectedEntityLists(tiles, [building]), frame, 0.5);

    const repack = (label: string, entities: ProjectedEntityView[], withFrame: ProjectedFrameView, level: number) => {
      const before = packing.pack(entities, withFrame, level);
      expect(before, label).toEqual(packDeGround(entities, withFrame, level));
      expect(packing.pack(entities, withFrame, level), `${label}: kept afterwards`).toBe(before);
      return before;
    };
    // One cell replaced by a view of another kind, in a remembered list and in a plain one.
    const water = [tiles[0]!, tile(1, 'water'), tiles[2]!, tiles[3]!];
    const second = repack('a replaced cell', joinProjectedEntityLists(water, [building]), frame, 0.5);
    expect(second).not.toBe(first);
    expect(second).not.toEqual(first);
    expect(repack('the first cells again, as a plain list', [...tiles, building], frame, 0.5)).not.toBe(second);
    // The building moved, moved again over the same terrain array (one building both times, so only the views
    // say so), then went.
    const third = repack('a moved building', joinProjectedEntityLists(tiles, [house(2)]), frame, 0.5);
    const moved = repack('the building moved again, the cells the same array', joinProjectedEntityLists(tiles, [house(3)]), frame, 0.5);
    expect(moved).not.toBe(third);
    expect(repack('no building', joinProjectedEntityLists(tiles, []), frame, 0.5)).not.toBe(moved);
    // The fog is another object with the same cells: a tick has passed, so nothing is taken on trust.
    const fourth = repack('the next tick\'s fog', joinProjectedEntityLists(tiles, []), fog(), 0.5);
    const lastFrame = fog();
    const fifth = repack('that fog again', joinProjectedEntityLists(tiles, []), lastFrame, 0.5);
    expect(fifth).not.toBe(fourth);
    expect(repack('another brightness', joinProjectedEntityLists(tiles, []), lastFrame, 0.8)).not.toBe(fifth);
  });

  it('keeps nothing without a fog to say a tick has not passed', () => {
    const packing = new KeptDeGroundPacking();
    const entities = joinProjectedEntityLists([tile(0), tile(1)], []);
    const first = packing.pack(entities, null, 0.5);
    const second = packing.pack(entities, null, 0.5);
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });
});
