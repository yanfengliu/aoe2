import type { Position } from 'civ-engine';

import { getBuildingFootprint } from '../../content/buildingFootprints';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { firesProjectile } from '../prototypeUnitRules';
import { UNIT_MAX_HP } from '../prototypeUnitRules/statTables';
import type { UnitType } from '../types';
import { isWaterUnit } from '../unitDomain';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

// The minimum-range census's fixtures (tests/simulation/minimumRangeCensus.
// test.ts; defect register, 2026-09-26, "The Siege Onager, the Capped Ram and
// the Elite Skirmisher were left out of tables that named the rest of their
// line"): for each unit that fires a projectile, one per scene, each owned by a
// player or by an AI, named `minimum-range-census-<unitType>[-<scene>][-ai]-fixture`.
//
// The scene knows nothing of the minimum-range table, on purpose: the census
// judges the game against units.csv, so the fixture cannot take its layout
// from the table it is there to check. Owner 1's attacker stands at ATTACKER.
// Distance is the one the attack step measures: Manhattan, in whole cells, to
// a unit's cell or to a building's nearest footprint cell.
//
// - `units` (no suffix): owner 2 has a unit at every distance from 0 (the
//   attacker's own cell) to DEEPEST, in a column running north, and a building
//   whose nearest cell is one away, to the west.
// - `building-alone`: no owner 2 units; the building one away, and a second
//   one DEEPEST away to the east, past every minimum, so a unit that passes
//   over the near one has something to take instead.
// - `wolf`: nothing of owner 2's nearby; a wolf one cell east. Land units only.
//
// Both Town Centres are in far corners and owner 2 has no AI. Owner 1 has none
// either unless the seed ends `-ai`, so the attacker shoots on the census's
// order or at what its own targeting takes, or, owned by an AI, at what the
// AI orders. The targets are Villagers. A water attacker gets a sea over the
// whole scene, Transport Ships for targets (no attack of their own) and Docks
// for the buildings.

export const MINIMUM_RANGE_CENSUS_ATTACKER: Position = { x: 30, y: 18 };
/** The farthest target: past the largest minimum units.csv gives (5). */
export const MINIMUM_RANGE_CENSUS_DEEPEST = 6;
/** Where the wolf of the `wolf` scene starts: one cell east of the attacker. */
export const MINIMUM_RANGE_CENSUS_WOLF: Position = { x: MINIMUM_RANGE_CENSUS_ATTACKER.x + 1, y: MINIMUM_RANGE_CENSUS_ATTACKER.y };

export type MinimumRangeCensusScene = 'units' | 'building-alone' | 'wolf';
const SCENES: readonly MinimumRangeCensusScene[] = ['units', 'building-alone', 'wolf'];

const SEA = { minX: 14, maxX: 46, minY: 6, maxY: 30 } as const;

export function minimumRangeCensusSeed(
  unitType: UnitType,
  scene: MinimumRangeCensusScene = 'units',
  aiOwned = false,
): string {
  return `minimum-range-census-${unitType}${scene === 'units' ? '' : `-${scene}`}${aiOwned ? '-ai' : ''}-fixture`;
}

/** Every unit the census can stage: each one that fires a projectile. */
export function minimumRangeCensusRoster(): UnitType[] {
  return (Object.keys(UNIT_MAX_HP) as UnitType[]).filter(firesProjectile);
}

/** Every census seed: each unit in each scene it can stand in, owned by a player and by an AI. */
export function minimumRangeCensusSeeds(): string[] {
  return minimumRangeCensusRoster().flatMap((unitType) => SCENES
    .filter((scene) => scene !== 'wolf' || !isWaterUnit(unitType))
    .flatMap((scene) => [false, true].map((aiOwned) => minimumRangeCensusSeed(unitType, scene, aiOwned))));
}

/** The cell of owner 2's unit `distance` cells from the attacker. */
export function minimumRangeCensusTargetCell(distance: number): Position {
  if (!Number.isInteger(distance) || distance < 0 || distance > MINIMUM_RANGE_CENSUS_DEEPEST) {
    throw new Error(
      `The minimum-range census stands targets at whole distances 0 to ${String(MINIMUM_RANGE_CENSUS_DEEPEST)}; `
      + `there is none at ${String(distance)}.`,
    );
  }
  return { x: MINIMUM_RANGE_CENSUS_ATTACKER.x, y: MINIMUM_RANGE_CENSUS_ATTACKER.y - distance };
}

/** The anchor (top-left footprint cell) of owner 2's building one cell west. */
export function minimumRangeCensusBuildingAnchor(unitType: UnitType): Position {
  const footprint = getBuildingFootprint(isWaterUnit(unitType) ? 'dock' : 'house');
  return { x: MINIMUM_RANGE_CENSUS_ATTACKER.x - footprint.width, y: MINIMUM_RANGE_CENSUS_ATTACKER.y };
}

/** The anchor of the `building-alone` scene's second building, DEEPEST cells east: its nearest cell. */
export function minimumRangeCensusFarBuildingAnchor(): Position {
  return { x: MINIMUM_RANGE_CENSUS_ATTACKER.x + MINIMUM_RANGE_CENSUS_DEEPEST, y: MINIMUM_RANGE_CENSUS_ATTACKER.y };
}

function censusSeed(seed: string): { unitType: UnitType; scene: MinimumRangeCensusScene; aiOwned: boolean } {
  const match = /^minimum-range-census-(.+?)(?:-(building-alone|wolf))?(-ai)?-fixture$/.exec(seed);
  const unitType = match?.[1] as UnitType | undefined;
  const scene = (match?.[2] ?? 'units') as MinimumRangeCensusScene;
  if (!unitType || !minimumRangeCensusRoster().includes(unitType) || (scene === 'wolf' && isWaterUnit(unitType))) {
    throw new Error(
      `Scenario '${seed}' is not a minimum-range census seed: expected `
      + 'minimum-range-census-<unitType>[-building-alone|-wolf][-ai]-fixture, naming a unit that fires a '
      + 'projectile (a land unit for -wolf, since a wolf cannot reach a ship).',
    );
  }
  return { unitType, scene, aiOwned: match?.[3] !== undefined };
}

function seaTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = SEA.minY; y <= SEA.maxY; y += 1) {
    for (let x = SEA.minX; x <= SEA.maxX; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return terrain;
}

export function createMinimumRangeCensusFixture(seed: string): PrototypeScenario {
  const { unitType: attacker, scene, aiOwned } = censusSeed(seed);
  const atSea = isWaterUnit(attacker);
  const target = atSea ? 'transport-ship' : 'villager';
  const building = atSea ? 'dock' : 'house';
  const targets = scene !== 'units' ? [] : Array.from({ length: MINIMUM_RANGE_CENSUS_DEEPEST + 1 }, (_, distance) => {
    const cell = minimumRangeCensusTargetCell(distance);
    return ownedSpawn(target, 2, cell.x, cell.y);
  });
  const buildings = scene === 'wolf' ? [] : [
    minimumRangeCensusBuildingAnchor(attacker),
    ...(scene === 'building-alone' ? [minimumRangeCensusFarBuildingAnchor()] : []),
  ];
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: atSea ? seaTerrain() : createGrassFixtureTerrain(),
    starts: [
      // The human seat runs an AI only when forced (scenarioSeedOps.ts).
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: 'imperial-age', disableAi: !aiOwned, forceAi: aiOwned },
      { owner: 2, townCenter: { x: 4, y: 30 }, startingAge: 'imperial-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('town-center', 2, 4, 30, { vision: 7 }),
      // Vision enough to see every target: an order on an entity its owner
      // cannot see is refused.
      ownedSpawn(attacker, 1, MINIMUM_RANGE_CENSUS_ATTACKER.x, MINIMUM_RANGE_CENSUS_ATTACKER.y, { vision: 12 }),
      ...targets,
      ...buildings.map((anchor) => ownedSpawn(building, 2, anchor.x, anchor.y)),
      ...(scene === 'wolf' ? [gaiaSpawn('wolf', MINIMUM_RANGE_CENSUS_WOLF.x, MINIMUM_RANGE_CENSUS_WOLF.y, { amount: 0 })] : []),
    ],
  };
}
