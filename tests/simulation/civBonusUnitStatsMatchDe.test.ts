// Civilization bonuses on a unit's own numbers do what Definitive Edition's do
// (work 120 M3; defect register 2026-10-12, "Six civilization bonuses departed
// from Definitive Edition's text").
//
// SOURCE: the civilization help texts in SiegeEngineers/aoe2techtree
// data/locales/en/strings.json at 3bb43b14 (DE update 185872):
//  - Italians: "Foot Archers and Condottieri +1 melee/+1 pierce armor"
//  - Vietnamese: "Foot Archers and Skirmishers +20% HP"
//  - Spanish: "Gunpowder Units attack +18% faster"
// DE's labels for its unique units give the classes. "(Foot Archer)" is the
// Longbowman, Chu Ko Nu, Plumed Archer, Genoese Crossbowman and Rattan Archer,
// so Foot Archers are the Archer line and those. The Skirmisher line is named
// apart ("Foot Archers and Skirmishers"), the Janissary is a "Foot Gunner", the
// Conquistador a "Mounted Gunner", and the Mangudai and War Wagon "Mounted
// Archer". The sets below are written out from those labels, not read from the
// code, so a census cannot agree with the code by construction.
//
// THE DEFECTS: the Italian armour had no implementation. The Vietnamese +20%
// reached every Archery Range unit, the Cavalry Archer line and the Hand
// Cannoneer included. The Spanish attack speed left out the Conquistador and
// the Janissary.
//
// THE CLASS: a civilization bonus on a unit's numbers whose scope or presence
// departs from DE's text. Each census walks every unit type in every age
// through the combat-state factory, which makes a unit's numbers when it is
// created and when a line upgrade rebuilds it, against the Britons, who have
// no bonus on these numbers. It asks that exactly DE's class differs, by
// exactly DE's amount.
//
// BOUNDS: the factory, and units made in a real match. A unit standing in a
// game saved before this change keeps the numbers it was saved with until a
// line upgrade rebuilds it (spec §11.11). A converted unit keeps its old
// owner's numbers, as it always has. The Genoese Crossbowman, Condottiero,
// Rattan Archer and Imperial Skirmisher are not in this build.

import { describe, expect, it } from 'vitest';

import { pierceArmorTechBonus } from '../../src/game/simulation/armorTechBonuses';
import { createCombatStateFactory } from '../../src/game/simulation/bridge/combatStateFactory';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { effectiveMeleeArmor, effectivePierceArmor, unitMaxHp, unitReloadTicks } from '../../src/game/simulation/prototypeUnitRules';
import { UNIT_BASE_SPEED_PERCENT } from '../../src/game/simulation/prototypeUnitRules/unitBaseSpeed';
import type { AgeType, UnitType } from '../../src/game/simulation/types';
import { selectOwnedBuildingDirect, selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

const AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
// Every unit type: the base-speed table is a Record<UnitType, ...>, so the
// compiler holds it complete.
const EVERY_UNIT_TYPE = Object.keys(UNIT_BASE_SPEED_PERCENT) as UnitType[];

const DE_FOOT_ARCHERS: ReadonlySet<UnitType> = new Set<UnitType>([
  'archer', 'crossbowman', 'arbalest',
  'longbowman', 'elite-longbowman',
  'chu-ko-nu', 'elite-chu-ko-nu',
  'plumed-archer', 'elite-plumed-archer',
]);
const DE_SKIRMISHERS: ReadonlySet<UnitType> = new Set<UnitType>(['skirmisher', 'elite-skirmisher']);
const DE_GUNPOWDER_UNITS: ReadonlySet<UnitType> = new Set<UnitType>([
  'hand-cannoneer', 'bombard-cannon', 'cannon-galleon', 'elite-cannon-galleon',
  'conquistador', 'elite-conquistador', 'janissary', 'elite-janissary',
]);

function made(civilization: string, unitType: UnitType, age: AgeType) {
  return createCombatStateFactory({
    hasTechnology: () => false,
    getCivilization: () => civilization,
    getAge: () => age,
  })(1, unitType);
}

function meleeArmor(civilization: string, unitType: UnitType, age: AgeType): number {
  return effectiveMeleeArmor(unitType, made(civilization, unitType, age).armor);
}

function pierceArmor(civilization: string, unitType: UnitType, age: AgeType): number {
  return effectivePierceArmor(unitType, pierceArmorTechBonus(made(civilization, unitType, age)));
}

describe('the combat-state factory gives each bonus to DE\'s class alone', () => {
  it('Italian Foot Archers have +1 melee and +1 pierce armor in every age, and no other unit changes', () => {
    const wrong: string[] = [];
    let armoured = 0;
    for (const unitType of EVERY_UNIT_TYPE) {
      for (const age of AGES) {
        const expected = DE_FOOT_ARCHERS.has(unitType) ? 1 : 0;
        const melee = meleeArmor('Italians', unitType, age) - meleeArmor('Britons', unitType, age);
        const pierce = pierceArmor('Italians', unitType, age) - pierceArmor('Britons', unitType, age);
        if (melee !== expected || pierce !== expected) {
          wrong.push(`${unitType} in the ${age}: +${melee}/+${pierce}, expected +${expected}/+${expected}`);
        }
        if (expected) armoured += 1;
      }
    }
    expect(wrong).toEqual([]);
    expect(armoured).toBe(DE_FOOT_ARCHERS.size * AGES.length);
  });

  it('Vietnamese Foot Archers and Skirmishers have +20% HP in every age, and no other unit changes', () => {
    const wrong: string[] = [];
    for (const unitType of EVERY_UNIT_TYPE) {
      for (const age of AGES) {
        const inClass = DE_FOOT_ARCHERS.has(unitType) || DE_SKIRMISHERS.has(unitType);
        const expected = inClass ? Math.round(unitMaxHp(unitType) * 1.2) : made('Britons', unitType, age).maxHp;
        const actual = made('Vietnamese', unitType, age).maxHp;
        if (actual !== expected) wrong.push(`${unitType} in the ${age}: ${actual} HP, expected ${expected}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('Spanish Gunpowder Units attack 18% faster in every age, the Conquistador included, and no other unit changes', () => {
    const wrong: string[] = [];
    for (const unitType of EVERY_UNIT_TYPE) {
      for (const age of AGES) {
        const expected = DE_GUNPOWDER_UNITS.has(unitType)
          ? Math.max(1, Math.round(unitReloadTicks(unitType) / 1.18))
          : made('Britons', unitType, age).reloadTicks;
        const actual = made('Spanish', unitType, age).reloadTicks;
        if (actual !== expected) wrong.push(`${unitType} in the ${age}: reload ${actual} ticks, expected ${expected}`);
      }
    }
    expect(wrong).toEqual([]);
    // Not vacuous: the Conquistador's own reload moves (29 ticks to 25).
    expect(made('Spanish', 'conquistador', 'castle-age').reloadTicks)
      .toBeLessThan(made('Britons', 'conquistador', 'castle-age').reloadTicks);
  });
});

type Bridge = ReturnType<typeof createSimulationBridge>;

function trainAt(bridge: Bridge, building: string, unitType: string): number {
  const before = new Set(bridge.getEconomyState().units.map((unit) => unit.id));
  expect(selectOwnedBuildingDirect(bridge, 1, building)).toBe(true);
  expect(bridge.queueTrainUnit(unitType as never)).toBe(true);
  let id: number | undefined;
  expect(stepBridgeUntil(bridge, () => {
    id = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === unitType && !before.has(unit.id),
    )?.id;
    return id !== undefined;
  }, { maxSteps: 900 })).toBe(true);
  return id!;
}

function panelArmor(bridge: Bridge, unitType: string): { melee: number | null; pierce: number | null } {
  expect(selectOwnedUnitDirect(bridge, 1, unitType)).toBe(true);
  const panel = bridge.getSelectionState();
  return { melee: panel.armor, pierce: panel.pierceArmor };
}

describe('units made in a real match', () => {
  it('an Italian Archer trained at the Archery Range shows +1 melee and +1 pierce armor in its panel', () => {
    const armorOfTrained = (civilization: string) => {
      const bridge = createSimulationBridge('new-unit-reach-fixture', {
        civilizationsByOwner: new Map([[1, civilization]]),
      });
      trainAt(bridge, 'archery-range', 'archer');
      return panelArmor(bridge, 'archer');
    };
    const plain = armorOfTrained('Britons');
    expect(armorOfTrained('Italians')).toEqual({ melee: plain.melee! + 1, pierce: plain.pierce! + 1 });
  }, 60_000);

  it('a Vietnamese Archer and Elite Skirmisher train at +20% HP, and a Cavalry Archer at its plain HP', () => {
    // The Vietnamese tree has no Hand Cannoneer (tech-tree.csv), so the
    // census above is the only place its hit points are asked about.
    const bridge = createSimulationBridge('new-unit-reach-fixture', {
      civilizationsByOwner: new Map([[1, 'Vietnamese']]),
    });
    const hp = (id: number) => bridge.getEntityHealth(id)?.maxHp;
    expect(hp(trainAt(bridge, 'archery-range', 'archer'))).toBe(Math.round(unitMaxHp('archer') * 1.2));
    expect(hp(trainAt(bridge, 'archery-range', 'elite-skirmisher'))).toBe(Math.round(unitMaxHp('elite-skirmisher') * 1.2));
    expect(hp(trainAt(bridge, 'archery-range', 'cavalry-archer'))).toBe(unitMaxHp('cavalry-archer'));
  }, 90_000);

  it('a Spanish Conquistador and Elite Conquistador reload 18% faster than a plain one', () => {
    const reloadOf = (civilization: string, unitType: string) => createSimulationBridge('unit-showcase-fixture', {
      civilizationsByOwner: new Map([[1, civilization]]),
    }).getEconomyState().units.find((unit) => unit.owner === 1 && unit.unitType === unitType)!.reloadTicks;
    for (const unitType of ['conquistador', 'elite-conquistador']) {
      expect(reloadOf('Spanish', unitType), unitType)
        .toBe(Math.max(1, Math.round(reloadOf('Britons', unitType) / 1.18)));
    }
  }, 60_000);
});
