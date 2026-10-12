import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// A foundation nobody has started building is hidden from its owner's enemies
// (work 121, spec §12.2 "An unstarted foundation is hidden from the owner's
// enemies"). These fixtures put one beside an enemy's soldiers, through the
// real placement command, so a test can read what that enemy sees, can click
// and attacks.
//
// The site is a 3x3 Barracks at x 25-27, y 16-18. The soldiers stand at
// x 22 with sight 4, so two of the footprint's cells are inside their sight
// and its anchor is 4 cells from them by Manhattan distance: inside the
// Aggressive stance's reach. The builder starts at x 31, nine cells from the
// soldiers and out of their sight, and builds from the east side, x 28, which
// is six cells from them, so it never shows itself while it works.
export const HIDDEN_FOUNDATION_SITE = { x: 25, y: 16 } as const;
export const HIDDEN_FOUNDATION_SOLDIERS = [
  { x: 22, y: 17 },
  { x: 22, y: 18 },
] as const;
export const HIDDEN_FOUNDATION_BUILDER = { x: 31, y: 17 } as const;
/** Where a test walks the builder to once it is told to leave the site. */
export const HIDDEN_FOUNDATION_AWAY = { x: 40, y: 17 } as const;

/**
 * `hidden-foundation-fixture`: the human (owner 1) has a Town Center in the
 * north-west and two Militia on the default Aggressive stance by the site.
 * Owner 2, with its AI off, has a Town Center in the south-east and a villager
 * east of the site with the wood for a Barracks; a test has that villager put
 * the foundation down. With `teamsByOwner` the same layout is an ally's.
 */
export function createHiddenFoundationFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, disableAi: true },
      {
        owner: 2,
        townCenter: { x: 52, y: 28 },
        disableAi: true,
        startingResources: { food: 0, wood: 500, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ...HIDDEN_FOUNDATION_SOLDIERS.map((cell) => ownedSpawn('militia', 1, cell.x, cell.y, { vision: 4 })),
      ownedSpawn('town-center', 2, 52, 28, { vision: 7 }),
      ownedSpawn('villager', 2, HIDDEN_FOUNDATION_BUILDER.x, HIDDEN_FOUNDATION_BUILDER.y, { vision: 4 }),
    ],
  };
}

/**
 * `hidden-foundation-ai-fixture`: the same layout with the sides swapped. The
 * soldiers are owner 2's, under its AI, in the Feudal Age with two Militia, so
 * its attack group stays under the age's five and its attack phase picks only
 * what it can see; its units' Aggressive stance runs too. The human's villager
 * puts the foundation down.
 */
export function createHiddenFoundationAiFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        disableAi: true,
        startingResources: { food: 0, wood: 500, gold: 0, stone: 0 },
      },
      {
        owner: 2,
        townCenter: { x: 52, y: 28 },
        startingAge: 'feudal-age',
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('villager', 1, HIDDEN_FOUNDATION_BUILDER.x, HIDDEN_FOUNDATION_BUILDER.y, { vision: 4 }),
      ownedSpawn('town-center', 2, 52, 28, { vision: 7 }),
      ...HIDDEN_FOUNDATION_SOLDIERS.map((cell) => ownedSpawn('militia', 2, cell.x, cell.y, { vision: 4 })),
    ],
  };
}

/** An attack group of `count` Militia for owner 2, in rows of four. */
function ownerTwoArmy(count: number, origin: { x: number; y: number }) {
  return Array.from({ length: count }, (_, i) => ownedSpawn(
    'militia',
    2,
    origin.x + (i % 4),
    origin.y + Math.floor(i / 4),
    { vision: 4 },
  ));
}

const OWNER_TWO_CASTLE_AI = {
  owner: 2,
  townCenter: { x: 52, y: 28 },
  startingAge: 'castle-age' as const,
  startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
};

export const HIDDEN_TOWN_CENTER = { x: 4, y: 4 } as const;
export const HIDDEN_TOWN_CENTER_FOUNDATION = { x: 20, y: 4 } as const;

/**
 * `hidden-foundation-town-center-fixture`: the human has a Town Center and,
 * placed after it, a second Town Center's foundation nobody has started — the
 * newest Town Center, which is the one an owner's Town Center reference names.
 * The human has no units, so owner 2's Castle Age AI, with seven Militia far
 * away, marches on the human's Town Center at once.
 */
export function createHiddenFoundationTownCenterFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [{ owner: 1, townCenter: { ...HIDDEN_TOWN_CENTER }, disableAi: true }, OWNER_TWO_CASTLE_AI],
    spawns: [
      ownedSpawn('town-center', 1, HIDDEN_TOWN_CENTER.x, HIDDEN_TOWN_CENTER.y, { vision: 7 }),
      ownedSpawn('town-center', 1, HIDDEN_TOWN_CENTER_FOUNDATION.x, HIDDEN_TOWN_CENTER_FOUNDATION.y, {
        unstartedFoundation: true,
      }),
      ownedSpawn('town-center', 2, 52, 28, { vision: 7 }),
      ...ownerTwoArmy(7, { x: 44, y: 26 }),
    ],
  };
}

export const HIDDEN_LAST_RESORT_FOUNDATION = { x: 10, y: 10 } as const;
export const HIDDEN_LAST_RESORT_HOUSE = { x: 16, y: 10 } as const;

/**
 * `hidden-foundation-last-resort-fixture`: the human has no Town Center, a
 * Barracks foundation nobody has started (spawned first, so it has the lowest
 * id of the human's buildings), a House, and one Militia in the far south-west
 * that keeps the human in the match out of everyone's sight. Owner 2's Castle
 * Age AI has seven Militia and nothing with a Town Center to march on, so it
 * falls back to the human's lowest-numbered building it may attack.
 */
export function createHiddenFoundationLastResortFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [{ owner: 1, townCenter: { x: 4, y: 4 }, disableAi: true }, OWNER_TWO_CASTLE_AI],
    spawns: [
      ownedSpawn('barracks', 1, HIDDEN_LAST_RESORT_FOUNDATION.x, HIDDEN_LAST_RESORT_FOUNDATION.y, {
        unstartedFoundation: true,
      }),
      ownedSpawn('house', 1, HIDDEN_LAST_RESORT_HOUSE.x, HIDDEN_LAST_RESORT_HOUSE.y),
      ownedSpawn('militia', 1, 4, 32, { vision: 4 }),
      ownedSpawn('town-center', 2, 52, 28, { vision: 7 }),
      ...ownerTwoArmy(7, { x: 44, y: 26 }),
    ],
  };
}

export const HIDDEN_CONQUEST_FOUNDATION = { x: 40, y: 20 } as const;

/**
 * `hidden-foundation-conquest-fixture`: owner 2, AI off, has a House
 * foundation nobody has started and one villager beside it; the human has a
 * Town Center. A test deletes the villager, before or after it starts the
 * House, to leave owner 2 with the foundation alone. Definitive Edition does
 * not let a foundation keep a player in the match (update 46295 stopped the
 * Donjon's doing so), and no enemy can see an unstarted one to destroy it.
 */
export function createHiddenFoundationConquestFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, disableAi: true },
      { owner: 2, townCenter: { ...HIDDEN_CONQUEST_FOUNDATION }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('house', 2, HIDDEN_CONQUEST_FOUNDATION.x, HIDDEN_CONQUEST_FOUNDATION.y, { unstartedFoundation: true }),
      ownedSpawn('villager', 2, HIDDEN_CONQUEST_FOUNDATION.x - 1, HIDDEN_CONQUEST_FOUNDATION.y, { vision: 4 }),
    ],
  };
}

export const HIDDEN_TOWER_FOUNDATION = { x: 25, y: 17 } as const;
export const HIDDEN_TOWER_NEIGHBOUR_HOUSE = { x: 23, y: 20 } as const;

/**
 * `hidden-foundation-tower-fixture`: a tower rush caught before it starts.
 * Owner 2 (AI off) has a Watch Tower foundation nobody has started three cells
 * from the human's two Militia, and a standing House four cells from them.
 * Both are inside the Aggressive stance's reach, and a tower outranks a House
 * as a target, so a soldier that still saw the foundation would go for it,
 * be refused, and never hit the House.
 */
export function createHiddenFoundationTowerFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, disableAi: true },
      { owner: 2, townCenter: { x: 52, y: 28 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ...HIDDEN_FOUNDATION_SOLDIERS.map((cell) => ownedSpawn('militia', 1, cell.x, cell.y, { vision: 4 })),
      ownedSpawn('town-center', 2, 52, 28, { vision: 7 }),
      ownedSpawn('watch-tower', 2, HIDDEN_TOWER_FOUNDATION.x, HIDDEN_TOWER_FOUNDATION.y, { unstartedFoundation: true }),
      ownedSpawn('house', 2, HIDDEN_TOWER_NEIGHBOUR_HOUSE.x, HIDDEN_TOWER_NEIGHBOUR_HOUSE.y),
    ],
  };
}

export const HIDDEN_AI_TOWER_HOUSE = { x: 14, y: 17 } as const;

/**
 * `hidden-foundation-ai-tower-fixture`: the same rush against an AI's eyes.
 * The human has a Watch Tower foundation nobody has started three cells from
 * owner 2's two Militia, and a standing House eight cells from them, outside
 * their reach but in sight of owner 2's Outpost. The human has no units, so
 * the AI's attack phase picks the best enemy building it can see: the House,
 * unless it still sees the foundation, which outranks it and is refused.
 */
export function createHiddenFoundationAiTowerFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, disableAi: true },
      {
        owner: 2,
        townCenter: { x: 52, y: 28 },
        startingAge: 'feudal-age',
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('watch-tower', 1, HIDDEN_TOWER_FOUNDATION.x, HIDDEN_TOWER_FOUNDATION.y, { unstartedFoundation: true }),
      ownedSpawn('house', 1, HIDDEN_AI_TOWER_HOUSE.x, HIDDEN_AI_TOWER_HOUSE.y),
      ownedSpawn('town-center', 2, 52, 28, { vision: 7 }),
      ownedSpawn('outpost', 2, HIDDEN_AI_TOWER_HOUSE.x, HIDDEN_AI_TOWER_HOUSE.y + 4),
      ...HIDDEN_FOUNDATION_SOLDIERS.map((cell) => ownedSpawn('militia', 2, cell.x, cell.y, { vision: 4 })),
    ],
  };
}

export const HIDDEN_VIEW_FOUNDATION = { x: 14, y: 9 } as const;
export const HIDDEN_VIEW_HOUSE = { x: 14, y: 14 } as const;

/**
 * `hidden-foundation-view-fixture`: the screenshot scene. At boot the human's
 * Town Center sees an enemy Barracks foundation nobody has started and, as a
 * control, a standing enemy House. Nothing moves, so two builds that differ
 * only in the foundation rule differ only where the foundation is.
 */
export function createHiddenFoundationViewFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 }, disableAi: true },
      { owner: 2, townCenter: { x: 50, y: 28 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8),
      ownedSpawn('town-center', 2, 50, 28),
      ownedSpawn('barracks', 2, HIDDEN_VIEW_FOUNDATION.x, HIDDEN_VIEW_FOUNDATION.y, { unstartedFoundation: true }),
      ownedSpawn('house', 2, HIDDEN_VIEW_HOUSE.x, HIDDEN_VIEW_HOUSE.y),
    ],
  };
}
