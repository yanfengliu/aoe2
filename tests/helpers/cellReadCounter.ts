// Counts reads of the map's cells, for the gates that hold a tick and a frame to not walking them (work 150 M2b):
// tests/simulation/renderStateCellsStaySorted.test.ts and tests/rendering/presentationSkipsCells.test.ts. Two counts,
// because a walk can read a cell's fields or only fetch the cell from its array:
//  - `cellReadCounter` replaces every field of every terrain view it is shown with an accessor, and the view's
//    prototype with a stand-in, and counts reads: of a field the view holds, and of one it does not;
//  - `terrainArrayReadCounter` hands the render state on with the terrain half of its list behind a proxy, and
//    counts the cells fetched from that array by index, which a native walk (a copy, a comparison of one array's
//    objects with another's) does without reading any field.
// Neither sees a walk of the whole joined list that asks nothing of a cell. Both are checked against reads whose
// number is known in tests/simulation/cellReadCounter.test.ts.
import { joinProjectedEntityLists, knownProjectedEntityLists } from '../../src/game/simulation/projectedEntityLists';
import type { ProjectedEntityView, RenderState } from '../../src/game/simulation/types';

export interface CellReadCounter {
  /** Starts counting reads of the terrain views in this list that are not counted yet. */
  watch(entities: readonly ProjectedEntityView[]): void;
  reads(): number;
  /** Runs the test's own look at the cells without counting it. */
  quietly<T>(look: () => T): T;
}

export function cellReadCounter(): CellReadCounter {
  const watched = new WeakSet<object>();
  let reads = 0;
  let counting = true;
  // A read of a field the view does not hold reaches no accessor: an optional field is simply absent on a cell
  // (`attackAnimation`, say), and a walk that asks every entity for one would be counted as nothing. Such a read goes
  // on to the view's prototype, so the prototype is a stand-in that counts it and answers as Object.prototype does
  // (review round 2 of work 150 M2b rank 1, F4).
  const absentFields = new Proxy(Object.prototype, {
    get(target, key, receiver) {
      if (counting && typeof key === 'string' && !(key in target)) reads += 1;
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
  return {
    watch(entities) {
      counting = false;
      try {
        for (const view of entities) {
          if (view.layer !== 'terrain' || watched.has(view)) continue;
          watched.add(view);
          for (const key of Object.keys(view)) {
            let value = (view as unknown as Record<string, unknown>)[key];
            Object.defineProperty(view, key, {
              enumerable: true,
              configurable: true,
              get() { if (counting) reads += 1; return value; },
              set(next: unknown) { value = next; },
            });
          }
          Object.setPrototypeOf(view, absentFields);
        }
      } finally {
        counting = true;
      }
    },
    reads: () => reads,
    quietly(look) {
      counting = false;
      try {
        return look();
      } finally {
        counting = true;
      }
    },
  };
}

export interface TerrainArrayReadCounter {
  /** The state with its list joined again over a counting stand-in for the terrain half. One stand-in for as long
   *  as the render state hands on one terrain array, so whatever keeps that array keeps the stand-in as well. */
  readState(state: RenderState): RenderState;
  /** Cells fetched from the terrain half by index since the counter was made, the joins of `readState` left out. */
  reads(): number;
  /** Cells fetched by the last join `readState` made: one copy of the half, so a count that sees nothing shows. */
  readsOfLastJoin(): number;
}

export function terrainArrayReadCounter(): TerrainArrayReadCounter {
  const standIns = new WeakMap<readonly ProjectedEntityView[], ProjectedEntityView[]>();
  let reads = 0;
  let readsOfLastJoin = 0;
  let last: { from: RenderState; to: RenderState } | null = null;
  const standInFor = (terrain: readonly ProjectedEntityView[]): ProjectedEntityView[] => {
    let standIn = standIns.get(terrain);
    if (!standIn) {
      standIn = new Proxy(terrain as ProjectedEntityView[], {
        get(target, key, receiver) {
          // An array's index is the only property name that starts with a digit.
          if (typeof key === 'string' && key.charCodeAt(0) >= 48 && key.charCodeAt(0) <= 57) reads += 1;
          return Reflect.get(target, key, receiver) as unknown;
        },
      });
      standIns.set(terrain, standIn);
    }
    return standIn;
  };
  return {
    readState(state) {
      if (last?.from !== state) {
        const lists = knownProjectedEntityLists(state.entities);
        if (!lists) throw new Error('The render state handed on a list without its two halves.');
        const before = reads;
        const entities = joinProjectedEntityLists(standInFor(lists.terrain), lists.others);
        readsOfLastJoin = reads - before;
        reads = before;
        last = { from: state, to: { ...state, entities } };
      }
      return last.to;
    },
    reads: () => reads,
    readsOfLastJoin: () => readsOfLastJoin,
  };
}
