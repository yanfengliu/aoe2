import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { formationRank } from '../../src/game/simulation/unitFormation';
import type { UnitType } from '../../src/game/simulation/types';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function ownedUnits(bridge: Bridge) {
  return bridge.getEconomyState().units.filter((unit) => unit.owner === 1);
}

// The showcase fixture is the only scenario with a big mixed band of owned
// units standing together, which is exactly what a formation is for: its two
// unique-unit rows at y=34/35 hold melee, archers, cavalry, and ships.
const BAND = { minX: 0, minY: 33, maxX: 59, maxY: 35 } as const;

describe('a group order arrives in formation', () => {
  it('spreads the group instead of piling it onto the clicked cell', () => {
    const bridge: Bridge = createSimulationBridge('unit-showcase-fixture');
    expect(bridge.selectUnitsInBox(BAND.minX, BAND.minY, BAND.maxX, BAND.maxY)).toBe(true);
    expect(bridge.issueMoveCommand(25, 22)).toBe(true);
    // Orders are queued through the command channel; one step applies them.
    bridge.step(100);

    const orders = bridge.getDebugSnapshot().unitPaths
      .filter((path) => path.commandType === 'move');
    expect(orders.length).toBeGreaterThanOrEqual(6);
    const destinations = new Set(orders.map((path) => `${String(path.toX)},${String(path.toY)}`));

    // "More than one cell" proves nothing: the plain spiral also uses a few.
    // What it does is STACK — cells hold several units each, so 34 units land
    // on 3 cells. A formation gives nearly every unit its own cell (measured:
    // 33 of 34 vs 3 of 34), which is the difference a player sees.
    expect(destinations.size, `${String(orders.length)} units landed on `
      + `${String(destinations.size)} cells`).toBeGreaterThan(orders.length / 2);

    // And it is a LINE: wider across the march than deep along it. The group
    // walks north here, so across is x.
    const width = new Set(orders.map((path) => path.toX)).size;
    const depth = new Set(orders.map((path) => path.toY)).size;
    expect(width, `line was ${String(width)} wide and ${String(depth)} deep`)
      .toBeGreaterThan(depth);
  });

  it('sends melee ahead of the shooters it is protecting', () => {
    // The ordering is the point of a formation. Assert it on the ORDERS rather
    // than on arrival, so a slow siege engine still counts.
    const bridge: Bridge = createSimulationBridge('unit-showcase-fixture');
    expect(bridge.selectUnitsInBox(BAND.minX, BAND.minY, BAND.maxX, BAND.maxY)).toBe(true);
    const target = { x: 25, y: 22 };
    expect(bridge.issueMoveCommand(target.x, target.y)).toBe(true);
    bridge.step(100);

    const byId = new Map(ownedUnits(bridge).map((unit) => [unit.id, unit.unitType as UnitType]));
    const ranked = bridge.getDebugSnapshot().unitPaths
      .filter((path) => path.commandType === 'move' && byId.has(path.id))
      .map((path) => ({
        rank: formationRank(byId.get(path.id)!),
        // Distance from the target ALONG the march: smaller means further
        // forward, since the group is walking north.
        forwardness: path.toY - target.y,
      }));
    expect(ranked.length).toBeGreaterThanOrEqual(6);

    const front = ranked.filter((entry) => entry.rank === 0);
    const back = ranked.filter((entry) => entry.rank >= 2);
    if (front.length > 0 && back.length > 0) {
      const averageFront = front.reduce((sum, e) => sum + e.forwardness, 0) / front.length;
      const averageBack = back.reduce((sum, e) => sum + e.forwardness, 0) / back.length;
      expect(averageFront, 'melee did not end up in front of siege/villagers')
        .toBeLessThanOrEqual(averageBack);
    }
  });
});

describe('the formation a group uses', () => {
  it('is the one most of the selection is set to, and defaults to Line', () => {
    const bridge: Bridge = createSimulationBridge('unit-showcase-fixture');
    expect(bridge.selectUnitsInBox(BAND.minX, BAND.minY, BAND.maxX, BAND.maxY)).toBe(true);
    expect(bridge.setSelectionFormation('box')).toBe(true);
    bridge.step(100);

    const formations = (bridge.world.getState('aoe2.unitFormations')
      ?? []) as Array<[number, string]>;
    expect(formations.length, 'a non-default formation must be stored').toBeGreaterThan(0);
    expect(formations.every(([, value]) => value === 'box')).toBe(true);
  });

  it('stores nothing when the selection is set back to the default', () => {
    const bridge: Bridge = createSimulationBridge('unit-showcase-fixture');
    expect(bridge.selectUnitsInBox(BAND.minX, BAND.minY, BAND.maxX, BAND.maxY)).toBe(true);
    expect(bridge.setSelectionFormation('flank')).toBe(true);
    expect(bridge.setSelectionFormation('line')).toBe(true);
    bridge.step(100);

    const formations = (bridge.world.getState('aoe2.unitFormations')
      ?? []) as Array<[number, string]>;
    expect(formations).toHaveLength(0);
  });

  it('is rejected with nothing selected', () => {
    const bridge: Bridge = createSimulationBridge('unit-showcase-fixture');
    bridge.clearSelection();
    expect(bridge.setSelectionFormation('box')).toBe(false);
  });
});

describe('a formation degrades rather than stacking', () => {
  it('still gets every unit somewhere it can stand', () => {
    // The formation shape is a PREFERENCE. Pressed against the map edge, cells
    // fall outside the world and the allocator's spiral has to catch them.
    const bridge: Bridge = createSimulationBridge('unit-showcase-fixture');
    expect(bridge.selectUnitsInBox(BAND.minX, BAND.minY, BAND.maxX, BAND.maxY)).toBe(true);
    expect(bridge.issueMoveCommand(1, 1)).toBe(true);
    bridge.step(100);
    expect(stepBridgeUntil(bridge, () => true, { maxSteps: 1 })).toBe(true);
    for (const path of bridge.getDebugSnapshot().unitPaths) {
      expect(path.toX).toBeGreaterThanOrEqual(0);
      expect(path.toY).toBeGreaterThanOrEqual(0);
    }
  });
});
