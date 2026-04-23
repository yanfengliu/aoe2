import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from './common';

// Slice 6 fixture: Franks human (player 1) with a completed Castle.
// Used to pin the contract that a non-Britons Castle offers NO train
// options in v1 (only Britons ship a unique unit yet).
export function createCastleNonBritonsFixture(seed: string): PrototypeScenario {
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
        civilization: 'Franks',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
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
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fixture: Britons human player with a completed Castle, a
// nearby villager, and generous resources so the test can queue a
// Longbowman immediately. Explicitly sets civilization to Britons to
// stay robust against changes to `defaultCivilizationName`.
export function createCastleUniqueFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
        startingResources: {
          food: 500,
          wood: 500,
          gold: 500,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
        civilization: 'Franks',
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
        kind: 'castle',
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
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fixture: player-1 Castle at (14, 6) with an enemy Spearman in
// range-8 reach so the test can assert defensive auto-fire lands damage
// over a few ticks. The Spearman is at (21, 8) — straight-line distance 7
// from Castle center, within the Castle's attack range of 8. The
// Castle owner is Britons (default for player 1) and has vision 11 so
// the target is always visible.
// Slice 6 review fix: AI militia stands between a player Castle and a
// player House. The Castle is closer (anchor distance 4 vs House's 6),
// so a Manhattan-only sort would steer the militia at the Castle.
// With buildingTargetPriority biasing big defensive structures down,
// the militia must instead pick the lower-priority House.
export function createCastleAiTargetPriorityFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 30 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      // Player 1 TC sits far away — does not draw the militia (TC is
      // also high priority, but distance keeps it out of consideration
      // for this scenario).
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      // Castle the AI must NOT prefer (4x4 anchor at (15, 5); cells
      // (15..18, 5..8)).
      {
        kind: 'castle',
        x: 15,
        y: 5,
        owner: 1,
        baseOwner: 1,
      },
      // House the AI MUST prefer (2x2 anchor at (15, 15); cells
      // (15..16, 15..16)). Anchor distance to the militia is 6,
      // strictly larger than the Castle's 4.
      {
        kind: 'house',
        x: 15,
        y: 15,
        owner: 1,
        baseOwner: 1,
      },
      // AI Militia. Vision radius 12 ensures both buildings'
      // anchor cells fall inside player-2 visibility.
      {
        kind: 'militia',
        x: 15,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 12 },
      },
      // AI TC kept far enough away that the AI militia is the only
      // thing in range of either player-1 building.
      {
        kind: 'town-center',
        x: 40,
        y: 30,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

export function createCastleDefensiveFireFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      // Spearman at (20, 8). Manhattan distance from the Castle's anchor
      // cell (14, 6) = 6 + 2 = 8, matching the Castle's attack range
      // exactly (tower combat uses anchor-to-target distance, not
      // closest-edge, matching the existing TC / Watch Tower convention).
      // Castle vision radius 11 keeps the Spearman visible. No enemy AI
      // is reachable (enemy TC is at (48, 28) across the map), so the
      // Spearman just stands and absorbs arrows.
      {
        kind: 'spearman',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fixture: a player-1 Longbowman stationed exactly 6 tiles from a
// stationary enemy Spearman. Used to assert ranged combat at the Longbow's
// canonical Castle-Age attack range without pursuit.
export function createLongbowmanRangedFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'longbowman',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      // Spearman at (20, 8). Manhattan distance from (14, 8) = 6, exactly
      // at the Longbow's canonical Castle-Age range.
      {
        kind: 'spearman',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fixture: Britons human with a completed Castle AND Blacksmith
// so the test can research Fletching, train a Longbowman, and assert the
// +1/+1 buff lands on the Castle-Age Britons unique.
export function createCastleFletchingFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
        startingResources: {
          food: 500,
          wood: 500,
          gold: 500,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'blacksmith',
        x: 20,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fixture: Britons human with a completed Castle and 20 villagers
// adjacent to it, used to assert that up to 20 villagers can garrison a
// Castle (canonical capacity) — well above the Town Center / Watch Tower
// 5-unit cap.
export function createCastleGarrisonFixture(seed: string): PrototypeScenario {
  const villagerSpawns: ScenarioSpawnSpec[] = [];
  // Place 20 villagers on a grid around (20, 10) — clear of the Castle
  // at (14, 6). Each villager gets a unique cell so no two share a slot.
  for (let i = 0; i < 20; i += 1) {
    const offsetX = i % 5;
    const offsetY = Math.floor(i / 5);
    villagerSpawns.push({
      kind: 'villager',
      x: 20 + offsetX,
      y: 10 + offsetY,
      owner: 1,
      baseOwner: 1,
    });
  }
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
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
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      ...villagerSpawns,
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: player-1 Castle with a single enemy Champion at Castle
// anchor-to-target distance 8 (within range 8). Used as the no-archer
// baseline — the Castle fires 1 arrow per reload.
export function createFu3CastleNoArchersFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'imperial-age',
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'imperial-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      // Champion at (20, 8). Closest Castle footprint cell is (17, 8),
      // distance 3 — well within range 8. Champion HP 70, 0 armor, so
      // one 11-damage arrow drops it to 59.
      {
        kind: 'champion',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: player-1 Castle + 3 adjacent archers waiting to garrison.
// The test drives them into the Castle via `issueContextCommandAtEntity`
// and verifies the 3-archer extra-arrows bonus brings the total to 4
// arrows per reload.
export function createFu3CastleThreeArchersFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'imperial-age',
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'imperial-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      // 3 archers adjacent to the Castle's south edge — ready to garrison
      // via the issueContextCommandAtEntity(castle) flow.
      {
        kind: 'archer',
        x: 14,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 15,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 16,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'champion',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: same as three-archers but with 5 archers — verifies the
// 5-arrow cap holds (1 base + 4 archer bonus, not 1 + 5).
export function createFu3CastleFiveArchersFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'imperial-age',
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'imperial-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'archer',
        x: 14,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 15,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 16,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 17,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 18,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'champion',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: Castle anchored at (6, 6), 4x4, with an enemy Spearman at
// (14, 8). Anchor-to-target Manhattan distance is |14-6| + |8-6| = 10.
// Closest footprint cell is (9, 8) at distance 5. Pre-FU3 the Castle
// ignored this target (distance 10 > range 8); post-FU3 it fires.
export function createFu3CastleEdgeRangeFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 2, y: 2 },
        startingAge: 'castle-age',
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 2,
        y: 2,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'castle',
        x: 6,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'spearman',
        x: 14,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: Feudal-Age human with a completed Barracks so the
// villager build options include palisade-wall. Mirrors the
// `fu3-stone-wall-fixture` layout but without the Castle-Age age-up.
export function createFu3PalisadeWallFixture(seed: string): PrototypeScenario {
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
        startingResources: { food: 250, wood: 250, gold: 250, stone: 200 },
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'feudal-age',
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
        kind: 'barracks',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 12,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: Castle-Age human + idle villager so the stone-wall build
// option is exposed in the villager's buildOptions selection state.
export function createFu3StoneWallFixture(seed: string): PrototypeScenario {
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
        startingResources: { food: 500, wood: 500, gold: 500, stone: 500 },
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
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
        kind: 'villager',
        x: 12,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: Castle-Age human, idle villager adjacent to a pre-built
// stone-wall. Used to confirm the wall blocks unit pathing (issueMove
// into the wall cell must be rejected).
export function createFu3StoneWallBlockingFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 48, y: 28 },
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
        kind: 'stone-wall',
        x: 18,
        y: 18,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 18,
        y: 20,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: pre-built stone-wall + enemy Battering Ram adjacent so
// the ram attacks the wall down. Wall starts with a low HP override so
// the test resolves in a handful of ticks without simulating a full
// 2000-HP takedown.
export function createFu3StoneWallCombatFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'imperial-age',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'imperial-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'stone-wall',
        x: 20,
        y: 20,
        owner: 1,
        baseOwner: 1,
        startHp: 50,
      },
      // Enemy Battering Ram one cell south of the wall. Ram atk 2 + 75
      // vs buildings = 77 per hit, so one reload cycle kills the 50-HP
      // wall segment.
      {
        kind: 'battering-ram',
        x: 20,
        y: 21,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 5 },
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}
