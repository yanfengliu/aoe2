import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// M1 Farms (slice 1) depletion fixture. Player 2's economy (AI planner
// disabled for determinism, but the villager-economy auto-gather still runs
// for non-human owners) has a handful of villagers, a Town Center food
// drop-off, and a COMPLETE farm seeded with a tiny amount of food. The
// villagers auto-gather food from the farm and draw it down to 0 within a few
// hundred ticks, exercising the depletion → building+resource removal path.
//
// The farm is a building+resource hybrid: it occupies its 1x1 cell as a
// building and carries a `farm` food resource (overridden to a low amount via
// `farmFood`). Player 1 is a passive human placeholder with no economy so the
// fixture stays focused on player 2's farm.
export function createFarmDepletionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 6 },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 22, y: 10 },
        startingResources: {
          food: 0,
          // < 60 wood so the owner CANNOT afford an auto-reseed (slice 2):
          // the depleting farm therefore takes the slice-1 removal path, which
          // is exactly what this fixture's depletion-removal test asserts.
          wood: 0,
          gold: 100,
          stone: 200,
        },
        // Disable the planner so the only thing player 2 does is auto-gather
        // with its villagers — keeps the depletion deterministic and quick.
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 7 }),
      ownedSpawn('town-center', 2, 22, 10, { vision: 7 }),
      // A complete farm holding only a little food, next to player 2's
      // villagers + Town Center so they gather + deposit quickly.
      ownedSpawn('farm', 2, 20, 10, { farmFood: 6, vision: 2 }),
      ownedSpawn('villager', 2, 19, 10, { vision: 4 }),
      ownedSpawn('villager', 2, 19, 11, { vision: 4 }),
      ownedSpawn('villager', 2, 19, 9, { vision: 4 }),
    ],
  };
}

// M1 Farms (slice 2) auto-reseed fixture. Identical shape to the depletion
// fixture, but player 2's owner has wood to spare (140) and the farm is seeded
// with a tiny amount of food. When the villagers draw the farm's food to 0 the
// auto-reseed fires (owner can afford 60 wood): the SAME farm entity is reset
// to 175 food, the owner's wood drops by 60, and gathering continues. With 140
// wood the owner can pay for two reseeds (140 → 80 → 20) before the next
// depletion finds it broke (20 < 60) and the farm is finally removed. The
// villagers auto-gather (AI economy, planner disabled for determinism).
export function createFarmReseedFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 6 },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 22, y: 10 },
        startingResources: {
          food: 0,
          // Enough wood for exactly two reseeds (60 each): 140 → 80 → 20, then
          // the third depletion finds 20 < 60 and removes the farm.
          wood: 140,
          gold: 100,
          stone: 200,
        },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 7 }),
      ownedSpawn('town-center', 2, 22, 10, { vision: 7 }),
      // A complete farm holding only a little food so depletion (and thus the
      // reseed) is reached quickly.
      ownedSpawn('farm', 2, 20, 10, { farmFood: 6, vision: 2 }),
      ownedSpawn('villager', 2, 19, 10, { vision: 4 }),
      ownedSpawn('villager', 2, 19, 11, { vision: 4 }),
      ownedSpawn('villager', 2, 19, 9, { vision: 4 }),
    ],
  };
}

// Farm-upgrade techs (v0.1.46) ground-truth fixture. Owner 1 (HUMAN) is in the
// Imperial Age with ALL THREE farm-food techs researched on boot, so its
// complete farm boots at the upgraded 550-food capacity (derived at
// onBuildingConstructionComplete from the researched set). Owner 2 has NO farm
// techs, so its complete farm stays at the base 175 — the no-regression
// control. Both players are passive (no AI) so the seeded state is the only
// thing under test. No `farmFood` override → the capacity is purely derived.
export function createFarmUpgradeTechsFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
        startingResearchedTechnologies: ['horse-collar', 'heavy-plow', 'crop-rotation'],
        startingResources: { food: 200, wood: 200, gold: 200, stone: 200 },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 30, y: 8 },
        startingResources: { food: 200, wood: 200, gold: 200, stone: 200 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      // Owner 1's farm: with all three techs researched it boots at 550 food.
      ownedSpawn('farm', 1, 6, 8, { vision: 2 }),
      ownedSpawn('town-center', 2, 30, 8, { vision: 7 }),
      // Owner 2's farm: no farm techs → stays at the base 175.
      ownedSpawn('farm', 2, 28, 8, { vision: 2 }),
    ],
  };
}

// Farm-upgrade BUILD fixture. A Feudal-Age human (owner 1) with Horse Collar
// researched and a villager to BUILD a farm through the normal placement flow.
// The completed farm must carry the upgraded 250 food (derived at
// construction-complete), proving the create-site wiring for a freshly-built
// farm. AI disabled for determinism.
export function createFarmUpgradeBuildFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'feudal-age',
        startingResearchedTechnologies: ['horse-collar'],
        startingResources: { food: 200, wood: 200, gold: 100, stone: 200 },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 30, y: 8 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 12, { vision: 4 }),
      ownedSpawn('town-center', 2, 30, 8, { vision: 7 }),
    ],
  };
}

// Farm-upgrade RESEED fixture. Mirrors the slice-2 reseed fixture but owner 2
// has Horse Collar researched, so when its nearly-depleted farm is drawn to 0
// the auto-reseed refills to the UPGRADED 250 (not the base 175) — proving the
// reseed-site wiring reads farmFoodCapacity. Plenty of wood (200) for several
// reseeds. AI disabled; the villager-economy auto-gather still runs.
export function createFarmUpgradeReseedFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 6 },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 22, y: 10 },
        startingResearchedTechnologies: ['horse-collar'],
        startingResources: { food: 0, wood: 200, gold: 100, stone: 200 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 7 }),
      ownedSpawn('town-center', 2, 22, 10, { vision: 7 }),
      // A complete farm seeded nearly-depleted (6 food) but at the upgraded max
      // (250, since Horse Collar is researched on boot) so depletion → reseed is
      // reached quickly and the reseed target is observable.
      ownedSpawn('farm', 2, 20, 10, { farmFood: 6, vision: 2 }),
      ownedSpawn('villager', 2, 19, 10, { vision: 4 }),
      ownedSpawn('villager', 2, 19, 11, { vision: 4 }),
      ownedSpawn('villager', 2, 19, 9, { vision: 4 }),
    ],
  };
}

// M1 Farms (slice 1) food-theft fixture. Player 1 (HUMAN) owns a farm. Player
// 2 (AI economy, planner disabled so it doesn't build/expand) has a food-role
// villager whose ONLY visible food on the map is player 1's farm — there are
// NO sheep, berries, boar, or a player-2 farm. Because a farm is an OWNED
// structure, the player-2 villager must NOT gather it (no food theft): it
// stays idle/un-tasked on food instead of walking to and harvesting the
// human's farm. Player 1's own villager, by contrast, gathers its own farm.
export function createFarmOwnershipFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: { food: 0, wood: 200, gold: 100, stone: 200 },
      },
      {
        owner: 2,
        townCenter: { x: 22, y: 8 },
        startingResources: { food: 0, wood: 200, gold: 100, stone: 200 },
        // Planner off so player 2 does nothing but auto-gather — isolates the
        // ownership gate (the villager-economy auto-gather still runs).
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      // Player 1's farm, near player 2's villager so distance is not the
      // reason the player-2 villager avoids it — ownership is.
      ownedSpawn('farm', 1, 20, 8, { vision: 2 }),
      // Player 1's own villager (will gather its own farm). Placed left of the
      // 4x4 Town Center (anchored at 8,8 → spans 8..11) so it does not collide.
      ownedSpawn('villager', 1, 6, 8, { vision: 4 }),
      ownedSpawn('town-center', 2, 22, 8, { vision: 7 }),
      // Player 2's food villager — its only nearby food is player 1's farm.
      ownedSpawn('villager', 2, 21, 8, { vision: 4 }),
    ],
  };
}
