import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';
import { unitBlastRadius } from '../prototypeUnitRules';
import type { UnitType } from '../types';
import { isWaterUnit } from '../unitDomain';
import {
  BLAST_CENSUS_ATTACKER,
  BLAST_CENSUS_BUILDING_TARGET,
  BLAST_CENSUS_UNIT_TARGET,
  blastCensusWitnessCell,
} from './blastCensusLayout';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// The blast census's fixtures (tests/simulation/blastCensus.test.ts, defect
// register "The Siege Onager fired direct hits with no splash", 2026-09-24):
// one per unit with a blast radius, named `blast-census-<unitType>-fixture`,
// and registered for every entry of the blast table, so a unit that gains a
// radius gains a fixture with it. The layout is ./blastCensusLayout.ts.
//
// Both Town Centres are in far corners, out of the fight, and both AIs are
// off, so nothing moves or shoots unless the census orders it. A land attacker
// stands on grass among Villagers, with a House to shell. A water attacker gets
// a sea over the whole fight, with a Dock, and Transport Ships for targets and
// witnesses: a ship with no attack of its own cannot shoot the attacker before
// it arrives.

const SEA = { minX: 14, maxX: 46, minY: 6, maxY: 30 } as const;

function censusUnitType(seed: string): UnitType {
  const match = /^blast-census-(.+)-fixture$/.exec(seed);
  const unitType = match?.[1] as UnitType | undefined;
  if (!unitType || unitBlastRadius(unitType) <= 0) {
    throw new Error(
      `Scenario '${seed}' is not a blast census seed: expected blast-census-<unitType>-fixture `
      + 'naming a unit with a blast radius.',
    );
  }
  return unitType;
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

export function createBlastCensusFixture(seed: string): PrototypeScenario {
  const attacker = censusUnitType(seed);
  const atSea = isWaterUnit(attacker);
  const target = atSea ? 'transport-ship' : 'villager';
  const witnesses = (['unit', 'building', 'ground'] as const).flatMap((impact) =>
    [true, false].map((inside) => {
      const cell = blastCensusWitnessCell(attacker, impact, inside);
      return ownedSpawn(target, 2, cell.x, cell.y);
    }));
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: atSea ? seaTerrain() : createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: 'imperial-age', disableAi: true },
      { owner: 2, townCenter: { x: 4, y: 30 }, startingAge: 'imperial-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('town-center', 2, 4, 30, { vision: 7 }),
      // Vision enough to see all three targets: an order on an entity its
      // owner cannot see is refused.
      ownedSpawn(attacker, 1, BLAST_CENSUS_ATTACKER.x, BLAST_CENSUS_ATTACKER.y, { vision: 12 }),
      ownedSpawn(target, 2, BLAST_CENSUS_UNIT_TARGET.x, BLAST_CENSUS_UNIT_TARGET.y),
      ownedSpawn(atSea ? 'dock' : 'house', 2, BLAST_CENSUS_BUILDING_TARGET.x, BLAST_CENSUS_BUILDING_TARGET.y),
      ...witnesses,
    ],
  };
}
