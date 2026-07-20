import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Visual-only showcase scenario (M7 units-beyond-circles). Places one P1 unit
// of every concrete UnitType in isolated rows. The original seven role
// representatives retain their established roots for comparable evidence; an
// inert fog-hidden P2 Town Center keeps the capture match nonterminal.
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
      {
        owner: 2,
        townCenter: { x: 53, y: 29 },
        startingAge: 'imperial-age',
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 6, { vision: 12 }),
      // One unit per render role, spaced 3 cells apart on a single row so each
      // silhouette is isolated and legible.
      ownedSpawn('villager', 1, 5, 12, { vision: 3 }),
      ownedSpawn('champion', 1, 8, 12, { vision: 3 }),
      ownedSpawn('arbalest', 1, 11, 12, { vision: 3 }),
      ownedSpawn('knight', 1, 14, 12, { vision: 3 }),
      ownedSpawn('cavalry-archer', 1, 17, 12, { vision: 3 }),
      ownedSpawn('mangonel', 1, 20, 12, { vision: 3 }),
      ownedSpawn('monk', 1, 23, 12, { vision: 3 }),
      ownedSpawn('scout', 1, 5, 16, { vision: 3 }),
      ownedSpawn('militia', 1, 7, 16, { vision: 3 }),
      ownedSpawn('spearman', 1, 9, 16, { vision: 3 }),
      ownedSpawn('archer', 1, 11, 16, { vision: 3 }),
      ownedSpawn('skirmisher', 1, 13, 16, { vision: 3 }),
      ownedSpawn('crossbowman', 1, 15, 16, { vision: 3 }),
      ownedSpawn('pikeman', 1, 17, 16, { vision: 3 }),
      ownedSpawn('light-cavalry', 1, 19, 16, { vision: 3 }),
      ownedSpawn('camel', 1, 21, 16, { vision: 3 }),
      ownedSpawn('scorpion', 1, 5, 19, { vision: 3 }),
      ownedSpawn('battering-ram', 1, 7, 19, { vision: 3 }),
      ownedSpawn('longbowman', 1, 9, 19, { vision: 3 }),
      ownedSpawn('halberdier', 1, 11, 19, { vision: 3 }),
      ownedSpawn('hussar', 1, 13, 19, { vision: 3 }),
      ownedSpawn('heavy-cavalry-archer', 1, 15, 19, { vision: 3 }),
      ownedSpawn('cavalier', 1, 17, 19, { vision: 3 }),
      ownedSpawn('elite-longbowman', 1, 19, 19, { vision: 3 }),
      ownedSpawn('onager', 1, 21, 19, { vision: 3 }),
      ownedSpawn('heavy-scorpion', 1, 5, 22, { vision: 3 }),
      ownedSpawn('siege-ram', 1, 7, 22, { vision: 3 }),
      ownedSpawn('bombard-cannon', 1, 9, 22, { vision: 3 }),
      ownedSpawn('trebuchet', 1, 11, 22, { vision: 3 }),
      ownedSpawn('man-at-arms', 1, 13, 22, { vision: 3 }),
      ownedSpawn('long-swordsman', 1, 15, 22, { vision: 3 }),
      ownedSpawn('two-handed-swordsman', 1, 17, 22, { vision: 3 }),
      ownedSpawn('paladin', 1, 19, 22, { vision: 3 }),
      ownedSpawn('heavy-camel', 1, 21, 22, { vision: 3 }),
      ownedSpawn('town-center', 2, 53, 29, { vision: 4 }),
    ],
  };
}
