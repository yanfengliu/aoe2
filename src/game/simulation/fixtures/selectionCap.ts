import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Work 146: DE caps a selection at 60 units (forum thread 226116, 2023), so a
// box over more takes 60. Sixty-four of the human's Militia stand in an 8x8
// block, one to a cell, from (20,20) to (27,27), clear of every other entity:
// a box over the block holds 64, and the first 60 of the box's own order (by
// row, then column) leave out the last row's right half, (24..27, 27). The
// camera starts on the Town Center far from the block, so a test centres it on
// the block before it drags. Both AIs are off.
export const SELECTION_CAP_BLOCK = { minX: 20, minY: 20, maxX: 27, maxY: 27 } as const;
// Work 146 M2: three Militia of the box's first row stand wounded, at a
// quarter, half and three quarters of their 40 hit points, so the group
// panel's 60 icons show bars that are not all full.
export const SELECTION_CAP_WOUNDED = [
  { cell: { x: 20, y: 20 }, hp: 10 },
  { cell: { x: 21, y: 20 }, hp: 20 },
  { cell: { x: 22, y: 20 }, hp: 30 },
] as const;

export function createSelectionCapFixture(seed: string): PrototypeScenario {
  const militia = [];
  for (let y = SELECTION_CAP_BLOCK.minY; y <= SELECTION_CAP_BLOCK.maxY; y += 1) {
    for (let x = SELECTION_CAP_BLOCK.minX; x <= SELECTION_CAP_BLOCK.maxX; x += 1) {
      const wounded = SELECTION_CAP_WOUNDED.find(({ cell }) => cell.x === x && cell.y === y);
      militia.push(ownedSpawn('militia', 1, x, y, { vision: 4, ...(wounded ? { startHp: wounded.hp } : {}) }));
    }
  }
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: { food: 200, wood: 200, gold: 100, stone: 200 },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 28 },
        startingResources: { food: 200, wood: 200, gold: 100, stone: 200 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 8 }),
      ...militia,
      ownedSpawn('town-center', 2, 50, 28, { vision: 7 }),
    ],
  };
}
