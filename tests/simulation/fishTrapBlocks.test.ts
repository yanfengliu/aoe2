// A ship cannot sail through a Fish Trap (2026-08-29).
//
// `isCellPassableForUnit` short-circuited EVERY water-domain unit to passable
// on any terrain-passable water cell, justified by a comment asserting "water
// cells hold no buildings or land resources". That was true when it was
// written and false since the Fish Trap shipped — `shorePlacement` declares it
// the one building that must stand ON water — so every ship sailed straight
// through one. Same class as the v0.3.161 gate bug: a passability predicate
// whose justifying comment quietly went stale when a later feature landed.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  OPEN_SHIP_GOAL, OPEN_SHIP_START, SHIP_GOAL, SHIP_START, TRAP_CELL,
} from '../../src/game/simulation/fixtures/fishTrapBlocks';

type Bridge = ReturnType<typeof createSimulationBridge>;

function shipAt(bridge: Bridge, start: { x: number; y: number }) {
  return bridge.getEconomyState().units.find(
    (unit) => unit.unitType === 'fishing-ship' && Math.round(unit.x) === start.x
      && Math.round(unit.y) === start.y,
  );
}

describe('a Fish Trap is a building, not open water', () => {
  it('never lets a ship pass through the trap cell', () => {
    const bridge = createSimulationBridge('fish-trap-blocks-fixture');
    const ship = shipAt(bridge, SHIP_START);
    expect(ship, 'the fixture lost its channel ship').toBeDefined();
    expect(bridge.world.submitWithResult('unit.move', {
      unitId: ship!.id, target: { x: SHIP_GOAL.x, y: SHIP_GOAL.y },
    }).accepted).toBe(true);

    // The channel is one cell tall, so reaching the far side means having
    // occupied the trap's own cell at some point. Watch for that directly
    // rather than inferring it from arrival.
    let enteredTrapCell = false;
    for (let tick = 0; tick < 3000; tick += 1) {
      bridge.step(100);
      const now = bridge.getEconomyState().units.find((unit) => unit.id === ship!.id);
      if (!now) break;
      if (Math.round(now.x) === TRAP_CELL.x && Math.round(now.y) === TRAP_CELL.y) {
        enteredTrapCell = true;
        break;
      }
    }
    expect(enteredTrapCell, 'a ship sailed through a Fish Trap').toBe(false);
  });

  it('still crosses open water freely, so the fix is not "ships cannot move"', () => {
    const bridge = createSimulationBridge('fish-trap-blocks-fixture');
    const ship = shipAt(bridge, OPEN_SHIP_START);
    expect(ship, 'the fixture lost its control ship').toBeDefined();
    expect(bridge.world.submitWithResult('unit.move', {
      unitId: ship!.id, target: { x: OPEN_SHIP_GOAL.x, y: OPEN_SHIP_GOAL.y },
    }).accepted).toBe(true);

    let arrived = false;
    for (let tick = 0; tick < 3000; tick += 1) {
      bridge.step(100);
      const now = bridge.getEconomyState().units.find((unit) => unit.id === ship!.id);
      if (now && Math.abs(now.x - OPEN_SHIP_GOAL.x) < 1.5) { arrived = true; break; }
    }
    expect(arrived, 'the control ship could not cross open water').toBe(true);
  });
});
