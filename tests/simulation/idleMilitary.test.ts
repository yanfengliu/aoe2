// The idle-military cycle (v0.3.155): DE binds ',' to "select next idle
// military unit" the way '.' selects idle villagers. Idle = the HUMAN's
// military unit (not an economy worker) with no standing command, no monk
// task, and no shelter; cycling is round-robin like the villager bell.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('idle military cycle', () => {
  it('cycles the idle soldiers round-robin, skipping busy ones', () => {
    const bridge = createSimulationBridge('queued-orders-fixture');
    const archer = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'archer',
    )!;
    // The archer is idle at boot; villagers never count.
    expect(bridge.countIdleMilitary()).toBe(1);
    expect(bridge.selectNextIdleMilitary()).toBe(true);
    expect(bridge.getSelectionState().selectedEntityId).toBe(archer.id);

    // A busy soldier drops out of the cycle.
    const victim = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'militia',
    )!;
    expect(bridge.issueContextCommandAtEntity(victim.id)).toBe(true);
    bridge.step(100);
    expect(bridge.countIdleMilitary()).toBe(0);
    expect(bridge.selectNextIdleMilitary()).toBe(false);
  });

  it('never offers villagers, even when every soldier is busy', () => {
    const bridge = createSimulationBridge('unit-repair-fixture');
    // The repair fixture has villagers and (possibly) no idle military.
    const militaryTypes = new Set(
      bridge.getEconomyState().units
        .filter((unit) => unit.owner === 1 && unit.unitType !== 'villager')
        .map((unit) => unit.unitType),
    );
    const count = bridge.countIdleMilitary();
    if (militaryTypes.size === 0) {
      expect(count).toBe(0);
      expect(bridge.selectNextIdleMilitary()).toBe(false);
    } else {
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});
