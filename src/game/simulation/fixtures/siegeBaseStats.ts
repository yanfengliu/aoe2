import { MAP_HEIGHT, MAP_WIDTH, type PrototypeScenario } from '../prototypeScenario';
import { UNIT_VISION_RADIUS } from '../prototypeUnitRules/presentationTables';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Ten-field siege contract: production/upgrades at a safe workshop, a
// surviving neutral melee target and an above-floor pierce attacker far away.
// The isolated Ram uses table sight only for paired rendered fog captures;
// separate production/upgrade commands establish the real sight mechanism.
export function createSiegeBaseStatsFixture(seed: string): PrototypeScenario {
  return {
    seed, width: MAP_WIDTH, height: MAP_HEIGHT, terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 6, y: 6 }, startingAge: 'imperial-age',
        civilization: 'Slavs', disableAi: true,
        startingResources: { food: 6000, wood: 6000, gold: 6000, stone: 200 } },
      { owner: 2, townCenter: { x: 54, y: 30 }, startingAge: 'imperial-age',
        civilization: 'Saracens', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6),
      ownedSpawn('siege-workshop', 1, 14, 6),
      ownedSpawn('mangonel', 1, 10, 13, { vision: 9, startHp: 25 }),
      ownedSpawn('scorpion', 1, 12, 13, { vision: 9, startHp: 20 }),
      ownedSpawn('battering-ram', 1, 32, 22, { vision: UNIT_VISION_RADIUS['battering-ram'] }),
      ownedSpawn('champion', 2, 42, 12, { vision: 5 }),
      ownedSpawn('hand-cannoneer', 2, 50, 24, { vision: 9 }),
      ownedSpawn('town-center', 2, 54, 30),
    ],
  };
}
