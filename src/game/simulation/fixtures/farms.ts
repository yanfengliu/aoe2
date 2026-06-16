import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain } from './common';

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
          wood: 200,
          gold: 100,
          stone: 200,
        },
        // Disable the planner so the only thing player 2 does is auto-gather
        // with its villagers — keeps the depletion deterministic and quick.
        disableAi: true,
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 6,
        y: 6,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'town-center',
        x: 22,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // A complete farm holding only a little food, next to player 2's
      // villagers + Town Center so they gather + deposit quickly.
      {
        kind: 'farm',
        x: 20,
        y: 10,
        owner: 2,
        baseOwner: 2,
        farmFood: 6,
        vision: { playerId: 2, radius: 2 },
      },
      {
        kind: 'villager',
        x: 19,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'villager',
        x: 19,
        y: 11,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'villager',
        x: 19,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      // Player 1's farm, near player 2's villager so distance is not the
      // reason the player-2 villager avoids it — ownership is.
      {
        kind: 'farm',
        x: 20,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 2 },
      },
      // Player 1's own villager (will gather its own farm). Placed left of the
      // 4x4 Town Center (anchored at 8,8 → spans 8..11) so it does not collide.
      {
        kind: 'villager',
        x: 6,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 22,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // Player 2's food villager — its only nearby food is player 1's farm.
      {
        kind: 'villager',
        x: 21,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}
