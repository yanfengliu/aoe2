// Sourced-bonus rounds six through nine (v0.3.149-152) — split from
// civBonusBreadth.test.ts at the 500-line gate; same conventions.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import { effectiveTrainingCost } from '../../src/game/simulation/civBonusEffects';

const NONE = new Set<never>() as ReadonlySet<never>;

describe('round-six bonuses (sourced v0.3.149)', () => {
  it('Spanish builders work 30% faster, composing with Treadmill Crane', async () => {
    const { buildRateMultiplier } = await import('../../src/game/simulation/buildingTechEffects');
    expect(buildRateMultiplier(NONE, 'Spanish')).toBeCloseTo(1.3, 5);
    expect(buildRateMultiplier(new Set(['treadmill-crane']), 'Spanish')).toBeCloseTo(1.56, 5);
    expect(buildRateMultiplier(NONE, 'Britons')).toBe(1);
  });

  it('a completed Spanish research pays +20 gold into the stockpile', () => {
    const spanish = createSimulationBridge('feudal-blacksmith-fixture', {
      civilizationsByOwner: new Map([[1, 'Spanish'], [2, 'Spanish']]),
    });
    const goldBefore = spanish.getEconomyState().playerResources[1]!.gold;
    expect(selectOwnedBuildingDirect(spanish, 1, 'blacksmith')).toBe(true);
    expect(spanish.queueResearch('fletching')).toBe(true);
    expect(stepBridgeUntil(
      spanish,
      // Blacksmith upgrades cost the Spanish no gold, so the ONLY gold
      // movement is the +20 completion grant.
      () => spanish.getEconomyState().playerResources[1]!.gold === goldBefore + 20,
      { maxSteps: 600 },
    )).toBe(true);
  }, 30_000);

  it('the Inca villager-armor clause starts in the Castle Age', async () => {
    const { civVillagersTakeInfantryArmor } = await import('../../src/game/simulation/civBonusEffects');
    expect(civVillagersTakeInfantryArmor('Incas', 'feudal-age')).toBe(false);
    expect(civVillagersTakeInfantryArmor('Incas', 'castle-age')).toBe(true);
    expect(civVillagersTakeInfantryArmor('Britons', 'imperial-age')).toBe(false);
  });
});

describe('round-eight bonuses (sourced v0.3.151)', () => {
  it('discounts the Korean wood components', () => {
    expect(effectiveTrainingCost('Koreans', 'castle-age', 'archer', NONE))
      .toEqual({ wood: 13, gold: 45 });
    expect(effectiveTrainingCost('Koreans', 'feudal-age', 'militia', NONE))
      .toEqual({ food: 60, gold: 20 });
    expect(effectiveTrainingCost('Koreans', 'feudal-age', 'galley', NONE))
      .toEqual({ wood: 72, gold: 30 });
  });

  it('Goths research Loom instantly; Vietnamese halve eco research; Persians speed the TC by age', async () => {
    const { teamResearchTimeMultiplier } = await import('../../src/game/simulation/bridge/teamProductionBonuses');
    const { playerCivilizationsCodec, playerTeamsCodec, playerAgesCodec } = await import('../../src/game/simulation/bridge/bridgeStateSerialize');
    const fake = (civ: string, age = 'castle-age') => ({
      get: (codec: unknown) => {
        if (codec === playerCivilizationsCodec) return new Map([[1, civ]]);
        if (codec === playerTeamsCodec) return new Map();
        if (codec === playerAgesCodec) return new Map([[1, age]]);
        throw new Error('unexpected codec');
      },
    }) as never;
    expect(teamResearchTimeMultiplier(fake('Goths'), 1, 'town-center', 'loom')).toBe(0);
    expect(teamResearchTimeMultiplier(fake('Vietnamese'), 1, 'mill', 'bow-saw')).toBeCloseTo(0.5, 5);
    expect(teamResearchTimeMultiplier(fake('Vietnamese'), 1, 'barracks', 'squires')).toBe(1);
    expect(teamResearchTimeMultiplier(fake('Persians', 'imperial-age'), 1, 'town-center', 'wheelbarrow')).toBeCloseTo(1 / 1.2, 5);
    expect(teamResearchTimeMultiplier(fake('Persians'), 1, 'blacksmith', 'forging')).toBe(1);
  });

  it('Mayan nodes outlast a control node under the same harvest', () => {
    const mayans = createSimulationBridge('queued-orders-fixture', {
      civilizationsByOwner: new Map([[1, 'Mayans']]),
    });
    const control = createSimulationBridge('queued-orders-fixture', {
      civilizationsByOwner: new Map([[1, 'Saracens']]),
    });
    for (const bridge of [mayans, control]) {
      const bush = bridge.getEconomyState().resources.find((r) => r.x === 13 && r.y === 12)!;
      const villager = bridge.getEconomyState().units.find(
        (u) => u.owner === 1 && u.unitType === 'villager',
      )!;
      expect(bridge.selectUnitsByIds([villager.id])).toBe(true);
      expect(bridge.issueContextCommandAtEntity(bush.id)).toBe(true);
      for (let i = 0; i < 300; i += 1) bridge.step(100);
    }
    const amountAt = (bridge: typeof control) => bridge.getEconomyState().resources.find(
      (r) => r.x === 13 && r.y === 12,
    )?.amount ?? 0;
    // Same 20-food bush, same harvest window: the Mayan node holds more.
    expect(amountAt(mayans)).toBeGreaterThan(amountAt(control));
  }, 30_000);
});

describe('round-nine armor ladders (sourced v0.3.152)', () => {
  it('Malian barracks pierce and Teuton melee step by age; Berber villagers ramp at Feudal', async () => {
    const { civMeleeArmorBonus, civPierceArmorBonus } = await import('../../src/game/simulation/civBonusEffects');
    expect(civPierceArmorBonus('Malians', 'militia', 'feudal-age')).toBe(1);
    expect(civPierceArmorBonus('Malians', 'halberdier', 'imperial-age')).toBe(3);
    expect(civPierceArmorBonus('Malians', 'archer', 'imperial-age')).toBe(0);
    expect(civMeleeArmorBonus('Teutons', 'militia', 'castle-age')).toBe(1);
    expect(civMeleeArmorBonus('Teutons', 'knight', 'imperial-age')).toBe(2);
    expect(civMeleeArmorBonus('Teutons', 'archer', 'imperial-age')).toBe(0);
    expect(civMeleeArmorBonus('Teutons', 'militia', 'feudal-age')).toBe(0);
    const { movementSpeedPercent } = await import('../../src/game/simulation/movementTechEffects');
    const NONE2 = new Set<never>() as ReadonlySet<never>;
    const dark = movementSpeedPercent(NONE2, 'villager', 'Berbers', 'dark-age');
    const feudal = movementSpeedPercent(NONE2, 'villager', 'Berbers', 'feudal-age');
    expect(feudal).toBeGreaterThan(dark);
    expect(dark).toBeGreaterThan(movementSpeedPercent(NONE2, 'villager', 'Britons', 'dark-age'));
  });

  it('a Teuton knight is born with its Castle-Age melee armor', () => {
    const teutons = createSimulationBridge('unit-showcase-fixture', {
      civilizationsByOwner: new Map([[1, 'Teutons']]),
    });
    const plain = createSimulationBridge('unit-showcase-fixture');
    const armorOf = (bridge: typeof plain) => bridge.getEconomyState().units.find(
      (unit) => unit.unitType === 'knight',
    )!.armor;
    // unit-showcase is an Imperial fixture: +2 over the control.
    expect(armorOf(teutons)).toBe(armorOf(plain) + 2);
  });
});
