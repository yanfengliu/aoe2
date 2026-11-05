import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

// Work 142: selecting and commanding as Definitive Edition does, on one paused
// frame at the browser suite's 800x600 and the camera's boot framing (centred
// on the human Town Center at zoom 1.2, so the view spans cells -3..23 along
// both axes at its corners). Each group below is one rule's setup:
// - a sheep of the human's hidden diagonally behind the Town Center, where the
//   occlusion showcase hides a villager: drawn as an outline, reached by a click;
// - three villagers and a sheep for a box: DE's box takes them all;
// - one villager among another player's villager, a wild boar, a tree and the
//   Town Center's corner: the box takes only the villager;
// - two villagers in ONE cell: two quick clicks on them are two clicks;
// - a villager at (0,0), above the top edge of the 800x600 view but inside the
//   cell bounding box of its corners: a double-click on screen leaves it out.
// A House gives room to train one villager. Both AIs are off and every spawn of the human's sees far enough that the
// other player's villager and the boar are on screen and visible.
export const SELECTION_CONTROLS_HIDDEN_SHEEP = { x: 7, y: 7 } as const;
export const SELECTION_CONTROLS_BOX_VILLAGERS = [
  { x: 13, y: 7 },
  { x: 14, y: 7 },
  { x: 15, y: 7 },
] as const;
export const SELECTION_CONTROLS_BOX_SHEEP = { x: 14, y: 8 } as const;
export const SELECTION_CONTROLS_MIXED_BOX = {
  villager: { x: 5, y: 12 },
  enemyVillager: { x: 6, y: 12 },
  boar: { x: 5, y: 13 },
  tree: { x: 6, y: 13 },
} as const;
export const SELECTION_CONTROLS_SHARED_CELL = { x: 3, y: 10 } as const;
export const SELECTION_CONTROLS_OFF_SCREEN_VILLAGER = { x: 0, y: 0 } as const;

export function createSelectionControlsFixture(seed: string): PrototypeScenario {
  const vision = { vision: 30 };
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
        townCenter: { x: 40, y: 24 },
        startingResources: { food: 200, wood: 200, gold: 100, stone: 200 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, vision),
      ownedSpawn('sheep', 1, SELECTION_CONTROLS_HIDDEN_SHEEP.x, SELECTION_CONTROLS_HIDDEN_SHEEP.y, { amount: 100 }),
      ...SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => ownedSpawn('villager', 1, cell.x, cell.y, vision)),
      ownedSpawn('sheep', 1, SELECTION_CONTROLS_BOX_SHEEP.x, SELECTION_CONTROLS_BOX_SHEEP.y, { amount: 100 }),
      ownedSpawn('villager', 1, SELECTION_CONTROLS_MIXED_BOX.villager.x, SELECTION_CONTROLS_MIXED_BOX.villager.y, vision),
      ownedSpawn('villager', 2, SELECTION_CONTROLS_MIXED_BOX.enemyVillager.x, SELECTION_CONTROLS_MIXED_BOX.enemyVillager.y, { vision: 4 }),
      gaiaSpawn('boar', SELECTION_CONTROLS_MIXED_BOX.boar.x, SELECTION_CONTROLS_MIXED_BOX.boar.y, { amount: 340 }),
      gaiaSpawn('tree', SELECTION_CONTROLS_MIXED_BOX.tree.x, SELECTION_CONTROLS_MIXED_BOX.tree.y, { amount: 100 }),
      ownedSpawn('villager', 1, SELECTION_CONTROLS_SHARED_CELL.x, SELECTION_CONTROLS_SHARED_CELL.y, vision),
      ownedSpawn('villager', 1, SELECTION_CONTROLS_SHARED_CELL.x, SELECTION_CONTROLS_SHARED_CELL.y, vision),
      ownedSpawn('villager', 1, SELECTION_CONTROLS_OFF_SCREEN_VILLAGER.x, SELECTION_CONTROLS_OFF_SCREEN_VILLAGER.y, vision),
      // Room for one more villager: the Town Center's 5 and this House's 5 against 8.
      ownedSpawn('house', 1, 18, 2, { vision: 4 }),
      ownedSpawn('town-center', 2, 40, 24, { vision: 7 }),
    ],
  };
}
