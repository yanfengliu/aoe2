import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../types';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Tower-upgrade (Guard Tower → Keep, v0.1.57) fixtures. Player 1 (human, AI
// disabled) owns a completed Watch Tower at (14, 6). An enemy Spearman (player
// 2, AI disabled) stands still and absorbs the tower's defensive arrows so a
// test can measure HP lost over a fixed tick window and compare across the
// tech tiers. The base Watch Tower attack range is 7 (prototypeBuildingRules);
// Keep adds +1 → 8. Distances below are Manhattan anchor-to-target, matching
// the tower-combat convention (see castleDefense's createCastleDefensiveFireFixture).
//
// The scenario is seeded with `startingResearchedTechnologies` on player 1 to
// pre-apply Guard Tower / Keep on boot — the DERIVED bonus is read from the
// researched set at the fire site, so no research needs to be driven in-test.

interface TowerUpgradeOptions {
  // Spearman position; distance from the tower anchor (14, 6) sets in/out of range.
  spearman: { x: number; y: number };
  // Player-1 techs pre-applied on boot (drives the derived fire-site bonus —
  // tower-upgrade techs and/or Blacksmith arrow techs like Fletching).
  researched?: ResearchableTechnologyType[];
}

function createTowerUpgradeScenario(
  seed: string,
  options: TowerUpgradeOptions,
): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        // Imperial so both Guard Tower and Keep are age-legal to seed; the
        // researched set (not the age) drives the derived bonus.
        startingAge: 'imperial-age',
        disableAi: true,
        ...(options.researched
          ? { startingResearchedTechnologies: options.researched }
          : {}),
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      // Watch Tower at (14, 6); vision radius 12 keeps the Spearman visible at
      // both the in-range (7) and edge (8) distances used by the fixtures.
      ownedSpawn('watch-tower', 1, 14, 6, { vision: 12 }),
      ownedSpawn('spearman', 2, options.spearman.x, options.spearman.y),
      // Enemy TC far across the map — no enemy AI is active, so the Spearman
      // just stands and absorbs arrows.
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
    ],
  };
}

// Baseline: no tower techs. Spearman at (18, 8) — Manhattan distance to the
// anchor (14, 6) = 4 + 2 = 6, inside base range 7.
export function createTowerUpgradeBaselineFixture(seed: string): PrototypeScenario {
  return createTowerUpgradeScenario(seed, { spearman: { x: 18, y: 8 } });
}

// Guard Tower researched: same Spearman position as baseline, so the only
// difference is the +2 attack — the test asserts strictly more HP lost.
export function createTowerUpgradeGuardFixture(seed: string): PrototypeScenario {
  return createTowerUpgradeScenario(seed, {
    spearman: { x: 18, y: 8 },
    researched: ['guard-tower'],
  });
}

// Edge case WITHOUT Keep: Spearman at (19, 8) — Manhattan distance 5 + 2 = 7?
// No: (19-14) + (8-6) = 5 + 2 = 7. To sit just BEYOND base range 7 we place it
// at (20, 8): (20-14) + (8-6) = 6 + 2 = 8, outside range 7, inside range 8.
export function createTowerUpgradeEdgeNoKeepFixture(seed: string): PrototypeScenario {
  return createTowerUpgradeScenario(seed, { spearman: { x: 20, y: 8 } });
}

// Same edge distance (8) but Keep researched (+1 range → 8), so the tower now
// reaches the Spearman.
export function createTowerUpgradeEdgeKeepFixture(seed: string): PrototypeScenario {
  return createTowerUpgradeScenario(seed, {
    spearman: { x: 20, y: 8 },
    researched: ['guard-tower', 'keep'],
  });
}

// Blacksmith arrow tech (Fletching) researched: same Spearman position as the
// baseline (18, 8), so the only difference is +1 building arrow attack — the
// test asserts strictly more HP lost than the un-teched baseline. Verifies
// Fletching/Bodkin/Bracer boost building fire (a Watch Tower here).
export function createTowerFletchingFixture(seed: string): PrototypeScenario {
  return createTowerUpgradeScenario(seed, {
    spearman: { x: 18, y: 8 },
    researched: ['fletching'],
  });
}
