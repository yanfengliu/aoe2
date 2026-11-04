// The selection panel's Melee armor and Pierce armor rows show the TOTAL
// armor, base plus upgrades, as Definitive Edition's panel does (work 140):
// for every building type in every age and armor-technology state, and for
// every unit type with and without the armor technologies, select it through
// the bridge and read the two numbers the panel renders.
//
// A building's rows must be the pinned DE armor (the oracle over
// tests/content/fixtures/deBuildingCombat.json), which is also what every hit
// on it meets (buildingDamageCensus.test.ts). A unit's must be what a hit on
// it meets: its base melee and pierce armor (the stat tables, held to
// units.csv by tests/content/baseStats.test.ts) plus the armor accumulators on
// its own combat state, read here from the saved world, not from the panel's
// code. Until work 140 the rows showed only the accumulators, and 0/0 for
// every building, so a Town Center read 0/0 where DE shows 3/5.
//
// BOUND: the panel's data (`SelectionState`), one selection at a time, at the
// first tick. That the HUD renders these numbers in those two rows is
// tests/ui/selectionPanelArmor.test.ts; that a real click on the Dark Age
// Town Center reads 3/5 is tests/browser/building-armor-panel.spec.ts.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  ARMOR_PANEL_AGES,
  ARMOR_PANEL_BUILDING_TECHS,
  ARMOR_PANEL_UNIT_TECHS,
  armorPanelBuildingsSeed,
  armorPanelUnitsSeed,
} from '../../src/game/simulation/fixtures/armorPanelCensus';
import { unitMeleeArmor, unitPierceArmor } from '../../src/game/simulation/prototypeUnitRules';
import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
import type { BuildingType, UnitType } from '../../src/game/simulation/types';
import { DE_BUILDING_COMBAT, oracleBuildingArmor } from './buildingCombatOracle';

describe('the panel shows every building\'s total DE armor', () => {
  for (const age of ARMOR_PANEL_AGES) {
    for (const [techKey, techs] of Object.entries(ARMOR_PANEL_BUILDING_TECHS)) {
      it(`${age}, ${techKey}`, () => {
        const bridge = createSimulationBridge(armorPanelBuildingsSeed(age, techKey));
        const problems: string[] = [];
        const seen = new Set<BuildingType>();
        for (const building of bridge.getEconomyState().buildings) {
          if (building.owner !== 1) continue;
          seen.add(building.buildingType);
          expect(bridge.selectEntityById(building.id), building.buildingType).toBe(true);
          const selection = bridge.getSelectionState();
          const de = oracleBuildingArmor(building.buildingType, age, new Set(techs));
          if (selection.armor !== de.melee || selection.pierceArmor !== de.pierce) {
            problems.push(`${building.buildingType}: panel ${String(selection.armor)}/${String(selection.pierceArmor)}, DE ${de.melee}/${de.pierce}`);
          }
        }
        expect(problems, problems.join('\n')).toEqual([]);
        expect([...seen].sort()).toEqual(DE_BUILDING_COMBAT.buildings.map((b) => b.id).sort());
      });
    }
  }
});

describe('the panel shows every unit\'s total armor', () => {
  for (const [techKey] of Object.entries(ARMOR_PANEL_UNIT_TECHS)) {
    it(techKey, () => {
      const bridge = createSimulationBridge(armorPanelUnitsSeed(techKey));
      // The accumulators every hit on a unit adds to its base armor, as saved.
      const combat = new Map((bridge.world.getState('aoe2.combatStates') ?? []) as Array<[number, { armor: number; pierceArmorBonus?: number }]>);
      const problems: string[] = [];
      const seen = new Set<UnitType>();
      let anyAccumulator = false;
      for (const unit of bridge.getEconomyState().units) {
        if (unit.owner !== 1) continue;
        seen.add(unit.unitType);
        const state = combat.get(unit.id);
        expect(state, `${unit.unitType}: combat state`).toBeDefined();
        anyAccumulator ||= state!.armor > 0;
        expect(bridge.selectEntityById(unit.id), unit.unitType).toBe(true);
        const selection = bridge.getSelectionState();
        const melee = unitMeleeArmor(unit.unitType) + state!.armor;
        const pierce = unitPierceArmor(unit.unitType) + state!.armor + (state!.pierceArmorBonus ?? 0);
        if (selection.armor !== melee || selection.pierceArmor !== pierce) {
          problems.push(`${unit.unitType}: panel ${String(selection.armor)}/${String(selection.pierceArmor)}, hits meet ${melee}/${pierce}`);
        }
      }
      expect(problems, problems.join('\n')).toEqual([]);
      expect(seen.size).toBe(Object.keys(UNIT_MAX_HP).length);
      // The armored scene must exercise the accumulators, or it proves nothing more than the plain one.
      expect(anyAccumulator).toBe(techKey === 'armored');
    });
  }
});
