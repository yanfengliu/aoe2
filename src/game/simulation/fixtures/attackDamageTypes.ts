import { MAP_HEIGHT, MAP_WIDTH, type PrototypeScenario } from '../prototypeScenario';
import { unitAttackDamage } from '../prototypeUnitRules';
import { UNIT_MAX_HP } from '../prototypeUnitRules/statTables';
import type { UnitType } from '../types';
import { isWaterUnit } from '../unitDomain';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Commanded damage-family census: a unit faces a target with unequal melee
// and pierce armor. Both bases are far away and both AIs are off. The target
// may retaliate normally; tests measure only the commanded attack's first hit.
// Water attackers face a Galleon (0 melee / 8 pierce), land attackers a
// Battering Ram (-3 melee / 180 pierce). No damage-family table sets the scene.
export function attackDamageTypesSeed(unitType: UnitType): string {
  return `attack-damage-types-${unitType}-fixture`;
}

export function attackDamageTypesSeeds(): string[] {
  return (Object.keys(UNIT_MAX_HP) as UnitType[])
    .filter(type => unitAttackDamage(type) > 0).map(attackDamageTypesSeed);
}

export function createAttackDamageTypesFixture(seed: string): PrototypeScenario {
  const unitType = /^attack-damage-types-(.+)-fixture$/.exec(seed)?.[1] as UnitType | undefined;
  if (!unitType || !attackDamageTypesSeeds().includes(seed)) {
    throw new Error(`Scenario '${seed}' needs attack-damage-types-<unitType>-fixture naming a damaging unit.`);
  }
  const water = isWaterUnit(unitType);
  const terrain = createGrassFixtureTerrain();
  if (water) {
    for (let y = 8; y <= 28; y += 1) {
      for (let x = 20; x <= 46; x += 1) terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return {
    seed, width: MAP_WIDTH, height: MAP_HEIGHT, terrain,
    starts: [
      { owner: 1, townCenter: { x: 6, y: 6 }, startingAge: 'imperial-age', disableAi: true },
      { owner: 2, townCenter: { x: 54, y: 30 }, startingAge: 'imperial-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 7 }),
      ownedSpawn('town-center', 2, 54, 30, { vision: 7 }),
      ownedSpawn(unitType, 1, 30, 18, { vision: 12 }),
      ownedSpawn(water ? 'galleon' : 'battering-ram', 2, 36, 18),
    ],
  };
}
