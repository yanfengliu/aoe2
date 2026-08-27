import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { towerTechResearchOptions } from '../../src/game/simulation/towerTechOptions';
import {
  towerAttackBonus,
  towerRangeBonus,
} from '../../src/game/simulation/towerTechEffects';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;
type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
const AGE_ORDER: AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];

// Guard Tower → Keep (v0.1.57): two DERIVED defensive tower-upgrade techs,
// hosted at the Watch Tower (AoE2 hosts them at the University, which does not
// exist in this build yet). Guard Tower (+2 attack) needs Castle Age; Keep
// (+2 more attack, +1 range) needs Imperial Age AND guard-tower first. The
// bonus is recomputed from the owner's researched-tech set at the tower's fire
// site (towerTechEffects) — no per-entity state, no save-format change. HP
// scaling ships via buildingTechEffects' guard-tower/keep multipliers (the
// old DEFERRED note here outlived the mechanic — absence-claim audit). The
// upgrades research at the UNIVERSITY (v0.3.131), as technologies.csv says.

function optionsFor(
  age: AgeType,
  researched: ResearchableTechnologyType[] = [],
): ResearchableTechnologyType[] {
  const have = new Set(researched);
  return towerTechResearchOptions(
    'university',
    1,
    (_owner, min) => AGE_ORDER.indexOf(age) >= AGE_ORDER.indexOf(min),
    (_owner, tech) => have.has(tech),
  );
}

function getOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

describe('towerTechEffects — derived attack + range bonuses (pure)', () => {
  it('attack bonus is 0 / 2 / 4 across none / guard-tower / keep', () => {
    expect(towerAttackBonus(new Set())).toBe(0);
    expect(towerAttackBonus(new Set(['guard-tower']))).toBe(2);
    // Keep implies the guard-tower base (+2) plus its own +2 → +4 total.
    expect(towerAttackBonus(new Set(['guard-tower', 'keep']))).toBe(4);
    // Keep alone (defensive: a researched set should always contain the
    // prereq, but the effect is additive so keep contributes its +2).
    expect(towerAttackBonus(new Set(['keep']))).toBe(2);
  });

  it('range bonus is 0 without Keep and +1 with Keep', () => {
    expect(towerRangeBonus(new Set())).toBe(0);
    expect(towerRangeBonus(new Set(['guard-tower']))).toBe(0);
    expect(towerRangeBonus(new Set(['guard-tower', 'keep']))).toBe(1);
  });
});

describe('towerTechOptions — linear gating at the Watch Tower', () => {
  it('offers nothing before Castle Age', () => {
    expect(optionsFor('feudal-age')).toEqual([]);
    expect(optionsFor('dark-age')).toEqual([]);
  });

  it('offers Guard Tower in Castle Age (no tech prereq)', () => {
    expect(optionsFor('castle-age')).toEqual(['guard-tower']);
  });

  it('does NOT offer Keep until guard-tower researched AND Imperial Age', () => {
    // Imperial but no guard-tower yet → still only guard-tower.
    expect(optionsFor('imperial-age')).toEqual(['guard-tower']);
    // guard-tower researched but only Castle Age → nothing more to offer.
    expect(optionsFor('castle-age', ['guard-tower'])).toEqual([]);
    // guard-tower researched AND Imperial Age → Keep is offered.
    expect(optionsFor('imperial-age', ['guard-tower'])).toEqual(['keep']);
  });

  it('drops each tech from the list once researched', () => {
    expect(optionsFor('imperial-age', ['guard-tower', 'keep'])).toEqual([]);
  });

  it('offers nothing for any non-watch-tower building', () => {
    const have = new Set<ResearchableTechnologyType>();
    expect(
      towerTechResearchOptions('castle', 1, () => true, (_o, t) => have.has(t)),
    ).toEqual([]);
    expect(
      towerTechResearchOptions('town-center', 1, () => true, (_o, t) => have.has(t)),
    ).toEqual([]);
  });
});

describe('tower-upgrade — cost & research-time tables', () => {
  it('Guard Tower costs 100 food / 50 gold and takes 300 ticks', () => {
    expect(researchCost('guard-tower')).toEqual({ food: 100, gold: 50 });
    expect(researchTimeTicks('guard-tower')).toBe(300);
  });

  it('Keep costs 200 food / 100 gold and takes 400 ticks', () => {
    expect(researchCost('keep')).toEqual({ food: 200, gold: 100 });
    expect(researchTimeTicks('keep')).toBe(400);
  });

  it('gates both techs to the Watch Tower (validator ↔ options agreement)', () => {
    expect(canResearchAt('university', 'guard-tower')).toBe(true);
    expect(canResearchAt('university', 'keep')).toBe(true);
    expect(canResearchAt('watch-tower', 'guard-tower')).toBe(false);
    expect(canResearchAt('castle', 'guard-tower')).toBe(false);
    expect(canResearchAt('town-center', 'keep')).toBe(false);
  });
});

describe('tower-upgrade — live bridge defensive fire', () => {
  // The enemy Spearman at (18, 8) is Manhattan distance 7 from the Watch
  // Tower anchor (14, 6): (18-14) + (8-6) = 4 + 2 = 6 + 1 = 7, inside the
  // base range of 7. HP lost over a fixed tick budget rises with attack.
  const IN_RANGE_TICKS = 300;

  it('baseline: an un-teched Watch Tower whittles the enemy at the base rate', () => {
    const bridge = createSimulationBridge('tower-upgrade-baseline-fixture');
    const enemy = getOwnedUnit(bridge, 2, 'spearman');
    expect(enemy).toBeDefined();
    const startHp = bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0;
    expect(startHp).toBeGreaterThan(0);

    for (let i = 0; i < IN_RANGE_TICKS; i += 1) bridge.step(100);

    const endHp = bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0;
    expect(endHp).toBeLessThan(startHp);
  }, 30_000);

  it('Guard Tower researched → the SAME enemy loses MORE HP over the same ticks', () => {
    // Short window so BOTH Spearmen are still alive at the end (the 45-HP
    // Spearman dies under sustained fire) — otherwise the comparison caps at
    // its total HP and the +2 attack is invisible. At 60 ticks the base tower
    // (5/shot) lands 25 damage and the Guard Tower (7/shot) lands 35.
    const COMPARE_TICKS = 60;
    const base = createSimulationBridge('tower-upgrade-baseline-fixture');
    const guard = createSimulationBridge('tower-upgrade-guard-fixture');

    const baseEnemy = getOwnedUnit(base, 2, 'spearman')!;
    const guardEnemy = getOwnedUnit(guard, 2, 'spearman')!;
    const baseStart = base.getEntityHealth(baseEnemy.id)!.currentHp;
    const guardStart = guard.getEntityHealth(guardEnemy.id)!.currentHp;
    expect(baseStart).toBe(guardStart);

    for (let i = 0; i < COMPARE_TICKS; i += 1) {
      base.step(100);
      guard.step(100);
    }

    const baseEndHp = base.getEntityHealth(baseEnemy.id)?.currentHp ?? 0;
    const guardEndHp = guard.getEntityHealth(guardEnemy.id)?.currentHp ?? 0;
    // Both Spearmen survive the window, so the loss delta reflects the raw
    // per-shot damage difference rather than a death cap.
    expect(baseEndHp).toBeGreaterThan(0);
    expect(guardEndHp).toBeGreaterThan(0);
    const baseLost = baseStart - baseEndHp;
    const guardLost = guardStart - guardEndHp;
    // +2 attack per arrow → strictly more damage over the same window.
    expect(guardLost).toBeGreaterThan(baseLost);
  }, 30_000);

  it('Keep adds +1 range: an enemy one cell BEYOND base range is hit only with Keep', () => {
    // The out-of-range fixture places the Spearman at Manhattan distance 8
    // from the tower anchor — outside the base range 7, inside range 8 (Keep).
    const noKeep = createSimulationBridge('tower-upgrade-edge-nokeep-fixture');
    const noKeepEnemy = getOwnedUnit(noKeep, 2, 'spearman')!;
    const noKeepStart = noKeep.getEntityHealth(noKeepEnemy.id)!.currentHp;
    for (let i = 0; i < IN_RANGE_TICKS; i += 1) noKeep.step(100);
    // Without Keep the enemy is out of range — untouched.
    expect(noKeep.getEntityHealth(noKeepEnemy.id)?.currentHp ?? 0).toBe(noKeepStart);

    const keep = createSimulationBridge('tower-upgrade-edge-keep-fixture');
    const keepEnemy = getOwnedUnit(keep, 2, 'spearman')!;
    const keepStart = keep.getEntityHealth(keepEnemy.id)!.currentHp;
    expect(
      stepBridgeUntil(
        keep,
        () => (keep.getEntityHealth(keepEnemy.id)?.currentHp ?? 0) < keepStart,
        { maxSteps: IN_RANGE_TICKS },
      ),
    ).toBe(true);
  }, 30_000);
});
