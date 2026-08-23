// The Fish Trap is the last building in structures.csv the game did not have:
// 100 wood for renewable food out on the water, built by a Fishing Ship rather
// than by a villager, and gathered like any other fish. It is the naval half of
// the Farm — the same building-plus-resource hybrid, on the other domain.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { constructionCost } from '../../src/game/simulation/prototypeEconomyRules';
import { getBuildingFootprint } from '../../src/game/content/buildingFootprints';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function unitOf(bridge: Bridge, owner: number, unitType: string) {
  return bridge.getEconomyState().units.find((u) => u.owner === owner && u.unitType === unitType);
}

describe('Fish Trap', () => {
  it('is a Fishing Ship build, not a villager one', () => {
    const bridge = createSimulationBridge('fish-trap-fixture');
    expect(constructionCost('fish-trap')).toEqual({ wood: 100 });
    expect(getBuildingFootprint('fish-trap')).toEqual({ width: 1, height: 1 });

    const ship = unitOf(bridge, 1, 'fishing-ship');
    expect(ship).toBeDefined();
    expect(bridge.selectUnitsByIds([ship!.id])).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('fish-trap');

    // A villager cannot: it could never reach the water to build one.
    const villager = unitOf(bridge, 1, 'villager');
    expect(bridge.selectUnitsByIds([villager!.id])).toBe(true);
    expect(bridge.getSelectionState().buildOptions).not.toContain('fish-trap');
  });

  it('goes on water, and refuses dry land', () => {
    const bridge = createSimulationBridge('fish-trap-fixture');
    const ship = unitOf(bridge, 1, 'fishing-ship');
    expect(bridge.selectUnitsByIds([ship!.id])).toBe(true);
    expect(bridge.beginBuildingPlacement('fish-trap')).toBe(true);
    // (8,12) is grass — a trap there would be a fish trap in a field.
    expect(bridge.confirmBuildingPlacement(8, 12)).toBe(false);
    expect(bridge.confirmBuildingPlacement(18, 9)).toBe(true);
  });

  it('feeds the player once built — the only food on this map', () => {
    const bridge = createSimulationBridge('fish-trap-fixture');
    expect(bridge.getEconomyState().playerResources[1]?.food ?? -1).toBe(0);

    const ship = unitOf(bridge, 1, 'fishing-ship');
    expect(bridge.selectUnitsByIds([ship!.id])).toBe(true);
    expect(bridge.beginBuildingPlacement('fish-trap')).toBe(true);
    expect(bridge.confirmBuildingPlacement(18, 9)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().buildings.some(
          (b) => b.buildingType === 'fish-trap' && b.isComplete,
        ),
        { maxSteps: 2000 },
      ),
    ).toBe(true);

    // On completion it is a fish resource holding structures.csv's 715 food.
    const trapResource = bridge
      .getEconomyState()
      .resources.find((r) => r.x === 18 && r.y === 9);
    expect(trapResource?.resourceType).toBe('fish');
    expect(trapResource?.amount).toBe(715);

    // And the ship fishes it once told to — a human's units idle until tasked,
    // exactly like a villager beside a berry bush.
    expect(bridge.selectUnitsByIds([ship!.id])).toBe(true);
    expect(bridge.issueContextCommand(18, 9)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => (bridge.getEconomyState().playerResources[1]?.food ?? 0) > 0,
        { maxSteps: 3000 },
      ),
    ).toBe(true);
    // The food came out of the trap, not from anywhere else.
    expect(
      bridge.getEconomyState().resources.find((r) => r.x === 18 && r.y === 9)?.amount ?? 715,
    ).toBeLessThan(715);
  }, 60_000);
});
