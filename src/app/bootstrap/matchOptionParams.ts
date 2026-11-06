// Parse the §4 match-option URL parameters the setup screen writes:
// ?victory=conquest-only, ?resources=standard|medium|high, and
// ?speed=slow|casual|normal|fast. Each unusable value warns and falls back to
// the default — a bad URL opens the ordinary game, never a refusal.

import {
  GAME_SPEEDS,
  RESOURCE_PRESETS,
  UNSET_GAME_SPEED,
  type GameSpeed,
  type ResourcePreset,
} from '../../game/simulation/matchOptions';

export function parseVictoryParam(url: string): 'conquest-only' | undefined {
  const raw = new URL(url).searchParams.get('victory');
  if (raw === null || raw.trim() === '') return undefined;
  if (raw.trim().toLowerCase() === 'conquest-only') return 'conquest-only';
  console.warn(`[aoe2] ?victory= "${raw.trim()}" is not "conquest-only"; using the standard set.`);
  return undefined;
}

export function parseResourcesParam(url: string): ResourcePreset | undefined {
  const raw = new URL(url).searchParams.get('resources');
  if (raw === null || raw.trim() === '') return undefined;
  const value = raw.trim().toLowerCase();
  if (value in RESOURCE_PRESETS) return value as ResourcePreset;
  console.warn(
    `[aoe2] ?resources= "${raw.trim()}" is not one of ${Object.keys(RESOURCE_PRESETS).join('/')}; using standard.`,
  );
  return undefined;
}

/** §4.6 population cap: ?popcap=25..500, absent = the standard 200. */
export function parsePopCapParam(url: string): number | undefined {
  const raw = new URL(url).searchParams.get('popcap');
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 25 || value > 500) {
    console.warn(`[aoe2] ?popcap= "${raw.trim()}" is not a whole number in 25..500; using 200.`);
    return undefined;
  }
  return value;
}

/** The simulation-delta multiplier ?speed= asks for (§4.5); Slow's 1.0x when
 *  absent, which is every boot but the lobby's. */
export function parseSpeedParam(url: string): number {
  const unset = GAME_SPEEDS[UNSET_GAME_SPEED].multiplier;
  const raw = new URL(url).searchParams.get('speed');
  if (raw === null || raw.trim() === '') return unset;
  const value = raw.trim().toLowerCase();
  if (Object.hasOwn(GAME_SPEEDS, value)) return GAME_SPEEDS[value as GameSpeed].multiplier;
  console.warn(
    `[aoe2] ?speed= "${raw.trim()}" is not one of ${Object.keys(GAME_SPEEDS).join('/')}; running at 1.0x.`,
  );
  return unset;
}
