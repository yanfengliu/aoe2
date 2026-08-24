import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedBuildingDirect, stepBridgeUntil } from './createSimulationBridge.helpers';
import { EAST_SHORE, STRAIT } from '../../src/game/simulation/fixtures';

import {
  TRANSPORT_CAPACITY,
  canBoardTransport,
  transportCapacity,
} from '../../src/game/simulation/transportShip';
import { unitDomain } from '../../src/game/simulation/unitDomain';
import { trainingCost } from '../../src/game/simulation/prototypeEconomyRules';
import { unitMaxHp } from '../../src/game/simulation/prototypeUnitRules';

describe('the Transport Ship', () => {
  it('is a ship, and costs what units.csv says', () => {
    expect(unitDomain('transport-ship')).toBe('water');
    expect(trainingCost('transport-ship')).toEqual({ wood: 125 });
    expect(unitMaxHp('transport-ship')).toBe(100);
  });

  it('carries a company', () => {
    // units.csv: "Ship to carry units. Garrison inside 5".
    expect(transportCapacity(new Set())).toBe(5);
    expect(TRANSPORT_CAPACITY).toBe(5);
  });
});

describe('who may board a transport', () => {
  // A transport exists to move LAND units over water. Putting a ship inside
  // one is meaningless — it can already swim — and the whole point is undone
  // if a transport can carry another transport.
  it('takes any land unit', () => {
    for (const unitType of ['villager', 'militia', 'knight', 'monk', 'mangonel'] as const) {
      expect(canBoardTransport(unitType), unitType).toBe(true);
    }
  });

  it('takes no ship, including another transport', () => {
    for (const unitType of ['fishing-ship', 'galley', 'transport-ship'] as const) {
      expect(canBoardTransport(unitType), unitType).toBe(false);
    }
  });
});

describe('training a Transport Ship', () => {
  // Every naval test before v0.3.20 spawned its ships from a fixture, which is
  // exactly why nobody noticed the Dock menu offered only the Fishing Ship for
  // several versions. This pins the menu itself.
  it('is offered at the Dock once out of the Dark Age', () => {
    const bridge = createSimulationBridge('naval-castle-age-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('transport-ship');
  });
});

describe('crossing a strait', () => {
  // The whole point of the ship, end to end. Water splits the map at x=14..17;
  // a militia cannot swim, so a militia standing east of the strait got there
  // aboard the transport.
  function transportRun() {
    const bridge = createSimulationBridge('transport-fixture');
    const find = (unitType: string) => bridge.getEconomyState().units
      .find((u) => u.owner === 1 && u.unitType === unitType);
    const militia = find('militia');
    const ship = find('transport-ship');
    if (!militia || !ship) throw new Error('the transport fixture needs a militia and a ship');
    return { bridge, militiaId: militia.id, shipId: ship.id };
  }

  const cellOf = (bridge: ReturnType<typeof createSimulationBridge>, id: number) =>
    bridge.getEconomyState().units.find((u) => u.id === id) ?? null;

  it('takes a militia aboard when it is sent at the ship', () => {
    const { bridge, militiaId, shipId } = transportRun();
    const ship = cellOf(bridge, shipId);
    expect(ship).not.toBeNull();
    expect(bridge.world.submitWithResult('unit.context', {
      unitId: militiaId,
      target: { x: ship!.x, y: ship!.y },
    }).accepted).toBe(true);

    expect(stepBridgeUntil(bridge, () => cellOf(bridge, militiaId) === null,
      { maxSteps: 600 }), 'the militia never boarded').toBe(true);
  });

  it('puts it ashore on the far side when the ship is sent at land', () => {
    const { bridge, militiaId, shipId } = transportRun();
    const ship = cellOf(bridge, shipId);
    bridge.world.submitWithResult('unit.context', {
      unitId: militiaId, target: { x: ship!.x, y: ship!.y },
    });
    expect(stepBridgeUntil(bridge, () => cellOf(bridge, militiaId) === null,
      { maxSteps: 600 })).toBe(true);

    // Sail east, then order the ship onto the far shore to unload.
    bridge.world.submitWithResult('unit.move', {
      unitId: shipId, target: { x: STRAIT.maxX, y: EAST_SHORE.y },
    });
    stepBridgeUntil(bridge, () => (cellOf(bridge, shipId)?.x ?? 0) >= STRAIT.maxX,
      { maxSteps: 900 });
    expect(bridge.world.submitWithResult('unit.context', {
      unitId: shipId, target: { x: EAST_SHORE.x, y: EAST_SHORE.y },
    }).accepted).toBe(true);

    expect(stepBridgeUntil(bridge, () => {
      const landed = cellOf(bridge, militiaId);
      return landed !== null && landed.x > STRAIT.maxX;
    }, { maxSteps: 600 }), 'the militia never came ashore east of the strait').toBe(true);
  });
});
