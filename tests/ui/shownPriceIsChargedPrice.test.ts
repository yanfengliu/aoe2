// @vitest-environment jsdom

// A price the HUD shows is the price the game charges (spec §14.2, work 125).
//
// The train button's tooltip read the base table (`trainingCost`) while the
// queue charged the owner's price (`effectiveTrainingCost`), so an Italian
// Fishing Ship said 75 wood and cost 64. Each case here mounts the REAL
// selection panel over a REAL bridge with the HUD's own wiring, reads the
// price off the rendered control, then pushes the same control and reads what
// the stockpile lost. The whole-table census is shownPriceCensus.test.ts; these
// are the cases a census of fixed seats cannot reach: a price that moves while
// the selection stands still, and the refusal a player reads instead of a
// price.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { selectOwnedBuildingDirect } from '../simulation/createSimulationBridge.helpers';
import {
  bootBlob,
  FULL_PURSE,
  mountSelectionPanel,
  purseOf,
  selectBuilding,
  shownCost,
  spentBetween,
  standSeat,
} from './shownPrice.helpers';

// A Vikings Castle in the Imperial Age facing three enemy villagers: Spies is
// priced 200 gold per one of them, so this fixture tells the live figure from
// the table's 200 (src/game/simulation/fixtures/vikingsRegeneration.ts).
const castleBlob = (): string => bootBlob('castle-facing-villagers', 'vikings-regeneration-fixture');

function spiesTooltip(panel: ReturnType<typeof mountSelectionPanel>): string {
  const button = panel.host.querySelector<HTMLButtonElement>('[data-command="research-spies"]');
  expect(button, 'the Castle draws no Research Spies button').not.toBeNull();
  return button!.dataset.tooltip ?? '';
}

describe('a shown price is the charged price', () => {
  it('quotes an Italian Fishing Ship at the 64 wood the Dock charges, not the 75 in the table', () => {
    const bridge = createSimulationBridge('naval-fixture', {
      civilizationsByOwner: new Map([[1, 'Italians'], [2, 'Britons']]),
    });
    const panel = mountSelectionPanel(bridge);
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    panel.refresh();

    const button = panel.host.querySelector<HTMLButtonElement>('[data-command="train-fishing-ship"]');
    expect(button, 'the Dock draws no Train Fishing Ship button').not.toBeNull();
    const tooltip = button!.dataset.tooltip ?? '';
    const shown = shownCost(tooltip);

    const before = purseOf(bridge);
    button!.click();
    bridge.step(100);
    const charged = spentBetween(before, purseOf(bridge));
    expect(charged, 'Fishing Ships cost the Italians 15% less: 75 wood x 0.85 = 64').toEqual({ wood: 64 });
    expect(shown, `the button says "${tooltip}" and the Dock charged ${JSON.stringify(charged)}`).toEqual(charged);
    panel.destroy();
  });

  it.each([
    ...CIVILIZATION_NAMES.map((civilization) => [civilization, [] as string[], 600] as const),
    // Atheism is the Huns' own technology: "Spies costs half".
    ['Huns', ['atheism'], 300] as const,
  ])('quotes a %s seat holding %j the live Spies price (%i gold for three enemy villagers) it charges', (civilization, researched, price) => {
    const bridge = standSeat({ blob: castleBlob(), civilization, age: 'imperial-age', researched });
    const panel = mountSelectionPanel(bridge);
    expect(selectBuilding(bridge, 'castle')).toBe(true);
    panel.refresh();
    const tooltip = spiesTooltip(panel);
    expect(shownCost(tooltip), `the Spies button says "${tooltip}"`).toEqual({ gold: price });

    const before = purseOf(bridge);
    panel.host.querySelector<HTMLButtonElement>('[data-command="research-spies"]')!.click();
    expect(bridge.consumeCommandRejection()).toBeNull();
    bridge.step(100);
    expect(spentBetween(before, purseOf(bridge)), `the Spies button says "${tooltip}"`).toEqual({ gold: price });
    panel.destroy();
  });

  it('keeps quoting the live Spies price while the Castle stays selected and the enemy grows', () => {
    const bridge = standSeat({
      blob: castleBlob(), civilization: 'Britons', age: 'imperial-age', researched: [], enemyPurse: FULL_PURSE,
    });
    const panel = mountSelectionPanel(bridge);
    expect(selectBuilding(bridge, 'castle')).toBe(true);
    panel.refresh();
    expect(shownCost(spiesTooltip(panel))).toEqual({ gold: 600 });

    // The enemy trains a fourth villager. Its command goes to the world, as
    // its own seat's would; the human's selection never moves.
    const enemyTownCenter = bridge.getEconomyState().buildings.find(
      (building) => building.owner === 2 && building.buildingType === 'town-center',
    )!;
    expect(bridge.world.submitWithResult('queue.train', {
      buildingId: enemyTownCenter.id,
      unitType: 'villager',
    }).accepted, 'the enemy Town Center refused a villager').toBe(true);
    const villagers = (): number => bridge.getEconomyState().units
      .filter((unit) => unit.owner === 2 && unit.unitType === 'villager').length;
    for (let tick = 0; tick < 600 && villagers() < 4; tick += 1) {
      bridge.step(100);
      panel.refresh();
    }
    expect(villagers(), 'the enemy villager never arrived').toBe(4);
    expect(bridge.getSelectionState().selectedEntityType).toBe('castle');
    expect(shownCost(spiesTooltip(panel)), 'the quote did not follow the price').toEqual({ gold: 800 });
    panel.destroy();
  });

  it('refuses an Inca Militia by the resource that is really short, as its button says', () => {
    // Dark Age Incas pay 15% less food for military units: a Militia is 43
    // food and 20 gold, not the table's 50 and 20. Holding 45 food and 10 gold,
    // the food is enough and the gold is not, so "Not enough food" — what the
    // base table would say — would name a resource the player already has.
    const bridge = standSeat({
      blob: bootBlob('showcase', 'building-showcase-fixture'),
      civilization: 'Incas',
      age: 'dark-age',
      researched: [],
      purse: { ...FULL_PURSE, food: 45, gold: 10 },
    });
    const panel = mountSelectionPanel(bridge);
    expect(selectBuilding(bridge, 'barracks')).toBe(true);
    panel.refresh();
    const button = panel.host.querySelector<HTMLButtonElement>('[data-command="train-militia"]')!;
    expect(shownCost(button.dataset.tooltip ?? '')).toEqual({ food: 43, gold: 20 });
    expect(button.dataset.commandReason).toBe('Not enough gold.');

    button.click();
    expect(bridge.consumeCommandRejection()).toBe('Not enough gold.');
    panel.destroy();
  });

  // The two validators that gated a price the click does not charge. Every
  // census seat pays from a purse nothing can exhaust, so only a purse between
  // the two prices tells them apart.
  it('refuses Spies at its live price with 300 gold against 600, as its button says, and takes nothing', () => {
    const bridge = standSeat({
      blob: castleBlob(), civilization: 'Britons', age: 'imperial-age', researched: [],
      purse: { ...FULL_PURSE, gold: 300 },
    });
    const panel = mountSelectionPanel(bridge);
    expect(selectBuilding(bridge, 'castle')).toBe(true);
    panel.refresh();
    const button = panel.host.querySelector<HTMLButtonElement>('[data-command="research-spies"]')!;
    expect(shownCost(button.dataset.tooltip ?? '')).toEqual({ gold: 600 });
    expect(button.dataset.commandReason).toBe('Not enough gold.');

    const before = purseOf(bridge);
    button.click();
    // Gated at the table's 200-gold floor, the click was accepted and the
    // charge then refused it silently: no toast, and nothing researched.
    expect(bridge.consumeCommandRejection(), 'the click was not refused').toBe('Not enough gold.');
    bridge.step(100);
    expect(spentBetween(before, purseOf(bridge))).toEqual({});
    panel.destroy();
  });

  it('lets a Guilds Market buy 100 food for the 115 gold it charges, from 120 gold at a rate of 100', () => {
    const bridge = standSeat({
      blob: bootBlob('showcase', 'building-showcase-fixture'), civilization: 'Britons', age: 'imperial-age',
      researched: ['guilds'], purse: { ...FULL_PURSE, gold: 120 },
    });
    const panel = mountSelectionPanel(bridge);
    expect(selectBuilding(bridge, 'market')).toBe(true);
    panel.refresh();
    const buy = panel.host.querySelector<HTMLButtonElement>('[data-command="market-buy-food"]')!;
    expect(buy.dataset.commandReason, 'the buy says it is short of gold').toBeUndefined();

    const before = purseOf(bridge);
    buy.click();
    // Gated at the un-teched 30% (130 gold), this buy was refused.
    expect(bridge.consumeCommandRejection(), 'the buy was refused').toBeNull();
    bridge.step(100);
    expect(spentBetween(before, purseOf(bridge)), 'gold paid, food gained').toEqual({ food: -100, gold: 115 });
    panel.destroy();
  });
});
