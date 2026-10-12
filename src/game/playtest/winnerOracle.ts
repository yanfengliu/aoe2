// Phase-6.D: winner extraction for AI-vs-LLM (or any multi-owner)
// playtests. Pure scoring function: takes per-owner entity counts at
// the end of the run and returns whether anyone won, the game is
// still in progress, or everybody died (tie). Result is appended to
// the run envelope as `winner` so a reader of the run, and the
// conformance probe of `playtest:findings`, see the outcome.
//
// Pure data — no I/O, no engine coupling. The runner script collects
// per-owner counts via the host (which reads the engine's
// EconomyState, through `entityCountsByOwner` below) and feeds them in.

import { isConstructionStarted } from '../simulation/bridge/unstartedFoundations';
import type { EconomyState } from '../simulation/types';

export interface PerOwnerEntityCounts {
  [ownerId: number]: { units: number; buildings: number };
}

export type WinnerResult =
  | { kind: 'winner'; ownerId: number }
  | { kind: 'in-progress'; aliveOwners: number[] }
  | { kind: 'tie' };

/**
 * Each owner's units and buildings, counted as conquest counts them: a
 * foundation nobody has started building keeps nobody in the match (work 121),
 * so it is not counted, and the oracle agrees with the game about who is out.
 */
export function entityCountsByOwner(
  economy: Pick<EconomyState, 'units' | 'buildings'>,
): PerOwnerEntityCounts {
  const counts: PerOwnerEntityCounts = {};
  for (const unit of economy.units) {
    const slot = counts[unit.owner] ?? { units: 0, buildings: 0 };
    slot.units += 1;
    counts[unit.owner] = slot;
  }
  for (const building of economy.buildings) {
    if (!isConstructionStarted(building)) continue;
    const slot = counts[building.owner] ?? { units: 0, buildings: 0 };
    slot.buildings += 1;
    counts[building.owner] = slot;
  }
  return counts;
}

export function extractWinner(counts: PerOwnerEntityCounts): WinnerResult {
  const aliveOwners: number[] = [];
  for (const [id, c] of Object.entries(counts)) {
    if (c.units > 0 || c.buildings > 0) {
      aliveOwners.push(Number(id));
    }
  }
  // Ascending owner-id sort for stable serialization in trace logs +
  // envelopes. Object.entries iteration order is insertion
  // order on modern engines, which is unstable for runtime-built
  // counts; pin it explicitly.
  aliveOwners.sort((a, b) => a - b);
  if (aliveOwners.length === 0) return { kind: 'tie' };
  if (aliveOwners.length === 1) return { kind: 'winner', ownerId: aliveOwners[0]! };
  return { kind: 'in-progress', aliveOwners };
}
