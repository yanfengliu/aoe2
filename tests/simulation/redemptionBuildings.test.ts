// Redemption's building half (spec section 12): with the technology, a monk
// converts enemy buildings - except Town Centers, Castles, Wonders, farms,
// and the wall line, which stay permanently out of reach. The flip carries
// ownership, tint, vision, and POPULATION SUPPLY (a house's five move from
// the loser to the winner).

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil, selectOwnedUnitDirect } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function houseOwner(bridge: Bridge): number | undefined {
  return bridge
    .getEconomyState()
    .buildings.find((b) => b.buildingType === 'house')?.owner;
}

function orderConvertAtHouse(bridge: Bridge): boolean {
  const house = bridge.getEconomyState().buildings.find((b) => b.buildingType === 'house')!;
  expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
  return bridge.issueContextCommandAtEntity(house.id);
}

describe('Redemption converts enemy buildings', () => {
  it('flips an enemy house to the monk, moving its five population supply', () => {
    const bridge = createSimulationBridge('redemption-buildings-fixture');
    const supplyBefore = {
      mine: bridge.getPopulationState(1).rawSupply,
      theirs: bridge.getPopulationState(2).rawSupply,
    };
    expect(orderConvertAtHouse(bridge)).toBe(true);
    expect(
      stepBridgeUntil(bridge, () => houseOwner(bridge) === 1, { maxSteps: 900 }),
    ).toBe(true);
    expect(bridge.getPopulationState(1).rawSupply).toBe(supplyBefore.mine + 5);
    expect(bridge.getPopulationState(2).rawSupply).toBe(supplyBefore.theirs - 5);
  });

  it('never touches the enemy TOWN CENTER, Redemption or not', () => {
    const bridge = createSimulationBridge('redemption-buildings-fixture');
    const enemyTownCenter = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 2 && b.buildingType === 'town-center')!;
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    // The click routes to an ordinary walk, not a convert task.
    bridge.issueContextCommandAtEntity(enemyTownCenter.id);
    for (let index = 0; index < 400; index += 1) bridge.step(100);
    expect(
      bridge.getEconomyState().buildings.find((b) => b.buildingType === 'town-center' && b.x === 40)!.owner,
    ).toBe(2);
  });

  it('does nothing without the technology', () => {
    const bridge = createSimulationBridge('redemption-buildings-baseline-fixture');
    orderConvertAtHouse(bridge);
    for (let index = 0; index < 400; index += 1) bridge.step(100);
    expect(houseOwner(bridge)).toBe(2);
  });
});
