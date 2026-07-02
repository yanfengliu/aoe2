import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect } from './createSimulationBridge.helpers';

// Wheelbarrow / Hand Cart villager movement-speed halves (v0.1.69). The carry
// techs already existed (carry-capacity only); this adds their AoE2 movement
// HALF (+10% villager speed each, STACKING to ×1.21). The pure percent math is
// covered in movementTechEffects.test.ts; here we prove the effect reaches a
// real villager end-to-end through the executor — a Wheelbarrow villager (and a
// faster Wheelbarrow+Hand Cart villager) reach a straight-line target in fewer
// ticks than a baseline villager.

type Bridge = ReturnType<typeof createSimulationBridge>;

const TARGET = { x: 30, y: 13 };

function getVillager(bridge: Bridge, owner: number) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === 'villager');
}

function commandMove(bridge: Bridge, target: { x: number; y: number }): void {
  expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
  expect(bridge.issueMoveCommand(target.x, target.y)).toBe(true);
}

function arrivalTick(bridge: Bridge, target: { x: number; y: number }, maxTicks = 200): number {
  for (let tick = 1; tick <= maxTicks; tick += 1) {
    bridge.step(100);
    const villager = getVillager(bridge, 1);
    if (villager && villager.x === target.x && villager.y === target.y) {
      return tick;
    }
  }
  throw new Error(`villager did not reach (${target.x},${target.y}) within ${maxTicks} ticks`);
}

describe('Wheelbarrow/Hand Cart — villager movement speed reaches a real villager', () => {
  it('a Wheelbarrow villager outraces a baseline villager over the same straight run', () => {
    const baseline: Bridge = createSimulationBridge('villager-speed-baseline-fixture');
    const wheelbarrow: Bridge = createSimulationBridge('villager-speed-wheelbarrow-fixture');

    commandMove(baseline, TARGET);
    commandMove(wheelbarrow, TARGET);

    const baselineTicks = arrivalTick(baseline, TARGET);
    const wheelbarrowTicks = arrivalTick(wheelbarrow, TARGET);

    expect(wheelbarrowTicks).toBeLessThan(baselineTicks);
    expect(baselineTicks - wheelbarrowTicks).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it('a Wheelbarrow+Hand Cart villager (121%) is no slower than Wheelbarrow alone (110%) and beats baseline', () => {
    const baseline: Bridge = createSimulationBridge('villager-speed-baseline-fixture');
    const wheelbarrow: Bridge = createSimulationBridge('villager-speed-wheelbarrow-fixture');
    const both: Bridge = createSimulationBridge('villager-speed-both-fixture');

    commandMove(baseline, TARGET);
    commandMove(wheelbarrow, TARGET);
    commandMove(both, TARGET);

    const baselineTicks = arrivalTick(baseline, TARGET);
    const wheelbarrowTicks = arrivalTick(wheelbarrow, TARGET);
    const bothTicks = arrivalTick(both, TARGET);

    // 121% ≥ 110% ≥ 100%: the stacked villager must not be slower than
    // Wheelbarrow alone, and both teched villagers beat the baseline.
    expect(bothTicks).toBeLessThanOrEqual(wheelbarrowTicks);
    expect(wheelbarrowTicks).toBeLessThan(baselineTicks);
    expect(bothTicks).toBeLessThan(baselineTicks);
  }, 30_000);
});
