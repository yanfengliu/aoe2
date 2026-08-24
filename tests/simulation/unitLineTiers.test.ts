// Three tiers the roster was missing, each completing a line that already
// existed. Comparing the UnitType union against units.csv found 20 names the
// code did not carry; most are wildlife modelled as resources, out-of-scope
// (King, Regicide only), or renames — these three are real gaps:
//
//   Battering Ram -> [Capped Ram] -> Siege Ram   (the line skipped a tier)
//   Mangonel -> Onager -> [Siege Onager]         (the line stopped a tier short)
//   Skirmisher -> [Elite Skirmisher]             (the line never improved)

import { describe, it, expect } from 'vitest';

import { UNIT_LINE_UPGRADES } from '../../src/game/simulation/bridge/unitLineUpgrades';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import { researchCost, researchTimeTicks, trainingCost } from '../../src/game/simulation/prototypeEconomyRules';
import {
  unitAttackDamage,
  unitMaxHp,
  unitPierceArmor,
} from '../../src/game/simulation/prototypeUnitRules';

describe('the three missing unit tiers', () => {
  it('upgrades from the tier below, so the ram line is three deep', () => {
    expect(UNIT_LINE_UPGRADES['capped-ram-upgrade']).toEqual({
      from: ['battering-ram'],
      to: 'capped-ram',
    });
    // The Siege Ram now takes the Capped Ram as its input, which is what
    // units.csv says ("Siege Ram: Upgraded Capped Ram") — it used to upgrade
    // straight from the Battering Ram and skip the tier entirely.
    expect(UNIT_LINE_UPGRADES['siege-ram-upgrade']).toEqual({
      from: ['capped-ram'],
      to: 'siege-ram',
    });
    expect(UNIT_LINE_UPGRADES['siege-onager-upgrade']).toEqual({
      from: ['onager'],
      to: 'siege-onager',
    });
    expect(UNIT_LINE_UPGRADES['elite-skirmisher-upgrade']).toEqual({
      from: ['skirmisher'],
      to: 'elite-skirmisher',
    });
  });

  it('carries the stats its data row gives it', () => {
    // units.csv: Capped Ram 200 HP / attack 3; Siege Onager 70 HP / attack 75;
    // Elite Skirmisher 35 HP / attack 3 / pierce armour 4.
    expect(unitMaxHp('capped-ram')).toBe(200);
    expect(unitMaxHp('siege-onager')).toBe(70);
    expect(unitMaxHp('elite-skirmisher')).toBe(35);
    expect(unitAttackDamage('siege-onager')).toBe(75);
    expect(unitPierceArmor('elite-skirmisher')).toBe(4);
  });

  it('never regresses on the tier below it', () => {
    // The invariant the elite-unit batch settled on: no axis goes backwards and
    // at least one improves. It is what catches a swapped pair of data rows.
    for (const [base, upgraded] of [
      ['battering-ram', 'capped-ram'],
      ['onager', 'siege-onager'],
      ['skirmisher', 'elite-skirmisher'],
    ] as const) {
      expect(unitMaxHp(upgraded)).toBeGreaterThanOrEqual(unitMaxHp(base));
      expect(unitAttackDamage(upgraded)).toBeGreaterThanOrEqual(unitAttackDamage(base));
      expect(unitPierceArmor(upgraded)).toBeGreaterThanOrEqual(unitPierceArmor(base));
      const better = unitMaxHp(upgraded) > unitMaxHp(base)
        || unitAttackDamage(upgraded) > unitAttackDamage(base)
        || unitPierceArmor(upgraded) > unitPierceArmor(base);
      expect(better, `${upgraded} must beat ${base} on something`).toBe(true);
    }
  });

  it('costs what technologies.csv charges', () => {
    expect(researchCost('capped-ram-upgrade')).toEqual({ food: 300 });
    expect(researchTimeTicks('capped-ram-upgrade')).toBe(500);
    expect(researchCost('siege-onager-upgrade')).toEqual({ food: 1450, gold: 1000 });
    expect(researchCost('elite-skirmisher-upgrade')).toEqual({ wood: 250, gold: 160 });
    // The units themselves cost what their base tier costs, as AoE2 upgrades do.
    expect(trainingCost('capped-ram')).toEqual(trainingCost('siege-ram'));
    expect(trainingCost('elite-skirmisher')).toEqual({ food: 25, wood: 35 });
  });
});

// v0.3.45 added the Elite Skirmisher, its upgrade and every table entry for
// both — and no command card ever offered the research, so the line still never
// improved in a real game. The test that "proved" it used a fixture with the
// upgrade PRE-RESEARCHED. This is the check that would have caught it: research
// it the way a player does, then watch the menu resolve to the new tier.
describe('the Elite Skirmisher upgrade can be researched by a player', () => {
  it('is offered at a Castle-Age Archery Range and moves the line up a tier', () => {
    const bridge = createSimulationBridge('imperial-upgrades-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('elite-skirmisher-upgrade');
    // Before the research the line's menu entry is the base Skirmisher.
    expect(bridge.getSelectionState().trainOptions).toContain('skirmisher');
    expect(bridge.getSelectionState().trainOptions).not.toContain('elite-skirmisher');

    expect(bridge.queueResearch('elite-skirmisher-upgrade')).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => {
        selectOwnedBuildingDirect(bridge, 1, 'archery-range');
        return !bridge.getSelectionState().researchOptions.includes('elite-skirmisher-upgrade');
      },
      { maxSteps: 1_500 },
    )).toBe(true);

    // And now the line offers the tier it was upgraded to.
    selectOwnedBuildingDirect(bridge, 1, 'archery-range');
    expect(bridge.getSelectionState().trainOptions).toContain('elite-skirmisher');
    expect(bridge.getSelectionState().trainOptions).not.toContain('skirmisher');
  }, 60_000);
});
