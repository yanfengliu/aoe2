import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  buildingArrowAttackBonus,
  buildingArrowRangeBonus,
} from '../../src/game/simulation/buildingArrowTechEffects';

type Bridge = ReturnType<typeof createSimulationBridge>;

// Blacksmith arrow techs (Fletching / Bodkin Arrow / Bracer) each add +1 attack
// and +1 range to arrow-firing buildings (Tower / TC / Castle), matching AoE2 —
// derived from the owner's researched set at the tower/TC/castle fire site
// (buildingArrowTechEffects), no per-building state, no save change.

function findEnemySpearman(bridge: Bridge) {
  return bridge.getEconomyState().units.find((u) => u.owner === 2 && u.unitType === 'spearman');
}

describe('buildingArrowTechEffects — derived building arrow bonuses (pure)', () => {
  it('attack/range bonuses are 0/1/2/3 across none / Fletching / +Bodkin / +Bracer', () => {
    expect(buildingArrowAttackBonus(new Set())).toBe(0);
    expect(buildingArrowRangeBonus(new Set())).toBe(0);
    expect(buildingArrowAttackBonus(new Set(['fletching']))).toBe(1);
    expect(buildingArrowRangeBonus(new Set(['fletching']))).toBe(1);
    expect(buildingArrowAttackBonus(new Set(['fletching', 'bodkin-arrow']))).toBe(2);
    expect(buildingArrowAttackBonus(new Set(['fletching', 'bodkin-arrow', 'bracer']))).toBe(3);
    // Unrelated techs contribute nothing.
    expect(buildingArrowAttackBonus(new Set(['loom', 'guard-tower']))).toBe(0);
  });
});

describe('Fletching boosts building arrow fire — live', () => {
  it('a Watch Tower with Fletching whittles the enemy faster than the un-teched baseline', () => {
    // 60-tick window so both Spearmen survive (no death cap masking the delta):
    // base tower 5/shot lands 25, the Fletching tower 6/shot lands 30.
    const COMPARE_TICKS = 60;
    const base = createSimulationBridge('tower-upgrade-baseline-fixture');
    const fletch = createSimulationBridge('tower-fletching-fixture');
    const baseEnemy = findEnemySpearman(base)!;
    const fletchEnemy = findEnemySpearman(fletch)!;
    const baseStart = base.getEntityHealth(baseEnemy.id)!.currentHp;
    const fletchStart = fletch.getEntityHealth(fletchEnemy.id)!.currentHp;
    expect(baseStart).toBe(fletchStart);

    for (let i = 0; i < COMPARE_TICKS; i += 1) {
      base.step(100);
      fletch.step(100);
    }

    const baseLost = baseStart - (base.getEntityHealth(baseEnemy.id)?.currentHp ?? 0);
    const fletchLost = fletchStart - (fletch.getEntityHealth(fletchEnemy.id)?.currentHp ?? 0);
    expect(base.getEntityHealth(baseEnemy.id)!.currentHp).toBeGreaterThan(0);
    expect(fletch.getEntityHealth(fletchEnemy.id)!.currentHp).toBeGreaterThan(0);
    expect(fletchLost).toBeGreaterThan(baseLost);
  }, 30_000);
});
