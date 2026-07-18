import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../common';

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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 6),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 6),
      ownedSpawn('villager', 1, 6, 10, { vision: 4 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
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
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      // Castle the AI must NOT prefer (4x4 anchor at (15, 5); cells
      // (15..18, 5..8)).
      ownedSpawn('castle', 1, 15, 5),
      // House the AI MUST prefer (2x2 anchor at (15, 15); cells
      // (15..16, 15..16)). Anchor distance to the militia is 6,
      // strictly larger than the Castle's 4.
      ownedSpawn('house', 1, 15, 15),
      // AI Militia. Vision radius 12 ensures both buildings'
      // anchor cells fall inside player-2 visibility.
      ownedSpawn('militia', 2, 15, 9, { vision: 12 }),
      // AI TC kept far enough away that the AI militia is the only
      // thing in range of either player-1 building.
      ownedSpawn('town-center', 2, 40, 30, { vision: 7 }),
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
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 6),
      // Spearman at (20, 8). Manhattan distance from the Castle's anchor
      // cell (14, 6) = 6 + 2 = 8, matching the Castle's attack range
      // exactly (tower combat uses anchor-to-target distance, not
      // closest-edge, matching the existing TC / Watch Tower convention).
      // Castle vision radius 11 keeps the Spearman visible. No enemy AI
      // is reachable (enemy TC is at (48, 28) across the map), so the
      // Spearman just stands and absorbs arrows.
      ownedSpawn('spearman', 2, 20, 8),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
    ],
  };
}
