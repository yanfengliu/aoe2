import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { unitBaseSpeedPercent } from '../../src/game/simulation/prototypeUnitRules/unitBaseSpeed';
import type { UnitType } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

// The table in unitBaseSpeed.ts is only half the claim. What a player feels is
// how long a unit takes to CROSS GROUND, and between the table and the ground
// sit the fractional carry, its cap, and the per-cell waypoint clamp — three
// places a percent can be quietly rounded or thrown away. These walk a real
// unit across a real map and check the wall-clock against the table.
function ticksToWalk(unitType: UnitType, cells: number): number {
  const bridge: Bridge = createSimulationBridge('unit-showcase-fixture');
  const unit = bridge.getEconomyState().units
    .find((candidate) => candidate.owner === 1 && candidate.unitType === unitType);
  expect(unit, unitType).toBeDefined();
  const target = { x: unit!.x + cells, y: unit!.y };

  expect(bridge.selectEntityById(unit!.id)).toBe(true);
  expect(bridge.issueMoveCommand(target.x, target.y)).toBe(true);

  for (let tick = 1; tick <= 2000; tick += 1) {
    bridge.step(100);
    const now = bridge.getEconomyState().units.find((candidate) => candidate.id === unit!.id);
    if (now && now.x === target.x && now.y === target.y) return tick;
  }
  throw new Error(`${unitType} never walked ${String(cells)} cells`);
}

describe('a unit crosses ground at the speed its table says', () => {
  // One reference walk, then everything else is measured against it. Ratios
  // rather than absolute ticks, so the base step size stays an implementation
  // detail. The walk is long enough that whole-tick arrival quantisation is
  // small: at 12 cells a disconnected seam still passed for the 112% Champion
  // and the 120% Archer, because a 12% error hid inside the tolerance.
  const CELLS = 24;

  it.each<[UnitType]>([
    ['scout'],
    ['knight'],
    ['champion'],
    ['archer'],
    ['mangonel'],
  ])('walks %s at its tabled ratio to a villager', (unitType) => {
    const villagerTicks = ticksToWalk('villager', CELLS);
    const ticks = ticksToWalk(unitType, CELLS);
    const measuredPercent = (villagerTicks / ticks) * 100;
    const tabled = unitBaseSpeedPercent(unitType);
    expect(
      Math.abs(measuredPercent - tabled) / tabled,
      `${unitType}: tabled ${String(tabled)}%, measured ${measuredPercent.toFixed(0)}%`,
    ).toBeLessThan(0.08);
  }, 60_000);

  it('takes a siege engine visibly longer to cross the same ground than a villager', () => {
    // The consequence a player feels, stated as ticks rather than percents: a
    // Mangonel is an investment you have to escort, not something that keeps up.
    const villagerTicks = ticksToWalk('villager', CELLS);
    const mangonelTicks = ticksToWalk('mangonel', CELLS);
    expect(mangonelTicks).toBeGreaterThan(villagerTicks);
    const hussarTicks = ticksToWalk('hussar', CELLS);
    expect(hussarTicks).toBeLessThan(villagerTicks);
  }, 60_000);
});
