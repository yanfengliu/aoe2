// Villager repair of mechanical units (spec §8.1, v0.3.107): siege engines
// and ships mend under a villager exactly as buildings do — walk adjacent,
// pay half the training cost pro-rata the missing HP up front, restore at
// the training rate. Monk-heal targets (organic units) are not repairable.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';
import {
  isRepairableUnitType,
  unitRepairCost,
  unitRepairRatePerTick,
} from '../../src/game/simulation/unitRepair';
import { trainingCost } from '../../src/game/simulation/prototypeEconomyRules';

describe('what a villager may repair', () => {
  it('siege engines and ships, never flesh and blood', () => {
    expect(isRepairableUnitType('battering-ram')).toBe(true);
    expect(isRepairableUnitType('mangonel')).toBe(true);
    expect(isRepairableUnitType('trebuchet')).toBe(true);
    expect(isRepairableUnitType('galley')).toBe(true);
    expect(isRepairableUnitType('transport-ship')).toBe(true);
    expect(isRepairableUnitType('fishing-ship')).toBe(true);
    expect(isRepairableUnitType('militia')).toBe(false);
    expect(isRepairableUnitType('villager')).toBe(false);
    expect(isRepairableUnitType('monk')).toBe(false);
    expect(isRepairableUnitType('knight')).toBe(false);
  });
});

describe('the repair economics', () => {
  it('half the training cost, pro-rata the missing HP, ceiling per resource', () => {
    const ram = trainingCost('battering-ram');
    // Fully missing HP: exactly half the build cost.
    expect(unitRepairCost('battering-ram', 175, 175)).toEqual({
      wood: Math.ceil((ram.wood ?? 0) * 0.5),
      gold: Math.ceil((ram.gold ?? 0) * 0.5),
    });
    // Nothing missing costs nothing.
    expect(unitRepairCost('battering-ram', 0, 175)).toEqual({});
  });

  it('restores at the training rate', () => {
    expect(unitRepairRatePerTick('battering-ram', 175)).toBeGreaterThan(0);
  });
});

describe('a villager repairing a ram', () => {
  it('walks over, charges up front, and restores it to full', () => {
    const bridge = createSimulationBridge('unit-repair-fixture');
    const units = bridge.getEconomyState().units;
    const villager = units.find((u) => u.owner === 1 && u.unitType === 'villager');
    const ram = units.find((u) => u.owner === 1 && u.unitType === 'battering-ram' && u.x === 14);
    if (!villager || !ram) throw new Error('fixture is missing the villager or the hurt ram');
    const health = bridge.getEntityHealth(ram.id);
    if (!health) throw new Error('the hurt ram has no health state');
    expect(health.currentHp).toBe(40);
    const maxHp = health.maxHp;
    const missing = maxHp - 40;

    const before = bridge.getHudState().playerResources;
    expect(bridge.selectEntityById(villager.id)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(ram.id)).toBe(true);

    // Mid-repair the villager swings the hammer, exactly as on a build site.
    for (let i = 0; i < 30; i += 1) bridge.step(100);
    const view = bridge.getRenderState().entities.find((e) => e.id === villager.id);
    expect(view?.activeVerb, 'the repairing villager should swing the hammer').toBe('building');

    const repaired = stepBridgeUntil(
      bridge,
      () => (bridge.getEntityHealth(ram.id)?.currentHp ?? 0) >= maxHp,
      { maxSteps: 3000 },
    );
    expect(repaired, 'the ram never reached full HP').toBe(true);

    // Charged once, up front: half the 160w/75g ram cost, pro-rata what was missing.
    const after = bridge.getHudState().playerResources;
    expect(before.wood - after.wood).toBe(Math.ceil(160 * 0.5 * (missing / maxHp)));
    expect(before.gold - after.gold).toBe(Math.ceil(75 * 0.5 * (missing / maxHp)));
  });

  it('charges nothing for a full-HP ram', () => {
    const bridge = createSimulationBridge('unit-repair-fixture');
    const units = bridge.getEconomyState().units;
    const villager = units.find((u) => u.owner === 1 && u.unitType === 'villager');
    const healthy = units.find((u) => u.owner === 1 && u.unitType === 'battering-ram' && u.x === 16);
    if (!villager || !healthy) throw new Error('fixture is missing the villager or the healthy ram');

    const before = bridge.getHudState().playerResources;
    bridge.selectEntityById(villager.id);
    bridge.issueContextCommandAtEntity(healthy.id);
    for (let i = 0; i < 50; i += 1) bridge.step(100);
    const after = bridge.getHudState().playerResources;
    expect(after.wood).toBe(before.wood);
    expect(after.gold).toBe(before.gold);
  });
});
