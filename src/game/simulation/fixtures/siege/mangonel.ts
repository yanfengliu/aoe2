import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../common';

// Slice 4 fixture: player-1 Mangonel stationed exactly 7 tiles (its attack
// range) from a stationary enemy Spearman. Used to assert ranged combat
// without pursuit / closing.
export function createMangonelRangedFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
        // Bonus-free civ so siege DAMAGE tests measure raw HP deltas, not the
        // Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Byzantines',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('mangonel', 1, 12, 8, { vision: 9 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('spearman', 2, 19, 8, { vision: 3 }),
    ],
  };
}

// Slice 4 review fixture: player-1 Mangonel adjacent-by-range to a single
// enemy Spearman. Used to measure base damage — the Mangonel has NO
// anti-infantry bonus (Slice 2b-ii: AoE2 anti-infantry is blast, deferred to
// M2), so its 40 base leaves the 45-HP Spearman at 5 after one attack tick.
export function createMangonelVsSpearmanFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
        // Bonus-free civ so siege DAMAGE tests measure raw HP deltas, not the
        // Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Byzantines',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('mangonel', 1, 12, 8, { vision: 9 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('spearman', 2, 18, 8, { vision: 3 }),
    ],
  };
}

// Blast/splash fixture (spec §10.7): a player-1 Mangonel targets a primary
// enemy Spearman with three units at the impact's ORTHOGONAL neighbours
// (Euclidean distance 1, inside the radius-1 blast) — an enemy Spearman +
// Militia (splashed) and a FRIENDLY Villager (friendly fire) — plus a far
// enemy Spearman (distance 3, outside the blast, unaffected). NOTE the metric
// is Euclidean: a DIAGONAL neighbour (distance √2 ≈ 1.41) would NOT be splashed.
export function createMangonelVsClusteredInfantryFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 }, startingAge: 'castle-age' },
      { owner: 2, townCenter: { x: 24, y: 8 }, startingAge: 'castle-age' },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('mangonel', 1, 12, 8, { vision: 9 }),
      // Friendly villager adjacent to the impact — hit by friendly fire.
      ownedSpawn('villager', 1, 18, 7, { vision: 3 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      // Primary target + two splashed orthogonal neighbours (Euclidean dist 1).
      ownedSpawn('spearman', 2, 18, 8, { vision: 3 }),
      ownedSpawn('spearman', 2, 18, 9, { vision: 3 }),
      ownedSpawn('militia', 2, 19, 8, { vision: 3 }),
      // Far enemy Spearman — distance 3 from the impact, outside the blast.
      ownedSpawn('spearman', 2, 18, 11, { vision: 3 }),
    ],
  };
}

// Blast/splash on the unit-vs-BUILDING path (spec §10.7): a player-1 Mangonel
// shells an enemy House (2×2, anchored at 22,20); an enemy Spearman one cell
// west of the anchor (21,20, outside the footprint) is splashed even though the
// primary target is a building. The whole scene sits far from BOTH Town Centers
// so no base-fire arrow confounds the splashed Spearman's HP.
export function createMangonelVsBuildingSplashFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: 'castle-age' },
      { owner: 2, townCenter: { x: 4, y: 30 }, startingAge: 'castle-age' },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('mangonel', 1, 16, 20, { vision: 9 }),
      ownedSpawn('town-center', 2, 4, 30, { vision: 7 }),
      // Enemy House (the primary target) + a Spearman orthogonally adjacent to
      // the anchor cell (21,20), outside the 2×2 footprint.
      ownedSpawn('house', 2, 22, 20, { vision: 3 }),
      ownedSpawn('spearman', 2, 21, 20, { vision: 3 }),
    ],
  };
}

// Slice 4 review fixture: player-1 Mangonel inside max range of a single
// enemy Knight. Used to confirm the +10 anti-infantry bonus does NOT apply
// to cavalry — Knight 100 HP should take exactly 40 damage on one tick.
export function createMangonelVsKnightFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
        // Bonus-free civ so siege DAMAGE tests measure raw HP deltas, not the
        // Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Byzantines',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('mangonel', 1, 12, 8, { vision: 9 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('knight', 2, 18, 8, { vision: 4 }),
    ],
  };
}

// Slice 4 review fixture: player-1 Mangonel with a stationary enemy
// Spearman TWO cells away — well inside the Mangonel's max range 7 but
// inside its minimum range 3. The Mangonel must refuse to fire (its
// boulders can't arc in that close) and hold its position.
export function createMangonelMinRangeBlockedFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
        // Bonus-free civ so siege DAMAGE tests measure raw HP deltas, not the
        // Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Byzantines',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      // Slice 12 moved this off (10,10) (inside the TC footprint); now at
      // y=20 so the empty-TC base arrow (spec §10.8) can't reach the enemy.
      ownedSpawn('mangonel', 1, 10, 20, { vision: 9 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      // Spearman at distance 2 from the Mangonel — inside the min-range 3
      // dead zone. The test issues an attack command; the Mangonel should
      // hold fire (no cooldown consumed) and the Spearman's HP must stay
      // pinned at 45. A stray shot would drop it to 0 (40 + 10 infantry).
      //
      // Slice 12 Task B: `vision: radius 1` instead of the old `3`. The
      // pre-Slice-12 fixture positioned the Mangonel inside the TC
      // footprint at (10, 10) which (a) failed the new fixture
      // validator and (b) side-benefit blocked the enemy AI's
      // Spearman from walking to the Mangonel because the TC cells
      // were impassable. The validator-compliant y=20 positions don't
      // have that blocker, so the standard AI would otherwise send the
      // Spearman to melee the Mangonel and die to a min-range-zone
      // retaliation. Tight radius-1 vision keeps the Spearman unaware
      // of the Mangonel so the test isolates the Mangonel's own
      // min-range behaviour.
      ownedSpawn('spearman', 2, 12, 20, { vision: 1 }),
    ],
  };
}

// Slice 4 review fixture: player-1 Mangonel with a stationary enemy
// Spearman at distance 5 — OUTSIDE min range 3 and WELL INSIDE max range
// 7. Positive control for the min-range test: under identical stats the
// Mangonel must fire; its 40 base damage (no anti-infantry bonus) brings the
// 45-HP Spearman to 5 on one tick.
export function createMangonelOutsideMinRangeFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
        // Bonus-free civ so siege DAMAGE tests measure raw HP deltas, not the
        // Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Byzantines',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      // Slice 12 moved this off (10,10) (inside the TC footprint); now at
      // y=20 so the empty-TC base arrow (spec §10.8) can't reach the enemy.
      ownedSpawn('mangonel', 1, 10, 20, { vision: 9 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('spearman', 2, 15, 20, { vision: 3 }),
    ],
  };
}

// Slice 7D fixture: Imperial Onager placed inside its own min-range 3 of an
// enemy Spearman. Mirrors the Mangonel min-range fixture to verify the
// Onager inherits the same dead-zone behavior.
export function createOnagerMinRangeBlockedFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'imperial-age',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      // Slice 12 moved this off (10,10) (inside the TC footprint); now at
      // y=20 so the empty-TC base arrow (spec §10.8) can't reach the enemy.
      ownedSpawn('onager', 1, 10, 20, { vision: 10 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      // Spearman at distance 2 — inside the Onager's min range of 3.
      // Slice 12 Task B: radius-1 vision so the enemy AI does not spot
      // the Onager and walk the Spearman in to melee it (see
      // mangonel-min-range-blocked-fixture for the same reason).
      ownedSpawn('spearman', 2, 12, 20, { vision: 1 }),
    ],
  };
}
