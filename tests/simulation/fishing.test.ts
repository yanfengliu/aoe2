import { describe, expect, it } from 'vitest';

import { canDropOffAt } from '../../src/game/simulation/prototypeEconomyRules';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

/** Train one Fishing Ship at the naval fixture's Dock and return it. */
function trainFishingShip(bridge: Bridge) {
  expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
  expect(bridge.queueTrainUnit('fishing-ship')).toBe(true);
  expect(stepBridgeUntil(
    bridge,
    () => bridge.getEconomyState().units.some(
      (unit) => unit.owner === 1 && unit.unitType === 'fishing-ship',
    ),
    { maxSteps: 1_500 },
  )).toBe(true);
  const ship = bridge.getEconomyState().units
    .find((unit) => unit.owner === 1 && unit.unitType === 'fishing-ship');
  expect(ship).toBeDefined();
  return ship!;
}

describe('the Dock is where fish come ashore', () => {
  it('accepts food, and still refuses wood, gold and stone', () => {
    expect(canDropOffAt('dock', 'food')).toBe(true);
    expect(canDropOffAt('dock', 'wood')).toBe(false);
    expect(canDropOffAt('dock', 'gold')).toBe(false);
    expect(canDropOffAt('dock', 'stone')).toBe(false);
  });

  it('leaves the existing drop-off rules alone', () => {
    expect(canDropOffAt('mill', 'food')).toBe(true);
    expect(canDropOffAt('town-center', 'food')).toBe(true);
    expect(canDropOffAt('lumber-camp', 'wood')).toBe(true);
    expect(canDropOffAt('mining-camp', 'gold')).toBe(true);
  });
});

describe('fishing', () => {
  it('gives a Fishing Ship the gathering state a villager has', () => {
    const bridge = createSimulationBridge('naval-fixture');
    const ship = trainFishingShip(bridge);
    // The ship appears in the economy's gatherer roster, which is what the
    // whole gather -> carry -> deposit loop keys off.
    const gatherers = bridge.getEconomyState().villagers;
    expect(gatherers.length).toBeGreaterThan(0);
    expect(bridge.selectEntityAtCell(ship.x, ship.y)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('fishing-ship');
  }, 90_000);

  it('sends a Fishing Ship to fish and brings the food home', () => {
    const bridge = createSimulationBridge('naval-fixture');
    const ship = trainFishingShip(bridge);

    const fish = bridge.getEconomyState().resources
      .find((resource) => resource.resourceType === 'fish');
    expect(fish).toBeDefined();

    expect(bridge.selectEntityAtCell(ship.x, ship.y)).toBe(true);
    expect(bridge.issueContextCommand(fish!.x, fish!.y)).toBe(true);

    const foodAt = () => bridge.getHudState().playerResources.food;
    const startingFood = foodAt();

    // The full loop: cross the bay, fish, carry the catch back to the Dock,
    // and deposit it. Nothing else in this fixture produces food.
    expect(stepBridgeUntil(
      bridge,
      () => foodAt() > startingFood,
      { maxSteps: 3_000 },
    )).toBe(true);
  }, 120_000);

  it('never strands the ship on land while it works', () => {
    const bridge = createSimulationBridge('naval-fixture');
    const ship = trainFishingShip(bridge);
    const fish = bridge.getEconomyState().resources
      .find((resource) => resource.resourceType === 'fish')!;
    expect(bridge.selectEntityAtCell(ship.x, ship.y)).toBe(true);
    expect(bridge.issueContextCommand(fish.x, fish.y)).toBe(true);

    const waterCells = new Set(
      bridge.getRenderState().entities
        .filter((entity) => entity.layer === 'terrain' && entity.entityType === 'water')
        .map((entity) => `${String(entity.x)}:${String(entity.y)}`),
    );
    for (let step = 0; step < 600; step += 1) {
      bridge.step(100);
      const now = bridge.getEconomyState().units.find((unit) => unit.id === ship.id);
      if (!now) break;
      expect(waterCells.has(`${String(now.x)}:${String(now.y)}`)).toBe(true);
    }
  }, 120_000);
});
