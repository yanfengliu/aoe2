// Continuous repair charging (spec §8.1, v0.3.122): fractions accrue in
// integer hundredths, whole units charge as they fall due BEFORE the HP
// applies, and a stockpile that cannot cover a due unit stalls the tick —
// nothing charged, nothing accrued, nothing mended for free.

import { describe, expect, it } from 'vitest';

import { chargeRepairTick, clearRepairAccrual } from '../../src/game/simulation/repairCharging';
import type { RepairAccrual } from '../../src/game/simulation/repairCharging';
import type { PlayerResources } from '../../src/game/simulation/types';

function stock(wood: number): PlayerResources {
  return { food: 0, wood, gold: 0, stone: 0 };
}

describe('chargeRepairTick', () => {
  it('collects the full-repair price over a whole repair, within a unit', () => {
    const accrual = new Map<number, RepairAccrual>();
    const stockpile = stock(100);
    // 13 wood per full 900-HP repair, restored 4.5 HP a tick.
    for (let hp = 0; hp < 900; hp += 4.5) {
      expect(chargeRepairTick({
        accrualByTarget: accrual, targetId: 7,
        costPerFullRepair: { wood: 13 }, maxHp: 900, deltaHp: 4.5,
        stockpile,
      })).toBe(true);
    }
    expect(Math.abs(100 - stockpile.wood - 13)).toBeLessThanOrEqual(1);
  });

  it('stalls when a due unit cannot be paid, charging and accruing nothing', () => {
    const accrual = new Map<number, RepairAccrual>();
    const stockpile = stock(0);
    // A big delta makes a whole unit due immediately.
    const paid = chargeRepairTick({
      accrualByTarget: accrual, targetId: 7,
      costPerFullRepair: { wood: 10 }, maxHp: 100, deltaHp: 50,
      stockpile,
    });
    expect(paid).toBe(false);
    expect(stockpile.wood).toBe(0);
    expect(accrual.get(7)).toBeUndefined();
  });

  it('a finished repair drops its sub-unit carry', () => {
    const accrual = new Map<number, RepairAccrual>();
    chargeRepairTick({
      accrualByTarget: accrual, targetId: 7,
      costPerFullRepair: { wood: 10 }, maxHp: 100, deltaHp: 3,
      stockpile: stock(50),
    });
    expect(accrual.get(7)).toBeDefined();
    expect(clearRepairAccrual(accrual, 7)).toBe(true);
    expect(accrual.get(7)).toBeUndefined();
  });
});
