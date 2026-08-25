import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Incas "Villagers affected by Blacksmith upgrades" (civilizations.csv) —
// the live-research half. Castle Age with a Blacksmith and 100 food banked
// (Scale Mail's cost). The owned militia is the research-done signal: it is
// infantry, so its armor flips to 1 for EVERY civ the moment Scale Mail
// lands — then the villager's armor answers the Incas question.
export function createCivIncasArmorFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
        startingResources: { food: 100, wood: 0, gold: 0, stone: 0 },
      },
      { owner: 2, townCenter: { x: 52, y: 30 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('blacksmith', 1, 10, 4),
      ownedSpawn('villager', 1, 10, 10),
      ownedSpawn('militia', 1, 12, 10),
      ownedSpawn('town-center', 2, 52, 30, { vision: 4 }),
    ],
  };
}
