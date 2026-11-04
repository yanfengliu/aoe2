// The building-armor path census's scenes (tests/simulation/
// buildingDamagePaths.test.ts, work 140): one per case, named
// `building-armor-census-<case>-fixture`. Every unit with an attack is a case
// against a building of a rotating type, age and armor technology, and a few
// more cases name the technologies and civilizations that change an attack on
// a building. Every case plays the real order: the attacker, owner 1, is
// placed in reach of the target, owner 2's, and the census reads its first
// hit off the building's hit points, through the melee delivery or a shot.
//
// The Town Centres sit in far corners and both AIs are off. A land case is on
// grass; a ship's case has a sea west of the target, which stands on the
// shore, or in the water for the Dock and the Fish Trap.

import { getBuildingFootprint } from '../../content/buildingFootprints';
import { MAP_HEIGHT, MAP_WIDTH, type PrototypeScenario } from '../prototypeScenario';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';
import { isMeleeUnit, unitAttackDamage, unitMinAttackRange } from '../prototypeUnitRules';
import { UNIT_MAX_HP } from '../prototypeUnitRules/statTables';
import type { ResearchableTechnologyType } from '../technologyTypes';
import type { AgeType, BuildingType, UnitType } from '../types';
import { isWaterUnit } from '../unitDomain';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

export interface BuildingArmorCensusCase {
  readonly name: string;
  readonly attacker: UnitType;
  readonly building: BuildingType;
  /** Both owners' age: the building's armor reads its owner's, a Goth
   *  attacker's ladder its own. */
  readonly age: AgeType;
  readonly buildingTechnologies: readonly ResearchableTechnologyType[];
  readonly attackerTechnologies: readonly ResearchableTechnologyType[];
  readonly attackerCivilization?: string;
}

const AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
const WATER_BUILDINGS = new Set<BuildingType>(['dock', 'fish-trap']);
const LAND_TARGETS: readonly BuildingType[] = [
  'town-center', 'house', 'barracks', 'castle', 'watch-tower', 'stone-wall', 'stone-gate', 'palisade-wall',
  'palisade-gate', 'wonder', 'mill', 'lumber-camp', 'mining-camp', 'stable', 'archery-range', 'blacksmith',
  'market', 'siege-workshop', 'monastery', 'university', 'bombard-tower', 'outpost', 'farm',
];
const SEA_TARGETS: readonly BuildingType[] = [
  'dock', 'fish-trap', 'town-center', 'house', 'castle', 'stone-wall', 'watch-tower', 'wonder', 'stone-gate', 'market',
];
// The armor technologies a case's building owner holds, by rotation; a
// technology DE gives only from the Castle Age is held only from it.
function rotatedBuildingTechnologies(index: number, building: BuildingType, age: AgeType): ResearchableTechnologyType[] {
  const late = age === 'castle-age' || age === 'imperial-age';
  const techs: ResearchableTechnologyType[] = [];
  if (late && index % 3 >= 1) techs.push('masonry');
  if (age === 'imperial-age' && index % 3 === 2) techs.push('architecture');
  if (late && building === 'watch-tower') techs.push('guard-tower', ...(age === 'imperial-age' ? ['keep' as const] : []));
  if (late && (building === 'stone-wall' || building === 'stone-gate') && index % 2 === 0) techs.push('fortified-wall');
  return techs;
}

const ATTACKERS = (Object.keys(UNIT_MAX_HP) as UnitType[]).filter((unitType) => unitAttackDamage(unitType) > 0);

const ROTATION: BuildingArmorCensusCase[] = ATTACKERS.map((attacker, index) => {
  const targets = isWaterUnit(attacker) ? SEA_TARGETS : LAND_TARGETS;
  const building = targets[index % targets.length]!;
  const age = AGES[index % AGES.length]!;
  return {
    name: `rotation-${attacker}-on-${building}`,
    attacker,
    building,
    age,
    buildingTechnologies: rotatedBuildingTechnologies(index, building, age),
    attackerTechnologies: [],
  };
});

// The four DE values the brief named, and every technology and civilization
// that changes an attack on a building, through the real order.
const NAMED: BuildingArmorCensusCase[] = [
  { name: 'de-archer-on-house', attacker: 'archer', building: 'house', age: 'dark-age', buildingTechnologies: [], attackerTechnologies: [] },
  { name: 'de-militia-on-town-center', attacker: 'militia', building: 'town-center', age: 'dark-age', buildingTechnologies: [], attackerTechnologies: [] },
  { name: 'de-ram-on-town-center', attacker: 'battering-ram', building: 'town-center', age: 'dark-age', buildingTechnologies: [], attackerTechnologies: [] },
  { name: 'de-villager-on-palisade', attacker: 'villager', building: 'palisade-wall', age: 'dark-age', buildingTechnologies: [], attackerTechnologies: [] },
  { name: 'sappers-villager-on-tower', attacker: 'villager', building: 'watch-tower', age: 'imperial-age', buildingTechnologies: [], attackerTechnologies: ['sappers'] },
  { name: 'engineers-trebuchet-on-castle', attacker: 'trebuchet', building: 'castle', age: 'imperial-age', buildingTechnologies: ['masonry', 'architecture'], attackerTechnologies: ['siege-engineers'] },
  { name: 'engineers-petard-on-castle', attacker: 'petard', building: 'castle', age: 'imperial-age', buildingTechnologies: [], attackerTechnologies: ['siege-engineers'] },
  { name: 'engineers-petard-on-fortified-wall', attacker: 'petard', building: 'stone-wall', age: 'imperial-age', buildingTechnologies: ['fortified-wall'], attackerTechnologies: ['siege-engineers'] },
  { name: 'engineers-mangonel-on-town-center', attacker: 'mangonel', building: 'town-center', age: 'imperial-age', buildingTechnologies: ['masonry', 'architecture'], attackerTechnologies: ['siege-engineers'] },
  { name: 'engineers-scorpion-on-house', attacker: 'scorpion', building: 'house', age: 'castle-age', buildingTechnologies: [], attackerTechnologies: ['siege-engineers'] },
  { name: 'engineers-demolition-on-dock', attacker: 'demolition-ship', building: 'dock', age: 'imperial-age', buildingTechnologies: [], attackerTechnologies: ['siege-engineers'] },
  { name: 'engineers-cannon-galleon-on-house', attacker: 'cannon-galleon', building: 'house', age: 'imperial-age', buildingTechnologies: [], attackerTechnologies: ['siege-engineers'] },
  { name: 'goths-champion-on-barracks', attacker: 'champion', building: 'barracks', age: 'imperial-age', buildingTechnologies: [], attackerTechnologies: [], attackerCivilization: 'Goths' },
  { name: 'goths-axeman-on-house', attacker: 'throwing-axeman', building: 'house', age: 'castle-age', buildingTechnologies: [], attackerTechnologies: [], attackerCivilization: 'Goths' },
  { name: 'goths-petard-on-house', attacker: 'petard', building: 'house', age: 'castle-age', buildingTechnologies: [], attackerTechnologies: [], attackerCivilization: 'Goths' },
  { name: 'saracens-archer-on-house', attacker: 'archer', building: 'house', age: 'feudal-age', buildingTechnologies: [], attackerTechnologies: [], attackerCivilization: 'Saracens' },
  { name: 'saracens-chu-ko-nu-on-mill', attacker: 'chu-ko-nu', building: 'mill', age: 'castle-age', buildingTechnologies: [], attackerTechnologies: [], attackerCivilization: 'Saracens' },
  { name: 'indians-scout-on-house', attacker: 'scout', building: 'house', age: 'feudal-age', buildingTechnologies: [], attackerTechnologies: [], attackerCivilization: 'Indians' },
  { name: 'indians-mameluke-on-market', attacker: 'mameluke', building: 'market', age: 'castle-age', buildingTechnologies: [], attackerTechnologies: [], attackerCivilization: 'Indians' },
  { name: 'teutonic-knight-on-wonder', attacker: 'teutonic-knight', building: 'wonder', age: 'imperial-age', buildingTechnologies: ['masonry', 'architecture'], attackerTechnologies: [] },
  { name: 'tarkan-on-gate', attacker: 'elite-tarkan', building: 'stone-gate', age: 'imperial-age', buildingTechnologies: ['fortified-wall'], attackerTechnologies: [] },
  { name: 'keep-takes-a-ram', attacker: 'capped-ram', building: 'watch-tower', age: 'imperial-age', buildingTechnologies: ['guard-tower', 'keep', 'masonry'], attackerTechnologies: [] },
  // DE's melee 0 beside the Chu Ko Nu's pierce meets a Dark Age House's -2 (review round 0, F0).
  { name: 'chu-ko-nu-on-dark-house', attacker: 'chu-ko-nu', building: 'house', age: 'dark-age', buildingTechnologies: [], attackerTechnologies: [] },
];

export const BUILDING_ARMOR_CENSUS_CASES: readonly BuildingArmorCensusCase[] = [...ROTATION, ...NAMED];
if (new Set(BUILDING_ARMOR_CENSUS_CASES.map((entry) => entry.name)).size !== BUILDING_ARMOR_CENSUS_CASES.length) {
  throw new Error('building-armor census cases need unique names: two cases would share one scenario seed.');
}

export function buildingArmorCensusSeed(entry: BuildingArmorCensusCase): string {
  return `building-armor-census-${entry.name}-fixture`;
}

export function buildingArmorCensusSeeds(): string[] {
  return BUILDING_ARMOR_CENSUS_CASES.map(buildingArmorCensusSeed);
}

/** Where the case's target stands: on land at (36, 16), or for the Dock and
 *  the Fish Trap in the water just west of the shore. */
export function buildingArmorCensusAnchor(building: BuildingType): { x: number; y: number } {
  return WATER_BUILDINGS.has(building) ? { x: 33 - getBuildingFootprint(building).width + 1, y: 16 } : { x: 36, y: 16 };
}

/** How far west of the target's footprint the attacker starts: beside it for
 *  a contact attacker, at its minimum range (at least 2) for a shooter. */
export function buildingArmorCensusStandoff(attacker: UnitType): number {
  return isMeleeUnit(attacker) ? 1 : Math.max(2, unitMinAttackRange(attacker));
}

export function createBuildingArmorCensusFixture(seed: string): PrototypeScenario {
  const entry = BUILDING_ARMOR_CENSUS_CASES.find((candidate) => buildingArmorCensusSeed(candidate) === seed);
  if (!entry) {
    throw new Error(`Scenario '${seed}' is not a building-armor census case: expected one of building-armor-census-<case>-fixture.`);
  }
  const atSea = isWaterUnit(entry.attacker);
  const terrain = createGrassFixtureTerrain();
  if (atSea) {
    for (let y = 6; y <= 30; y += 1) {
      for (let x = 12; x <= 35; x += 1) terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  const anchor = buildingArmorCensusAnchor(entry.building);
  const standoff = buildingArmorCensusStandoff(entry.attacker);
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      {
        owner: 1, townCenter: { x: 2, y: 2 }, startingAge: entry.age, disableAi: true,
        ...(entry.attackerCivilization ? { civilization: entry.attackerCivilization } : {}),
        startingResearchedTechnologies: [...entry.attackerTechnologies],
      },
      {
        owner: 2, townCenter: { x: 54, y: 30 }, startingAge: entry.age, disableAi: true,
        startingResearchedTechnologies: [...entry.buildingTechnologies],
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 2, 2, { vision: 7 }),
      ownedSpawn('town-center', 2, 54, 30, { vision: 7 }),
      ownedSpawn(entry.building, 2, anchor.x, anchor.y),
      ownedSpawn(entry.attacker, 1, anchor.x - standoff, anchor.y, { vision: 12 }),
    ],
  };
}
