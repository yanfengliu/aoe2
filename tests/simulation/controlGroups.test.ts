// Control groups (spec section 9, v0.3.104): Ctrl+digit binds the current
// selection to that digit, digit recalls it, dead members prune on recall.
// Session-transient by scope (not in saves) - noted in the spec.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('control groups', () => {
  it('assigns the selection to a digit and recalls it later', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    expect(
      bridge.selectOwnedUnitsByTypeInRect('militia', 20, 18, 40, 30),
    ).toBe(true);
    const count = bridge.getSelectionState().selectedCount;
    expect(count).toBeGreaterThanOrEqual(5);
    expect(bridge.assignControlGroup(1)).toBe(true);
    bridge.clearSelection();
    expect(bridge.getSelectionState().selectedCount).toBe(0);
    expect(bridge.recallControlGroup(1)).toBe(true);
    expect(bridge.getSelectionState().selectedCount).toBe(count);
    expect(bridge.getSelectionState().selectedEntityType).toBe('militia');
  });

  it('an empty digit recalls nothing and reports false', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    expect(bridge.recallControlGroup(4)).toBe(false);
  });

  it('cannot assign an empty selection', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    bridge.clearSelection();
    expect(bridge.assignControlGroup(2)).toBe(false);
  });

  it('reassigning a digit replaces the old group', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    expect(bridge.selectOwnedUnitsByTypeInRect('militia', 20, 18, 40, 30)).toBe(true);
    expect(bridge.assignControlGroup(3)).toBe(true);
    const monk = bridge.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === 'monk')!;
    expect(bridge.selectEntityAtCell(monk.x, monk.y)).toBe(true);
    expect(bridge.assignControlGroup(3)).toBe(true);
    bridge.clearSelection();
    expect(bridge.recallControlGroup(3)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('monk');
    expect(bridge.getSelectionState().selectedCount).toBe(1);
  });
});
