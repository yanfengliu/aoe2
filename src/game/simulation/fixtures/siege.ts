import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from './common';

// Slice 4 fixture: Castle-Age human with a completed Siege Workshop, used to
// assert that the Siege Workshop train menu offers Mangonel / Scorpion /
// Battering Ram and that the producer flow works end-to-end.
export function createSiegeWorkshopFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 500,
          wood: 500,
          gold: 500,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
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
      {
        kind: 'siege-workshop',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 6,
        y: 10,
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
    ],
  };
}

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
      {
        kind: 'mangonel',
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
        x: 19,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 4 review fixture: player-1 Mangonel adjacent-by-range to a single
// enemy Spearman. Used to measure one-shot damage including the +10
// anti-infantry bonus — Spearman 45 HP vs Mangonel (40 base + 10 infantry
// bonus) = death after a single attack tick.
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
      {
        kind: 'mangonel',
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
        x: 18,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
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
      {
        kind: 'mangonel',
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
        kind: 'knight',
        x: 18,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
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
      {
        // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
        kind: 'mangonel',
        x: 10,
        y: 13,
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
      // were impassable. The validator-compliant y=13 positions don't
      // have that blocker, so the standard AI would otherwise send the
      // Spearman to melee the Mangonel and die to a min-range-zone
      // retaliation. Tight radius-1 vision keeps the Spearman unaware
      // of the Mangonel so the test isolates the Mangonel's own
      // min-range behaviour.
      {
        kind: 'spearman',
        x: 12,
        y: 13,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 1 },
      },
    ],
  };
}

// Slice 4 review fixture: player-1 Mangonel with a stationary enemy
// Spearman at distance 5 — OUTSIDE min range 3 and WELL INSIDE max range
// 7. Positive control for the min-range test: under identical stats the
// Mangonel must fire and destroy the Spearman with 40 + 10 = 50 damage
// on one tick.
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
      {
        // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
        kind: 'mangonel',
        x: 10,
        y: 13,
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
        x: 15,
        y: 13,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 4 review fixture: player-1 Watch Tower with both an enemy Mangonel
// and an enemy Militia inside its attack range. Used to assert siege is the
// highest-priority target for defensive buildings (the tower must fire on
// the Mangonel first, not the closer Militia).
export function createTowerVsSiegePriorityFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
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
      {
        // Slice 12 Task B: moved from (10, 10) (inside TC footprint
        // at 8..11, 8..11). (12, 10) still sits within tower range 7
        // of both enemy units below so the priority test is
        // unchanged, but now occupies a free cell.
        kind: 'watch-tower',
        x: 12,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 8 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // Both enemies sit inside the tower's range 7. Militia is CLOSER than
      // the Mangonel (dist 3 vs dist 4 after the tower move) — before the
      // priority fix the tower fell back on proximity and killed the Militia
      // first. The fix must make the Mangonel the preferred target regardless
      // of proximity.
      {
        kind: 'militia',
        x: 15,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'mangonel',
        x: 16,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 9 },
      },
    ],
  };
}

// Slice 4 fixture: player-1 Scorpion stationed exactly 7 tiles (its attack
// range) from a stationary enemy Spearman. Used to assert ranged combat.
export function createScorpionRangedFixture(seed: string): PrototypeScenario {
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
      {
        kind: 'scorpion',
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
        x: 19,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 4 fixture: player-1 Battering Ram next to an enemy House. Used to
// assert the Ram's +75 anti-building bonus destroys a 75-HP House in one hit
// (base 2 + 75 = 77 > 75).
export function createRamVsBuildingFixture(seed: string): PrototypeScenario {
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
      {
        kind: 'battering-ram',
        x: 13,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'house',
        x: 14,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
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

// Slice 4 fixture: player-1 Battering Ram next to an enemy villager. Used to
// assert the Ram does NOT receive the +75 building bonus against unit targets.
export function createRamVsVillagerFixture(seed: string): PrototypeScenario {
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
      {
        kind: 'battering-ram',
        x: 14,
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
        kind: 'villager',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Slice 4 fixture: player-1 Pikeman next to an enemy Battering Ram. Used to
// assert the Pikeman anti-cavalry bonus does NOT fire against siege units.
export function createPikemanVsRamFixture(seed: string): PrototypeScenario {
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
      {
        kind: 'pikeman',
        x: 14,
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
        kind: 'battering-ram',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 4 fixture: player-1 Camel next to an enemy Battering Ram. Used to
// assert the Camel anti-cavalry bonus does NOT fire against siege units.
export function createCamelVsRamFixture(seed: string): PrototypeScenario {
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
      {
        kind: 'camel',
        x: 14,
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
        kind: 'battering-ram',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
        kind: 'onager',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 10 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // Spearman at distance 2 — inside the Onager's min range of 3.
      // Slice 12 Task B: radius-1 vision so the enemy AI does not spot
      // the Onager and walk the Spearman in to melee it (see
      // mangonel-min-range-blocked-fixture for the same reason).
      {
        kind: 'spearman',
        x: 12,
        y: 13,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 1 },
      },
    ],
  };
}

// Slice 7D fixture: player-1 Bombard Cannon placed at distance 10 from an
// enemy Town Center (inside max-range 12, outside min-range 5). Used to
// assert Bombard Cannon carries a +80 anti-building bonus. A TC with a
// low startHp (200) dies in two hits of 40 base + 80 bonus = 120 each.
export function createBombardCannonVsBuildingFixture(seed: string): PrototypeScenario {
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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'bombard-cannon',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 13 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        startHp: 200,
      },
    ],
  };
}

// Slice 7D fixture: player-1 Bombard Cannon with an enemy Spearman inside
// its min-range 5 dead-zone. Used to assert the Bombard Cannon holds fire
// at close range.
export function createBombardCannonMinRangeBlockedFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 40, y: 8 },
        startingAge: 'imperial-age',
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
      {
        kind: 'bombard-cannon',
        x: 14,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 13 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // Spearman at distance 3 — inside the Bombard Cannon's min range of 5.
      {
        kind: 'spearman',
        x: 17,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 7D fixture: player-1 Siege Ram next to an enemy Town Center. Used
// to assert the Siege Ram carries a +250 anti-building bonus — a Town Center
// with a low startHp (200) is destroyed in a single hit. Vision is widened
// from the Ram's canonical 3 so the enemy building is visible for the
// command to resolve.
export function createSiegeRamVsBuildingFixture(seed: string): PrototypeScenario {
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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'siege-ram',
        x: 22,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 10 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        startHp: 200,
      },
    ],
  };
}

// FU7 fixture: player-1 Trebuchet sitting far from any enemy. Used to
// assert a freshly-placed Trebuchet is packed by default and can move
// without paying the pack transition cost.
export function createTrebuchetPackFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 50, y: 8 },
        startingAge: 'imperial-age',
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
      {
        kind: 'trebuchet',
        x: 12,
        y: 14,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 10 },
      },
      {
        kind: 'town-center',
        x: 50,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU7 fixture: player-1 Trebuchet already inside its 16-tile range of a
// low-HP enemy Town Center. Used to prove the Trebuchet auto-unpacks
// over the ~50-tick transition before firing, and that once unpacked a
// fresh move order resumes the pack transition before walking away.
// Player 2 keeps a second Town Center far off-map so destroying the
// near one does not trigger a conquest victory — we need the match
// still running for the post-unpack move-command observation.
export function createTrebuchetVsBuildingFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 50, y: 25 },
        startingAge: 'imperial-age',
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
      {
        kind: 'trebuchet',
        x: 15,
        y: 8,
        owner: 1,
        baseOwner: 1,
        // Wide vision so the enemy TC is already visible when the
        // attack command lands.
        vision: { playerId: 1, radius: 18 },
      },
      {
        kind: 'town-center',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        // Low HP so one Trebuchet shot (attack 7 + 200 anti-building
        // bonus = 207) is guaranteed to kill it.
        startHp: 200,
      },
      // Second player-2 Town Center far from the action so conquest
      // does not fire when the near TC is destroyed.
      {
        kind: 'town-center',
        x: 50,
        y: 25,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}
