// In Age of Empires II a unit told to garrison WALKS to the building and goes
// in when it gets there. Here it went in instantly from any distance — a
// villager six cells away vanished into the Town Center the moment the order
// was given, which is a free escape from anything chasing it and the exact
// mechanism a raid response would lean on.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Bridge = ReturnType<typeof createSimulationBridge>;

function villagerOf(bridge: Bridge, owner: number) {
  return bridge.getEconomyState().units.find((u) => u.owner === owner && u.unitType === 'villager');
}

describe('garrisoning walks there first', () => {
  it('does not swallow a distant villager on the spot', () => {
    const bridge = createSimulationBridge('outpost-vision-fixture');
    const villager = villagerOf(bridge, 1);
    expect(villager).toBeDefined();
    const start = { x: villager!.x, y: villager!.y };
    const townCenter = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'town-center');
    expect(townCenter).toBeDefined();

    expect(bridge.selectUnitsByIds([villager!.id])).toBe(true);
    // Garrison intent on the Town Center, from six cells away.
    expect(bridge.issueContextCommand(townCenter!.x, townCenter!.y, true)).toBe(true);

    // Still on the map on the next tick: it has to walk.
    bridge.step(100);
    const afterOrder = villagerOf(bridge, 1);
    expect(afterOrder).toBeDefined();

    let moved = false;
    let sheltered = false;
    for (let i = 0; i < 400; i += 1) {
      bridge.step(100);
      const current = villagerOf(bridge, 1);
      if (!current) { sheltered = true; break; }
      if (current.x !== start.x || current.y !== start.y) moved = true;
    }
    // It walked, and then it went in.
    expect(moved).toBe(true);
    expect(sheltered).toBe(true);
  }, 60_000);
});
