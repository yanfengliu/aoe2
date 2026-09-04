import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// An enemy whose only surviving villagers are GARRISONED, which is the state a
// besieged AI reaches on its own: the town bell puts the villagers inside, and
// a garrisoned unit has NO position component.
//
// Owner 1 is the attacking AI, mustered well past its Castle-age attack-group
// threshold and standing beside owner 2's base. Owner 2 is inert (`disableAi`)
// and holds only buildings plus the two villagers the test garrisons, so the
// only question the fixture asks is whether owner 1 attacks at all.
//
// Measured on `gold-rush` at 60,000 ticks before the fix: owner 1 held 151
// units and owner 2 held 14 buildings and no unit on the map, and every one of
// owner 1's units was idle from tick 30,000 to the horizon. The AI's attack
// phase prefers the target enemy's villager, `findOwnedUnit` (now `findOwnedUnitOnMap`) returned the
// garrisoned one, and `setUnitAttackCommandDirect` no-ops silently on a target
// with no position — so the order was re-issued and dropped on every decision
// tick for 30,000 ticks and the match could not resolve.
export function createAiGarrisonedDefenderFixture(seed: string): PrototypeScenario {
  const attackers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) =>
    ownedSpawn('man-at-arms', 1, 20 + (index % 5), 18 + Math.floor(index / 5), { vision: 5 }));
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
        startingResources: { food: 2000, wood: 2000, gold: 2000, stone: 500 },
      },
      {
        owner: 2,
        townCenter: { x: 30, y: 20 },
        startingAge: 'castle-age',
        // Inert: this fixture is about the ATTACKER. An owner 2 that trains
        // would give owner 1 an ungarrisoned unit to chase and hide the defect.
        disableAi: true,
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 13, 10, { vision: 4 }),
      ...attackers,
      ownedSpawn('town-center', 2, 30, 20, { vision: 7 }),
      ownedSpawn('house', 2, 26, 18, { vision: 3 }),
      ownedSpawn('barracks', 2, 26, 22, { vision: 5 }),
      // The two the test garrisons. They are owner 2's only units, so once
      // they are inside the Town Centre nothing of owner 2's is on the map.
      ownedSpawn('villager', 2, 29, 19, { vision: 4 }),
      ownedSpawn('villager', 2, 29, 24, { vision: 4 }),
    ],
  };
}
