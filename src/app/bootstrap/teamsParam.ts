// Parse the ?teams=<a,b,c> URL param — which side each player is on, one
// number per player in owner order, so `?players=3&teams=1,1,2` puts owners 1
// and 2 together against owner 3.
//
// Mirrors parseCivParam and parsePlayersParam: closure-local, reaching
// createSimulationBridge as a scenario override rather than save state. §2.2
// puts "optional AI allies" in scope; this is how a player asks for one.
//
// Anything unusable warns and yields an empty map, which leaves a free-for-all.
// That includes putting EVERY player on one team, which would be a match
// nobody can win.

import { parseTeamAssignment } from '../../game/simulation/alliances';

export function parseTeamsParam(url: string, playerCount: number): Map<number, number> {
  const raw = new URL(url).searchParams.get('teams');
  if (raw === null || raw.trim() === '') return new Map();
  const teams = parseTeamAssignment(raw, playerCount);
  if (teams.size === 0) {
    console.warn(
      `[aoe2] ?teams= "${raw.trim()}" needs one team number per player`
      + ` (${String(playerCount)} of them, from 1, and not all the same);`
      + ' playing a free-for-all.',
    );
  }
  return teams;
}
