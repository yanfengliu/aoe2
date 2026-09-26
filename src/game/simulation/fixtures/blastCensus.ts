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
  BLAST_CENSUS_ALLY_OWNER,
  BLAST_CENSUS_ATTACKER,
  BLAST_CENSUS_BUILDING_TARGET,
  BLAST_CENSUS_UNIT_TARGET,
  BLAST_CENSUS_WILDLIFE_TARGET,
  blastCensusBuildingType,
  blastCensusFriendCell,
  blastCensusImpacts,
  blastCensusWitnessCell,
} from './blastCensusLayout';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

// The blast census's fixtures (tests/simulation/blastCensus.test.ts, defect
// register "The Siege Onager fired direct hits with no splash", 2026-09-24):
// one per unit with a blast radius, named `blast-census-<unitType>-fixture`,
// and registered for every entry of the blast table, so a unit that gains a
// radius gains a fixture with it. The layout is ./blastCensusLayout.ts.
//
// The Town Centres are in far corners, out of the fight, and every AI is off,
// so nothing moves or shoots unless the census orders it. Owners 1 and 3 are
// one team against owner 2. A land attacker stands on grass among Villagers,
// with an Outpost to shell and a boar to hunt. A water attacker gets a sea over
// the whole fight, with a Dock, and Transport Ships for targets and witnesses:
// a ship with no attack of its own cannot shoot the attacker before it
// arrives. Owner 1's own witness is a Trade Cart on land and a Trade Cog at
// sea, the units that stand on No Attack, because owner 1 is the human and
// any other idle unit of its would start a fight with the witness beside it.

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
  const ownWitness = atSea ? 'trade-cog' : 'trade-cart';
  const witnesses = blastCensusImpacts(attacker).flatMap((impact) => {
    const inside = blastCensusWitnessCell(attacker, impact, true);
    const outside = blastCensusWitnessCell(attacker, impact, false);
    const own = blastCensusFriendCell(attacker, impact, 'own');
    const ally = blastCensusFriendCell(attacker, impact, 'ally');
    return [
      ownedSpawn(target, 2, inside.x, inside.y),
      ownedSpawn(target, 2, outside.x, outside.y),
      ownedSpawn(ownWitness, 1, own.x, own.y),
      ownedSpawn(target, BLAST_CENSUS_ALLY_OWNER, ally.x, ally.y),
    ];
  });
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: atSea ? seaTerrain() : createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, team: 1, startingAge: 'imperial-age', disableAi: true },
      { owner: 2, townCenter: { x: 4, y: 30 }, team: 2, startingAge: 'imperial-age', disableAi: true },
      {
        owner: BLAST_CENSUS_ALLY_OWNER,
        townCenter: { x: 54, y: 30 },
        team: 1,
        startingAge: 'imperial-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('town-center', 2, 4, 30, { vision: 7 }),
      ownedSpawn('town-center', BLAST_CENSUS_ALLY_OWNER, 54, 30, { vision: 7 }),
      // Vision enough to see every target: an order on an entity its owner
      // cannot see is refused.
      ownedSpawn(attacker, 1, BLAST_CENSUS_ATTACKER.x, BLAST_CENSUS_ATTACKER.y, { vision: 12 }),
      ownedSpawn(target, 2, BLAST_CENSUS_UNIT_TARGET.x, BLAST_CENSUS_UNIT_TARGET.y),
      ownedSpawn(blastCensusBuildingType(attacker), 2, BLAST_CENSUS_BUILDING_TARGET.x, BLAST_CENSUS_BUILDING_TARGET.y),
      ...(atSea ? [] : [gaiaSpawn('boar', BLAST_CENSUS_WILDLIFE_TARGET.x, BLAST_CENSUS_WILDLIFE_TARGET.y, { amount: 340 })]),
      ...witnesses,
    ],
  };
}
