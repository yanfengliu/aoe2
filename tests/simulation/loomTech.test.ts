import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  createOptionsRules,
  type OptionsRulesDeps,
} from '../../src/game/simulation/bridge/optionsRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import {
  combatDamageAfterArmor,
  effectiveMeleeArmor,
  effectivePierceArmor,
} from '../../src/game/simulation/prototypeUnitRules';
import { applyArmorTech, pierceArmorTechBonus } from '../../src/game/simulation/armorTechBonuses';
import type {
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../../src/game/simulation/types';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import type { SaveBlob } from '../../src/game/simulation/saveSchema';

// Loom (v0.1.40): the verified data-only Dark-Age Town Center tech from
// campaign-10. Researched at the TC, available in the Dark Age, no prereq
// beyond a standing TC, 50 gold, ~25 s. Effect on every villager (current AND
// future): +15 max HP (25 → 40, current HP bumped flat) + +1 armor.
//
// NOTE on the armor value: AoE2 Loom is +1 MELEE / +2 PIERCE armor. This slice
// ships +1/+1 (the single `CombatState.armor` scalar that the symmetric
// blacksmith armor techs already use); the extra +1 PIERCE is DEFERRED to a
// future asymmetric-armor-tech slice (when CombatState.armor splits into
// melee/pierce for all armor techs). See design/spec-final.md + roadmap M2.

type Bridge = ReturnType<typeof createSimulationBridge>;
type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
const AGE_ORDER: AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];

function optionsAt(
  age: AgeType,
  researched: ResearchableTechnologyType[] = [],
  canAdvanceTo?: AgeType,
) {
  const have = new Set(researched);
  const deps: OptionsRulesDeps = {
    latestResearchedInChain: () => 'villager' as TrainableUnitType,
    hasTechnology: (_owner, tech) => have.has(tech),
    getPlayerAge: () => age,
    isAtLeastAge: (_owner, min) => AGE_ORDER.indexOf(age) >= AGE_ORDER.indexOf(min),
    getPlayerCivilization: () => 'Franks',
    canAdvanceToFeudalAge: () => canAdvanceTo === 'feudal-age',
    canAdvanceToCastleAge: () => canAdvanceTo === 'castle-age',
    canAdvanceToImperialAge: () => canAdvanceTo === 'imperial-age',
    hasCompletedBuilding: () => true,
    hasOwnedWonder: () => false,
  };
  return createOptionsRules(deps);
}

function findFirstOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function villagerHealthViaSelection(
  bridge: Bridge,
  owner: number,
): { current: number; max: number } | null {
  if (!selectOwnedUnitDirect(bridge, owner, 'villager')) {
    return null;
  }
  const health = bridge.getSelectionState().health;
  return health ? { current: health.current, max: health.max } : null;
}

describe('Loom — researchable at the Town Center (options surface)', () => {
  it('offers Loom in the Dark Age and at every later age until researched', () => {
    expect(optionsAt('dark-age').getResearchOptions(1, 'town-center')).toEqual(['loom']);
    expect(optionsAt('feudal-age').getResearchOptions(1, 'town-center')).toContain('loom');
    expect(optionsAt('castle-age').getResearchOptions(1, 'town-center')).toContain('loom');
    expect(optionsAt('imperial-age').getResearchOptions(1, 'town-center')).toContain('loom');
  });

  it('drops Loom from the list once researched', () => {
    expect(optionsAt('dark-age', ['loom']).getResearchOptions(1, 'town-center')).toEqual([]);
    expect(optionsAt('feudal-age', ['loom']).getResearchOptions(1, 'town-center')).not.toContain(
      'loom',
    );
  });

  it('offers Loom alongside the age-up and carry techs (age-up still first)', () => {
    // Feudal, able to advance to Castle, nothing else researched: the age-up
    // comes first, then carry (wheelbarrow), then Loom.
    expect(
      optionsAt('feudal-age', [], 'castle-age').getResearchOptions(1, 'town-center'),
    ).toEqual(['castle-age', 'wheelbarrow', 'loom']);
  });

  it('surfaces Loom in getVisibleResearchOptions for the agent/HUD', () => {
    expect(optionsAt('dark-age').getVisibleResearchOptions(1, 'town-center')).toContain('loom');
    expect(
      optionsAt('feudal-age').getVisibleResearchOptions(1, 'town-center'),
    ).toEqual(['castle-age', 'wheelbarrow', 'loom']);
  });

  it('gates Loom to the Town Center (validator↔options agreement)', () => {
    expect(canResearchAt('town-center', 'loom')).toBe(true);
    expect(canResearchAt('blacksmith', 'loom')).toBe(false);
    expect(canResearchAt('barracks', 'loom')).toBe(false);
    expect(canResearchAt('lumber-camp', 'loom')).toBe(false);
  });
});

describe('Loom — cost & research-time tables', () => {
  it('costs 50 gold and takes 250 ticks (25 s × 10 TPS)', () => {
    expect(researchCost('loom')).toEqual({ gold: 50 });
    expect(researchTimeTicks('loom')).toBe(250);
  });
});

describe('Loom — asymmetric +1 melee / +2 pierce at the damage site (spec §11.8)', () => {
  it('gives a villager +1 melee armor and +2 pierce armor', () => {
    // Villager base melee/pierce armor is 0/0; Loom adds +1 to `armor` (melee)
    // and +1 extra pierce (via pierceArmorBonus), so effective pierce = 2.
    const state = { armor: 0, pierceArmorBonus: 0 };
    applyArmorTech(state, 'loom');
    expect(effectiveMeleeArmor('villager', state.armor)).toBe(1);
    expect(effectivePierceArmor('villager', pierceArmorTechBonus(state))).toBe(2);
  });

  it('a Loom villager takes 1 less melee and 2 less pierce damage', () => {
    const loom = { armor: 0, pierceArmorBonus: 0 };
    applyArmorTech(loom, 'loom');
    // Melee hit of 6: 6 - 0 = 6 vs base, 6 - 1 = 5 with Loom.
    expect(combatDamageAfterArmor(6, 'melee', effectiveMeleeArmor('villager', 0), 0)).toBe(6);
    expect(combatDamageAfterArmor(6, 'melee', effectiveMeleeArmor('villager', loom.armor), 0)).toBe(5);
    // Pierce hit of 5: 5 - 0 = 5 vs base, 5 - 2 = 3 with Loom (was 4 under the
    // old symmetric +1/+1 model — this is the asymmetry regression guard).
    expect(combatDamageAfterArmor(5, 'pierce', 0, effectivePierceArmor('villager', 0))).toBe(5);
    expect(
      combatDamageAfterArmor(5, 'pierce', 0, effectivePierceArmor('villager', pierceArmorTechBonus(loom))),
    ).toBe(3);
  });
});

describe('Loom — research charges 50 gold and records the tech', () => {
  it('spends 50 gold and adds loom to the researched set on completion', () => {
    const bridge = createSimulationBridge('loom-fixture');
    const goldBefore = bridge.getEconomyState().playerResources[1]?.gold ?? 0;
    expect(goldBefore).toBe(100);

    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    expect(bridge.queueResearch('loom')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const villager = findFirstOwnedUnit(bridge, 1, 'villager');
          // Loom is done once the villager max HP reaches 40.
          return !!villager && (villagerHealthViaSelection(bridge, 1)?.max ?? 0) === 40;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    expect(bridge.getEconomyState().playerResources[1]?.gold).toBe(50); // 100 - 50
  });

  it('rejects Loom when the owner cannot afford 50 gold', () => {
    // The broke fixture seeds player 1 with only 40 gold, so the 50-gold Loom
    // research hits the validator's insufficient_resources path.
    const bridge = createSimulationBridge('loom-broke-fixture');
    expect(bridge.getEconomyState().playerResources[1]?.gold).toBe(40);
    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    expect(bridge.queueResearch('loom')).toBe(false);
    // The villager is untouched — no research happened.
    expect(villagerHealthViaSelection(bridge, 1)).toEqual({ current: 25, max: 25 });
  });
});

describe('Loom — existing villagers gain +15 HP (flat) and +1 armor', () => {
  it('bumps an existing villager from 25/25 to 40/40 and armor 0 → 1', () => {
    const bridge = createSimulationBridge('loom-fixture');

    const before = villagerHealthViaSelection(bridge, 1);
    expect(before).toEqual({ current: 25, max: 25 });
    expect(bridge.getSelectionState().armor).toBe(0);

    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    expect(bridge.queueResearch('loom')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => (villagerHealthViaSelection(bridge, 1)?.max ?? 0) === 40,
        { maxSteps: 600 },
      ),
    ).toBe(true);

    const after = villagerHealthViaSelection(bridge, 1);
    // Flat +15 to BOTH current and max (a full-HP villager → 40/40).
    expect(after).toEqual({ current: 40, max: 40 });
    expect(bridge.getSelectionState().armor).toBe(1);
  });

  it('does NOT affect a non-villager (Militia) when Loom completes', () => {
    const bridge = createSimulationBridge('loom-fixture');
    const militiaBefore = findFirstOwnedUnit(bridge, 1, 'militia');
    expect(militiaBefore?.armor).toBe(0);

    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    expect(bridge.queueResearch('loom')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => (villagerHealthViaSelection(bridge, 1)?.max ?? 0) === 40,
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // The Militia is unchanged: its HP and armor are still the base values.
    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.getSelectionState().health).toEqual({ current: 40, max: 40 }); // militia base HP 40
    expect(bridge.getSelectionState().armor).toBe(0);
  });
});

describe('Loom — future villagers (trained / spawned after research) are boosted', () => {
  it('a villager created with Loom already researched starts at 40/40 + armor 1', () => {
    // The loom-researched fixture pre-applies Loom on boot, so the seeded
    // villager is created via createCombatState WITH the bonus.
    const bridge = createSimulationBridge('loom-researched-fixture');
    expect(villagerHealthViaSelection(bridge, 1)).toEqual({ current: 40, max: 40 });
    expect(bridge.getSelectionState().armor).toBe(1);
  });

  it('a NON-villager seeded with Loom researched is unaffected (40/40 militia, armor 0)', () => {
    const bridge = createSimulationBridge('loom-researched-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.getSelectionState().health).toEqual({ current: 40, max: 40 });
    expect(bridge.getSelectionState().armor).toBe(0);
  });
});

describe('Loom — no effect before research', () => {
  it('a base villager (no Loom) reads 25/25 + armor 0', () => {
    const bridge = createSimulationBridge('loom-fixture');
    expect(villagerHealthViaSelection(bridge, 1)).toEqual({ current: 25, max: 25 });
    expect(bridge.getSelectionState().armor).toBe(0);
  });
});

// Recursively delete every occurrence of `key` (simulates a pre-split save that
// never wrote the field) / collect every value stored under `key`.
function deepDelete(node: unknown, key: string): void {
  if (Array.isArray(node)) {
    node.forEach((child) => deepDelete(child, key));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === key) delete (node as Record<string, unknown>)[k];
      else deepDelete(v, key);
    }
  }
}
function deepCollect(node: unknown, key: string, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    node.forEach((child) => deepCollect(child, key, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === key) out.push(v);
      deepCollect(v, key, out);
    }
  }
  return out;
}

describe('Loom — save round-trip', () => {
  it('a pre-split schema-2 save (no pierceArmorBonus) survives load + Loom research without NaN', () => {
    // Regression for the melee/pierce armor split: a save written before the
    // split has no `pierceArmorBonus`. Loading it and then researching Loom (an
    // asymmetric +1 melee / +2 pierce tech) must not turn the villagers' pierce
    // armor into NaN (undefined + 1). Both reviewers flagged this on the
    // schema-2 (current) load path.
    const bridge1 = createSimulationBridge('loom-fixture');
    const stripped: SaveBlob = JSON.parse(JSON.stringify(bridge1.saveGame())) as SaveBlob;
    deepDelete(stripped, 'pierceArmorBonus');
    expect(deepCollect(stripped, 'pierceArmorBonus')).toHaveLength(0);

    const bridge2 = createSimulationBridge('loom-fixture', { savedGame: stripped });
    expect(selectOwnedBuildingDirect(bridge2, 1, 'town-center')).toBe(true);
    expect(bridge2.queueResearch('loom')).toBe(true);
    expect(
      stepBridgeUntil(bridge2, () => (villagerHealthViaSelection(bridge2, 1)?.max ?? 0) === 40, {
        maxSteps: 600,
      }),
    ).toBe(true);
    expect(bridge2.getSelectionState().armor).toBe(1); // melee side intact

    // Re-save and inspect the persisted pierce bonuses: a NaN serializes to
    // null, so requiring every value to be a finite number catches the bug,
    // and the Loom'd villager's extra pierce bonus is 1.
    const after = JSON.parse(JSON.stringify(bridge2.saveGame())) as SaveBlob;
    const bonuses = deepCollect(after, 'pierceArmorBonus');
    expect(bonuses.length).toBeGreaterThan(0);
    expect(bonuses.every((v) => typeof v === 'number' && Number.isFinite(v))).toBe(true);
    expect(bonuses).toContain(1);
  });

  it('persists the researched tech and the boosted villager stats across save/load', () => {
    const bridge1 = createSimulationBridge('loom-fixture');
    expect(selectOwnedBuildingDirect(bridge1, 1, 'town-center')).toBe(true);
    expect(bridge1.queueResearch('loom')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge1,
        () => (villagerHealthViaSelection(bridge1, 1)?.max ?? 0) === 40,
        { maxSteps: 600 },
      ),
    ).toBe(true);

    const blob = bridge1.saveGame();
    // JSON round-trip to prove nothing relies on runtime references.
    const parsed: SaveBlob = JSON.parse(JSON.stringify(blob)) as SaveBlob;
    const bridge2 = createSimulationBridge('loom-fixture', { savedGame: parsed });

    // The loaded villager that had Loom still reads 40 HP + armor 1.
    expect(villagerHealthViaSelection(bridge2, 1)).toEqual({ current: 40, max: 40 });
    expect(bridge2.getSelectionState().armor).toBe(1);
  });

  it('round-trips loom in the researched set + the boosted villager stats across save/load', () => {
    // loom-researched-fixture has loom in the researched set on boot. Saving +
    // loading keeps loom in the set AND restores the boosted villager's stats
    // (40/40 + armor 1). The post-load createCombatState re-derive for a NEWLY
    // trained villager is covered by the 'created with Loom researched starts at
    // 40/40' test (the seed-time createCombatState path).
    const bridge1 = createSimulationBridge('loom-researched-fixture');
    const blob = bridge1.saveGame();
    const parsed: SaveBlob = JSON.parse(JSON.stringify(blob)) as SaveBlob;
    const bridge2 = createSimulationBridge('loom-researched-fixture', { savedGame: parsed });
    expect(villagerHealthViaSelection(bridge2, 1)).toEqual({ current: 40, max: 40 });
    expect(bridge2.getSelectionState().armor).toBe(1);
  });
});
