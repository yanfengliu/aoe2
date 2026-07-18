import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../common';

// Auto-aggression fixtures.
//
// Town Center placement note: spec §10.8 gives a completed Town Center a base
// arrow even when empty (v0.1.29). Each test here turns on the ENEMY spearman's
// HP — either it drops (the unit engaged) or it stays put (the unit correctly
// held). A home TC within range 6 of the enemy would fire on it and satisfy the
// assertion on its own, masking the unit's behavior. So for every fixture whose
// enemy sits within range of (8,8), the human TC is parked out of range (y=28,
// or the enemy TC east at x=40 in the move-override case) — the unit auto-aggros
// off its OWN vision, so engagement is unaffected. Fixtures whose enemy is
// already >6 from (8,8) — out-of-vision (x20) and archer-pursuit (x18) — keep
// the TC at (8,8).

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
      { owner: 1, townCenter: { x: 8, y: 28 } },
      { owner: 2, townCenter: { x: 24, y: 8 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 28, { vision: 7 }),
      ownedSpawn('militia', 1, 12, 8, { vision: 3 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('spearman', 2, 15, 8, { vision: 3 }),
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('militia', 1, 12, 8, { vision: 3 }),
      ownedSpawn('town-center', 2, 32, 8, { vision: 7 }),
      ownedSpawn('spearman', 2, 20, 8, { vision: 3 }),
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('archer', 1, 13, 8, { vision: 5 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('spearman', 2, 18, 8, { vision: 3 }),
    ],
  };
}

// Auto-aggression vs player order: militia given a move command past an
// enemy spearman. The militia should NOT auto-engage (player order
// honored) — it walks past the enemy to its destination. The enemy TC is
// parked far east (40,8) so it can't shoot the militia at its move target
// (28,8); the human TC is south (4,28) so it can't shoot the spearman (12,9).
export function createAutoAggroPlayerMoveOverridesFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 28 } },
      { owner: 2, townCenter: { x: 40, y: 8 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 28, { vision: 7 }),
      ownedSpawn('militia', 1, 8, 8, { vision: 3 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
      ownedSpawn('spearman', 2, 12, 9, { vision: 3 }),
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
      { owner: 1, townCenter: { x: 8, y: 28 } },
      { owner: 2, townCenter: { x: 24, y: 8 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 28, { vision: 7 }),
      ownedSpawn('villager', 1, 12, 8, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('spearman', 2, 13, 8, { vision: 3 }),
    ],
  };
}

// Auto-aggression villager non-pursuit: idle villager with enemy
// spearman 4 tiles away (outside villager's defensive radius of 1).
// The villager should NOT pursue. (Villager 12,8 / spearman 16,8 keep their
// 4-tile gap; the human TC is south at 8,28, out of the spearman's range.)
export function createAutoAggroVillagerNoPursuitFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 28 } },
      { owner: 2, townCenter: { x: 24, y: 8 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 28, { vision: 7 }),
      ownedSpawn('villager', 1, 12, 8, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('spearman', 2, 16, 8, { vision: 3 }),
    ],
  };
}

// Auto-aggression vs gather order: a villager gathering wood with an
// enemy spearman placed adjacent to the gather cell. The villager has
// an active `GathererComponent.task` so auto-aggression must NOT yank
// it off the resource — the gather order is treated as a player order.
// The villager keeps gathering while taking damage. (Human TC south at
// 8,28; the test still finds the tree at 13,8.)
export function createAutoAggroVillagerGatheringFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 28 } },
      { owner: 2, townCenter: { x: 24, y: 8 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 28, { vision: 7 }),
      ownedSpawn('villager', 1, 12, 8, { vision: 4 }),
      gaiaSpawn('tree', 13, 8, { baseOwner: 1, amount: 200 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      // radius-1 vision so the enemy AI doesn't walk the spearman away.
      ownedSpawn('spearman', 2, 12, 9, { vision: 1 }),
    ],
  };
}

// Auto-aggression skips Monks. Monks have their own task pipeline
// (heal / convert / pickup / deposit relics). An adjacent enemy spearman
// must not pull the Monk into an attack-command — the Monk's "attack" is
// conversion, handled separately. (Human TC south at 8,28 so it can't be
// what damages the spearman; the assertion is the spearman stays unscathed.)
export function createAutoAggroMonkSkipFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 28 }, startingAge: 'castle-age' },
      { owner: 2, townCenter: { x: 24, y: 8 }, startingAge: 'castle-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 28, { vision: 7 }),
      ownedSpawn('monk', 1, 12, 8, { vision: 9 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('spearman', 2, 13, 8, { vision: 1 }),
    ],
  };
}

// Auto-aggression target switch: idle militia between two enemy spearmen.
// After killing the first, the militia should auto-engage the second on its
// own (idempotent re-scan). Human TC south at 8,28 so the kills are the
// militia's, not the TC's.
export function createAutoAggroSequentialTargetsFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 28 } },
      { owner: 2, townCenter: { x: 24, y: 8 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 28, { vision: 7 }),
      ownedSpawn('militia', 1, 12, 8, { vision: 3 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('spearman', 2, 13, 8, { vision: 3 }),
      ownedSpawn('spearman', 2, 14, 8, { vision: 3 }),
    ],
  };
}
