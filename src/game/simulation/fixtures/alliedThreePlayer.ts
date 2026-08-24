import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

/** Owners 1 and 2 share a side; owner 3 is on its own. */
export const ALLIED_TEAMS: Readonly<Record<number, number>> = { 1: 1, 2: 1, 3: 2 };

/**
 * Three armies, 1 and 2 allied against 3, each far enough from the others that
 * nobody can see anybody.
 *
 * The same discriminator shape as `ai-versus-ai-fixture`: with vision 4 and
 * thirty cells between them, auto-aggression cannot fire, so any approach is a
 * deliberate march and marching AT AN ALLY is the failure this fixture is for.
 */
export function createAlliedThreePlayerFixture(seed: string): PrototypeScenario {
  const bases = [
    { owner: 1, x: 8, y: 8 },
    { owner: 2, x: 44, y: 8 },
    { owner: 3, x: 26, y: 28 },
  ] as const;
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: bases.map((base) => ({
      owner: base.owner,
      townCenter: { x: base.x, y: base.y },
      team: ALLIED_TEAMS[base.owner],
      startingAge: 'feudal-age' as const,
      startingResources: { food: 500, wood: 500, gold: 500, stone: 300 },
    })),
    spawns: bases.flatMap((base) => [
      ownedSpawn('town-center', base.owner, base.x, base.y, { vision: 6 }),
      // Six militia each: above the Feudal attack threshold of five, so every
      // one of them wants to march somewhere.
      ...[0, 1, 2, 3, 4, 5].map((i) => ownedSpawn(
        'militia',
        base.owner,
        base.x + (i % 3) - 4,
        base.y + Math.floor(i / 3) + 5,
        { vision: 4 },
      )),
    ]),
  };
}
