import type { Position } from 'civ-engine';

/**
 * Remembers a SUCCEEDING approach search so it is not repeated every tick.
 *
 * The negative cache in `movementPlanOps` only spares a FAILING search. A
 * succeeding one re-ran in full on every tick: measured on `default-seed`
 * warmed 33,000 ticks, 32.8 resource + 7.9 building A* per tick at 50 units —
 * about one per unit per tick — while `movePathCache`, the pre-existing
 * positive cache, recorded ZERO hits in that window. It covers explicit move
 * commands only; the AI does issue those (rally points walk units by move
 * command), but not on a warmed `default-seed` where nothing trains, so the
 * zero is the window's, not a rule. Pathfinding was 23% of tick self time.
 *
 * Behaviour-preserving for everything the key pins. A* is deterministic, and
 * the approach search reads the unit's start CELL, the target's approach
 * cells, durable topology, and — through gate admittance — the asking unit's
 * OWNER and movement domain; never other units, which do not block
 * passability. Topology changes bump `structuralRevision`; the one in-place
 * owner change, monk conversion, announces itself through
 * `notePassabilityChange` (review C1 — before it did, a converted villager
 * replayed a step into its old side's gate). So for an unchanged (unit, start
 * cell, target, structuralRevision) a fresh search returns exactly what the
 * previous one did, and replaying the stored answer cannot change a decision.
 *
 * Keying on the start CELL is what bounds an entry's life for a MOVING unit:
 * it stops applying the moment the unit crosses into a new cell, every ~12.5
 * ticks at the base 0.32 fine units per tick (4 per cell — 0.08 tiles/tick),
 * so the hit rate on a walk is over 90%. A STATIONARY unit's entry lives
 * until the next revision bump, measured in play at a median of 97-746 ticks
 * between bumps and up to ~2,000 (review I2) — which is why every input the
 * search reads has to be either in the key or announced as a bump.
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
