// A building's armor, as Definitive Edition gives it (spec §10.3, work 140).
//
// DE armors a building in melee and pierce like a unit, and also in classes of
// its own that only attacks against buildings reach: Building (DE class 11,
// every building), Stone Defense (13: towers, Stone Walls, Gates), Standard
// Building (21: every building but the Wonder), Wall & Gate (22) and Castle
// (26). An attack in a class the building lacks does nothing to it (spec
// §10.1), which is why a Wonder takes no infantry +N against buildings.
//
// Everything here is DERIVED at the moment a blow lands from the building's
// type and its owner's age and researched set, so nothing is saved for it.
// The numbers are tests/content/fixtures/deBuildingCombat.json's, pinned to DE:
//  - melee/pierce by age: DE upgrades each building to its next age's unit at
//    every age-up, and those units carry the armor below (DE dat, update
//    147949; every Dark Age row equals the pinned 185872 dataset);
//  - class armor: the pinned dataset (aoe2techtree 3bb43b14, update 185872);
//  - Guard Tower, Keep and Fortified Wall turn the building into the next
//    unit, whose armor replaces the row;
//  - Masonry and Architecture: +1 melee, +1 pierce and +3 Building armor each,
//    on DE's unit classes 3 (Building) and 52 (Tower): every building but the
//    walls, gates, Farm and Fish Trap (DE effects 50 and 51; the same help
//    text, "+1 melee/+1 pierce armor and +3 building armor").

import type { ResearchableTechnologyType } from './technologyTypes';
import type { AgeType, BuildingType } from './types';

/** DE's armor classes that only attacks against buildings reach. */
export type BuildingArmorClass =
  | 'building'
  | 'stone-defense'
  | 'standard-building'
  | 'wall-and-gate'
  | 'castle';

/** Every building class, in DE's id order; `DE_BUILDING_CLASS_ID` names each. */
export const BUILDING_ARMOR_CLASSES: readonly BuildingArmorClass[] = [
  'building', 'stone-defense', 'standard-building', 'wall-and-gate', 'castle',
];

export const DE_BUILDING_CLASS_ID: Readonly<Record<BuildingArmorClass, number>> = {
  building: 11,
  'stone-defense': 13,
  'standard-building': 21,
  'wall-and-gate': 22,
  castle: 26,
};

/** Amounts per building class. A class absent from the record is one the
 *  building does not carry (or, for an attack, one it does not attack in). */
export type BuildingClassAmounts = Readonly<Partial<Record<BuildingArmorClass, number>>>;

export interface BuildingArmor {
  readonly melee: number;
  readonly pierce: number;
  readonly classes: BuildingClassAmounts;
}

type MeleePierce = readonly [melee: number, pierce: number];

interface BuildingArmorRow {
  /** Dark, Feudal, Castle, Imperial: the owner's current age picks the row. */
  readonly byAge: readonly [MeleePierce, MeleePierce, MeleePierce, MeleePierce];
  readonly classes: BuildingClassAmounts;
}

const AGE_ROW: Readonly<Record<AgeType, 0 | 1 | 2 | 3>> = {
  'dark-age': 0,
  'feudal-age': 1,
  'castle-age': 2,
  'imperial-age': 3,
};

const flat = (melee: number, pierce: number): BuildingArmorRow['byAge'] =>
  [[melee, pierce], [melee, pierce], [melee, pierce], [melee, pierce]];
const LADDER_0_7: BuildingArmorRow['byAge'] = [[0, 7], [1, 8], [2, 9], [3, 10]];
const LADDER_1_8: BuildingArmorRow['byAge'] = [[1, 8], [1, 8], [2, 9], [3, 10]];
// Building 0, Standard Building 0: what every ordinary building carries.
const STANDARD: BuildingClassAmounts = { building: 0, 'standard-building': 0 };
const STONE: BuildingClassAmounts = { building: 0, 'stone-defense': 0, 'standard-building': 0 };

// A building a scenario places before its first age (a Stable in the Dark Age)
// keeps the first unit DE has for it, as DE's own data does.
const BUILDING_ARMOR: Readonly<Record<BuildingType, BuildingArmorRow>> = {
  'town-center': { byAge: [[3, 5], [4, 6], [5, 7], [6, 8]], classes: STANDARD },
  barracks: { byAge: LADDER_0_7, classes: STANDARD },
  // DE's House is soft to a sword: -2 melee in the Dark Age.
  house: { byAge: [[-2, 7], [-1, 8], [1, 9], [3, 10]], classes: STANDARD },
  mill: { byAge: LADDER_0_7, classes: STANDARD },
  dock: { byAge: LADDER_0_7, classes: STANDARD },
  'lumber-camp': { byAge: LADDER_0_7, classes: STANDARD },
  'mining-camp': { byAge: LADDER_0_7, classes: STANDARD },
  blacksmith: { byAge: LADDER_0_7, classes: STANDARD },
  monastery: { byAge: LADDER_0_7, classes: STANDARD },
  'archery-range': { byAge: LADDER_1_8, classes: STANDARD },
  stable: { byAge: LADDER_1_8, classes: STANDARD },
  market: { byAge: LADDER_1_8, classes: STANDARD },
  university: { byAge: [[2, 9], [2, 9], [2, 9], [3, 10]], classes: STANDARD },
  // No Imperial unit: DE's Imperial Age adds +1/+1 to the Castle Age one.
  'siege-workshop': { byAge: [[1, 8], [1, 8], [1, 8], [2, 9]], classes: STANDARD },
  castle: { byAge: flat(8, 11), classes: { building: 8, 'standard-building': 0, castle: 0 } },
  // The one building that is not a Standard Building.
  wonder: { byAge: flat(3, 10), classes: { building: 0 } },
  outpost: { byAge: flat(0, 0), classes: STANDARD },
  'watch-tower': { byAge: flat(1, 7), classes: STONE },
  'bombard-tower': { byAge: flat(3, 9), classes: STONE },
  'palisade-wall': { byAge: flat(2, 5), classes: { ...STANDARD, 'wall-and-gate': 0 } },
  'stone-wall': { byAge: flat(8, 10), classes: { ...STONE, building: 16, 'wall-and-gate': 0 } },
  'stone-gate': { byAge: flat(0, 0), classes: { ...STONE, building: 20, 'wall-and-gate': 0 } },
  'palisade-gate': { byAge: flat(0, 0), classes: { ...STANDARD, 'wall-and-gate': 0 } },
  farm: { byAge: flat(0, 0), classes: STANDARD },
  'fish-trap': { byAge: flat(1, 1), classes: { building: 10, 'standard-building': 0 } },
};

// A technology that turns one building into DE's next unit, whose armor
// replaces the row. Later entries win: the Keep needs the Guard Tower first.
// The Fortified Wall also turns the Gate into a Fortified Gate, whose armor is
// the Gate's, so it has no entry.
const ARMOR_UPGRADES: ReadonlyArray<{
  readonly buildingType: BuildingType;
  readonly technology: ResearchableTechnologyType;
  readonly armor: MeleePierce;
  readonly classes: BuildingClassAmounts;
}> = [
  { buildingType: 'watch-tower', technology: 'guard-tower', armor: [2, 8], classes: STONE },
  { buildingType: 'watch-tower', technology: 'keep', armor: [3, 9], classes: STONE },
  { buildingType: 'stone-wall', technology: 'fortified-wall', armor: [12, 12], classes: { ...STONE, building: 24, 'wall-and-gate': 0 } },
];

/** Masonry's and Architecture's armor, each. */
export const MASONRY_ARMOR = { melee: 1, pierce: 1, building: 3 } as const;

// DE's unit classes 27 (Wall), 39 (Gate) and 49 (Farm, Fish Trap) are outside
// Masonry and Architecture, armor and hit points alike.
const OUTSIDE_MASONRY: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'palisade-wall', 'stone-wall', 'stone-gate', 'palisade-gate', 'farm', 'fish-trap',
]);

/** Whether Masonry and Architecture reach this building (hit points and armor). */
export function takesMasonry(buildingType: BuildingType): boolean {
  return !OUTSIDE_MASONRY.has(buildingType);
}

/** The building's armor under its owner's age and researched set. */
export function buildingArmor(
  buildingType: BuildingType,
  ownerAge: AgeType,
  ownerTechnologies: ReadonlySet<ResearchableTechnologyType>,
): BuildingArmor {
  const row = BUILDING_ARMOR[buildingType];
  let [melee, pierce] = row.byAge[AGE_ROW[ownerAge]];
  let classes: Partial<Record<BuildingArmorClass, number>> = { ...row.classes };
  for (const upgrade of ARMOR_UPGRADES) {
    if (upgrade.buildingType !== buildingType || !ownerTechnologies.has(upgrade.technology)) continue;
    [melee, pierce] = upgrade.armor;
    classes = { ...upgrade.classes };
  }
  if (takesMasonry(buildingType)) {
    for (const technology of ['masonry', 'architecture'] as const) {
      if (!ownerTechnologies.has(technology)) continue;
      melee += MASONRY_ARMOR.melee;
      pierce += MASONRY_ARMOR.pierce;
      classes.building = (classes.building ?? 0) + MASONRY_ARMOR.building;
    }
  }
  return { melee, pierce, classes };
}
