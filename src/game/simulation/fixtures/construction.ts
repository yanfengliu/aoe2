import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from './common';

// Five villagers clustered near a Town Center with full coffers, primed
// for placing a building together. The seed is shared between this and
// the single-villager variant so any speed comparisons are apples-to-
// apples.
export function createMultiVillagerConstructionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: {
          food: 1000,
          wood: 1000,
          gold: 1000,
          stone: 1000,
        },
        // Disable the AI planner so the human player owns command
        // dispatch entirely; otherwise the AI may overwrite villager
        // commands mid-test.
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      // Five villagers at adjacent free cells south of the Town Center.
      ownedSpawn('villager', 1, 6, 13, { vision: 4 }),
      ownedSpawn('villager', 1, 7, 13, { vision: 4 }),
      ownedSpawn('villager', 1, 8, 13, { vision: 4 }),
      ownedSpawn('villager', 1, 9, 13, { vision: 4 }),
      ownedSpawn('villager', 1, 10, 13, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

// Single-villager mirror of the above. Same seed and same terrain so the
// only behavioral difference is the villager count.
export function createSingleVillagerConstructionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: {
          food: 1000,
          wood: 1000,
          gold: 1000,
          stone: 1000,
        },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 8, 13, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

// Automatic post-construction mining (spec §6.2). Player 1 has three
// villagers primed to build a Mining Camp, plus a controlled mine layout so
// tests can steer nearest/tie/depleted/no-mine geometry purely by choosing
// the camp anchor:
//   - stone-mine (14,18) amount 400 — spawned FIRST so it holds the LOWEST
//     entity id of the mine set (tie-break assertions rely on this order);
//   - gold-mine  (18,14) amount 400;
//   - gold-mine  (20,14) amount 400;
//   - gold-mine  (16,17) amount 0 — permanently depleted, must be skipped.
// Camp anchor (16,15): depleted mine at distance 2.0 (skipped), gold (18,14)
// at sqrt(5) ~ 2.24 is the nearest harvestable. Camp anchor (14,14): stone
// (14,18) and gold (18,14) tie at exactly 4.0 -> lowest id (the stone) wins.
// Camp anchor (10,26): no mine within 7 cells -> builders go idle.
// Player 2 (also human-planner-free) mirrors the setup on the east side with
// two villagers and one gold-mine (34,14) so owner-agnostic behavior is
// provable via a raw building.placeConfirm for owner 2 at anchor (30,14).
export function createAutoMineCampFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 34, y: 8 },
        startingResources: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 14, { vision: 4 }),
      ownedSpawn('villager', 1, 7, 14, { vision: 4 }),
      ownedSpawn('villager', 1, 8, 14, { vision: 4 }),
      gaiaSpawn('stone-mine', 14, 18, { baseOwner: 1, amount: 400 }),
      gaiaSpawn('gold-mine', 18, 14, { baseOwner: 1, amount: 400 }),
      gaiaSpawn('gold-mine', 20, 14, { baseOwner: 1, amount: 400 }),
      gaiaSpawn('gold-mine', 16, 17, { baseOwner: 1, amount: 0 }),
      ownedSpawn('town-center', 2, 34, 8, { vision: 7 }),
      ownedSpawn('villager', 2, 32, 17, { vision: 4 }),
      ownedSpawn('villager', 2, 33, 17, { vision: 4 }),
      gaiaSpawn('gold-mine', 34, 14, { baseOwner: 2, amount: 400 }),
    ],
  };
}

// Repair (spec §8.1): a player-1 Villager and a DAMAGED player-1 House (2×2,
// maxHp 75, spawned at 30 HP via `startHp`). The owner has full coffers so it
// can pay the repair cost. Placed away from the enemy so nothing else touches
// the House while it is repaired.
export function createRepairFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 6 },
        startingResources: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 30 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 7 }),
      ownedSpawn('house', 1, 14, 14, { startHp: 30, vision: 3 }),
      ownedSpawn('villager', 1, 14, 17, { vision: 4 }),
      ownedSpawn('town-center', 2, 40, 30, { vision: 7 }),
    ],
  };
}
