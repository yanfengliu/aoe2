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

// §4.5's speed ladder. All data in the spec is defined at 1.0×, which is the
// rate every existing test measures — so Slow IS today's speed, and the two
// faster presets multiply the view's simulation delta.
export const GAME_SPEEDS = {
  slow: 1.0,
  normal: 1.5,
  fast: 2.0,
} as const;
export type GameSpeed = keyof typeof GAME_SPEEDS;
