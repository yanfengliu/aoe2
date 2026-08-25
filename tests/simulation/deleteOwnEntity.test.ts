// The Delete key (spec §9, v0.3.114): AoE2 lets a player remove their own
// unit or building — freeing population at the cap, clearing a misplaced
// house. One entity per press (the primary selection), own things only, no
// refund, and it flows through a recorded command so replays reproduce it.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('deleting your own entity', () => {
  it('kills the selected own unit and frees its population slot', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const militia = bridge.getEconomyState().units.find(
      (u) => u.owner === 1 && u.unitType === 'militia',
    );
    if (!militia) throw new Error('fixture has no owned militia');
    const popBefore = bridge.getPopulationState(1).current;

    expect(bridge.selectUnitsByIds([militia.id])).toBe(true);
    expect(bridge.deleteSelectedEntity()).toBe(true);
    bridge.step(100);

    expect(
      bridge.getEconomyState().units.some((u) => u.id === militia.id),
      'the deleted unit still stands',
    ).toBe(false);
    expect(bridge.getPopulationState(1).current).toBe(popBefore - 1);
  });

  it('demolishes the selected own building', () => {
    const bridge = createSimulationBridge('unit-repair-fixture');
    const tc = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 1 && b.buildingType === 'town-center',
    );
    if (!tc) throw new Error('fixture has no owned town center');
    expect(bridge.selectEntityById(tc.id)).toBe(true);
    expect(bridge.deleteSelectedEntity()).toBe(true);
    bridge.step(100);
    expect(
      bridge.getEconomyState().buildings.some((b) => b.id === tc.id),
      'the deleted building still stands',
    ).toBe(false);
  });

  it('refuses enemies, resources, and empty selections', () => {
    const bridge = createSimulationBridge('unit-repair-fixture');
    bridge.clearSelection();
    expect(bridge.deleteSelectedEntity()).toBe(false);

    const enemyTc = bridge.getEconomyState().buildings.find((b) => b.owner === 2);
    if (!enemyTc) throw new Error('fixture has no enemy building');
    // Enemy buildings cannot be SELECTED as own, but a direct command with an
    // enemy target must also bounce at the validator.
    const rejected = bridge.world.submitWithResult('entity.delete', {
      entityId: enemyTc.id,
      requestedBy: 1,
    });
    expect(rejected.accepted).toBe(false);
    bridge.step(100);
    expect(bridge.getEconomyState().buildings.some((b) => b.id === enemyTc.id)).toBe(true);
  });
});
