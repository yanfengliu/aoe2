// Every hit on a building is Definitive Edition's (work 140): a census over
// every attacker, every building, every age and every armor technology,
// through the one seam (`attackOnBuilding`, `buildingArmor`,
// `damageOnBuilding`), against an oracle that reads only the pinned DE
// fixture and spec §10.1's formula, never the runtime tables
// (./buildingCombatOracle.ts).
//
// The formula: damage = max(1, sum over the attack classes the building has
// armor in of max(0, attack - armor)), the base attack meeting melee or
// pierce armor by its family. Until work 140 a hit on a building took no
// armor at all and only siege carried an anti-building figure, so an Archer
// took 4 a shot off a House where DE takes 1.
//
// BOUND, so a green run is not read for more than it holds:
//  - The pure seam. That the melee delivery and a landing shot read it is
//    buildingDamagePaths.test.ts.
//  - An attacker's base attack is this game's attack stat (units.csv), not
//    re-sourced here: 26 roster units differ from the pinned dataset (work
//    140's plan lists them). The census holds what the building classes and
//    the building's armor do to whatever that stat is.
//  - The attacker's owner shares the building owner's age, and the
//    civilization cases are one owner each: the Goths for their ladder, a
//    Saracen and an Indian (DE's Hindustanis) side for the team bonuses.

import { describe, expect, it } from 'vitest';

import { buildingArmor } from '../../src/game/simulation/buildingArmor';
import { attackOnBuilding, damageOnBuilding } from '../../src/game/simulation/buildingAttack';
import { UNIT_ATTACK_DAMAGE } from '../../src/game/simulation/prototypeUnitRules/statTables';
import { teamBuildingAttackBonus } from '../../src/game/simulation/teamCombatBonuses';
import type { ResearchableTechnologyType } from '../../src/game/simulation/technologyTypes';
import type { AgeType, BuildingType, UnitType } from '../../src/game/simulation/types';
import { DE_BUILDING_COMBAT, ORACLE_AGES, oracleBuildingDamage, type OracleOwner } from './buildingCombatOracle';

type OwnerCase = OracleOwner & { name: string; techs: ResearchableTechnologyType[] };
const ATTACKER_OWNERS: OwnerCase[] = [
  { name: 'plain', techs: [] },
  { name: 'Siege Engineers and Sappers', techs: ['siege-engineers', 'sappers'] },
  { name: 'Goths', techs: [], civilization: 'Goths' },
  { name: 'Saracen side', techs: [], side: ['Saracens'] },
  { name: 'Indian side', techs: [], side: ['Indians'] },
];

function buildingTechStates(building: BuildingType): ResearchableTechnologyType[][] {
  const university: ResearchableTechnologyType[][] = [[], ['masonry'], ['masonry', 'architecture']];
  const upgrades: ResearchableTechnologyType[][] = building === 'watch-tower' ? [[], ['guard-tower'], ['guard-tower', 'keep']]
    : building === 'stone-wall' || building === 'stone-gate' ? [[], ['fortified-wall']] : [[]];
  return university.flatMap((a) => upgrades.map((b) => [...a, ...b]));
}

/** The runtime, through the seam. Owner 1 attacks; owner 2, on its side, is
 *  the ally a team bonus comes from. */
function runtimeDamage(unitId: UnitType, buildingId: BuildingType, age: AgeType, buildingTechs: ReadonlySet<ResearchableTechnologyType>, owner: OwnerCase): number {
  const teams = new Map([[1, 1], [2, 1]]);
  const civilizations = new Map<number, string>();
  if (owner.civilization) civilizations.set(1, owner.civilization);
  if (owner.side?.[0]) civilizations.set(2, owner.side[0]);
  const attack = attackOnBuilding(unitId, UNIT_ATTACK_DAMAGE[unitId], {
    technologies: new Set(owner.techs),
    civilization: civilizations.get(1),
    age,
    teamBonus: teamBuildingAttackBonus(teams, civilizations, 1, unitId),
  });
  return damageOnBuilding(attack, buildingArmor(buildingId, age, buildingTechs));
}

const PLAIN: OwnerCase = { name: 'plain', techs: [] };

describe('every hit on a building is DE\'s per-class damage', () => {
  it('matches the DE oracle for every attacker, building, age and armor technology', () => {
    const problems: string[] = [];
    let cases = 0;
    for (const unit of DE_BUILDING_COMBAT.units) {
      for (const building of DE_BUILDING_COMBAT.buildings) {
        for (const techList of buildingTechStates(building.id)) {
          const techs = new Set(techList);
          for (const age of ORACLE_AGES) {
            for (const owner of ATTACKER_OWNERS) {
              cases += 1;
              const expected = oracleBuildingDamage(unit.id, UNIT_ATTACK_DAMAGE[unit.id], building.id, age, techs, age, owner);
              const actual = runtimeDamage(unit.id, building.id, age, techs, owner);
              if (actual !== expected && problems.length < 40) {
                problems.push(`${unit.id} -> ${building.id} (${age}, [${techList.join(',')}], ${owner.name}): ${actual}, DE ${expected}`);
              }
            }
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(80_000);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  // Hand-checked against DE: the formula worked by hand from the pinned
  // dataset's numbers, not by the oracle.
  it.each([
    // Archer 4 pierce on a House (-2/7): pierce 0, Standard Building 0 - 0; the minimum.
    ['archer', 'house', 'dark-age', [], 1],
    // Militia 4 melee on a Dark Age Town Center (3/5): 4 - 3.
    ['militia', 'town-center', 'dark-age', [], 1],
    // Battering Ram 2 melee, 150 Building, on a Town Center (3/5, Building 0): 0 + 150.
    ['battering-ram', 'town-center', 'dark-age', [], 150],
    // ... and on a Castle Age one with Masonry (6/8, Building 3): 0 + 147.
    ['battering-ram', 'town-center', 'castle-age', ['masonry'], 147],
    // Villager 3 melee, 3 Building, 6 Stone Defense, on a Palisade Wall (2/5,
    // Building 0, no Stone Defense): 1 + 3, and the 6 meets no armor class.
    ['villager', 'palisade-wall', 'dark-age', [], 4],
    // ... and on a Watch Tower (1/7, Building 0, Stone Defense 0): 2 + 3 + 6.
    ['villager', 'watch-tower', 'feudal-age', [], 11],
    // Man-at-Arms 6 melee, 2 Standard Building, on a Feudal House (-1/8): 7 + 2.
    ['man-at-arms', 'house', 'feudal-age', [], 9],
    // Trebuchet 200 pierce, 250 Building, on a Castle (8/11, Building 8): 189 + 242.
    ['trebuchet', 'castle', 'imperial-age', [], 431],
    // Petard 25 melee on a Stone Wall (8/10, Building 16, Wall & Gate 0): 17 + 484 + 900.
    ['petard', 'stone-wall', 'castle-age', [], 1401],
    // Teutonic Knight's 4 Standard Building meets nothing on a Wonder (3/10, Building only): 12 - 3.
    ['teutonic-knight', 'wonder', 'imperial-age', [], 9],
  ] as Array<[UnitType, BuildingType, AgeType, ResearchableTechnologyType[], number]>)('%s on a %s (%s, %j) deals %i', (unit, building, age, techs, expected) => {
    expect(runtimeDamage(unit, building, age, new Set(techs), PLAIN)).toBe(expected);
  });

  it('applies Siege Engineers to the anti-building attack alone, as DE effect 375 does', () => {
    const se: OwnerCase = { name: 'se', techs: ['siege-engineers'] };
    // Trebuchet on a Castle with Siege Engineers: 189 + (250 x 1.2 - 8) = 481.
    // The old whole-total multiplier gave (200 + 250) x 1.2 = 540 before armor.
    expect(runtimeDamage('trebuchet', 'castle', 'imperial-age', new Set(), se)).toBe(481);
    // The Petard is a Demolition Unit, x1.4 on Building, Wall & Gate and Castle:
    // on a Castle 17 + (700 - 8) + 140 = 849.
    expect(runtimeDamage('petard', 'castle', 'imperial-age', new Set(), se)).toBe(849);
  });
});
