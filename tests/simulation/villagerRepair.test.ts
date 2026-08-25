import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { repairCost } from '../../src/game/simulation/prototypeEconomyRules';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

// Repair (spec §8.1): a villager repairs a friendly, complete, damaged building —
// restoring HP over time for a fraction of the build cost (charged up front).

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
  it('repairs a damaged friendly building to full HP, charging the cost up front', () => {
    const bridge = createSimulationBridge('repair-fixture');
    const house = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 1 && b.buildingType === 'house',
    );
    expect(house).toBeDefined();
    expect(bridge.getEntityHealth(house!.id)?.currentHp).toBe(30);
    const woodBefore = bridge.getHudState().playerResources.wood;

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(house!.id)).toBe(true);
    // Process the command (routing charges the repair cost up front).
    bridge.step(100);
    // ceil(0.5 * 25 wood * 870/900) = 13 wood (house 900 HP since v0.3.97).
    expect(woodBefore - bridge.getHudState().playerResources.wood).toBe(13);

    expect(
      stepBridgeUntil(
        bridge,
        () => (bridge.getEntityHealth(house!.id)?.currentHp ?? 0) >= 900,
        { maxSteps: 8000 },
      ),
    ).toBe(true);
    expect(bridge.getEntityHealth(house!.id)?.currentHp).toBe(900);
    // No further charge once the building is back to full HP.
    expect(woodBefore - bridge.getHudState().playerResources.wood).toBe(13);
  }, 20_000);
});
