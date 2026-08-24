import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

/**
 * Three players, each with a Town Center, three villagers and food beside them.
 *
 * The spec's in-scope list says "AI opponents" and "optional AI allies", so a
 * skirmish is not a 1v1 — and this build's default map hardcodes exactly two
 * starts. This fixture is the smallest thing that answers what actually breaks
 * with a third player, rather than reasoning about it: colours, victory,
 * targeting, the HUD, and the AI's own assumptions all get to fail out loud.
 */
export function createThreePlayerFixture(seed: string): PrototypeScenario {
  // Close enough that one frame holds all three, which is what makes this
  // usable for comparing player COLOURS as well as behaviour.
  const bases = [
    { owner: 1, x: 14, y: 8 },
    { owner: 2, x: 30, y: 10 },
    { owner: 3, x: 20, y: 22 },
  ] as const;
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: bases.map((base) => ({
      owner: base.owner,
      townCenter: { x: base.x, y: base.y },
      startingAge: 'dark-age' as const,
      startingResources: { food: 200, wood: 200, gold: 100, stone: 200 },
    })),
    spawns: bases.flatMap((base) => [
      // Wide vision on purpose: the human slot has to SEE the other two for a
      // capture of this fixture to say anything about their colours, and fog
      // would answer "black" instead.
      ownedSpawn('town-center', base.owner, base.x, base.y, { vision: 30 }),
      ownedSpawn('villager', base.owner, base.x - 2, base.y + 5, { vision: 4 }),
      ownedSpawn('villager', base.owner, base.x - 1, base.y + 5, { vision: 4 }),
      ownedSpawn('villager', base.owner, base.x, base.y + 5, { vision: 4 }),
      // Enough to work: berries beside the base and trees within reach.
      gaiaSpawn('berry-bush', base.x - 3, base.y + 2, { amount: 200 }),
      gaiaSpawn('berry-bush', base.x - 3, base.y + 3, { amount: 200 }),
      gaiaSpawn('tree', base.x + 5, base.y + 2, { amount: 100 }),
      gaiaSpawn('tree', base.x + 5, base.y + 3, { amount: 100 }),
      gaiaSpawn('gold-mine', base.x + 5, base.y + 5, { amount: 400 }),
    ]),
  };
}
