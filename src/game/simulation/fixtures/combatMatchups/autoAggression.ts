import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain } from '../common';

// Auto-aggression: idle militia (vision 3) with enemy spearman placed at
// distance 3. The spearman is inside the militia's vision radius, so the
// idle militia should engage on its own without a player command.
export function createAutoAggroIdleMilitiaInVisionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      { owner: 2, townCenter: { x: 24, y: 8 }, disableAi: true },
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
      {
        kind: 'militia',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'spearman',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Auto-aggression: idle militia (vision 3) with enemy spearman placed at
// distance 8 — far outside militia vision. The militia must remain idle.
export function createAutoAggroIdleMilitiaOutOfVisionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      { owner: 2, townCenter: { x: 32, y: 8 }, disableAi: true },
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
      {
        kind: 'militia',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 32,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'spearman',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Auto-aggression: idle archer (attack range 4, vision 5). Enemy
// spearman placed at distance 5 — inside vision, outside attack range.
// The archer should pursue, close to range, and fire.
export function createAutoAggroArcherPursuitFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 }, startingAge: 'feudal-age' },
      { owner: 2, townCenter: { x: 24, y: 8 }, startingAge: 'feudal-age', disableAi: true },
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
      {
        kind: 'archer',
        x: 13,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'spearman',
        x: 18,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Auto-aggression vs player order: militia given a move command past an
// enemy spearman. The militia should NOT auto-engage (player order
// honored) — it walks past the enemy to its destination.
export function createAutoAggroPlayerMoveOverridesFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 8 } },
      { owner: 2, townCenter: { x: 32, y: 8 }, disableAi: true },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'militia',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 32,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'spearman',
        x: 12,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Auto-aggression villager defense: idle villager with enemy spearman
// placed exactly 1 tile away. Defensive-stance canon — the villager
// should swing back at the adjacent enemy.
export function createAutoAggroVillagerAdjacentFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      { owner: 2, townCenter: { x: 24, y: 8 }, disableAi: true },
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
      {
        kind: 'villager',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'spearman',
        x: 13,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Auto-aggression villager non-pursuit: idle villager with enemy
// spearman 4 tiles away (outside villager's defensive radius of 1).
// The villager should NOT pursue.
export function createAutoAggroVillagerNoPursuitFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      { owner: 2, townCenter: { x: 24, y: 8 }, disableAi: true },
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
      {
        kind: 'villager',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'spearman',
        x: 16,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Auto-aggression vs gather order: a villager gathering wood with an
// enemy spearman placed adjacent to the gather cell. The villager has
// an active `GathererComponent.task` so auto-aggression must NOT yank
// it off the resource — the gather order is treated as a player
// order. The villager keeps gathering while taking damage.
export function createAutoAggroVillagerGatheringFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      { owner: 2, townCenter: { x: 24, y: 8 }, disableAi: true },
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
      {
        kind: 'villager',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'tree',
        x: 13,
        y: 8,
        owner: null,
        baseOwner: 1,
        amount: 200,
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'spearman',
        x: 12,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 1 },
      },
    ],
  };
}

// Auto-aggression skips Monks. Monks have their own task pipeline
// (heal / convert / pickup / deposit relics). An adjacent enemy
// spearman must not pull the Monk into an attack-command — the Monk's
// "attack" is conversion, handled separately.
export function createAutoAggroMonkSkipFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 }, startingAge: 'castle-age' },
      { owner: 2, townCenter: { x: 24, y: 8 }, startingAge: 'castle-age', disableAi: true },
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
      {
        kind: 'monk',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'spearman',
        x: 13,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 1 },
      },
    ],
  };
}

// Auto-aggression target switch: idle militia between two enemy
// spearmen. After killing the first, the militia should auto-engage the
// second on its own (idempotent re-scan).
export function createAutoAggroSequentialTargetsFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      { owner: 2, townCenter: { x: 24, y: 8 }, disableAi: true },
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
      {
        kind: 'militia',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'spearman',
        x: 13,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'spearman',
        x: 14,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}
