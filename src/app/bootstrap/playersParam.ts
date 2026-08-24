// Parse the ?players=<n> URL param — how many players the skirmish opens with.
//
// Mirrors parseCivParam: closure-local, never written into world.state, and it
// reaches createSimulationBridge as a scenario override rather than save state.
// §2.2 puts "AI opponents" in scope, so a skirmish is not a 1v1 — this is how a
// player asks for the third and fourth.
//
// An unusable value warns and yields undefined, which leaves the default of two
// in place: a bad URL should open the ordinary game, not refuse to start.

import { MAX_STANDARD_PLAYERS } from '../../game/simulation/mapGeneration/applyStandardPlayerOpening/patches';

export function parsePlayersParam(url: string): number | undefined {
  const raw = new URL(url).searchParams.get('players');
  if (raw === null || raw.trim() === '') return undefined;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed)) {
    console.warn(`[aoe2] ?players= "${raw.trim()}" is not a whole number; opening a 1v1.`);
    return undefined;
  }
  if (parsed < 2 || parsed > MAX_STANDARD_PLAYERS) {
    console.warn(
      `[aoe2] ?players= ${String(parsed)} is outside 2..${String(MAX_STANDARD_PLAYERS)}`
      + ' on this map size; opening a 1v1.',
    );
    return undefined;
  }
  return parsed;
}
