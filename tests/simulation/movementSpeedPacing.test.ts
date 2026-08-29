// Spec §12.4.2 movement clock pin: the villager — the 100% reference every
// other unit's movement_rate percent multiplies — covers ground at 0.8
// tiles/second. At TPS 10 and subgrid 4 that is 0.32 fine units per tick, so
// 8 straight cells take ~100 ticks. Before v0.3.160 the base step was 2 fine
// units/tick — 5 tiles/s, 6.25x AoE2 — and every walk in the game teleported.
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('spec §12.4.2 movement pacing', () => {
  it('a villager walks at ~0.8 tiles/second', () => {
    const bridge = createSimulationBridge('move-target-unblocks-fixture');
    expect(bridge.selectEntityAtCell(2, 8)).toBe(true);
    expect(bridge.issueMoveCommand(10, 8)).toBe(true);
    const start = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.x === 2 && unit.y === 8);
    expect(start).toBeDefined();
    let arrivalTick: number | null = null;
    for (let tick = 1; tick <= 220; tick += 1) {
      bridge.step(100);
      const unit = bridge.getEconomyState().units.find((u) => u.id === start!.id);
      if (unit && Math.abs(unit.x - 10) < 0.4 && Math.abs(unit.y - 8) < 0.4) {
        arrivalTick = tick;
        break;
      }
    }
    // 8 cells at 0.8 tiles/s = 100 ticks; allow slack for the approach slot
    // and waypoint clamps, but a hot clock (pre-retune: ~16 ticks) or a
    // frozen one must both fail.
    expect(arrivalTick).not.toBeNull();
    expect(arrivalTick!).toBeGreaterThanOrEqual(85);
    expect(arrivalTick!).toBeLessThanOrEqual(140);
  });
});
