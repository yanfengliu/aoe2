import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

/**
 * Two AI armies with no economy to distract them, 32 cells apart.
 *
 * A discriminator for "who does an AI attack": the two Town Centers are far
 * enough apart that neither army can see the other, and auto-aggression only
 * fires on what a unit can see — so ANY contact between them proves that
 * somebody deliberately marched. Before v0.3.54 the AI looked for its target on
 * the human player alone, which meant the forced-AI owner in the human slot had
 * nobody to attack and an AI never attacked another AI; on this fixture that
 * shows up as two armies standing at home forever.
 *
 * Six militia each is above the Feudal attack threshold of five, and the
 * starting age is Feudal so the threshold is the one being tested rather than
 * the Dark-Age value of one.
 */
export function createAiVersusAiFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'feudal-age',
        startingResources: { food: 500, wood: 500, gold: 500, stone: 300 },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'feudal-age',
        startingResources: { food: 500, wood: 500, gold: 500, stone: 300 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
      // Six each, standing beside their own Town Center.
      // Clear of the 4x4 Town Center footprints (which cover 8..11 and 40..43).
      ...[0, 1, 2, 3, 4, 5].map((i) => ownedSpawn('militia', 1, 4 + (i % 3), 13 + Math.floor(i / 3), { vision: 4 })),
      ...[0, 1, 2, 3, 4, 5].map((i) => ownedSpawn('militia', 2, 44 + (i % 3), 13 + Math.floor(i / 3), { vision: 4 })),
    ],
  };
}
