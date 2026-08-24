import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';

// Grass everywhere, plus a small pool for the naval row. Ships are water-domain
// units (see unitDomain.ts) and cannot occupy a land cell at all.
function showcaseTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = 25; y <= 29; y += 1) {
    for (let x = 2; x <= 26; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return terrain;
}

// Visual-only showcase scenario (M7 units-beyond-circles). Places one P1 unit
// of every concrete UnitType in isolated rows. The original seven role
// representatives retain their established roots for comparable evidence; an
// inert fog-hidden P2 Town Center keeps the capture match nonterminal.
export function createUnitShowcaseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: showcaseTerrain(),
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
      // M5 naval: ships can only exist on water, so the showcase has a small
      // pool for them rather than a ship parked implausibly on grass.
      ownedSpawn('fishing-ship', 1, 24, 26, { vision: 3 }),
      ownedSpawn('transport-ship', 1, 26, 26, { vision: 3 }),
      ownedSpawn('galley', 1, 4, 26, { vision: 3 }),
      ownedSpawn('war-galley', 1, 8, 26, { vision: 3 }),
      ownedSpawn('galleon', 1, 12, 26, { vision: 3 }),
      ownedSpawn('fire-ship', 1, 16, 26, { vision: 3 }),
      ownedSpawn('fast-fire-ship', 1, 20, 26, { vision: 3 }),
      ownedSpawn('demolition-ship', 1, 4, 28, { vision: 3 }),
      ownedSpawn('heavy-demolition-ship', 1, 8, 28, { vision: 3 }),
      ownedSpawn('cannon-galleon', 1, 12, 28, { vision: 3 }),
      ownedSpawn('elite-cannon-galleon', 1, 16, 28, { vision: 3 }),
      // M4 unique units: the two naval ones share the pool, the seventeen
      // land ones get their own rows below it.
      ownedSpawn('jaguar-warrior', 1, 2, 34, { vision: 3 }),
      ownedSpawn('cataphract', 1, 5, 34, { vision: 3 }),
      ownedSpawn('woad-raider', 1, 8, 34, { vision: 3 }),
      ownedSpawn('chu-ko-nu', 1, 11, 34, { vision: 3 }),
      ownedSpawn('throwing-axeman', 1, 14, 34, { vision: 3 }),
      ownedSpawn('huskarl', 1, 17, 34, { vision: 3 }),
      ownedSpawn('tarkan', 1, 20, 34, { vision: 3 }),
      ownedSpawn('samurai', 1, 23, 34, { vision: 3 }),
      ownedSpawn('war-wagon', 1, 26, 34, { vision: 3 }),
      ownedSpawn('plumed-archer', 1, 29, 34, { vision: 3 }),
      ownedSpawn('mangudai', 1, 32, 34, { vision: 3 }),
      ownedSpawn('war-elephant', 1, 35, 34, { vision: 3 }),
      ownedSpawn('mameluke', 1, 38, 34, { vision: 3 }),
      ownedSpawn('conquistador', 1, 41, 34, { vision: 3 }),
      ownedSpawn('teutonic-knight', 1, 44, 34, { vision: 3 }),
      ownedSpawn('janissary', 1, 47, 34, { vision: 3 }),
      ownedSpawn('berserk', 1, 50, 34, { vision: 3 }),
      // The elite tier gets its own row below the base one.
      ownedSpawn('elite-jaguar-warrior', 1, 2, 35, { vision: 3 }),
      ownedSpawn('elite-cataphract', 1, 5, 35, { vision: 3 }),
      ownedSpawn('elite-woad-raider', 1, 8, 35, { vision: 3 }),
      ownedSpawn('elite-chu-ko-nu', 1, 11, 35, { vision: 3 }),
      ownedSpawn('elite-throwing-axeman', 1, 14, 35, { vision: 3 }),
      ownedSpawn('elite-huskarl', 1, 17, 35, { vision: 3 }),
      ownedSpawn('elite-tarkan', 1, 20, 35, { vision: 3 }),
      ownedSpawn('elite-samurai', 1, 23, 35, { vision: 3 }),
      ownedSpawn('elite-war-wagon', 1, 26, 35, { vision: 3 }),
      ownedSpawn('elite-plumed-archer', 1, 29, 35, { vision: 3 }),
      ownedSpawn('elite-mangudai', 1, 32, 35, { vision: 3 }),
      ownedSpawn('elite-war-elephant', 1, 35, 35, { vision: 3 }),
      ownedSpawn('elite-mameluke', 1, 38, 35, { vision: 3 }),
      ownedSpawn('elite-conquistador', 1, 41, 35, { vision: 3 }),
      ownedSpawn('elite-teutonic-knight', 1, 44, 35, { vision: 3 }),
      ownedSpawn('elite-janissary', 1, 47, 35, { vision: 3 }),
      ownedSpawn('elite-berserk', 1, 50, 35, { vision: 3 }),
      ownedSpawn('elite-turtle-ship', 1, 2, 25, { vision: 3 }),
      ownedSpawn('elite-longboat', 1, 6, 25, { vision: 3 }),
      ownedSpawn('turtle-ship', 1, 20, 28, { vision: 3 }),
      ownedSpawn('longboat', 1, 24, 28, { vision: 3 }),
      // The three line tiers added in v0.3.45, on their own row.
      ownedSpawn('capped-ram', 1, 30, 32, { vision: 3 }),
      ownedSpawn('siege-onager', 1, 33, 32, { vision: 3 }),
      ownedSpawn('elite-skirmisher', 1, 36, 32, { vision: 3 }),
      ownedSpawn('town-center', 2, 53, 29, { vision: 4 }),
    ],
  };
}
