// An AI-vs-AI match measured on the default map lost whole villager forces to
// raids neither side defended against: 23 villagers at tick 10000 on one side,
// zero on the other, with no shelter attempted. In Age of Empires II the answer
// to a raid is the town bell — the villagers drop what they are carrying and
// take cover in the Town Center until it passes.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function aiVillagersOnTheMap(bridge: Bridge): number {
  return bridge
    .getEconomyState()
    .units.filter((u) => u.owner === 2 && u.unitType === 'villager').length;
}

function shelteredCount(bridge: Bridge): number {
  const townCenter = bridge
    .getEconomyState()
    .buildings.find((b) => b.owner === 2 && b.buildingType === 'town-center');
  if (!townCenter) return 0;
  const inventory = bridge.getSelectionState().inventory;
  // The economy snapshot has no garrison count, so read it off the building's
  // own selection detail — which is what a player sees.
  bridge.selectEntityById(townCenter.id);
  const detail = bridge.getSelectionState().inventory ?? inventory ?? '';
  const match = /^(\d+) \//.exec(detail);
  return match ? Number(match[1]) : 0;
}

describe('the AI answers a raid by sheltering its villagers', () => {
  it('takes them into the Town Center instead of letting them be cut down', () => {
    const bridge = createSimulationBridge('ai-under-raid-fixture');
    expect(aiVillagersOnTheMap(bridge)).toBe(4);

    // Long enough for three militia to kill four villagers several times over
    // if nobody moves: a militia deals 4 damage a second to a 25 HP villager.
    expect(
      stepBridgeUntil(bridge, () => shelteredCount(bridge) >= 3, { maxSteps: 900 }),
    ).toBe(true);

    // The point is survival, not shelter for its own sake.
    const sheltered = shelteredCount(bridge);
    expect(sheltered + aiVillagersOnTheMap(bridge)).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it('lets them out again once the raid is over', () => {
    // The other half of the rule, and the dangerous one: villagers that shelter
    // and never come out are an economy that stopped. The Town Center kills the
    // raiders itself — one arrow empty, one more per sheltering villager — so
    // this also exercises the arrow ceiling the shelter feeds.
    const bridge = createSimulationBridge('ai-under-raid-fixture');
    expect(
      stepBridgeUntil(bridge, () => shelteredCount(bridge) >= 3, { maxSteps: 900 }),
    ).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().units.filter((u) => u.owner === 1).length === 0,
        { maxSteps: 4000 },
      ),
    ).toBe(true);

    // All clear: back out and back to work.
    expect(
      stepBridgeUntil(bridge, () => aiVillagersOnTheMap(bridge) >= 3, { maxSteps: 2000 }),
    ).toBe(true);
  }, 120_000);
});
