// Match options (spec §4.1 / §4.3 / §4.5): the presets a setup screen offers
// and the app's URL parameters carry. Pure data — the bridge seeds them into
// world state (victory) or the opening stockpiles (resources), and the view
// multiplies its simulation delta (speed).

import type { PlayerResources } from './types';

// §4.1's three Random Map presets.
export const RESOURCE_PRESETS = {
  standard: { food: 200, wood: 200, gold: 100, stone: 200 },
  medium: { food: 500, wood: 500, gold: 300, stone: 400 },
  high: { food: 1000, wood: 1000, gold: 700, stone: 800 },
} as const satisfies Record<string, PlayerResources>;
export type ResourcePreset = keyof typeof RESOURCE_PRESETS;

// §4.5: Definitive Edition's four game speeds (work 149), named as its string
// table names them (13101 Slow, 13126 Casual, 13102 Normal, 13103 Fast) and at
// the multipliers its players document (plan 149). The data is defined at
// 1.0x, so Slow is the rate every tick-counted datum reads; a faster speed
// multiplies the view's simulation delta and never what a tick does.
export const GAME_SPEEDS = {
  slow: { label: 'Slow', multiplier: 1.0 },
  casual: { label: 'Casual', multiplier: 1.5 },
  normal: { label: 'Normal', multiplier: 1.7 },
  fast: { label: 'Fast', multiplier: 2.0 },
} as const;
export type GameSpeed = keyof typeof GAME_SPEEDS;

/** DE's speeds slowest first: the lobby's order and the numpad keys' steps. */
export const GAME_SPEED_LADDER: readonly GameSpeed[] = ['slow', 'casual', 'normal', 'fast'];

/** DE's creation screen starts on Normal (1.7x): the lobby's default. */
export const DEFAULT_GAME_SPEED: GameSpeed = 'normal';

/** A URL without `?speed=` (every test, harness and probe boot) runs at Slow,
 *  the rate the data is defined at; the lobby writes every other speed. */
export const UNSET_GAME_SPEED: GameSpeed = 'slow';

const LADDER_MULTIPLIERS = GAME_SPEED_LADDER.map((id) => GAME_SPEEDS[id].multiplier);
const SAME_SPEED = 1e-9;

/** One press of DE's SPEED_UP (+1) or SPEED_DOWN (-1): the next preset that
 *  way, held at Fast and at Slow. A speed between presets goes to the nearest
 *  one that way, and one past an end to that end, so the keys always land on
 *  one of DE's four. */
export function stepGameSpeed(multiplier: number, direction: 1 | -1): number {
  const next = direction > 0
    ? LADDER_MULTIPLIERS.find((step) => step > multiplier + SAME_SPEED)
    : [...LADDER_MULTIPLIERS].reverse().find((step) => step < multiplier - SAME_SPEED);
  if (next !== undefined) return next;
  return direction > 0 ? LADDER_MULTIPLIERS[LADDER_MULTIPLIERS.length - 1]! : LADDER_MULTIPLIERS[0]!;
}

/** The speed as DE's game-time display shows it, in brackets after the clock. */
export function formatGameSpeed(multiplier: number): string {
  return `(${multiplier.toFixed(1)})`;
}
