import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';

// Grass, plus a pool for the Dock — which is the one building that must be
// placed against water (shorePlacement.ts).
function showcaseTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = 21; y <= 24; y += 1) {
    for (let x = 8; x <= 16; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return terrain;
}

// Visual-only showcase scenario (M7 building-visuals). Places one COMPLETED
// human-owned building of every concrete BuildingType in a tidy grid, so the
// AGENTS.md visual-change protocol can capture a single before/after frame that
// exercises both shared role silhouettes and their type-specific details. Not
// referenced by gameplay tests; purely a capture target (lives in the fixtures
// tree, the sanctioned home for scenario data).
// Imperial age + generous vision so every building is fog-visible to player 1
// at boot. Footprints are spaced apart so the bridge-boot overlap validator
// passes and each silhouette is isolated and legible.
export function createBuildingShowcaseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: showcaseTerrain(),
    starts: [
      {
        owner: 1,
        // The player's Town Center IS the showcase town-center (top-left of the
        // grid) so we don't seed an extra TC the layout has to dodge.
        townCenter: { x: 2, y: 3 },
        startingAge: 'imperial-age',
        startingResources: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 27, y: 27 },
        startingAge: 'imperial-age',
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
        disableAi: true,
      },
    ],
    spawns: [
      // Row 1 — the 4x4 landmarks.
      ownedSpawn('town-center', 1, 2, 3, { vision: 16 }),
      ownedSpawn('castle', 1, 8, 3, { vision: 16 }),
      ownedSpawn('wonder', 1, 14, 3, { vision: 16 }),
      ownedSpawn('market', 1, 20, 3, { vision: 16 }),
      // Row 2 — every 3x3 production hall.
      ownedSpawn('barracks', 1, 2, 10, { vision: 10 }),
      ownedSpawn('stable', 1, 7, 10, { vision: 10 }),
      ownedSpawn('archery-range', 1, 12, 10, { vision: 10 }),
      ownedSpawn('siege-workshop', 1, 17, 10, { vision: 10 }),
      ownedSpawn('blacksmith', 1, 22, 10, { vision: 10 }),
      // Row 3 — economy, religion, defense, and both wall materials.
      ownedSpawn('house', 1, 2, 16, { vision: 8 }),
      ownedSpawn('mill', 1, 6, 16, { vision: 8 }),
      ownedSpawn('lumber-camp', 1, 10, 16, { vision: 8 }),
      ownedSpawn('mining-camp', 1, 14, 16, { vision: 8 }),
      ownedSpawn('monastery', 1, 18, 16, { vision: 8 }),
      ownedSpawn('watch-tower', 1, 22, 16, { vision: 8 }),
      ownedSpawn('farm', 1, 25, 16, { vision: 6 }),
      ownedSpawn('stone-wall', 1, 27, 16, { vision: 6 }),
      ownedSpawn('palisade-wall', 1, 29, 16, { vision: 6 }),
      // Row 4 — research halls added after the original three rows were laid out.
      ownedSpawn('university', 1, 2, 22, { vision: 8 }),
      ownedSpawn('dock', 1, 5, 25, { vision: 8 }),
      // Inert, fog-hidden conquest presence keeps capture frames free of the
      // victory card without adding motion or another visible showcase type.
      ownedSpawn('town-center', 2, 27, 27, { vision: 1 }),
    ],
  };
}
