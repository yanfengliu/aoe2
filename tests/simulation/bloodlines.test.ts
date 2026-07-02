import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import { BLOODLINES_BONUS_HP } from '../../src/game/simulation/bridge/bloodlinesEffect';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

// Bloodlines (v0.1.65; gate + scope conformance-fixed v0.1.67): a researchable
// Stable tech granting the owner's MOUNTED units (cavalry + cavalry archers,
// technologies.csv:78) +20 HP, mirroring the Loom (villager HP) and Sanctity
// (monk HP) imperative pattern. Applied in TWO places — createCombatState (new
// units, DERIVED from the researched set) and applyTechnology's `bloodlines`
// case (existing units, via bloodlinesEffect) — both sharing isMountedUnit.
// Hosted at the Stable, FEUDAL Age (as in AoE2), drops once researched. No
// save-format change.

type Bridge = ReturnType<typeof createSimulationBridge>;

function getOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

describe('Bloodlines — cost & research-time tables', () => {
  it('costs 150 food / 100 gold and takes 500 ticks', () => {
    expect(researchCost('bloodlines')).toEqual({ food: 150, gold: 100 });
    expect(researchTimeTicks('bloodlines')).toBe(500);
  });
});

describe('Bloodlines — gating at the Stable', () => {
  it('is researchable only at the Stable', () => {
    expect(canResearchAt('stable', 'bloodlines')).toBe(true);
    expect(canResearchAt('blacksmith', 'bloodlines')).toBe(false);
    expect(canResearchAt('town-center', 'bloodlines')).toBe(false);
    expect(canResearchAt('monastery', 'bloodlines')).toBe(false);
  });

  it('is offered at a Castle+/Stable and drops once researched', () => {
    const bridge = createSimulationBridge('imperial-stable-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('bloodlines');

    expect(bridge.queueResearch('bloodlines')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          selectOwnedBuildingDirect(bridge, 1, 'stable');
          return !(bridge.getSelectionState().researchOptions ?? []).includes('bloodlines');
        },
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().researchOptions ?? []).not.toContain('bloodlines');
  }, 30_000);

  it('IS offered at a FEUDAL-Age Stable (technologies.csv:78 — v0.1.67 conformance fix)', () => {
    const bridge = createSimulationBridge('bloodlines-feudal-stable-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    const options = bridge.getSelectionState().researchOptions ?? [];
    expect(options).toContain('bloodlines');
    // The Castle-gated stable techs must NOT leak down to Feudal with the
    // restructured branch (husbandry's negative guard lives in husbandry.test).
    expect(options).not.toContain('light-cavalry-upgrade');
  });
});

describe('Bloodlines — derived +20 mounted HP at unit creation (createCombatState)', () => {
  it('a cavalry unit built WITH Bloodlines has maxHp = base + 20', () => {
    const baseline = createSimulationBridge('bloodlines-baseline-fixture');
    const researched = createSimulationBridge('bloodlines-researched-fixture');

    const baseKnight = getOwnedUnit(baseline, 1, 'knight');
    const techKnight = getOwnedUnit(researched, 1, 'knight');
    expect(baseKnight).toBeDefined();
    expect(techKnight).toBeDefined();

    const baseHp = baseline.getEntityHealth(baseKnight!.id)!;
    const techHp = researched.getEntityHealth(techKnight!.id)!;
    expect(techHp.maxHp).toBe(baseHp.maxHp + BLOODLINES_BONUS_HP);
    expect(techHp.currentHp).toBe(baseHp.currentHp + BLOODLINES_BONUS_HP);
  });

  it('a mounted ARCHER (Cavalry Archer) built WITH Bloodlines has maxHp = base + 20 (csv:78 applies-to)', () => {
    const baseline = createSimulationBridge('bloodlines-baseline-fixture');
    const researched = createSimulationBridge('bloodlines-researched-fixture');

    const baseArcher = getOwnedUnit(baseline, 1, 'cavalry-archer');
    const techArcher = getOwnedUnit(researched, 1, 'cavalry-archer');
    expect(baseArcher).toBeDefined();
    expect(techArcher).toBeDefined();

    const baseHp = baseline.getEntityHealth(baseArcher!.id)!;
    const techHp = researched.getEntityHealth(techArcher!.id)!;
    expect(techHp.maxHp).toBe(baseHp.maxHp + BLOODLINES_BONUS_HP);
    expect(techHp.currentHp).toBe(baseHp.currentHp + BLOODLINES_BONUS_HP);
  });

  it('a NON-cavalry unit (Militia) is unaffected by Bloodlines', () => {
    const baseline = createSimulationBridge('bloodlines-baseline-fixture');
    const researched = createSimulationBridge('bloodlines-researched-fixture');

    const baseMilitia = getOwnedUnit(baseline, 1, 'militia');
    const techMilitia = getOwnedUnit(researched, 1, 'militia');
    expect(baseMilitia).toBeDefined();
    expect(techMilitia).toBeDefined();

    const baseHp = baseline.getEntityHealth(baseMilitia!.id)!;
    const techHp = researched.getEntityHealth(techMilitia!.id)!;
    expect(techHp.maxHp).toBe(baseHp.maxHp);
    expect(techHp.currentHp).toBe(baseHp.currentHp);
  });
});

describe('Bloodlines — existing-unit +20 HP on research (applyTechnology)', () => {
  it('researching Bloodlines raises an EXISTING cavalry unit maxHp by 20', () => {
    const bridge = createSimulationBridge('imperial-stable-fixture');

    const knightBefore = getOwnedUnit(bridge, 1, 'knight');
    expect(knightBefore).toBeDefined();
    const knightId = knightBefore!.id;
    const maxHpBefore = bridge.getEntityHealth(knightId)!.maxHp;

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.queueResearch('bloodlines')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => (bridge.getEntityHealth(knightId)?.maxHp ?? 0) === maxHpBefore + BLOODLINES_BONUS_HP,
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    expect(bridge.getEntityHealth(knightId)!.maxHp).toBe(maxHpBefore + BLOODLINES_BONUS_HP);
  }, 30_000);

  it('researching Bloodlines at a FEUDAL stable raises an EXISTING cavalry archer maxHp by 20', () => {
    const bridge = createSimulationBridge('bloodlines-feudal-stable-fixture');

    const archerBefore = getOwnedUnit(bridge, 1, 'cavalry-archer');
    expect(archerBefore).toBeDefined();
    const archerId = archerBefore!.id;
    const maxHpBefore = bridge.getEntityHealth(archerId)!.maxHp;

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.queueResearch('bloodlines')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => (bridge.getEntityHealth(archerId)?.maxHp ?? 0) === maxHpBefore + BLOODLINES_BONUS_HP,
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    expect(bridge.getEntityHealth(archerId)!.maxHp).toBe(maxHpBefore + BLOODLINES_BONUS_HP);
  }, 30_000);
});
