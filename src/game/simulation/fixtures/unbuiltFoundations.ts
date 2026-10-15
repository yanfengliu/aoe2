import type { Position } from 'civ-engine';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { setTerrainKind } from '../mapGeneration/sharedTerrainHelpers';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

// Work 126 (spec §8.1 and §12.1-12.2): a foundation nobody has started building
// is no obstacle in Definitive Edition. Update 185872: "Fixed a bug preventing
// Villagers from walking over unbuilt Foundations" and "Fixed a bug causing
// unbuilt building Foundations to prevent players from building upon them".
//
// One open grass map, three seats and no AI: the human (owner 1), its ally
// (owner 3, the same team) and their enemy (owner 2). Every unit that matters
// is a villager, because a villager starts no fight by itself (its Defensive
// stance only answers whoever strikes it), so units can stand beside and on
// each other's sites without a skirmish deciding the case.
//
// The enemy's 3x3 Barracks goes down at ENEMY_SITE through a real
// `building.placeConfirm`. The human's crosser walks the site's middle row, so
// on a 4-connected grid the shortest walk is that row exactly when the
// foundation is open ground.
// The human's builder sees the whole site and the ally's House site, so its
// placement there reads explored, lit ground. HUMAN_SITE is the human's own
// House site, where the cases stand other players' units before it starts.

export const UNBUILT_FOUNDATIONS_SEED = 'unbuilt-foundations-fixture';

/** Owner 2's 3x3 Barracks site: x 26-28, y 16-18. */
export const ENEMY_SITE: Position = { x: 26, y: 16 };
/** Owner 2's villager, which places and builds the Barracks. It stands on the
 *  site's middle row, so walked due west it crosses its own site. */
export const ENEMY_BUILDER: Position = { x: 34, y: 17 };
/** Where a test walks owner 2's villager after placing, out of every unit's sight. */
export const ENEMY_AWAY: Position = { x: 46, y: 26 };

/** The human's crosser walks row 17, the Barracks' middle row, from here... */
export const CROSSER_START: Position = { x: 16, y: 17 };
/** ...to here: twenty cells due east. */
export const CROSSER_TARGET: Position = { x: 36, y: 17 };

/** The human's builder: sight 9 covers ENEMY_SITE and ALLY_SITE whole. */
export const HUMAN_BUILDER: Position = { x: 22, y: 21 };
export const HUMAN_BUILDER_VISION = 9;
/** A House here overlaps the Barracks site at (26,16) only. */
export const HOUSE_OVER_ENEMY_SITE: Position = { x: 25, y: 15 };
/** The human's own House site, for the cases that stand units on it. */
export const HUMAN_SITE: Position = { x: 22, y: 26 };

/** Owner 3's villager, which places the ally's House at ALLY_SITE. */
export const ALLY_BUILDER: Position = { x: 14, y: 12 };
export const ALLY_SITE: Position = { x: 20, y: 13 };
export const ALLY_AWAY: Position = { x: 8, y: 12 };

const STOCK = { food: 1000, wood: 1000, gold: 1000, stone: 1000 };

export function createUnbuiltFoundationsFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 1, y: 1 }, team: 1, startingResources: { ...STOCK } },
      { owner: 2, townCenter: { x: 55, y: 31 }, team: 2, disableAi: true, startingResources: { ...STOCK } },
      { owner: 3, townCenter: { x: 55, y: 1 }, team: 1, disableAi: true, startingResources: { ...STOCK } },
    ],
    spawns: [
      // Town Centers in far corners with short sight, so none sees the middle.
      ownedSpawn('town-center', 1, 1, 1, { vision: 3 }),
      ownedSpawn('town-center', 2, 55, 31, { vision: 3 }),
      ownedSpawn('town-center', 3, 55, 1, { vision: 3 }),
      ownedSpawn('villager', 1, HUMAN_BUILDER.x, HUMAN_BUILDER.y, { vision: HUMAN_BUILDER_VISION }),
      ownedSpawn('villager', 1, CROSSER_START.x, CROSSER_START.y, { vision: 4 }),
      ownedSpawn('villager', 2, ENEMY_BUILDER.x, ENEMY_BUILDER.y, { vision: 4 }),
      ownedSpawn('villager', 3, ALLY_BUILDER.x, ALLY_BUILDER.y, { vision: 4 }),
    ],
  };
}

/**
 * `unbuilt-foundations-animal-fixture`: a living animal under ground the human
 * has not explored. The human's villager sees the disc of radius 4 around
 * ANIMAL_VILLAGER at boot, so a House at HOUSE_OVER_HIDDEN_SHEEP touches one
 * explored cell, (20,10), and covers a Gaia sheep at (20,9) that the fog hides.
 * Everything else is open grass, so the sheep is the only thing under it.
 */
export const UNBUILT_FOUNDATIONS_ANIMAL_SEED = 'unbuilt-foundations-animal-fixture';
export const ANIMAL_VILLAGER: Position = { x: 20, y: 14 };
export const HIDDEN_SHEEP: Position = { x: 20, y: 9 };
export const HOUSE_OVER_HIDDEN_SHEEP: Position = { x: 20, y: 9 };

export function createUnbuiltFoundationsAnimalFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 1, y: 1 }, startingResources: { ...STOCK } },
      { owner: 2, townCenter: { x: 55, y: 31 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 1, 1, { vision: 3 }),
      ownedSpawn('town-center', 2, 55, 31, { vision: 3 }),
      ownedSpawn('villager', 1, ANIMAL_VILLAGER.x, ANIMAL_VILLAGER.y, { vision: 4 }),
      gaiaSpawn('sheep', HIDDEN_SHEEP.x, HIDDEN_SHEEP.y, { amount: 100 }),
    ],
  };
}

/**
 * `unbuilt-foundations-ai-fixture`: an AI (owner 2) in the Dark Age with the
 * wood for exactly one Barracks, its first want, and one villager far from its
 * Town Center. It puts the Barracks down beside the Town Center, and its
 * villager has a long walk to it. The human's villager waits near that ground
 * with wood of its own, out of the Town Center's sight.
 */
export const UNBUILT_FOUNDATIONS_AI_SEED = 'unbuilt-foundations-ai-fixture';
export const AI_TOWN_CENTER: Position = { x: 40, y: 14 };
export const AI_VILLAGER: Position = { x: 57, y: 33 };
export const AI_RACE_HUMAN_VILLAGER: Position = { x: 31, y: 12 };

export function createUnbuiltFoundationsAiFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 1, y: 1 }, startingResources: { ...STOCK } },
      {
        owner: 2,
        townCenter: { ...AI_TOWN_CENTER },
        startingResources: { food: 0, wood: 175, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 1, 1, { vision: 3 }),
      ownedSpawn('town-center', 2, AI_TOWN_CENTER.x, AI_TOWN_CENTER.y, { vision: 3 }),
      ownedSpawn('villager', 1, AI_RACE_HUMAN_VILLAGER.x, AI_RACE_HUMAN_VILLAGER.y, { vision: 6 }),
      ownedSpawn('villager', 2, AI_VILLAGER.x, AI_VILLAGER.y, { vision: 4 }),
    ],
  };
}

/**
 * `unbuilt-foundations-ai-guard-fixture`: the same AI with three villagers far
 * from its Town Center and the wood for several buildings, so it may run two
 * builds at once (one fewer than its villagers) and searches for its next site
 * while its first foundation still stands unstarted.
 */
export const UNBUILT_FOUNDATIONS_AI_GUARD_SEED = 'unbuilt-foundations-ai-guard-fixture';

export function createUnbuiltFoundationsAiGuardFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 1, y: 1 }, startingResources: { ...STOCK } },
      {
        owner: 2,
        townCenter: { ...AI_TOWN_CENTER },
        startingResources: { food: 200, wood: 600, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 1, 1, { vision: 3 }),
      ownedSpawn('town-center', 2, AI_TOWN_CENTER.x, AI_TOWN_CENTER.y, { vision: 3 }),
      ownedSpawn('villager', 2, AI_VILLAGER.x, AI_VILLAGER.y, { vision: 4 }),
      ownedSpawn('villager', 2, AI_VILLAGER.x - 1, AI_VILLAGER.y, { vision: 4 }),
      ownedSpawn('villager', 2, AI_VILLAGER.x, AI_VILLAGER.y - 1, { vision: 4 }),
    ],
  };
}

/**
 * `unbuilt-foundations-relic-fixture`: the human's Monastery holding a relic,
 * with the human's unstarted House on the first cell the relic would spill to
 * when the Monastery goes (two cells north of its anchor, the first cell of the
 * spill's ring order), and a villager of the human's to build the House. A
 * foundation nobody has started is open ground, and the spill treats it so.
 */
export const UNBUILT_FOUNDATIONS_RELIC_SEED = 'unbuilt-foundations-relic-fixture';
export const RELIC_MONASTERY: Position = { x: 20, y: 12 };
export const RELIC_HOUSE: Position = { x: 20, y: 9 };
export const RELIC_BUILDER: Position = { x: 26, y: 9 };

export function createUnbuiltFoundationsRelicFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 1, y: 1 }, startingAge: 'castle-age', startingResources: { ...STOCK } },
      { owner: 2, townCenter: { x: 55, y: 31 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 1, 1, { vision: 3 }),
      ownedSpawn('town-center', 2, 55, 31, { vision: 3 }),
      ownedSpawn('monastery', 1, RELIC_MONASTERY.x, RELIC_MONASTERY.y, { vision: 6, startingRelicsInMonastery: 1 }),
      ownedSpawn('house', 1, RELIC_HOUSE.x, RELIC_HOUSE.y, { unstartedFoundation: true }),
      ownedSpawn('villager', 1, RELIC_BUILDER.x, RELIC_BUILDER.y, { vision: 6 }),
    ],
  };
}

/**
 * `unbuilt-foundations-pass-fixture`: a wall of water two cells thick down the
 * map at x 30-31, with one gap two cells tall at y 16-17, and the human's
 * builder west of it. A House in the gap fills the pass: units cross it while
 * nobody has started it, and it seals the pass the moment it starts.
 */
export const UNBUILT_FOUNDATIONS_PASS_SEED = 'unbuilt-foundations-pass-fixture';
export const PASS_HOUSE: Position = { x: 30, y: 16 };
export const PASS_BUILDER: Position = { x: 27, y: 16 };

export function createUnbuiltFoundationsPassFixture(seed: string): PrototypeScenario {
  const terrain = createGrassFixtureTerrain();
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    if (y === PASS_HOUSE.y || y === PASS_HOUSE.y + 1) continue;
    setTerrainKind(terrain, PASS_HOUSE.x, y, 'water');
    setTerrainKind(terrain, PASS_HOUSE.x + 1, y, 'water');
  }
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      { owner: 1, townCenter: { x: 1, y: 1 }, startingResources: { ...STOCK } },
      { owner: 2, townCenter: { x: 55, y: 31 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 1, 1, { vision: 3 }),
      ownedSpawn('town-center', 2, 55, 31, { vision: 3 }),
      ownedSpawn('villager', 1, PASS_BUILDER.x, PASS_BUILDER.y, { vision: 9 }),
    ],
  };
}
