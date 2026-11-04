import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import { isInfantryUnit } from '../../src/game/simulation/prototypeUnitRules';
import { attackOnBuilding, SAPPERS_BUILDING_ATTACK } from '../../src/game/simulation/buildingAttack';
import type { ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

// Sappers (v0.1.64; villagers since v0.3.132, DE's classes since work 140): a
// Castle technology giving the owner's VILLAGERS +15 attack against the
// Building and Stone Defense classes (DE effect 321). It is DERIVED where a hit
// on a building is resolved (buildingAttack.ts), and the building's armor in
// those classes takes its share like any attack's. No per-unit state, no
// save-format change. See spec §10.7.2.

type Bridge = ReturnType<typeof createSimulationBridge>;

const WITH_SAPPERS: ReadonlySet<ResearchableTechnologyType> = new Set(['sappers']);
const NO_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();

// Step a villager into destroying the enemy house and return the tick count it
// took (in 5-tick units). The house does not fire back and AI is disabled, so
// the only variable is the villager's per-hit building damage — with Sappers the
// house dies in strictly fewer ticks.
function unitsToDestroyEnemyHouse(fixtureName: string): number {
  const bridge: Bridge = createSimulationBridge(fixtureName);
  const house = bridge
    .getEconomyState()
    .buildings.find((b) => b.owner === 2 && b.buildingType === 'house');
  expect(house).toBeDefined();
  const houseId = house!.id;

  // The villager sits at (13, 8), adjacent to the house at (14, 8).
  expect(bridge.selectEntityAtCell(13, 8)).toBe(true);
  expect(bridge.issueContextCommandAtEntity(houseId)).toBe(true);

  let ticks = 0;
  const MAX = 1500; // 7500 sim ticks — ample for a villager's 5 a blow to fell the 900-HP House.
  while (ticks < MAX) {
    bridge.step(500); // 5 ticks per iteration.
    ticks += 1;
    const gone =
      bridge.getEconomyState().buildings.find((b) => b.id === houseId) === undefined;
    if (gone) {
      return ticks;
    }
  }
  return MAX;
}

describe('isInfantryUnit — the infantry classification', () => {
  it('classifies militia-line and spearman-line as infantry, others not', () => {
    const infantry: UnitType[] = [
      'militia',
      'man-at-arms',
      'long-swordsman',
      'two-handed-swordsman',
      'champion',
      'spearman',
      'pikeman',
      'halberdier',
    ];
    for (const unitType of infantry) {
      expect(isInfantryUnit(unitType)).toBe(true);
    }
    const nonInfantry: UnitType[] = ['archer', 'villager', 'knight', 'mangonel', 'monk'];
    for (const unitType of nonInfantry) {
      expect(isInfantryUnit(unitType)).toBe(false);
    }
  });
});

describe('Sappers — villagers +15 against the Building and Stone Defense classes', () => {
  const owner = (technologies: ReadonlySet<ResearchableTechnologyType>) => (
    { technologies, civilization: undefined, age: 'imperial-age' as const, teamBonus: 0 }
  );

  it('adds nothing without the tech', () => {
    expect(attackOnBuilding('villager', 3, owner(NO_TECHS)).classes).toEqual({ building: 3, 'stone-defense': 6 });
    expect(attackOnBuilding('militia', 4, owner(NO_TECHS)).classes).toEqual({});
  });

  it('arms VILLAGERS with the tech (DE effect 321), nobody else', () => {
    // v0.3.132: the CSV applies Sappers to Villagers — the siege-crew
    // reading — not to infantry, which an earlier slice had assumed.
    expect(SAPPERS_BUILDING_ATTACK).toEqual({ building: 15, 'stone-defense': 15 });
    expect(attackOnBuilding('villager', 3, owner(WITH_SAPPERS)).classes).toEqual({ building: 18, 'stone-defense': 21 });
    for (const unitType of ['militia', 'champion', 'archer', 'knight'] as UnitType[]) {
      expect(attackOnBuilding(unitType, 4, owner(WITH_SAPPERS)).classes, unitType)
        .toEqual(attackOnBuilding(unitType, 4, owner(NO_TECHS)).classes);
    }
  });
});

describe('Sappers — cost & research-time tables', () => {
  // technologies.csv: 400 food, 200 wood, 10 s. It took 20 s until 2026-09-23;
  // tests/content/trainAndResearchCostsAndTimes.test.ts holds every row to the CSV.
  it('costs 400 food / 200 wood and takes 100 ticks', () => {
    expect(researchCost('sappers')).toEqual({ food: 400, wood: 200 });
    expect(researchTimeTicks('sappers')).toBe(100);
  });
});

describe('Sappers — gating at the Castle (v0.3.132)', () => {
  it('is researchable only at the Castle', () => {
    expect(canResearchAt('castle', 'sappers')).toBe(true);
    expect(canResearchAt('blacksmith', 'sappers')).toBe(false);
    expect(canResearchAt('siege-workshop', 'sappers')).toBe(false);
    expect(canResearchAt('monastery', 'sappers')).toBe(false);
  });

  it('is offered at an Imperial-Age Castle and drops once researched (v0.3.132)', () => {
    const bridge = createSimulationBridge('conscription-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('sappers');
    // And the old Blacksmith hosting is gone.
    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().researchOptions ?? []).not.toContain('sappers');

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.queueResearch('sappers')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          selectOwnedBuildingDirect(bridge, 1, 'castle');
          return !(bridge.getSelectionState().researchOptions ?? []).includes('sappers');
        },
        { maxSteps: 1500 },
      ),
    ).toBe(true);
  }, 30_000);
});

describe('Sappers — derived +15 vs buildings in live combat', () => {
  it('a villager with Sappers razes an enemy house in strictly fewer ticks', () => {
    const baseline = unitsToDestroyEnemyHouse('sappers-baseline-fixture');
    const researched = unitsToDestroyEnemyHouse('sappers-researched-fixture');

    // A villager without the tech still fells the Castle Age House (1/9):
    // 2 melee + 3 Building a blow, DE's.
    expect(baseline).toBeLessThan(1500);
    // Sappers (+15 Building a blow, 20 in all) razes it markedly faster.
    expect(researched).toBeLessThan(baseline);
  }, 30_000);
});
