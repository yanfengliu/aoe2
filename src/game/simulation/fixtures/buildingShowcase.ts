import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Visual-only showcase scenario (M7 building-visuals slice 1). Places one
// COMPLETED human-owned building of every render ROLE — town-center, fortress
// (castle), wonder, house, mill, farm, drop-site (lumber-camp), military
// (barracks), blacksmith, market, monastery, tower (watch-tower), wall
// (stone-wall) — in a tidy, all-visible grid, so the AGENTS.md visual-change
// protocol can capture a single before/after frame that exercises every
// building silhouette. Not referenced by gameplay tests; purely a capture
// target (lives in the fixtures tree, the sanctioned home for scenario data).
// Imperial age + generous vision so every building is fog-visible to player 1
// at boot. Footprints are spaced apart so the bridge-boot overlap validator
// passes and each silhouette is isolated and legible.
export function createBuildingShowcaseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        // The player's Town Center IS the showcase town-center (top-left of the
        // grid) so we don't seed an extra TC the layout has to dodge.
        townCenter: { x: 3, y: 4 },
        startingAge: 'imperial-age',
        startingResources: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
        disableAi: true,
      },
    ],
    spawns: [
      // Row 1 — the 4x4 landmarks.
      ownedSpawn('town-center', 1, 3, 4, { vision: 16 }),
      ownedSpawn('castle', 1, 10, 4, { vision: 16 }),
      ownedSpawn('wonder', 1, 17, 4, { vision: 16 }),
      ownedSpawn('market', 1, 24, 4, { vision: 16 }),
      // Row 2 — 3x3 halls + 2x2 economy.
      ownedSpawn('barracks', 1, 3, 12, { vision: 10 }),
      ownedSpawn('blacksmith', 1, 9, 12, { vision: 10 }),
      ownedSpawn('house', 1, 15, 12, { vision: 8 }),
      ownedSpawn('mill', 1, 19, 12, { vision: 8 }),
      ownedSpawn('lumber-camp', 1, 23, 12, { vision: 8 }),
      ownedSpawn('monastery', 1, 27, 12, { vision: 8 }),
      // Row 3 — the 1x1 defensive + farm.
      ownedSpawn('watch-tower', 1, 3, 18, { vision: 8 }),
      ownedSpawn('stone-wall', 1, 6, 18, { vision: 6 }),
      ownedSpawn('farm', 1, 9, 18, { vision: 6 }),
    ],
  };
}
