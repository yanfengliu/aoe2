// src/game/simulation/projectedEntityLists.ts lets a reader of the projected entity list skip the map's cells: the
// two writers of a list (the render state and the position smoother) remember it as its terrain half and its other
// half, and a reader that finds the halves uses them instead of filtering 14,400 cells out of the list (work 150
// M2b, rank 1). A reader trusts what it is told, so these cases hold the writers to the promise the file states,
// at every tick and every frame of a real match: the list is exactly the terrain half followed by the other half,
// every view in the terrain half is a tile on the terrain layer, and none in the other half is on that layer. They
// also hold that the smoother's list for a remembered list is the list it builds for one nobody remembered.
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { joinProjectedEntityLists, knownProjectedEntityLists } from '../../src/game/simulation/projectedEntityLists';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { createDisplayedPositionSmoother } from '../../src/rendering/displayedPositionSmoother';

function expectPromiseKept(entities: readonly ProjectedEntityView[], where: string): readonly ProjectedEntityView[] {
  const lists = knownProjectedEntityLists(entities);
  expect(lists, `${where}: the list's halves`).toBeDefined();
  const { terrain, others } = lists!;
  expect(terrain.length + others.length, `${where}: the halves' lengths`).toBe(entities.length);
  for (let index = 0; index < entities.length; index += 1) {
    const expected = index < terrain.length ? terrain[index] : others[index - terrain.length];
    if (entities[index] !== expected) throw new Error(`${where}: the list's view ${String(index)} is not the halves'`);
  }
  for (const view of terrain) {
    if (view.layer !== 'terrain' || view.kind !== 'tile') throw new Error(`${where}: the terrain half holds a ${view.kind} on the ${view.layer} layer`);
  }
  for (const view of others) {
    if (view.layer === 'terrain') throw new Error(`${where}: the other half holds a terrain view`);
  }
  return terrain;
}

describe('a projected entity list remembered as two halves', () => {
  it('is what the render state and the smoother hand on, at every tick and frame of a match', () => {
    const bridge = createSimulationBridge('aoe2-prototype', { forceAiForOwners: new Set([1]) });
    const remembered = createDisplayedPositionSmoother();
    const forgotten = createDisplayedPositionSmoother();
    let terrainArrays = 0;
    let lastTerrain: readonly ProjectedEntityView[] | null = null;
    let moved = 0;
    for (let tick = 0; tick < 400; tick += 1) {
      bridge.step(1000 / TPS);
      const state = bridge.getRenderState();
      const terrain = expectPromiseKept(state.entities, `tick ${String(state.tick)}`);
      if (terrain !== lastTerrain) terrainArrays += 1;
      lastTerrain = terrain;
      for (const alpha of [0, 0.5]) {
        const displayed = remembered.apply(state.entities, state.tick, alpha);
        // The cells are handed on as the array they came in.
        expect(expectPromiseKept(displayed, `tick ${String(state.tick)} at ${String(alpha)}`)).toBe(terrain);
        // The same frame from a list nobody remembered: the smoother's old path, and the same list.
        const plain = forgotten.apply([...state.entities], state.tick, alpha);
        expect(knownProjectedEntityLists(plain)).toBeUndefined();
        expect(displayed).toHaveLength(plain.length);
        for (let index = 0; index < plain.length; index += 1) {
          const view = displayed[index]!;
          if (view === plain[index]) continue;
          moved += 1;
          expect(view).toEqual(plain[index]);
        }
      }
    }
    // One terrain array for the whole run: no cell changed, so nothing ever rebuilt it.
    expect(terrainArrays).toBe(1);
    // Units were drawn between their sampled positions, so the comparison above was not of identical lists only.
    expect(moved).toBeGreaterThan(400);
  }, 120_000);

  it('knows nothing of a list nobody joined, and of a copy of one that was', () => {
    const tile = { layer: 'terrain', kind: 'tile' } as ProjectedEntityView;
    const unit = { layer: 'unit', kind: 'unit' } as ProjectedEntityView;
    expect(knownProjectedEntityLists([tile, unit])).toBeUndefined();
    const terrain = [tile];
    const others = [unit];
    const joined = joinProjectedEntityLists(terrain, others);
    expect(joined).toEqual([tile, unit]);
    expect(knownProjectedEntityLists(joined)).toEqual({ terrain, others });
    expect(knownProjectedEntityLists(joined)!.terrain).toBe(terrain);
    expect(knownProjectedEntityLists([...joined])).toBeUndefined();
    expect(knownProjectedEntityLists(joined.slice())).toBeUndefined();
  });
});
