// Parse the ?civ=<name> URL param — the human player's chosen civilization.
// Mirrors parseDisableAiParam: closure-local, never written into
// world.state.aoe2.* (the choice flows to createSimulationBridge as a scenario
// override, not save state). The name is validated + normalized to its
// canonical casing (so ?civ=goths → 'Goths'); an unknown/empty value warns and
// yields an empty map (the default civ then applies). Returns an owner→civ map
// keyed by the human slot (owner 1) so it composes with the other scenario
// overrides.

import { HUMAN_PLAYER_ID } from '../../game/simulation/prototypeScenario';
import { normalizeCivilizationName } from '../../game/simulation/civilizationNames';

export function parseCivParam(url: string): Map<number, string> {
  const map = new Map<number, string>();
  const raw = new URL(url).searchParams.get('civ');
  if (raw === null || raw.trim() === '') return map;
  const canonical = normalizeCivilizationName(raw);
  if (canonical === null) {
    console.warn(`[aoe2] ?civ= "${raw.trim()}" is not a known civilization; using the default.`);
    return map;
  }
  map.set(HUMAN_PLAYER_ID, canonical);
  return map;
}
