import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { repairCost } from '../../src/game/simulation/prototypeEconomyRules';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

// Repair (spec §8.1): a villager repairs a friendly, complete, damaged building —
// restoring HP over time for a fraction of the build cost, charged
// CONTINUOUSLY as the hit points return (v0.3.122; up-front until then).

describe('repairCost — a fraction of the build cost, scaled by missing HP', () => {
  it('charges ceil(0.5 * buildCost * missing/max) per resource, nothing at full HP', () => {
    // House: 25 wood, maxHp 900 (v0.3.97). Missing 870 → 0.5*25*870/900 → ceil 13.
    expect(repairCost('house', 45, 75)).toEqual({ wood: 8 });
    // Full HP → no cost.
    expect(repairCost('house', 0, 75)).toEqual({});
    // Multi-resource: Town Center (275 wood, 100 stone) fully missing → half.
    expect(repairCost('town-center', 100, 100)).toEqual({ wood: 138, stone: 50 });
  });
});

describe('villager repair (spec §8.1)', () => {
  it('repairs a damaged friendly building to full HP, paying as the HP returns (v0.3.122)', () => {
    const bridge = createSimulationBridge('repair-fixture');
    const house = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 1 && b.buildingType === 'house',
    );
    expect(house).toBeDefined();
    expect(bridge.getEntityHealth(house!.id)?.currentHp).toBe(30);
    const woodBefore = bridge.getHudState().playerResources.wood;

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(house!.id)).toBe(true);
    // Starting is FREE — AoE2 charges as the hit points come back.
    bridge.step(100);
    expect(woodBefore - bridge.getHudState().playerResources.wood).toBe(0);

    expect(
      stepBridgeUntil(
        bridge,
        () => (bridge.getEntityHealth(house!.id)?.currentHp ?? 0) >= 900,
        { maxSteps: 8000 },
      ),
    ).toBe(true);
    expect(bridge.getEntityHealth(house!.id)?.currentHp).toBe(900);
    // The completed repair totals ~half the build cost pro-rata the missing
    // 870/900 — ceil(0.5*25*870/900)=13, within a rounding unit either side.
    const charged = woodBefore - bridge.getHudState().playerResources.wood;
    expect(Math.abs(charged - 13)).toBeLessThanOrEqual(1);
    // And no further charge accrues at full HP.
    for (let i = 0; i < 20; i += 1) bridge.step(100);
    expect(woodBefore - bridge.getHudState().playerResources.wood).toBe(charged);
  }, 20_000);
});
