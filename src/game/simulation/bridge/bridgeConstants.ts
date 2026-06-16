// Shared bridge constants. Used by both createSimulationBridge.ts (for
// scenario seeding) and bridge/createWorld.ts (for the createWorld factory
// + per-tick logic).

import type { Position } from 'civ-engine';
import type { PlayerResources } from '../types';

export const STANDARD_STARTING_RESOURCES: PlayerResources = {
  food: 200,
  wood: 200,
  gold: 100,
  stone: 200,
};

// Base population headroom before any building supply. 0 because the cap
// is fully building-derived (spec §6.10): the player's starting Town
// Center is created through the normal completion path and contributes
// its +5 (AoE2 starts each player at 5 pop = 1 TC). Houses (+5), extra
// TCs (+5), and Castles (+20) add from there.
export const STANDARD_POPULATION_CAP = 0;

// Standard AoE2 Random Map population limit (roadmap M1, v0.1.37). The
// effective cap is min(POP_HARD_CAP, raw building-supplied housing). The
// model tracks an honest, unclamped `rawSupply` running sum on
// PopulationState and DERIVES `cap = deriveCap(rawSupply)` at every
// build/destroy site + on load — clamping the STORED cap directly is lossy
// (build to 250, lose a house, and a stored-clamped cap wrongly drops to 195
// even though raw supply is still 245; Codex population-model iter-1 HIGH).
// Over-housing past 200 is allowed but wasteful (no extra cap); losing
// housing while raw supply stays >= 200 keeps the cap at 200; only when raw
// supply drops below 200 does the cap follow it down. A configurable cap /
// "no pop limit" lobby option is a future seam — `deriveCap` takes the hard
// cap as a parameter so that lands without touching the call sites.
export const POP_HARD_CAP = 200;

// Derive the effective population cap from the honest (unclamped) raw
// building supply. Single source of truth shared by all four cap-mutation
// sites (entity create/destroy + the construction-flow completion) and the
// save-load codec/hydrate paths so the clamp logic cannot drift. The
// `max(0, …)` is defensive against an underflowed raw sum.
export function deriveCap(rawSupply: number, hardCap: number = POP_HARD_CAP): number {
  return Math.min(hardCap, Math.max(0, rawSupply));
}

export const WONDER_COUNTDOWN_TICKS = 2000;
// Slice 8: Relic victory requires holding every relic on the map in one
// player's Monasteries for the full countdown. Mirrors Wonder countdown.
export const RELIC_COUNTDOWN_TICKS = 2000;
// Deterministic per-tick increments for Monk conversion and heal (Slice 5).
// Conversion flips target ownership at 50 progress; heal restores 1 HP per
// 10 ticks. These values are intentionally v1 "easy-to-observe" rates — real
// AoE2 uses per-tick conversion chance plus faith; out-of-scope here.
export const MONK_HEAL_TICK_INTERVAL = 10;
export const MONK_HEAL_HP_PER_INTERVAL = 1;
export const MONK_CONVERT_PROGRESS_PER_TICK = 1;
export const MONK_CONVERT_FLIP_THRESHOLD = 50;
export const MARKET_TRANSACTION_AMOUNT = 100;
export const MARKET_FEE_RATE = 0.3;
export const MARKET_RATE_STEP = 3;
export const MARKET_MIN_RATE = 20;
export const CARDINAL_NEIGHBOR_OFFSETS: Position[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
