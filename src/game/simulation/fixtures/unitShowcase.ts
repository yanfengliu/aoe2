import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Visual-only showcase scenario (M7 units-beyond-circles slice 1). Places one
// human-owned unit of EVERY render role — villager, infantry, archer, cavalry,
// cavalry-archer, siege, monk — in a tidy, all-visible row beside a Town
// Center, so the AGENTS.md visual-change protocol can capture a single
// before/after frame that exercises every unit silhouette. Not referenced by
// gameplay tests; purely a capture target (lives in the fixtures tree, which is
// the sanctioned home for scenario data). Imperial age + generous vision so
// every unit is fog-visible to player 1 at boot.
export function createUnitShowcaseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 6 },
        startingAge: 'imperial-age',
        startingResources: { food: 1000, wood: 1000, gold: 1000, stone: 500 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 6, { vision: 12 }),
      // One unit per render role, spaced 3 cells apart on a single row so each
      // silhouette is isolated and legible.
      ownedSpawn('villager', 1, 5, 12, { vision: 6 }),
      ownedSpawn('champion', 1, 8, 12, { vision: 6 }),
      ownedSpawn('arbalest', 1, 11, 12, { vision: 6 }),
      ownedSpawn('knight', 1, 14, 12, { vision: 6 }),
      ownedSpawn('cavalry-archer', 1, 17, 12, { vision: 6 }),
      ownedSpawn('mangonel', 1, 20, 12, { vision: 9 }),
      ownedSpawn('monk', 1, 23, 12, { vision: 9 }),
    ],
  };
}
