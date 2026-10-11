// Civilization bonuses measured in a match against current Definitive Edition
// (work 120; defect register 2026-10-11, "Civilization bonuses the code applied
// differently from Definitive Edition"). Each case boots the real bridge as the
// civilization under test and as a control civilization with no bonus on the
// thing measured, so the difference between the two runs is the bonus as a
// player meets it.
//
// SOURCE: the civilization help texts in SiegeEngineers/aoe2techtree
// data/locales/en/strings.json at 3bb43b14 (DE update 185872; the file's
// SHA-256 is pinned in tests/content/fixtures/deProjectileStats.json):
//   Hindustanis, team bonus: "Scout Cavalry-line and Camel Units +2 attack vs. buildings"
//   Aztecs: "Military Units train +15% faster"
//   Incas: "Villagers affected by Infantry Blacksmith upgrades starting in Castle Age"
//   Goths: "Hunters carry +15; hunted animals last +20% longer"
//   Mayans: "Resources last +15% longer"
//
// BOUNDS: one fixture and one owner per bonus, with no technology except where
// named. The tables behind these bonuses are checked for every unit and
// resource kind in civBonusDeParity.test.ts, and the age-up sweep against the
// factory in ageUpSweepMatchesFactory.test.ts; this file shows the bridge
// applies them where a player sees them. Allies are not booted here.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedBuildingDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function boot(seed: string, civilization: string): Bridge {
  return createSimulationBridge(seed, { civilizationsByOwner: new Map([[1, civilization]]) });
}

describe('Indian Scout line against buildings (team bonus, counted once)', () => {
  // The defect: the Indians entry in CIV_BONUSES added +2 and the team seam
  // added the same +2 for the owner's side, so the owner's Scout dealt +4.
  function firstHitOnHouse(civilization: string): number {
    const bridge = boot('fog-memory-fixture', civilization);
    const house = bridge.getEconomyState().buildings.find((b) => b.owner === 2 && b.buildingType === 'house');
    const scout = bridge.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === 'scout');
    if (!house || !scout) throw new Error('fog-memory-fixture has no enemy house or own scout');
    const hp0 = bridge.getEntityHealth(house.id)!.currentHp;
    expect(bridge.selectUnitsByIds([scout.id])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(house.id), 'the scout was refused the attack').toBe(true);
    expect(
      stepBridgeUntil(bridge, () => bridge.getEntityHealth(house.id)!.currentHp < hp0, { maxSteps: 300 }),
      'the scout never hit the house',
    ).toBe(true);
    return hp0 - bridge.getEntityHealth(house.id)!.currentHp;
  }

  it('hits a building for exactly 2 more than a Briton Scout', () => {
    expect(firstHitOnHouse('Indians') - firstHitOnHouse('Britons')).toBe(2);
  });
});

describe('Aztec train speed reaches Military Units only', () => {
  function ticksToFishingShip(civilization: string): number {
    const bridge = boot('naval-fixture', civilization);
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    const ships = () => bridge.getEconomyState().units
      .filter((u) => u.owner === 1 && u.unitType === 'fishing-ship').length;
    const before = ships();
    expect(bridge.queueTrainUnit('fishing-ship')).toBe(true);
    let ticks = 0;
    while (ships() === before && ticks < 1_000) {
      bridge.step(100);
      ticks += 1;
    }
    expect(ships(), `no Fishing Ship appeared for ${civilization}`).toBe(before + 1);
    return ticks;
  }

  it('an Aztec Dock trains a Fishing Ship in the same time as a control Dock', () => {
    expect(ticksToFishingShip('Aztecs')).toBe(ticksToFishingShip('Britons'));
  });
});

describe('Inca villagers take the infantry armor already researched when the Castle Age lands', () => {
  it('a villager standing at the advance wears the Feudal Scale Mail, as one trained after it does', () => {
    const bridge = boot('castle-age-fixture', 'Incas');
    const villagers = () => bridge.getEconomyState().units.filter((u) => u.owner === 1 && u.unitType === 'villager');
    const standing = villagers()[0]!;
    const armorOf = (id: number) => bridge.getEconomyState().units.find((u) => u.id === id)!.armor;

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('scale-mail-armor')).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getResearchedTechnologies(1).includes('scale-mail-armor'),
      { maxSteps: 900 },
    )).toBe(true);
    // DE's clause starts in the Castle Age, so the Feudal research passes the
    // villagers by.
    expect(armorOf(standing.id)).toBe(0);

    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    expect(bridge.queueResearch('castle-age')).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().ages[1] === 'castle-age',
      { maxSteps: 2_500 },
    )).toBe(true);
    expect(armorOf(standing.id), 'the standing villager missed the Scale Mail').toBe(1);

    expect(bridge.queueTrainUnit('villager')).toBe(true);
    expect(stepBridgeUntil(bridge, () => villagers().length === 2, { maxSteps: 600 })).toBe(true);
    const trained = villagers().find((u) => u.id !== standing.id)!;
    expect(armorOf(trained.id)).toBe(armorOf(standing.id));
  }, 30_000);
});

describe('"Last longer" bonuses run out like any other node', () => {
  // The defect: a swing was capped by the node's remaining amount but took off
  // only that amount divided by the bonus, so a node below one swing shrank by
  // a fixed fraction per swing and took hundreds of swings to reach zero.
  function stepsToEmptyBush(civilization: string, cap: number): number {
    const bridge = boot('queued-orders-fixture', civilization);
    const bush = bridge.getEconomyState().resources.find((r) => r.x === 13 && r.y === 12)!;
    const villager = bridge.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === 'villager')!;
    expect(bridge.selectUnitsByIds([villager.id])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(bush.id)).toBe(true);
    const gone = () => (bridge.getEconomyState().resources.find((r) => r.id === bush.id)?.amount ?? 0) <= 0;
    let steps = 0;
    while (!gone() && steps < cap) {
      bridge.step(100);
      steps += 1;
    }
    return steps;
  }

  it('a Mayan villager empties a bush about 15% later than a control, not twenty minutes later', () => {
    const control = stepsToEmptyBush('Saracens', 3_000);
    expect(control).toBeLessThan(3_000);
    const mayans = stepsToEmptyBush('Mayans', 3_000);
    // 23 swings against 20, plus the same two walks to the Mill.
    expect(mayans).toBeGreaterThan(control);
    expect(mayans).toBeLessThan(control * 1.25);
  }, 30_000);

  it('Goth hunters take 20% more food out of a boar than a control side, in about the same time', () => {
    function huntBoar(civilization: string): { food: number; gatherSteps: number } {
      // Owner 2 stays home: a raid on a hunter carrying meat would lose food.
      const bridge = createSimulationBridge('boar-hunt-fixture', {
        civilizationsByOwner: new Map([[1, civilization]]),
        disableAiForOwners: new Set([2]),
      });
      const boar = bridge.getEconomyState().resources.find((r) => r.resourceType === 'boar')!;
      const hunters = bridge.getEconomyState().units.filter((u) => u.owner === 1 && u.unitType === 'villager').map((u) => u.id);
      const food0 = bridge.getEconomyState().playerResources[1]!.food;
      // A live boar is killed first, then its carcass is gathered: two orders
      // (spec §6.4, "Hunting parties").
      expect(bridge.selectUnitsByIds(hunters)).toBe(true);
      expect(bridge.issueContextCommandAtEntity(boar.id)).toBe(true);
      const boarDead = () => bridge.getRenderState().entities.find((e) => e.id === boar.id)?.wildlifeAlive === false;
      expect(stepBridgeUntil(bridge, boarDead, { maxSteps: 600 }), `${civilization} never killed the boar`).toBe(true);
      const living = bridge.getEconomyState().units.filter((u) => hunters.includes(u.id)).map((u) => u.id);
      expect(bridge.selectUnitsByIds(living)).toBe(true);
      expect(bridge.issueContextCommandAtEntity(boar.id)).toBe(true);
      const boarLeft = () => bridge.getEconomyState().resources.find((r) => r.id === boar.id)?.amount ?? 0;
      let gatherSteps = 0;
      while (boarLeft() > 0 && gatherSteps < 8_000) {
        bridge.step(100);
        gatherSteps += 1;
      }
      expect(boarLeft(), `${civilization} never emptied the boar`).toBe(0);
      // Every hunter walks its last load home; the boar is the only food here.
      for (let i = 0; i < 600; i += 1) bridge.step(100);
      return { food: bridge.getEconomyState().playerResources[1]!.food - food0, gatherSteps };
    }
    const control = huntBoar('Saracens');
    const goths = huntBoar('Goths');
    expect(control.food).toBeCloseTo(340, 6);
    expect(goths.food).toBeCloseTo(340 * 1.2, 6);
    // A fifth more food at the same rate, in fewer trips (they carry +15):
    // measured 2,014 steps against 2,047. A carcass shrinking by a fraction
    // per swing at the end took 5,396.
    expect(goths.gatherSteps).toBeLessThan(control.gatherSteps * 1.25);
  }, 60_000);
});
