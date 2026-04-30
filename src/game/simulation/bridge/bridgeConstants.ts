// Shared bridge constants. Used by `bridge/wireBridgeOps.ts` and
// `bridge/assembleBridgeApi.ts` (and other helper-ops modules that need the
// standard starting resources, population cap, countdown windows, and
// monk/market tunings).

import type { Position } from 'civ-engine';
import type { PlayerResources } from '../types';

export const STANDARD_STARTING_RESOURCES: PlayerResources = {
  food: 200,
  wood: 200,
  gold: 100,
  stone: 200,
};

export const STANDARD_POPULATION_CAP = 5;
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
