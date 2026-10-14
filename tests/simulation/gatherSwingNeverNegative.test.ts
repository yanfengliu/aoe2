// A gather swing never takes a negative amount (work 120 M4's independent
// review, finding 1; defect register 2026-10-14, "Four Definitive Edition
// civilization bonuses had no implementation").
//
// THE DEFECT: a swing took `min(per-swing amount, what the node has left,
// carry - what the gatherer holds)`, and the last term goes below 0 when a
// gatherer holds more than the new resource lets it carry. A farmer with Heavy
// Plow ("Farmers carry +1 food") fills its hands with 11 food, and a forager
// may carry 10. Sent from its Farm to a berry bush, its first swing took -1:
// the bush GAINED a food and the hands lost one, for every civilization, which
// predates work 120. Beside it, a Portuguese forager's wood came to -0.3333,
// paid as -1 wood that the stockpile's save flag (`paid > 0`) never marked, so
// a save gave the wood back and a replay's self-check diverged.
//
// THE CLASS: a swing below 0. The census drives that farmer through the
// right-click path for every civilization but the Khmer, whose farmers hold
// nothing (civBonusGatherMatchDe.test.ts), and reads the bush, the hands and
// the wood on every tick after the order to forage.
//
// BOUNDS: one overflow, Heavy Plow's +1 against a forager's carry; a carry
// bonus on every resource (the Aztecs' +3) rides on both sides of it. A held
// load of ANOTHER resource is relabelled as the new one when gathering starts,
// a separate defect with a card of its own; the guard here only keeps such a
// swing from going below 0.

import { describe, expect, it } from 'vitest';

import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

const FARMER = { x: 19, y: 12 };
const FARM = { x: 20, y: 12 };
const BUSH = { x: 19, y: 14 };

/** Owner 1's farmer fills its hands at the Farm, then is right-clicked onto
 *  the bush; what the bush, the hands and the wood did on every tick after. */
function farmerSentToForage(civilization: string) {
  const bridge = createSimulationBridge('civ-farm-to-berries-fixture', {
    civilizationsByOwner: new Map([[1, civilization]]),
  });
  const villager = () => bridge.getEconomyState().villagers.find((v) => v.owner === 1)!;
  const bush = () => bridge.getEconomyState().resources.find((r) => r.resourceType === 'berry-bush')!.amount;
  const wood = () => bridge.getEconomyState().playerResources[1]!.wood;
  expect(bridge.selectEntityAtCell(FARMER.x, FARMER.y)).toBe(true);
  expect(bridge.issueContextCommand(FARM.x, FARM.y)).toBe(true);
  // No Mill or Town Center: the full farmer stands holding its load.
  expect(stepBridgeUntil(bridge, () => villager().task === 'to-dropoff', { maxSteps: 900 }), civilization).toBe(true);
  const held = villager().carriedAmount;
  const start = { bush: bush(), wood: wood() };
  expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
  expect(bridge.issueContextCommand(BUSH.x, BUSH.y)).toBe(true);
  let most = start.bush;
  let least = { wood: start.wood, held };
  let foraged = false;
  for (let tick = 0; tick < 200; tick += 1) {
    bridge.step(100);
    most = Math.max(most, bush());
    least = { wood: Math.min(least.wood, wood()), held: Math.min(least.held, villager().carriedAmount) };
    if (villager().task === 'gathering') foraged = true;
  }
  return { held, start, most, least, foraged, endTask: villager().task };
}

describe('a gather swing never takes a negative amount', () => {
  it('a Portuguese farmer holding 11 food, sent to a berry bush, loses no wood and adds nothing to the bush', () => {
    const run = farmerSentToForage('Portuguese');
    // Heavy Plow's 11 against a forager's 10, and the swing came round: the
    // forager worked the bush, then turned for home with its hands full.
    expect(run.held).toBe(11);
    expect(run.foraged).toBe(true);
    expect(run.endTask).toBe('to-dropoff');
    expect(run.least.wood).toBe(run.start.wood);
    expect(run.most).toBe(run.start.bush);
    expect(run.least.held).toBe(11);
  }, 60_000);

  it('for every civilization whose farmers carry, the overfull forager\'s swing takes nothing and gives nothing back', () => {
    const wrong: string[] = [];
    let census = 0;
    for (const civilization of CIVILIZATION_NAMES) {
      // Khmer farmers hold nothing, so they never arrive overfull.
      if (civilization === 'Khmer') continue;
      census += 1;
      const run = farmerSentToForage(civilization);
      if (!run.foraged) wrong.push(`${civilization}: never worked the bush`);
      if (run.most !== run.start.bush) wrong.push(`${civilization}: the bush went from ${run.start.bush} to ${run.most}`);
      if (run.least.held !== run.held) wrong.push(`${civilization}: the hands went from ${run.held} to ${run.least.held}`);
      if (run.least.wood < run.start.wood) wrong.push(`${civilization}: wood went from ${run.start.wood} to ${run.least.wood}`);
    }
    expect(wrong).toEqual([]);
    expect(census).toBe(CIVILIZATION_NAMES.length - 1);
  }, 300_000);
});
