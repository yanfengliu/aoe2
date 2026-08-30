// A per-revision memo for spawn passability.
//
// `isCellPassableForSpawn` is the hottest query in the simulation: pathfinding
// asks it for every neighbour of every expanded node, and CPU profiling of an
// AI self-play match put it and the engine `getCellStatus` it calls at ~32% of
// all time. Memoising it took the match from 15.1 to 8.0 ms/tick.
//
// Soundness has TWO halves, and only the first is about reading.
//
// READ SIDE: the predicate reads bounds, terrain, building claims and resource
// claims — and NOT units, which crowd rather than block and deliberately do not
// bump the structural revision. So a cell's answer cannot change until
// something structural does. Anything that starts making spawn passability
// depend on units, owners or time must stop using this memo.
//
// WRITE SIDE: every writer that can change one of those claims must bump the
// revision. This is the half that has to be enforced rather than argued, and it
// is the half that was broken when this shipped for review: `syncUnit` released
// an entity's claims directly without the bump, and an id being synced as a
// unit can still hold a BUILDING or RESOURCE claim from a previous life — so
// that path could drop a structural blocker and leave this memo answering
// `false` for a cell that had become open, permanently, until an unrelated
// mutation happened to bump. `worldOccupancy.releaseClaims` is now the single
// choke point, and the mutate-then-requery sweep in
// `worldOccupancyFastPath.test.ts` is what keeps it one.

/** 0 = not yet computed, 1 = passable, 2 = blocked. */
const UNKNOWN = 0;
const PASSABLE = 1;
const BLOCKED = 2;

export interface SpawnPassabilityMemo {
  /** Returns the memoised answer, calling `compute(x, y)` on a miss. `compute`
   *  is passed rather than closed over so a hit allocates nothing — this is the
   *  path that runs hundreds of thousands of times a tick. */
  get(x: number, y: number, revision: number, compute: (x: number, y: number) => boolean): boolean;
}

export function createSpawnPassabilityMemo(
  worldWidth: number,
  worldHeight: number,
): SpawnPassabilityMemo {
  const cells = new Uint8Array(Math.max(0, worldWidth * worldHeight));
  let memoRevision = -1;

  return {
    get(
      x: number,
      y: number,
      revision: number,
      compute: (x: number, y: number) => boolean,
    ): boolean {
      if (memoRevision !== revision) {
        cells.fill(UNKNOWN);
        memoRevision = revision;
      }
      const index = y * worldWidth + x;
      const cached = cells[index];
      if (cached !== UNKNOWN) return cached === PASSABLE;
      const answer = compute(x, y);
      cells[index] = answer ? PASSABLE : BLOCKED;
      return answer;
    },
  };
}
