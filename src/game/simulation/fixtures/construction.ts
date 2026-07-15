import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain } from './common';

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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      // Five villagers at adjacent free cells south of the Town Center.
      { kind: 'villager', x: 6, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'villager', x: 7, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'villager', x: 8, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'villager', x: 9, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'villager', x: 10, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      { kind: 'villager', x: 8, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
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
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'villager', x: 6, y: 14, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'villager', x: 7, y: 14, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'villager', x: 8, y: 14, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'stone-mine', x: 14, y: 18, owner: null, baseOwner: 1, amount: 400 },
      { kind: 'gold-mine', x: 18, y: 14, owner: null, baseOwner: 1, amount: 400 },
      { kind: 'gold-mine', x: 20, y: 14, owner: null, baseOwner: 1, amount: 400 },
      { kind: 'gold-mine', x: 16, y: 17, owner: null, baseOwner: 1, amount: 0 },
      { kind: 'town-center', x: 34, y: 8, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      { kind: 'villager', x: 32, y: 17, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 33, y: 17, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'gold-mine', x: 34, y: 14, owner: null, baseOwner: 2, amount: 400 },
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
      { kind: 'town-center', x: 6, y: 6, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'house', x: 14, y: 14, owner: 1, baseOwner: 1, startHp: 30, vision: { playerId: 1, radius: 3 } },
      { kind: 'villager', x: 14, y: 17, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'town-center', x: 40, y: 30, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
    ],
  };
}
