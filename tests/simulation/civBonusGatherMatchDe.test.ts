// Civilization bonuses on gathering do what Definitive Edition's do (work 120
// M4; defect register 2026-10-14, "Four Definitive Edition civilization bonuses
// had no implementation").
//
// SOURCE: the civilization help texts in SiegeEngineers/aoe2techtree
// data/locales/en/strings.json at 3bb43b14 (DE update 185872):
//  - Portuguese: "Foragers generate wood in addition to food"
//  - Khmer: "Farmers don't require Mills or Town Centers to drop off food"
// Neither text gives a rate or a method, so both come from DE's own patch notes
// on ageofempires.com:
//  - update 73855 (2022-12-07), Portuguese: "New Civ Bonus (replaces faster
//    tech civ bonus) – Foragers generate a trickle of wood (33%)." DE's data
//    holds the percent as 33.33 of the forager's work rate (resource 267,
//    "Foraging Wood Productivity"), paid while it gathers, not at a drop-off.
//  - update 34699 (2020-01-21), Khmer: "Farmers no longer require Mills or
//    Town Centers to drop off food."; update 42848 (2020-11-17): "Further
//    reduced the work rate of Khmer Farmers from -3% ▶ -5%."; update 185872
//    (2026-09-22) names the mechanism, the gather task's "auto-collection".
//
// THE DEFECTS: neither bonus had an implementation. A Portuguese forager
// earned no wood, and a Khmer farmer carried its food to a Mill or a Town
// Center like anyone else's, and with neither standing it filled its hands and
// stood still.
//
// THE CLASS: a civilization's gathering bonus that DE has and this build does
// not. Each census walks every resource kind through the seams the gather loop
// reads, against the Britons, whose only gathering bonus is on sheep; the
// match checks drive one villager through the right-click path and read the
// stockpile.
//
// BOUNDS: owner 1 is a human, so a deposit is not scaled by an AI difficulty;
// the pure cases cover that scaling. A forager's wood waits on the villager in
// ten-thousandths of a unit until it makes a whole one, and a game saved
// before this change has none waiting. DE's other forage bushes (fruit bushes,
// papaya trees) are not in this build.

import { describe, expect, it } from 'vitest';

import { creditGatherSwing } from '../../src/game/simulation/bridge/systems/gatherCredit';
import { civGatherRateMultiplier } from '../../src/game/simulation/civBonusEffects';
import { civCollectsWithoutDropOff, civGatherSideIncome } from '../../src/game/simulation/civGatherBonuses';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { EconomyResourceKind, GathererComponent, PlayerResources, ResourceKind } from '../../src/game/simulation/types';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;
interface Cell { readonly x: number; readonly y: number }

// Every resource kind: the compiler holds the list complete.
const EVERY_KIND = Object.keys({
  'berry-bush': 0, 'gold-mine': 0, 'stone-mine': 0, boar: 0, deer: 0, fish: 0,
  sheep: 0, wolf: 0, tree: 0, relic: 0, farm: 0,
} satisfies Record<ResourceKind, 0>) as ResourceKind[];

const FORAGER: Cell = { x: 9, y: 6 };
const BUSH: Cell = { x: 10, y: 6 };
const FARMER: Cell = { x: 19, y: 12 };
const FARM: Cell = { x: 20, y: 12 };

function villagerOf(bridge: Bridge) {
  const villager = bridge.getEconomyState().villagers.find((v) => v.owner === 1);
  expect(villager).toBeDefined();
  return villager!;
}

function stockpileOf(bridge: Bridge) {
  return bridge.getEconomyState().playerResources[1]!;
}

/** Owner 1's villager, given a right-click on the node, as a player gives it. */
function gatherer(fixture: string, civilization: string, villager: Cell, node: Cell): Bridge {
  const bridge = createSimulationBridge(fixture, { civilizationsByOwner: new Map([[1, civilization]]) });
  expect(bridge.selectEntityAtCell(villager.x, villager.y)).toBe(true);
  expect(bridge.issueContextCommand(node.x, node.y)).toBe(true);
  return bridge;
}

describe('the seams the gather loop reads give each bonus to DE\'s kind alone', () => {
  it('Portuguese gatherers earn wood beside what they take from forage bushes alone, 33.33% of it', () => {
    for (const kind of EVERY_KIND) {
      expect(civGatherSideIncome('Portuguese', kind), kind)
        .toEqual(kind === 'berry-bush' ? { resource: 'wood', perUnit: 0.3333 } : null);
      expect(civGatherSideIncome('Britons', kind), kind).toBeNull();
    }
  });

  it('Khmer gatherers skip the drop-off, and work 5% slower, on farms alone', () => {
    for (const kind of EVERY_KIND) {
      expect(civCollectsWithoutDropOff('Khmer', kind), kind).toBe(kind === 'farm');
      expect(civCollectsWithoutDropOff('Britons', kind), kind).toBe(false);
      expect(civGatherRateMultiplier('Khmer', kind), kind).toBe(kind === 'farm' ? 0.95 : 1);
    }
  });
});

describe('a swing paid where the gatherer stands', () => {
  const EMPTY: PlayerResources = { food: 0, wood: 0, gold: 0, stone: 0 };
  function villager(carried?: { resource: EconomyResourceKind; amount: number }): GathererComponent {
    return {
      desiredResource: 'food', hasExplicitGatherOrder: true, task: 'gathering', targetResourceId: 1,
      dropOffBuildingId: null, carriedResource: carried?.resource ?? null, carriedAmount: carried?.amount ?? 0,
      carryCapacity: 10, gatherProgressTicks: 0,
    };
  }
  function swing(gatherer: GathererComponent, kind: ResourceKind, civilization: string, stockpile: PlayerResources, depositMultiplier = 1) {
    return creditGatherSwing({ gatherer, kind, amount: 1, civilization, stockpile, depositMultiplier });
  }

  it('scales a Khmer farmer\'s food by the AI difficulty as a drop-off does, to the unit over ten swings', () => {
    for (const [multiplier, expected] of [[1.3, 13], [0.7, 7], [1, 10]] as const) {
      const stockpile = { ...EMPTY };
      const farmer = villager();
      for (let i = 0; i < 10; i += 1) swing(farmer, 'farm', 'Khmer', stockpile, multiplier);
      expect(stockpile.food, `x${multiplier}`).toBe(expected);
      expect(farmer.carriedAmount).toBe(0);
    }
  });

  it('a Khmer farmer puts the food it holds in with its swing, and keeps another resource in its hands', () => {
    const stockpile = { ...EMPTY };
    const fromBerries = villager({ resource: 'food', amount: 5 });
    expect(swing(fromBerries, 'farm', 'Khmer', stockpile)).toEqual({ paid: 6, collected: true });
    expect([fromBerries.carriedResource, fromBerries.carriedAmount]).toEqual([null, 0]);
    const fromTrees = villager({ resource: 'wood', amount: 7 });
    expect(swing(fromTrees, 'farm', 'Khmer', stockpile)).toEqual({ paid: 1, collected: true });
    expect([fromTrees.carriedResource, fromTrees.carriedAmount]).toEqual(['wood', 7]);
    expect(stockpile).toEqual({ ...EMPTY, food: 7 });
  });

  it('scales a Portuguese forager\'s wood by the AI difficulty, as a drop-off scales its food', () => {
    // Ten food is 3.333 wood, 4.333 at x1.3 and 2.333 at x0.7.
    for (const [multiplier, expected] of [[1.3, 4], [0.7, 2], [1, 3]] as const) {
      const stockpile = { ...EMPTY };
      const forager = villager();
      for (let i = 0; i < 10; i += 1) swing(forager, 'berry-bush', 'Portuguese', stockpile, multiplier);
      expect(stockpile.wood, `x${multiplier}`).toBe(expected);
    }
  });

  it('pays nothing and keeps nothing for a civilization without these bonuses', () => {
    const stockpile = { ...EMPTY };
    for (const kind of EVERY_KIND) {
      const gatherer = villager();
      expect(swing(gatherer, kind, 'Britons', stockpile), kind).toEqual({ paid: 0, collected: false });
      expect(gatherer.creditTenThousandths, kind).toBeUndefined();
    }
    expect(stockpile).toEqual(EMPTY);
  });
});

describe('Portuguese foragers generate wood in addition to food', () => {
  it('a Portuguese forager has earned wood before its first load reaches the Town Center', () => {
    const handful = (civilization: string) => {
      const bridge = gatherer('civ-forager-fixture', civilization, FORAGER, BUSH);
      expect(stepBridgeUntil(bridge, () => villagerOf(bridge).carriedAmount >= 4, { maxSteps: 400 })).toBe(true);
      return { carried: villagerOf(bridge).carriedAmount, food: stockpileOf(bridge).food, wood: stockpileOf(bridge).wood };
    };
    // Four food in hand and none delivered: 4 x 33.33% is 1.33 wood, so one
    // whole wood is in the stockpile already. DE's wood is a trickle while the
    // forager works, not a bonus on the food it drops off.
    expect(handful('Portuguese')).toEqual({ carried: 4, food: 0, wood: 1 });
    expect(handful('Britons')).toEqual({ carried: 4, food: 0, wood: 0 });
  }, 60_000);

  it('earns 33.33% of the food it gathers in wood over a long stretch of foraging', () => {
    const bridge = gatherer('civ-forager-fixture', 'Portuguese', FORAGER, BUSH);
    for (let tick = 0; tick < 3000; tick += 1) bridge.step(100);
    const gathered = stockpileOf(bridge).food + villagerOf(bridge).carriedAmount;
    // Eight loads or more went to the Town Center, so most of this food did.
    expect(gathered).toBeGreaterThan(80);
    expect(stockpileOf(bridge).wood).toBe(Math.floor((gathered * 3333) / 10000));
  }, 60_000);

  it('a game saved between two wood keeps the part of a wood the forager had earned', () => {
    const bridge = gatherer('civ-forager-fixture', 'Portuguese', FORAGER, BUSH);
    expect(stepBridgeUntil(bridge, () => villagerOf(bridge).carriedAmount >= 3, { maxSteps: 400 })).toBe(true);
    // Three food is 0.9999 wood: none paid yet.
    expect(stockpileOf(bridge).wood).toBe(0);
    const loaded = createSimulationBridge('civ-forager-fixture', {
      savedGame: JSON.parse(JSON.stringify(bridge.saveGame())) as ReturnType<Bridge['saveGame']>,
    });
    expect(stepBridgeUntil(loaded, () => villagerOf(loaded).carriedAmount >= 4, { maxSteps: 100 })).toBe(true);
    // The fourth food takes it past one wood, as it does in a game never saved.
    expect(stockpileOf(loaded).wood).toBe(1);
  }, 60_000);

  it('a game saved before the forager\'s first drop-off keeps the wood it has been paid', () => {
    // Paid where the forager stands, the wood reaches the save only because
    // the payment marks the stockpile changed; nothing else did this tick.
    const bridge = gatherer('civ-forager-fixture', 'Portuguese', FORAGER, BUSH);
    expect(stepBridgeUntil(bridge, () => villagerOf(bridge).carriedAmount >= 4, { maxSteps: 400 })).toBe(true);
    expect(stockpileOf(bridge)).toMatchObject({ food: 0, wood: 1 });
    const loaded = createSimulationBridge('civ-forager-fixture', {
      savedGame: JSON.parse(JSON.stringify(bridge.saveGame())) as ReturnType<Bridge['saveGame']>,
    });
    expect(stockpileOf(loaded)).toMatchObject({ food: 0, wood: 1 });
  }, 60_000);
});

describe('Khmer farmers do not need a Mill or a Town Center to drop off food', () => {
  /** Owner 1's farmer works the Farm for `ticks`, with no building that takes food. */
  function farm(civilization: string, ticks: number) {
    const bridge = gatherer('civ-farmer-fixture', civilization, FARMER, FARM);
    let mostCarried = 0;
    for (let tick = 0; tick < ticks; tick += 1) {
      bridge.step(100);
      mostCarried = Math.max(mostCarried, villagerOf(bridge).carriedAmount);
    }
    const villager = villagerOf(bridge);
    return { food: stockpileOf(bridge).food, carried: villager.carriedAmount, mostCarried, task: villager.task };
  }

  it('anyone else\'s farmer fills its hands and has nowhere to take them', () => {
    expect(farm('Britons', 1500)).toEqual({ food: 0, carried: 10, mostCarried: 10, task: 'to-dropoff' });
  }, 60_000);

  it('a Khmer farmer puts its food in the stockpile as it works, carrying none, 5% slower than the base rate', () => {
    const khmer = farm('Khmer', 3000);
    expect(khmer.mostCarried).toBe(0);
    expect(khmer.task).toBe('gathering');
    // The base farmer gathers 1 food per 30 ticks; DE's Khmer farmer works 5%
    // slower (update 42848). 3000 ticks, less up to 60 to reach the Farm, is
    // 93 to 95 food at 95%, and 98 to 100 at the full rate.
    expect(khmer.food).toBeGreaterThanOrEqual(Math.floor((0.95 * (3000 - 60)) / 30));
    expect(khmer.food).toBeLessThanOrEqual(Math.floor((0.95 * 3000) / 30));
  }, 60_000);

  it('a Khmer farmer works its Farm on through a reseed without a step away from it', () => {
    const bridge = gatherer('civ-farmer-reseed-fixture', 'Khmer', FARMER, FARM);
    const tasks = new Set<string>();
    for (let tick = 0; tick < 600; tick += 1) {
      bridge.step(100);
      const { task } = villagerOf(bridge);
      if (tasks.size > 0 || task === 'gathering') tasks.add(task);
    }
    // The Farm's 6 food went in, the reseed took the 60 wood, and the farmer
    // worked the reseeded Farm on: about 19 food in 600 ticks at 95%.
    expect(stockpileOf(bridge).wood).toBe(0);
    expect(stockpileOf(bridge).food).toBeGreaterThan(6 + 8);
    expect([...tasks]).toEqual(['gathering']);
  }, 60_000);

  it('a game saved mid-farm loads with the food the Khmer farmer had paid in', () => {
    // No drop-off ever marks this stockpile changed: each payment must.
    const bridge = gatherer('civ-farmer-fixture', 'Khmer', FARMER, FARM);
    for (let tick = 0; tick < 600; tick += 1) bridge.step(100);
    const { food } = stockpileOf(bridge);
    expect(food).toBeGreaterThan(10);
    const loaded = createSimulationBridge('civ-farmer-fixture', {
      savedGame: JSON.parse(JSON.stringify(bridge.saveGame())) as ReturnType<Bridge['saveGame']>,
    });
    expect(stockpileOf(loaded).food).toBe(food);
  }, 60_000);

  it('a Khmer farmer an older save left holding 10 food with no drop-off pays it in when sent back to its Farm', () => {
    // Before this change a Khmer farmer carried its food like anyone's, so with
    // no Mill or Town Center it stood holding 10. A save of that moment, with
    // the owner's civilization written as the Khmer, is such a save.
    const before = gatherer('civ-farmer-fixture', 'Britons', FARMER, FARM);
    for (let tick = 0; tick < 1500; tick += 1) before.step(100);
    expect(villagerOf(before)).toMatchObject({ carriedAmount: 10, task: 'to-dropoff' });
    const blob = JSON.parse(JSON.stringify(before.saveGame())) as ReturnType<Bridge['saveGame']>;
    const state = (blob.worldSnapshot as unknown as { state: Record<string, unknown> }).state;
    state['aoe2.playerCivilizations'] = (state['aoe2.playerCivilizations'] as [number, string][])
      .map(([owner, civilization]) => [owner, owner === 1 ? 'Khmer' : civilization]);
    const loaded = createSimulationBridge('civ-farmer-fixture', { savedGame: blob });
    // Left alone it still stands there: it is on its way to a drop-off.
    for (let tick = 0; tick < 100; tick += 1) loaded.step(100);
    expect(villagerOf(loaded)).toMatchObject({ carriedAmount: 10, task: 'to-dropoff' });
    expect(stockpileOf(loaded).food).toBe(0);
    // Ordered back to its Farm, its first swing pays the 10 in.
    expect(selectOwnedUnitDirect(loaded, 1, 'villager')).toBe(true);
    expect(loaded.issueContextCommand(FARM.x, FARM.y)).toBe(true);
    expect(stepBridgeUntil(loaded, () => stockpileOf(loaded).food >= 10, { maxSteps: 200 })).toBe(true);
    expect(villagerOf(loaded)).toMatchObject({ carriedAmount: 0, task: 'gathering' });
  }, 60_000);
});
