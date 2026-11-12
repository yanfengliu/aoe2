// GATE: a tick does not sort the map's cells again, or read them (work 150 M2b, rank 1).
//
// WHY. A map has one projected entity per cell: 2,160 on today's 60x36 map and 14,400 on a DE Tiny one, beside a few
// hundred to a couple of thousand of everything else. Until this gate `RenderStore.getEntities` sorted every one of
// them on every tick, with a comparator that built an array per comparison, and `getRenderState` then sorted them
// all a second time whenever the fog remembered anything. Around the sorts it filtered every cell through the fog's
// rule, which passes every cell, and gathered every cell's id to ask which remembered entities are live. On a late
// DE Tiny match that was 5.3% of the main thread, 3.0-5.3 ms/tick of its time against 0.9 on today's map (plan 150,
// "M2b measurement"), for cells that never move.
//
// WHAT IT COUNTS. Not a timing. Two counts while `getRenderState()` rebuilds, tick after tick of a match the
// computer plays on both seats:
//  (1) the terrain views inside every array that `Array.prototype.sort` is called on;
//  (2) reads of any field of any terrain view, one it holds or one it does not, counted by replacing every field of
//      every terrain view the bridge hands out with an accessor and its prototype with a counting stand-in
//      (tests/helpers/cellReadCounter.ts), which sees a filter or a gathering of ids as well as a sort's comparisons.
// A cell may be sorted and read when the cells themselves change (one is created, replaced or destroyed), so both
// are held against the ticks on which the list's terrain views are not the previous tick's: no more than one sort
// of the cells on such a tick, and no sort and no read on any other. The old code sorted them at least once and
// read them all several times on every tick, which this refuses.
//
// HOW. The DE Tiny sized world of tests/helpers/deTinySizedWorld.ts and today's map, each stepped past the point
// where the fog holds memories (so the second sort's path is taken), then counted over 150 ticks.
//
// BOUND. A walk that asks nothing of a cell (a native copy of the array, which the join of the list's two halves is,
// or a comparison of its objects with another array's) is not seen here. The frames between ticks are
// tests/rendering/presentationSkipsCells.test.ts's.
import { describe, expect, it } from 'vitest';

import { createSimulationBridge, type SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { cellReadCounter } from '../helpers/cellReadCounter';
import { createDeTinySizedBridge } from '../helpers/deTinySizedWorld';

/** Runs `read` and returns how many terrain views were inside the arrays sorted while it ran. `quietly` keeps
 *  this count's own look at each view out of the count of reads. */
function terrainViewsSortedDuring(read: () => void, quietly: (look: () => void) => void): number {
  const original = Array.prototype.sort;
  let terrainViews = 0;
  Array.prototype.sort = function sortCounting(this: unknown[], ...args: Parameters<typeof original>) {
    quietly(() => {
      for (const value of this) {
        if (typeof value === 'object' && value !== null && (value as { layer?: unknown }).layer === 'terrain') terrainViews += 1;
      }
    });
    return original.apply(this, args);
  } as typeof original;
  try {
    read();
  } finally {
    Array.prototype.sort = original;
  }
  return terrainViews;
}

function terrainOf(entities: readonly ProjectedEntityView[]): ProjectedEntityView[] {
  return entities.filter((entity) => entity.layer === 'terrain');
}

interface Count {
  readonly cells: number; readonly ticks: number; readonly cellChangeTicks: number; readonly remembered: number;
  readonly sortedOnQuietTicks: number; readonly sortedOnChangeTicks: number; readonly fieldsReadOnQuietTicks: number;
}

function countOver(bridge: SimulationBridge, warmUpTicks: number, ticks: number): Count {
  for (let tick = 0; tick < warmUpTicks; tick += 1) bridge.step(1000 / TPS);
  const counter = cellReadCounter();
  let previous = terrainOf(bridge.getRenderState().entities);
  counter.watch(previous);
  let cellChangeTicks = 0;
  let sortedOnQuietTicks = 0;
  let sortedOnChangeTicks = 0;
  let fieldsReadOnQuietTicks = 0;
  for (let tick = 0; tick < ticks; tick += 1) {
    bridge.step(1000 / TPS);
    // The read that rebuilds the render state; the reads after it on this tick are handed the same value.
    const readsBefore = counter.reads();
    const sorted = terrainViewsSortedDuring(() => { bridge.getRenderState(); }, counter.quietly);
    const fieldsRead = counter.reads() - readsBefore;
    const terrain = terrainOf(bridge.getRenderState().entities);
    counter.watch(terrain);
    const changed = terrain.length !== previous.length || terrain.some((view, index) => view !== previous[index]);
    if (changed) {
      cellChangeTicks += 1;
      sortedOnChangeTicks = Math.max(sortedOnChangeTicks, sorted);
    } else {
      sortedOnQuietTicks += sorted;
      fieldsReadOnQuietTicks += fieldsRead;
    }
    previous = terrain;
  }
  const state = bridge.getRenderState();
  return {
    cells: previous.length, ticks, cellChangeTicks, sortedOnQuietTicks, sortedOnChangeTicks, fieldsReadOnQuietTicks,
    remembered: state.entities.filter((entity) => entity.isMemory).length,
  };
}

describe('a tick does not sort the map\'s cells again, or read them', () => {
  const worlds: ReadonlyArray<readonly [string, () => SimulationBridge, number]> = [
    ['a DE Tiny sized world', () => createDeTinySizedBridge(), 14_400],
    ['today\'s map', () => createSimulationBridge('aoe2-prototype', { forceAiForOwners: new Set([1]) }), 2_160],
  ];
  for (const [label, open, cells] of worlds) {
    it(`on ${label}`, () => {
      const count = countOver(open(), 700, 150);
      expect(count.cells, 'terrain cells projected').toBe(cells);
      // The fog must be remembering something, or the render state's second sort is never reached.
      expect(count.remembered, 'entities remembered under fog when the count ended').toBeGreaterThan(0);
      // The cells themselves rarely change; if they changed on most ticks this gate would allow most sorts.
      expect(count.cellChangeTicks, 'ticks on which a terrain view was replaced').toBeLessThanOrEqual(count.ticks / 10);
      expect(count.sortedOnQuietTicks, `terrain views sorted over the ${String(count.ticks - count.cellChangeTicks)} ticks on which no cell changed`).toBe(0);
      expect(count.sortedOnChangeTicks, 'terrain views sorted on a tick that replaced a cell, at most').toBeLessThanOrEqual(cells);
      expect(count.fieldsReadOnQuietTicks, 'reads of a cell\'s fields by the render state\'s read, over the same ticks on which no cell changed').toBe(0);
    }, 120_000);
  }
});
