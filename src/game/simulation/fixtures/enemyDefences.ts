import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

// The register's 2026-09-02 defect in miniature: a resource the assignment
// would pick on distance alone, standing inside the ENEMY Town Centre's reach.
//
// Owner 1's Town Centre at (8,8) covers cells 8..11 and shoots to range 6, so
// with the one-cell margin the rule keeps, anything within 7 of that footprint
// is off limits to automatic assignment. Owner 2's Town Centre is at (26,8):
// the dangerous node is NEARER to it (Manhattan 11 from the anchor) than the
// safe one (15), which is exactly the ordering that sent thirty villagers to
// die on the boot map — a fixture where the safe node was also the nearer one
// would pass before the fix and prove nothing.
//
// Three seeds share the layout:
//   `enemy-defence-gather-fixture`          both bushes — the villager must take the far one
//   `enemy-defence-gather-only-fixture`     the dangerous bush alone — nothing else of any
//                                           kind exists, so it is still gathered (the exception)
//   `enemy-defence-gather-fallback-fixture` the dangerous bush and a safe TREE — the kind
//                                           fallback runs before the exception, so the food
//                                           villager chops wood rather than die for berries
const ENEMY_TOWN_CENTER = { x: 8, y: 8 };
const HOME_TOWN_CENTER = { x: 26, y: 8 };
export const ENEMY_DEFENCE_DANGEROUS_BUSH = { x: 16, y: 9 };
export const ENEMY_DEFENCE_SAFE_BUSH = { x: 40, y: 9 };
export const ENEMY_DEFENCE_SAFE_TREE = { x: 44, y: 10 };

export function createEnemyDefenceGatherFixture(seed: string): PrototypeScenario {
  const only = seed.endsWith('-only-fixture');
  const fallback = seed.endsWith('-fallback-fixture');
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      // The human slot, with no AI: its Town Centre shoots on its own.
      { owner: 1, townCenter: ENEMY_TOWN_CENTER, disableAi: true },
      // The economy under test. Planner off, so the only decision in the
      // match is the villager-economy system's own assignment.
      { owner: 2, townCenter: HOME_TOWN_CENTER, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, ENEMY_TOWN_CENTER.x, ENEMY_TOWN_CENTER.y, { vision: 7 }),
      ownedSpawn('town-center', 2, HOME_TOWN_CENTER.x, HOME_TOWN_CENTER.y, { vision: 7 }),
      // Owner 2's first villager wants FOOD (assignVillagerRole ordinal 0),
      // standing clear of its Town Centre's 4x4 footprint at 26..29 x 8..11.
      ownedSpawn('villager', 2, 24, 13, { vision: 4 }),
      // Five cells from the enemy footprint's east edge: inside its reach.
      gaiaSpawn('berry-bush', ENEMY_DEFENCE_DANGEROUS_BUSH.x, ENEMY_DEFENCE_DANGEROUS_BUSH.y, { amount: 200 }),
      ...(only || fallback
        ? []
        : [gaiaSpawn('berry-bush', ENEMY_DEFENCE_SAFE_BUSH.x, ENEMY_DEFENCE_SAFE_BUSH.y, { amount: 200 })]),
      ...(fallback
        ? [gaiaSpawn('tree', ENEMY_DEFENCE_SAFE_TREE.x, ENEMY_DEFENCE_SAFE_TREE.y, { amount: 100 })]
        : []),
    ],
  };
}

// The hunt phase's half of the same defect: fourteen villagers on the boot map
// walked to one boar beside the enemy Town Centre. Owner 2 is AI-controlled
// with nothing to gather but live boar, so its hunt phase is the only decision
// that can move a villager; the dangerous boar stands four cells from owner
// 1's Town Centre and NEARER to owner 2's than the safe one (17 against 18
// from its anchor, both inside the 20-cell hunt radius).
//
//   `enemy-defence-hunt-fixture`       both boar — the party must take the far one
//   `enemy-defence-hunt-only-fixture`  the dangerous boar alone — hunted anyway (the exception)
const HUNTER_TOWN_CENTER = { x: 30, y: 12 };
export const ENEMY_DEFENCE_DANGEROUS_BOAR = { x: 15, y: 10 };
export const ENEMY_DEFENCE_SAFE_BOAR = { x: 48, y: 12 };

export function createEnemyDefenceHuntFixture(seed: string): PrototypeScenario {
  const only = seed.endsWith('-only-fixture');
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: ENEMY_TOWN_CENTER, disableAi: true },
      // Nothing in the bank, so the planner can neither build nor train and
      // its villagers stay idle for the hunt phase to pick up.
      {
        owner: 2,
        townCenter: HUNTER_TOWN_CENTER,
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, ENEMY_TOWN_CENTER.x, ENEMY_TOWN_CENTER.y, { vision: 7 }),
      ownedSpawn('town-center', 2, HUNTER_TOWN_CENTER.x, HUNTER_TOWN_CENTER.y, { vision: 7 }),
      // A full party of four, clear of the Town Centre footprint at 30..33 x 12..15.
      ownedSpawn('villager', 2, 34, 17, { vision: 4 }),
      ownedSpawn('villager', 2, 35, 17, { vision: 4 }),
      ownedSpawn('villager', 2, 34, 18, { vision: 4 }),
      ownedSpawn('villager', 2, 35, 18, { vision: 4 }),
      gaiaSpawn('boar', ENEMY_DEFENCE_DANGEROUS_BOAR.x, ENEMY_DEFENCE_DANGEROUS_BOAR.y, { amount: 340 }),
      ...(only
        ? []
        : [gaiaSpawn('boar', ENEMY_DEFENCE_SAFE_BOAR.x, ENEMY_DEFENCE_SAFE_BOAR.y, { amount: 340 })]),
    ],
  };
}
