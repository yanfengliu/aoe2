// The armor-panel census's scenes (tests/simulation/selectionArmorCensus.
// test.ts, work 140): every building type for the human player in one age and
// one set of armor technologies, `armor-panel-buildings-<age>-<techs>-fixture`,
// and every unit type for the human player with or without the armor
// technologies, `armor-panel-units-<techs>-fixture`. The census selects each
// and reads the panel's two armor rows. Both AIs are off; owner 2 keeps only
// its Town Center, far off.

import { getBuildingFootprint } from '../../content/buildingFootprints';
import { MAP_HEIGHT, MAP_WIDTH, type PrototypeScenario } from '../prototypeScenario';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';
import { UNIT_MAX_HP } from '../prototypeUnitRules/statTables';
import type { ResearchableTechnologyType } from '../technologyTypes';
import type { AgeType, BuildingType, UnitType } from '../types';
import { isWaterUnit } from '../unitDomain';
import { createGrassFixtureTerrain, ownedSpawn } from './common';
import type { ScenarioSpawnSpec } from '../prototypeScenario';

export const ARMOR_PANEL_AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
export const ARMOR_PANEL_BUILDING_TECHS: Readonly<Record<string, readonly ResearchableTechnologyType[]>> = {
  none: [],
  masonry: ['masonry'],
  architecture: ['masonry', 'architecture'],
  upgraded: ['masonry', 'architecture', 'guard-tower', 'keep', 'fortified-wall'],
};
export const ARMOR_PANEL_UNIT_TECHS: Readonly<Record<string, readonly ResearchableTechnologyType[]>> = {
  none: [],
  armored: [
    'loom', 'scale-mail-armor', 'chain-mail-armor', 'plate-mail-armor',
    'scale-barding-armor', 'chain-barding-armor', 'plate-barding',
    'padded-archer-armor', 'leather-archer-armor', 'ring-archer-armor', 'parthian-tactics',
  ],
};

const WATER_TOP = 27;
const LAND_BUILDINGS: readonly BuildingType[] = [
  'house', 'barracks', 'castle', 'watch-tower', 'stone-wall', 'stone-gate', 'palisade-wall', 'palisade-gate',
  'wonder', 'mill', 'lumber-camp', 'mining-camp', 'stable', 'archery-range', 'blacksmith', 'market',
  'siege-workshop', 'monastery', 'university', 'bombard-tower', 'outpost', 'farm',
];

export function armorPanelBuildingsSeed(age: AgeType, techs: string): string {
  return `armor-panel-buildings-${age}-${techs}-fixture`;
}

export function armorPanelUnitsSeed(techs: string): string {
  return `armor-panel-units-${techs}-fixture`;
}

export function armorPanelSeeds(): string[] {
  return [
    ...ARMOR_PANEL_AGES.flatMap((age) => Object.keys(ARMOR_PANEL_BUILDING_TECHS).map((techs) => armorPanelBuildingsSeed(age, techs))),
    ...Object.keys(ARMOR_PANEL_UNIT_TECHS).map(armorPanelUnitsSeed),
  ];
}

function terrainWithSea() {
  const terrain = createGrassFixtureTerrain();
  for (let y = WATER_TOP; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) terrain[y]![x] = createTerrainCell(x, y, 'water');
  }
  return terrain;
}

function buildingSpawns(): ScenarioSpawnSpec[] {
  const spawns: ScenarioSpawnSpec[] = [];
  LAND_BUILDINGS.forEach((building, index) => {
    // 4x4 slots with a cell between, east of the Town Center at (2, 2).
    const x = 7 + (index % 9) * 5;
    const y = 2 + Math.floor(index / 9) * 6;
    if (getBuildingFootprint(building).width > 4) throw new Error(`${building} does not fit an armor-panel slot`);
    spawns.push(ownedSpawn(building, 1, x, y));
  });
  spawns.push(ownedSpawn('dock', 1, 10, WATER_TOP + 2));
  spawns.push(ownedSpawn('fish-trap', 1, 20, WATER_TOP + 3));
  return spawns;
}

function unitSpawns(): ScenarioSpawnSpec[] {
  const spawns: ScenarioSpawnSpec[] = [];
  let land = 0;
  let sea = 0;
  for (const unitType of Object.keys(UNIT_MAX_HP) as UnitType[]) {
    if (isWaterUnit(unitType)) {
      spawns.push(ownedSpawn(unitType, 1, 2 + (sea % 18) * 3, WATER_TOP + 2 + Math.floor(sea / 18) * 3));
      sea += 1;
    } else {
      spawns.push(ownedSpawn(unitType, 1, 2 + (land % 25) * 2, 2 + Math.floor(land / 25) * 2));
      land += 1;
    }
  }
  return spawns;
}

export function createArmorPanelCensusFixture(seed: string): PrototypeScenario {
  const buildings = /^armor-panel-buildings-(dark-age|feudal-age|castle-age|imperial-age)-([a-z]+)-fixture$/.exec(seed);
  const units = /^armor-panel-units-([a-z]+)-fixture$/.exec(seed);
  const age = (buildings?.[1] ?? 'imperial-age') as AgeType;
  const techs = buildings ? ARMOR_PANEL_BUILDING_TECHS[buildings[2]!] : units ? ARMOR_PANEL_UNIT_TECHS[units[1]!] : undefined;
  if (!techs) throw new Error(`Scenario '${seed}' is not an armor-panel census seed: expected one of ${armorPanelSeeds().join(', ')}.`);
  const ownTownCenter = buildings ? { x: 2, y: 2 } : { x: 54, y: 20 };
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: terrainWithSea(),
    starts: [
      { owner: 1, townCenter: ownTownCenter, startingAge: age, disableAi: true, startingResearchedTechnologies: [...techs] },
      { owner: 2, townCenter: { x: 54, y: 2 }, startingAge: age, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, ownTownCenter.x, ownTownCenter.y, { vision: 30 }),
      ownedSpawn('town-center', 2, 54, 2, { vision: 7 }),
      ...(buildings ? buildingSpawns() : unitSpawns()),
    ],
  };
}
