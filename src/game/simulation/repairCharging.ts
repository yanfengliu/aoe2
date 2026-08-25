// Continuous repair charging (spec §8.1, v0.3.122): AoE2 pays for a repair
// AS the hit points come back, not up front — stop early and you have paid
// only for what was mended; go broke and the repair STALLS until you can pay.
// Fractions accrue per target in integer hundredths (save-exact); whole
// resource units are charged the tick they fall due, BEFORE the HP applies,
// so a stalled tick restores nothing and owes nothing.

import type { PlayerResources } from './types';

export type RepairAccrual = Partial<Record<'food' | 'wood' | 'gold' | 'stone', number>>;

const RESOURCE_KEYS = ['food', 'wood', 'gold', 'stone'] as const;

/**
 * Accrue one tick of repair cost and charge any whole units due. Returns true
 * if the tick is PAID (caller applies the HP); false stalls the tick — the
 * stockpile could not cover a due unit, nothing was charged, nothing accrued.
 */
export function chargeRepairTick(params: {
  accrualByTarget: Map<number, RepairAccrual>;
  targetId: number;
  /** Half the build/training cost — the cost of repairing from 0 to full. */
  costPerFullRepair: Partial<PlayerResources>;
  maxHp: number;
  deltaHp: number;
  stockpile: PlayerResources;
}): boolean {
  const { accrualByTarget, targetId, costPerFullRepair, maxHp, deltaHp, stockpile } = params;
  if (maxHp <= 0 || deltaHp <= 0) return true;
  const accrual: RepairAccrual = { ...(accrualByTarget.get(targetId) ?? {}) };
  const due: RepairAccrual = {};
  for (const key of RESOURCE_KEYS) {
    const perFull = costPerFullRepair[key];
    if (!perFull) continue;
    const next = (accrual[key] ?? 0) + Math.round(perFull * 100 * deltaHp / maxHp);
    const wholeUnits = Math.floor(next / 100);
    if (wholeUnits > 0) due[key] = wholeUnits;
    accrual[key] = next - wholeUnits * 100;
  }
  for (const key of RESOURCE_KEYS) {
    if ((due[key] ?? 0) > stockpile[key]) return false;
  }
  for (const key of RESOURCE_KEYS) {
    const charge = due[key] ?? 0;
    if (charge > 0) stockpile[key] -= charge;
  }
  accrualByTarget.set(targetId, accrual);
  return true;
}

/** A finished (or abandoned-at-full) repair owes nothing more — drop the carry. */
export function clearRepairAccrual(
  accrualByTarget: Map<number, RepairAccrual>,
  targetId: number,
): boolean {
  return accrualByTarget.delete(targetId);
}
