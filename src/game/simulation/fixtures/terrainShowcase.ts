import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';
import { setTerrainKind } from '../mapGeneration/sharedTerrainHelpers';
import type { TerrainKind } from '../types';

// Visual-only showcase scenario (M7 terrain-blending slice, v0.1.43). Paints a
// patchwork of ADJACENT terrain KINDS — grass / forest / water / hill — across
// the top-left (the default camera view) so every kind-to-kind boundary
// (grass↔forest, grass↔water, grass↔hill, forest↔water, …) is on-screen and the
// before/after capture exercises the blended-transition renderer. Not referenced
// by gameplay tests; purely a capture target (lives in the fixtures tree, the
// sanctioned home for scenario data). Imperial age + a single P1 Town Center far
// to the right so the terrain patchwork is unobstructed; AI disabled so nothing
// moves and the frame is static.
//
// Layout (cell coords; the default 800x600 / zoom-1.4 view shows roughly the
// top-left 24x18 cells): four horizontal bands of alternating kinds plus a few
// inset blocks, so each kind borders several others.
export function createTerrainShowcaseFixture(seed: string): PrototypeScenario {
  const terrain = createGrassFixtureTerrain();

  // Helper to paint a solid rectangular block of one kind.
  const block = (x0: number, y0: number, x1: number, y1: number, kind: TerrainKind): void => {
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        setTerrainKind(terrain, x, y, kind);
      }
    }
  };

  // Top band: a forest patch beside grass beside water — the three most common
  // boundaries. Left column forest, middle grass (left as-is), right water.
  block(2, 2, 8, 9, 'forest');
  block(15, 2, 22, 9, 'water');
  // A hill block sitting between grass and water so grass↔hill and hill↔water
  // boundaries appear.
  block(9, 11, 14, 17, 'hill');
  // A water inlet biting into the forest (forest↔water boundary) and a forest
  // finger into the grass below (forest↔grass on a second edge).
  block(5, 11, 8, 14, 'water');
  block(18, 11, 22, 16, 'forest');
  // A small grass island fully inside the top water block so a cell is bordered
  // by a different kind on all four edges (the maximal-transition case).
  block(18, 5, 19, 6, 'grass');

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      {
        owner: 1,
        // Park the player's Town Center on grass far to the right, out of the
        // captured patchwork, so the terrain transitions are unobstructed.
        townCenter: { x: 50, y: 30 },
        startingAge: 'imperial-age',
        startingResources: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
        disableAi: true,
      },
    ],
    spawns: [
      // Generous vision so the whole patchwork is fog-visible to player 1 at
      // boot (terrain is not fog-filtered, but a wide reveal keeps the frame
      // bright and matches the other showcase fixtures).
      ownedSpawn('town-center', 1, 50, 30, { vision: 60 }),
    ],
  };
}

/** Two inert opponents keep displayed simulation time available for wave-motion proof. */
export function createTerrainWaterMotionFixture(seed: string): PrototypeScenario {
  const showcase = createTerrainShowcaseFixture(seed);
  return {
    ...showcase,
    starts: [
      ...showcase.starts,
      {
        owner: 2,
        townCenter: { x: 2, y: 30 },
        startingAge: 'imperial-age',
        startingResources: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
        disableAi: true,
      },
    ],
    spawns: [
      ...showcase.spawns,
      ownedSpawn('town-center', 2, 2, 30, { vision: 1 }),
    ],
  };
}
