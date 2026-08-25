// The AI ferry (spec section 5.4 Islands): with its target across open water,
// the AI boards its militia onto a transport, sails the channel, unloads on
// the far shore, and marches - and in the no-transport variant it first
// trains the Transport Ship at its own Dock.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

const WEST_ISLAND_MAX_X = 21;

function aiMilitiaAshoreWest(bridge: Bridge): boolean {
  return bridge
    .getEconomyState()
    .units.some(
      (u) => u.owner === 2 && u.unitType === 'militia' && u.x <= WEST_ISLAND_MAX_X,
    );
}

describe('AI ferry across open water', () => {
  it('boards, sails, unloads on the far island, and its militia march ashore', () => {
    const bridge = createSimulationBridge('ai-ferry-fixture');
    expect(
      stepBridgeUntil(bridge, () => aiMilitiaAshoreWest(bridge), { maxSteps: 4000 }),
    ).toBe(true);
  }, 180_000);

  it('trains the Transport Ship itself when it has a Dock but no ship', () => {
    const bridge = createSimulationBridge('ai-ferry-train-fixture');
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge
          .getEconomyState()
          .units.some((u) => u.owner === 2 && u.unitType === 'transport-ship'),
        { maxSteps: 1500 },
      ),
    ).toBe(true);
    expect(
      stepBridgeUntil(bridge, () => aiMilitiaAshoreWest(bridge), { maxSteps: 5000 }),
    ).toBe(true);
  }, 240_000);
});

describe('the Islands map', () => {
  it('boots two starts on separate land masses with open sea between', () => {
    const bridge = createSimulationBridge('islands');
    const townCenters = bridge
      .getEconomyState()
      .buildings.filter((b) => b.buildingType === 'town-center');
    expect(townCenters).toHaveLength(2);
    const [west, east] = [...townCenters].sort((a, b) => a.x - b.x);
    // A straight walk between the two must cross water: every land route is
    // severed, which is the map's whole identity.
    const water = bridge
      .getRenderState()
      .entities.filter((e) => e.layer === 'terrain' && e.entityType === 'water');
    expect(water.length).toBeGreaterThan(100);
    const columns = new Set(water.map((e) => e.x));
    // At least one full water column separates the islands.
    let severed = false;
    for (let x = west!.x + 1; x < east!.x; x += 1) {
      if (columns.has(x)) { severed = true; break; }
    }
    expect(severed).toBe(true);
  });
});
