// Civ selection (v0.1.87): a ?civ=<name> URL param sets the human player's
// civilization, so the civilization bonuses (v0.1.81–86) are felt in a real
// game — not just the default Britons-vs-Franks matchup. The param is parsed in
// the app bootstrap (parseCivParam), validated/normalized against the canonical
// civ list (normalizeCivilizationName), and threaded to createSimulationBridge
// as civilizationsByOwner, which overrides the scenario start's civilization
// (mirroring the ?disableAi override).

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  CIVILIZATION_NAMES,
  normalizeCivilizationName,
} from '../../src/game/simulation/civilizationNames';
import { parseCivParam } from '../../src/app/bootstrap/civParam';

describe('normalizeCivilizationName — canonical civ matching', () => {
  it('returns the canonical name for an exact or case-insensitive match', () => {
    expect(normalizeCivilizationName('Goths')).toBe('Goths');
    expect(normalizeCivilizationName('goths')).toBe('Goths');
    expect(normalizeCivilizationName('GOTHS')).toBe('Goths');
    expect(normalizeCivilizationName('  franks  ')).toBe('Franks');
  });

  it('returns null for an unknown or empty civ', () => {
    expect(normalizeCivilizationName('Klingons')).toBeNull();
    expect(normalizeCivilizationName('')).toBeNull();
    expect(normalizeCivilizationName('   ')).toBeNull();
  });

  it('the canonical list has the 30 AoE2 civilizations', () => {
    expect(CIVILIZATION_NAMES).toContain('Britons');
    expect(CIVILIZATION_NAMES).toContain('Goths');
    expect(CIVILIZATION_NAMES).toContain('Aztecs');
    expect(CIVILIZATION_NAMES).toHaveLength(30);
  });
});

describe('parseCivParam — ?civ=<name> → owner→civilization map', () => {
  it('maps the human player (owner 1) to the normalized civ', () => {
    expect(parseCivParam('http://x/?civ=Goths')).toEqual(new Map([[1, 'Goths']]));
    expect(parseCivParam('http://x/?civ=goths')).toEqual(new Map([[1, 'Goths']]));
  });

  it('yields an empty map for an absent, empty, or unknown civ', () => {
    expect(parseCivParam('http://x/')).toEqual(new Map());
    expect(parseCivParam('http://x/?civ=')).toEqual(new Map());
    expect(parseCivParam('http://x/?civ=Klingons')).toEqual(new Map());
  });
});

describe('civilizationsByOwner — overrides the scenario start civ end-to-end', () => {
  it('a ?civ=Goths override lets owner 1 train the discounted (Goths) Militia', () => {
    // The control fixture is Persians with 50 food / 15 gold — it CANNOT afford
    // the base Militia (60/20). Overriding owner 1 to Goths applies the −35%
    // infantry discount, so the Militia (39/13) becomes affordable and is charged.
    const overridden = createSimulationBridge('civ-goths-cost-control-fixture', {
      civilizationsByOwner: new Map([[1, 'Goths']]),
    });
    expect(overridden.selectEntityAtCell(4, 10)).toBe(true); // Barracks
    expect(overridden.queueTrainUnit('militia')).toBe(true);
    overridden.step(100);
    const res = overridden.getEconomyState().playerResources[1];
    expect(res.food).toBe(11);
    expect(res.gold).toBe(2);

    // Sanity: WITHOUT the override the same fixture (Persians) cannot afford it.
    const control = createSimulationBridge('civ-goths-cost-control-fixture');
    expect(control.selectEntityAtCell(4, 10)).toBe(true);
    expect(control.queueTrainUnit('militia')).toBe(false);
  });
});
