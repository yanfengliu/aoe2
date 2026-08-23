import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createTerrainCell } from '../../mapGeneration/sharedTerrainHelpers';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../common';

// In Age of Empires II the forest IS the trees: chop one and its tile becomes
// open ground, so a woodline is cut from the outside in until it is gone. Here
// a tree stood ON a permanently impassable forest tile, so only the rim of a
// woodline could ever be worked and everything behind it was unreachable
// forever. Measured on the default map at tick 6000: 18 of the 27 surviving
// trees had NO walkable neighbour at all — 83 of their blocked faces were
// forest terrain — and the AI's whole villager force had abandoned wood.
//
// Two trees in a row on forest tiles, with the far one otherwise walled in by
// forest. The near one must clear its tile when it is exhausted so the far one
// becomes workable.
export function createWoodlineClearingFixture(seed: string): PrototypeScenario {
  const terrain = createGrassFixtureTerrain();
  const forestCells = [
    { x: 10, y: 10 }, { x: 11, y: 10 },
    { x: 11, y: 9 }, { x: 11, y: 11 }, { x: 12, y: 10 },
  ];
  for (const cell of forestCells) {
    terrain[cell.y]![cell.x] = createTerrainCell(cell.x, cell.y, 'forest');
  }
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      { owner: 1, townCenter: { x: 50, y: 30 }, disableAi: true },
      { owner: 2, townCenter: { x: 4, y: 8 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 50, 30, { vision: 7 }),
      ownedSpawn('town-center', 2, 4, 8, { vision: 12 }),
      // Near tree: reachable from the west. Small, so one villager finishes it.
      gaiaSpawn('tree', 10, 10, { baseOwner: 2, amount: 12 }),
      // Far tree: its other three faces are forest tiles, so the ONLY way to it
      // is through the near tree's cell.
      gaiaSpawn('tree', 11, 10, { baseOwner: 2, amount: 100 }),
      ownedSpawn('villager', 2, 9, 10, { vision: 4 }),
    ],
  };
}
