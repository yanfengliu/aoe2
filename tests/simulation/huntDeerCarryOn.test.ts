import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { GathererComponent, ResourceComponent } from '../../src/game/simulation/types';

// Bound: the player's real boar hunt on open approaches, with a passive deer
// four cells from the boar and trees behind it to keep its flight inside the
// carry-on radius. Live boars remain excluded by huntCarryOn.test.ts. This
// catches a kind-table-only implementation that permits deer but rejects all
// passive deer as non-harvestable, leaving the hunter idle beside the deer.
// Deer in this build are gathered directly; only boars/wolves have combat HP.
type Bridge = ReturnType<typeof createSimulationBridge>;
const amount = (bridge: Bridge, id: number) => bridge.world.getComponent<ResourceComponent>(id, 'resource')?.amount ?? 0;
const hunters = (bridge: Bridge) => bridge.getEconomyState().units
  .filter((unit) => unit.owner === 1 && unit.unitType === 'villager').map((unit) => unit.id);

function start() {
  const bridge = createSimulationBridge('carry-on-deer-fixture', { renderProjection: 'on-read' });
  const boar = bridge.getEconomyState().resources.find((node) => node.resourceType === 'boar')!.id;
  const deer = bridge.getEconomyState().resources.find((node) => node.resourceType === 'deer')!.id;
  expect(bridge.selectUnitsByIds(hunters(bridge))).toBe(true);
  expect(bridge.issueContextCommandAtEntity(boar)).toBe(true);
  return { bridge, boar, deer };
}

function until(bridge: Bridge, done: () => boolean, ticks: number): boolean {
  for (let tick = 0; tick < ticks; tick += 1) {
    bridge.step(100);
    if (done()) return true;
  }
  return false;
}

function gatheringDeer(bridge: Bridge, deer: number): boolean {
  return hunters(bridge).some((id) => bridge.world.getComponent<GathererComponent>(id, 'gatherer')?.targetResourceId === deer);
}

describe('a hunter carries on to passive deer', () => {
  it('continues to a nearby passive deer after the boar is eaten and banks both animals', () => {
    const { bridge, boar, deer } = start();
    expect(until(bridge, () => amount(bridge, boar) === 0, 4_000), 'the first carcass was never eaten').toBe(true);
    expect(amount(bridge, deer), 'premise: the deer must still have food').toBeGreaterThan(0);
    expect(gatheringDeer(bridge, deer), 'no hunter continued to the deer').toBe(true);
    expect(until(bridge, () => amount(bridge, deer) === 0 && bridge.countIdleVillagers() === hunters(bridge).length, 4_000),
      'the deer was not gathered and delivered').toBe(true);
    expect(bridge.getEconomyState().playerResources[1]!.food).toBe(70);
    const sheep = bridge.getEconomyState().resources.find((node) => node.resourceType === 'sheep')!;
    expect(sheep.amount, 'the hunt switched to another food kind').toBe(100);
  }, 60_000);

  it('a save during the automatic continuation keeps the deer target and carried food', () => {
    const { bridge, deer } = start();
    expect(until(bridge, () => gatheringDeer(bridge, deer), 4_000), 'the automatic continuation never began').toBe(true);
    const restored = createSimulationBridge('carry-on-deer-fixture', {
      renderProjection: 'on-read', savedGame: bridge.saveGame(),
    });
    const carried = (game: Bridge) => hunters(game).reduce((sum, id) =>
      sum + (game.world.getComponent<GathererComponent>(id, 'gatherer')?.carriedAmount ?? 0), 0);
    expect(gatheringDeer(restored, deer)).toBe(true);
    expect(carried(restored)).toBe(carried(bridge));
    for (let tick = 0; tick < 4_000; tick += 1) {
      bridge.step(100);
      restored.step(100);
    }
    expect(restored.getEconomyState()).toEqual(bridge.getEconomyState());
    expect(restored.getEconomyState().playerResources[1]!.food).toBe(70);
  }, 60_000);
});
