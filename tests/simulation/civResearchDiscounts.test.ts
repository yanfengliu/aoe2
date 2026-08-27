// Civ RESEARCH-COST bonuses (sourced v0.3.147) — the audit's last big shared
// seam. Verified verbatim in the DE help texts: Chinese "Technologies cost
// -5/10/15% in Feudal/Castle/Imperial Age", Italians "Dock and University
// technologies cost -25%" and "Advancing to the next Age costs -15%",
// Byzantines "Advancing to Imperial Age costs -33%", Turks "Gunpowder
// technologies costs -50%", Spanish "Blacksmith upgrades cost no gold",
// Vietnamese "Economic upgrades cost no wood".

import { describe, expect, it } from 'vitest';

import { effectiveResearchCost } from '../../src/game/simulation/civBonusEffects';
import { researchCost } from '../../src/game/simulation/prototypeEconomyRules';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedBuildingDirect } from './createSimulationBridge.helpers';

describe('effectiveResearchCost (pure)', () => {
  it('scales the Chinese ladder by age over every technology', () => {
    const base = researchCost('fletching');
    expect(effectiveResearchCost('Chinese', 'feudal-age', 'fletching'))
      .toEqual({ food: Math.round((base.food ?? 0) * 0.95), gold: Math.round((base.gold ?? 0) * 0.95) });
    expect(effectiveResearchCost('Chinese', 'imperial-age', 'fletching'))
      .toEqual({ food: Math.round((base.food ?? 0) * 0.85), gold: Math.round((base.gold ?? 0) * 0.85) });
    // Dark Age: no discount yet.
    expect(effectiveResearchCost('Chinese', 'dark-age', 'loom')).toEqual(researchCost('loom'));
  });

  it('discounts Italian dock/university techs and age advances', () => {
    const careening = researchCost('careening');
    expect(effectiveResearchCost('Italians', 'castle-age', 'careening'))
      .toEqual({ food: Math.round((careening.food ?? 0) * 0.75), gold: Math.round((careening.gold ?? 0) * 0.75) });
    const castleAge = researchCost('castle-age');
    expect(effectiveResearchCost('Italians', 'feudal-age', 'castle-age'))
      .toEqual({ food: Math.round((castleAge.food ?? 0) * 0.85), gold: Math.round((castleAge.gold ?? 0) * 0.85) });
    // A barracks tech is untouched.
    expect(effectiveResearchCost('Italians', 'castle-age', 'squires')).toEqual(researchCost('squires'));
  });

  it('gives Byzantines a third off the Imperial Age alone', () => {
    const imperial = researchCost('imperial-age');
    expect(effectiveResearchCost('Byzantines', 'castle-age', 'imperial-age'))
      .toEqual({ food: Math.round((imperial.food ?? 0) * 0.67), gold: Math.round((imperial.gold ?? 0) * 0.67) });
    expect(effectiveResearchCost('Byzantines', 'feudal-age', 'castle-age')).toEqual(researchCost('castle-age'));
  });

  it('halves Turkish gunpowder technologies and zeroes Spanish blacksmith gold', () => {
    const unlock = researchCost('bombard-tower-unlock');
    expect(effectiveResearchCost('Turks', 'imperial-age', 'bombard-tower-unlock'))
      .toEqual({ food: Math.round((unlock.food ?? 0) * 0.5), wood: Math.round((unlock.wood ?? 0) * 0.5) });
    const bodkin = researchCost('bodkin-arrow');
    const spanish = effectiveResearchCost('Spanish', 'castle-age', 'bodkin-arrow');
    expect(spanish.food).toBe(bodkin.food);
    expect(spanish.gold ?? 0).toBe(0);
  });

  it('zeroes Vietnamese wood on economic upgrades only', () => {
    const bowSaw = researchCost('bow-saw');
    const viet = effectiveResearchCost('Vietnamese', 'feudal-age', 'bow-saw');
    expect(viet.wood ?? 0).toBe(0);
    expect(viet.food).toBe(bowSaw.food);
    expect(effectiveResearchCost('Vietnamese', 'castle-age', 'squires')).toEqual(researchCost('squires'));
  });

  it('leaves everyone else at the table price', () => {
    expect(effectiveResearchCost('Britons', 'imperial-age', 'fletching')).toEqual(researchCost('fletching'));
    expect(effectiveResearchCost(undefined, 'imperial-age', 'fletching')).toEqual(researchCost('fletching'));
  });
});

describe('the discount reaches the live charge', () => {
  it('a Spanish blacksmith researches Fletching without spending gold', () => {
    const spanish = createSimulationBridge('feudal-blacksmith-fixture', {
      civilizationsByOwner: new Map([[1, 'Spanish'], [2, 'Spanish']]),
    });
    const goldBefore = spanish.getEconomyState().playerResources[1]!.gold;
    expect(selectOwnedBuildingDirect(spanish, 1, 'blacksmith')).toBe(true);
    expect(spanish.queueResearch('fletching')).toBe(true);
    spanish.step(100);
    expect(spanish.getEconomyState().playerResources[1]!.gold).toBe(goldBefore);
  });
});
