import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function findFirstOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function findFirstOwnedBuilding(bridge: Bridge, owner: number, buildingType: string) {
  return bridge
    .getEconomyState()
    .buildings.find((building) => building.owner === owner && building.buildingType === buildingType);
}

describe('FU7 Trebuchet pack/unpack', () => {
  it('a freshly-placed Trebuchet is packed and moves immediately when given a move order', () => {
    // A packed Trebuchet behaves like any other mobile siege unit — a
    // move command does NOT kick off a pack transition, so the unit
    // should leave its starting cell within a few ticks.
    const bridge = createSimulationBridge('trebuchet-pack-fixture');

    const trebBefore = findFirstOwnedUnit(bridge, 1, 'trebuchet');
    expect(trebBefore).toBeDefined();
    const startX = trebBefore!.x;
    const startY = trebBefore!.y;

    expect(selectOwnedUnitDirect(bridge, 1, 'trebuchet')).toBe(true);
    // Move 5 cells east of the starting position.
    expect(bridge.issueMoveCommand(startX + 5, startY)).toBe(true);

    // A packed Trebuchet has no transition to burn through, so within
    // far fewer than 50 ticks (the canonical transition length) the
    // unit should have budged from its starting coarse cell.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const treb = bridge.getEconomyState().units.find((u) => u.id === trebBefore!.id);
          if (!treb) {
            return false;
          }
          return treb.x !== startX || treb.y !== startY;
        },
        { maxSteps: 30 },
      ),
    ).toBe(true);
  }, 10_000);

  it('a Trebuchet auto-unpacks (~50 ticks) before firing on an enemy building in range', () => {
    // Trebuchet is planted at distance 4 from an enemy Town Center —
    // already well inside its canonical range of 16 so the command
    // does not need to walk. The attack command should nonetheless
    // NOT deal damage in the first ~40 ticks (transition is 50 ticks).
    const bridge = createSimulationBridge('trebuchet-vs-building-fixture');

    const tc = findFirstOwnedBuilding(bridge, 2, 'town-center');
    expect(tc).toBeDefined();
    const tcIdBefore = tc!.id;

    expect(selectOwnedUnitDirect(bridge, 1, 'trebuchet')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(tcIdBefore)).toBe(true);

    // Step the first 30 ticks — well inside the pack transition
    // window — and confirm the TC is still at its pre-set low HP
    // (startHp keeps the fixture compact).
    for (let index = 0; index < 30; index += 1) {
      bridge.step(100);
    }
    const tcAfter30 = bridge.getEconomyState().buildings.find((b) => b.id === tcIdBefore);
    expect(tcAfter30).toBeDefined();

    // After the 50-tick unpack transition plus one reload cycle, the
    // Town Center should have taken at least one siege hit — a
    // Trebuchet's base 7 attack + 200 anti-building bonus = 207 damage
    // per shot, which drops a 200-HP TC in a single hit.
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge.getEconomyState().buildings.find((b) => b.id === tcIdBefore) === undefined,
        { maxSteps: 200 },
      ),
    ).toBe(true);
  }, 30_000);

  it('an unpacked Trebuchet that receives a move order stays put for the pack transition', () => {
    // Drive a Trebuchet to fire on an enemy Town Center first — once
    // the TC is dropped the Trebuchet is unpacked and idle. Then
    // issue a fresh move order and verify the unit does NOT step for
    // the full pack transition.
    const bridge = createSimulationBridge('trebuchet-vs-building-fixture');

    const trebBefore = findFirstOwnedUnit(bridge, 1, 'trebuchet');
    expect(trebBefore).toBeDefined();
    const trebId = trebBefore!.id;
    const tc = findFirstOwnedBuilding(bridge, 2, 'town-center');
    expect(tc).toBeDefined();

    // Drive the Trebuchet to unpack and destroy the low-HP TC.
    expect(selectOwnedUnitDirect(bridge, 1, 'trebuchet')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(tc!.id)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().buildings.find((b) => b.id === tc!.id) === undefined,
        { maxSteps: 200 },
      ),
    ).toBe(true);

    // Trebuchet is now unpacked. Issue a move order and snapshot
    // its cell.
    const trebAfter = bridge.getEconomyState().units.find((u) => u.id === trebId);
    expect(trebAfter).toBeDefined();
    const startX = trebAfter!.x;
    const startY = trebAfter!.y;

    expect(selectOwnedUnitDirect(bridge, 1, 'trebuchet')).toBe(true);
    expect(bridge.issueMoveCommand(startX + 10, startY)).toBe(true);

    // Step 30 ticks (below the 50-tick pack transition). The
    // Trebuchet should NOT have budged from its starting cell.
    for (let index = 0; index < 30; index += 1) {
      bridge.step(100);
    }
    const trebMid = bridge.getEconomyState().units.find((u) => u.id === trebId);
    expect(trebMid).toBeDefined();
    expect(trebMid!.x).toBe(startX);
    expect(trebMid!.y).toBe(startY);

    // After the full 50-tick pack plus some walking budget, the
    // Trebuchet should finally have budged east.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const treb = bridge.getEconomyState().units.find((u) => u.id === trebId);
          if (!treb) {
            return false;
          }
          return treb.x !== startX;
        },
        { maxSteps: 120 },
      ),
    ).toBe(true);
  }, 30_000);
});
