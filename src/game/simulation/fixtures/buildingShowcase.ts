import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain } from './common';

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
      {
        kind: 'town-center',
        x: 3,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 16 },
      },
      { kind: 'castle', x: 10, y: 4, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 16 } },
      { kind: 'wonder', x: 17, y: 4, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 16 } },
      { kind: 'market', x: 24, y: 4, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 16 } },
      // Row 2 — 3x3 halls + 2x2 economy.
      { kind: 'barracks', x: 3, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 10 } },
      { kind: 'blacksmith', x: 9, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 10 } },
      { kind: 'house', x: 15, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 8 } },
      { kind: 'mill', x: 19, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 8 } },
      { kind: 'lumber-camp', x: 23, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 8 } },
      { kind: 'monastery', x: 27, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 8 } },
      // Row 3 — the 1x1 defensive + farm.
      { kind: 'watch-tower', x: 3, y: 18, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 8 } },
      { kind: 'stone-wall', x: 6, y: 18, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 6 } },
      { kind: 'farm', x: 9, y: 18, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 6 } },
    ],
  };
}
