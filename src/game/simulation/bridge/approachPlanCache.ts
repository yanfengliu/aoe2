import type { Position } from 'civ-engine';

/**
 * Remembers a SUCCEEDING approach search so it is not repeated every tick.
 *
 * The negative cache in `movementPlanOps` only spares a FAILING search. A
 * succeeding one re-ran in full on every tick: measured on `default-seed`
 * warmed 33,000 ticks, 32.8 resource + 7.9 building A* per tick at 50 units —
 * about one per unit per tick — while `movePathCache`, the pre-existing
 * positive cache, recorded ZERO hits because it only covers explicit move
 * commands and an AI never issues one. Pathfinding was 23% of tick self time.
 *
 * Behaviour-preserving BY CONSTRUCTION, not by measurement. A* is
 * deterministic, and the approach search reads only the unit's start CELL, the
 * target's approach cells, and durable topology — never other units, which do
 * not block passability. So for an unchanged (unit, start cell, target,
 * structuralRevision) a fresh search returns exactly what the previous one
 * did, and replaying the stored answer cannot change a decision.
 *
 * Keying on the start CELL is what makes that true. The entry stops applying
 * the moment the unit crosses into a new cell, which at 0.32 tiles/tick is
 * roughly every third tick — so this removes about two searches in three
 * without ever answering for a position the search was not run from.
 */
export interface ApproachPlanCache<TPlan> {
  /** The stored answer, or null when nothing applies to this exact state. */
  get(key: string, revision: number | undefined, position: Position): { plan: TPlan | null } | null;
  set(key: string, revision: number | undefined, position: Position, plan: TPlan | null): void;
  /** Entries held. Exposed for the eviction test; not used by callers. */
  readonly size: number;
}

/** Entries kept before the cache is dropped wholesale. Matches the sibling
 *  unreachable-plan cache; a full clear is correct because every entry is a
 *  pure memo that will be recomputed on demand. */
export const APPROACH_CACHE_LIMIT = 4096;

export function createApproachPlanCache<TPlan>(): ApproachPlanCache<TPlan> {
  const entries = new Map<string, { revision: number; cell: string; plan: TPlan | null }>();
  const cellKey = (position: Position): string => `${position.x},${position.y}`;
  return {
    get(key, revision, position) {
      // No revision source means no way to know whether topology moved, so
      // never answer from the cache rather than risk a stale path.
      if (revision === undefined) return null;
      const entry = entries.get(key);
      if (!entry || entry.revision !== revision || entry.cell !== cellKey(position)) return null;
      return entry;
    },
    set(key, revision, position, plan) {
      if (revision === undefined) return;
      if (entries.size >= APPROACH_CACHE_LIMIT) entries.clear();
      entries.set(key, { revision, cell: cellKey(position), plan });
    },
    get size() {
      return entries.size;
    },
  };
}
