// Phase-6.D: winner extraction for AI-vs-LLM (or any multi-owner)
// playtests. Pure scoring function: takes per-owner entity counts at
// the end of the run and returns whether anyone won, the game is
// still in progress, or everybody died (tie). Result is appended to
// the run envelope as `winner` so corpus runners + dashboards can
// surface the outcome alongside cost/duration.
//
// Pure data — no I/O, no engine coupling. The runner script collects
// per-owner counts via the host (which reads the engine's
// EconomyState) and feeds them in.

export interface PerOwnerEntityCounts {
  [ownerId: number]: { units: number; buildings: number };
}

export type WinnerResult =
  | { kind: 'winner'; ownerId: number }
  | { kind: 'in-progress'; aliveOwners: number[] }
  | { kind: 'tie' };

export function extractWinner(counts: PerOwnerEntityCounts): WinnerResult {
  const aliveOwners: number[] = [];
  for (const [id, c] of Object.entries(counts)) {
    if (c.units > 0 || c.buildings > 0) {
      aliveOwners.push(Number(id));
    }
  }
  // Ascending owner-id sort for stable serialization in trace logs +
  // dashboard tables. Object.entries iteration order is insertion
  // order on modern engines, which is unstable for runtime-built
  // counts; pin it explicitly.
  aliveOwners.sort((a, b) => a - b);
  if (aliveOwners.length === 0) return { kind: 'tie' };
  if (aliveOwners.length === 1) return { kind: 'winner', ownerId: aliveOwners[0]! };
  return { kind: 'in-progress', aliveOwners };
}
