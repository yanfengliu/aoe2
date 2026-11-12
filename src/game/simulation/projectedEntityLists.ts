// The projected entity list, known in two parts: the terrain cells and everything else (work 150 M2b).
//
// WHY. A map has one projected entity per cell, and a 120x120 map has 14,400 of them beside about 900 others late in
// a match. The cells never move and almost never change, yet every consumer of the list walked them: the render
// store sorted them on every tick, the render state filtered them and sorted them again with fog memory, and on
// every drawn frame the presentation's coordinator, the position smoother, the ground's packing and the adapter each
// walked or filtered the whole list to find or to skip them (plan 150, "M2b measurement": 5.3% of a late DE Tiny
// frame in `getRenderState` alone). The list is terrain first, then the rest (the layer order every producer sorts
// by), so whoever builds it already holds the two parts.
//
// WHAT THIS IS. A side table from a list to its two parts, written by whoever built the list out of them and read by
// whoever would otherwise filter it. The list itself is unchanged: the same array of the same views in the same
// order, so a reader that knows nothing of this file reads what it always read. A list nobody remembered has no
// entry, and its reader does what it did before.
//
// WHAT THE WRITER PROMISES. `entities` is exactly `terrain` followed by `others`, every view in `terrain` is a map
// cell (a tile on the terrain layer) and no view in `others` is on the terrain layer. A writer that cannot promise
// it joins nothing and hands on a plain list. `tests/simulation/projectedEntityLists.test.ts` holds the writers to it.
import type { ProjectedEntityView } from './types';

export interface ProjectedEntityLists {
  /** The map's cells, in list order. Shared between lists while the cells are unchanged: never written. */
  readonly terrain: readonly ProjectedEntityView[];
  /** Every other view, in list order. */
  readonly others: readonly ProjectedEntityView[];
}

const remembered = new WeakMap<readonly ProjectedEntityView[], ProjectedEntityLists>();

/** `terrain` followed by `others` as one list, remembered as those two parts. */
export function joinProjectedEntityLists(
  terrain: readonly ProjectedEntityView[],
  others: readonly ProjectedEntityView[],
): ProjectedEntityView[] {
  const entities = terrain.concat(others);
  remembered.set(entities, { terrain, others });
  return entities;
}

/** The two parts a list was built from, or undefined when nobody remembered them. */
export function knownProjectedEntityLists(
  entities: readonly ProjectedEntityView[],
): ProjectedEntityLists | undefined {
  return remembered.get(entities);
}
