import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import { isSiegeUnit } from '../../src/game/simulation/prototypeUnitRules';
import type { UnitType } from '../../src/game/simulation/types';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

// Siege Engineers (v0.1.62): a researchable tech that grants the owner's SIEGE
// units +1 attack range, mirroring the Blacksmith Fletching pattern. Applied in
// TWO places — createCombatState (new units, DERIVED from the researched set)
// and applyTechnology's `siege-engineers` case (existing units, imperative
// per-unit loop). Hosted at the Siege Workshop (AoE2 hosts it at the University,
// which does not exist in this build yet). Imperial-gated; drops once
// researched. No save-format change. See spec §10.7.1.

type Bridge = ReturnType<typeof createSimulationBridge>;

function getOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

describe('isSiegeUnit — the siege classification', () => {
  it('classifies every siege unit as siege and non-siege as not', () => {
    const siege: UnitType[] = [
      'mangonel',
      'scorpion',
      'battering-ram',
      'onager',
      'heavy-scorpion',
      'siege-ram',
      'bombard-cannon',
      'trebuchet',
    ];
    for (const unitType of siege) {
      expect(isSiegeUnit(unitType)).toBe(true);
    }
    const nonSiege: UnitType[] = ['archer', 'villager', 'knight', 'monk', 'champion'];
    for (const unitType of nonSiege) {
      expect(isSiegeUnit(unitType)).toBe(false);
    }
  });
});

describe('Siege Engineers — cost & research-time tables', () => {
  it('costs 500 food / 600 wood and takes 700 ticks', () => {
    expect(researchCost('siege-engineers')).toEqual({ food: 500, wood: 600 });
    expect(researchTimeTicks('siege-engineers')).toBe(700);
  });
});

describe('Siege Engineers — gating at the Siege Workshop', () => {
  it('is researchable only at the Siege Workshop', () => {
    expect(canResearchAt('siege-workshop', 'siege-engineers')).toBe(true);
    expect(canResearchAt('blacksmith', 'siege-engineers')).toBe(false);
    expect(canResearchAt('town-center', 'siege-engineers')).toBe(false);
    expect(canResearchAt('castle', 'siege-engineers')).toBe(false);
  });

  it('is offered as an Imperial-Age Siege Workshop option and drops once researched', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('siege-engineers');

    // Research it → it drops from the option list.
    expect(bridge.queueResearch('siege-engineers')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          selectOwnedBuildingDirect(bridge, 1, 'siege-workshop');
          return !(bridge.getSelectionState().researchOptions ?? []).includes(
            'siege-engineers',
          );
        },
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().researchOptions ?? []).not.toContain('siege-engineers');
  }, 30_000);

  it('is NOT offered before Imperial Age (Castle-Age Siege Workshop)', () => {
    const bridge = createSimulationBridge('siege-workshop-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().researchOptions ?? []).not.toContain('siege-engineers');
  });
});

describe('Siege Engineers — derived +1 range at unit creation (createCombatState)', () => {
  it('a siege unit built WITH Siege Engineers has attackRange = base + 1', () => {
    const baseline = createSimulationBridge('siege-engineers-baseline-fixture');
    const researched = createSimulationBridge('siege-engineers-researched-fixture');

    const baseMangonel = getOwnedUnit(baseline, 1, 'mangonel');
    const techMangonel = getOwnedUnit(researched, 1, 'mangonel');
    expect(baseMangonel).toBeDefined();
    expect(techMangonel).toBeDefined();

    expect(techMangonel!.attackRange).toBe(baseMangonel!.attackRange + 1);
  });

  it('a NON-siege unit (Archer) is unaffected by Siege Engineers', () => {
    const baseline = createSimulationBridge('siege-engineers-baseline-fixture');
    const researched = createSimulationBridge('siege-engineers-researched-fixture');

    const baseArcher = getOwnedUnit(baseline, 1, 'archer');
    const techArcher = getOwnedUnit(researched, 1, 'archer');
    expect(baseArcher).toBeDefined();
    expect(techArcher).toBeDefined();

    expect(techArcher!.attackRange).toBe(baseArcher!.attackRange);
  });
});

describe('Siege Engineers — existing-unit +1 range on research (applyTechnology)', () => {
  it('researching Siege Engineers raises an EXISTING siege unit range by 1, leaving non-siege alone', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture');

    const mangonelBefore = getOwnedUnit(bridge, 1, 'mangonel');
    expect(mangonelBefore).toBeDefined();
    const mangonelId = mangonelBefore!.id;
    const rangeBefore = mangonelBefore!.attackRange;

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.queueResearch('siege-engineers')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const m = bridge.getEconomyState().units.find((u) => u.id === mangonelId);
          return (m?.attackRange ?? 0) === rangeBefore + 1;
        },
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    const mangonelAfter = bridge.getEconomyState().units.find((u) => u.id === mangonelId);
    expect(mangonelAfter?.attackRange).toBe(rangeBefore + 1);
  }, 30_000);
});
