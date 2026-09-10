// A Town Center whose only way out is one corridor through a wall of forest,
// and an AI that has the wood for exactly the building that would fill it.
//
// Built for the map-connectivity gate (2026-09-08). Found by the standing
// loop, playing: a 93-minute Black Forest match in which the whole army was
// ordered across the map and nothing happened, then an independent flood over
// terrain plus building footprints showed the map had sealed itself — enemy
// units reachable from the human's ground 4/4 at tick 0, 0/26 by tick 20,000.
// The owner reported none of it. The AI's site search had a seal guard, and
// then a second pass that ran without it whenever nothing else fit, so "the
// only site is the corridor" always ended with the corridor filled.
//
// Three seeds, one factory:
//
//   corridor-seal-far-open-fixture   a 3-lane corridor north of the Town
//                                    Center (rows 4..15) opening onto open
//                                    ground at rows 0..3 — Chebyshev 13..16
//                                    from the anchor, past the ordinary
//                                    radius-12 search. Every 3x3 in the
//                                    corridor seals it; the open ground
//                                    does not.
//   corridor-seal-no-open-fixture    the same 3-lane corridor running to the
//                                    map edge, and nothing else: no 3x3
//                                    anywhere that does not seal.
//   corridor-seal-same-decision-fixture
//                                    a 4-lane corridor (rows 13..15) that
//                                    narrows to ONE cell at row 12, then
//                                    widens again above. An owner-1 scout at
//                                    (36,11) is a fresh enemy sighting, and
//                                    the AI has wood for a barracks and stone
//                                    for a watch tower, so ONE decision pushes
//                                    both. The tower's ring lands it at
//                                    (37,14) — lane 3; the barracks' first fit
//                                    is (34,13), lanes 0..2 of the same rows.
//                                    Neither seals alone; together they do,
//                                    which the barracks' guard can only see if
//                                    the tower's intention counts as ground.
//
// The wall is FOREST TERRAIN — impassable, unbuildable, and what Black
// Forest's own wall is made of — rather than tree entities, so nothing can be
// chopped through inside a test's window and the world holds no entity per
// wall cell. Owner 2's villagers stand in a bay east of the corridor mouth,
// off every site the AI would pick, because a unit standing on a cell blocks
// an anchor there. Owner 1 has a scout and no buildings: a player with a unit
// is not eliminated, and a Town Center on the far side would shoot the AI's
// builder.

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../prototypeScenario';
import { createTerrainCell, type TerrainCellSpec } from '../mapGeneration/sharedTerrainHelpers';
import { ownedSpawn } from './common';

/** Owner 2's Town Center anchor (4x4, so the footprint is 34..37 x 16..19). */
export const CORRIDOR_SEAL_TOWN_CENTER = { x: 34, y: 16 };
/** Where owner 1's scout starts in each variant — on the far side. */
export const CORRIDOR_SEAL_FAR_UNIT = {
  'far-open': { x: 45, y: 2 },
  'no-open': { x: 35, y: 1 },
  'same-decision': { x: 36, y: 11 },
} as const;
export type CorridorSealVariant = keyof typeof CORRIDOR_SEAL_FAR_UNIT;

export const CORRIDOR_SEAL_SEEDS: Record<CorridorSealVariant, string> = {
  'far-open': 'corridor-seal-far-open-fixture',
  'no-open': 'corridor-seal-no-open-fixture',
  'same-decision': 'corridor-seal-same-decision-fixture',
};

function variantOf(seed: string): CorridorSealVariant {
  for (const [variant, name] of Object.entries(CORRIDOR_SEAL_SEEDS)) {
    if (name === seed) return variant as CorridorSealVariant;
  }
  return 'far-open';
}

/** A cell rectangle, inclusive on every side. */
type Rect = { minX: number; minY: number; maxX: number; maxY: number };

/** A sealed chamber east of the bay holding the buildings the same-decision
 *  variant needs STANDING: a Watch Tower is offered only to a Feudal owner
 *  with a completed barracks (buildOptions.ts), and with a mill and two farms
 *  already up the Feudal build order's next affordable entry is the 3x3
 *  blacksmith rather than a 2x2 mill or a 1x1 farm. Nothing can walk in or
 *  out of it, and nothing needs to. */
const SAME_DECISION_CHAMBER: Rect = { minX: 42, minY: 14, maxX: 50, maxY: 22 };

function openCells(variant: CorridorSealVariant): Rect[] {
  const tc = CORRIDOR_SEAL_TOWN_CENTER;
  const footprint = { minX: tc.x, minY: tc.y, maxX: tc.x + 3, maxY: tc.y + 3 };
  switch (variant) {
    case 'far-open':
      return [
        footprint,
        { minX: 34, minY: 4, maxX: 36, maxY: 15 }, // three lanes, rows 4..15
        { minX: 37, minY: 15, maxX: 38, maxY: 15 }, // the villagers' bay
        { minX: 20, minY: 0, maxX: 50, maxY: 3 }, // open ground past radius 12
      ];
    case 'no-open':
      return [
        footprint,
        { minX: 34, minY: 0, maxX: 36, maxY: 15 }, // three lanes to the edge
        { minX: 37, minY: 15, maxX: 38, maxY: 15 },
      ];
    case 'same-decision':
      return [
        footprint,
        { minX: 34, minY: 13, maxX: 37, maxY: 15 }, // four lanes beside the TC
        { minX: 37, minY: 12, maxX: 37, maxY: 12 }, // the one-cell choke
        { minX: 34, minY: 0, maxX: 37, maxY: 11 }, // four lanes again above it
        { minX: 38, minY: 15, maxX: 40, maxY: 15 }, // three villagers' bay
        SAME_DECISION_CHAMBER,
      ];
  }
}

function terrainFor(variant: CorridorSealVariant): TerrainCellSpec[][] {
  const terrain = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'forest')),
  );
  for (const rect of openCells(variant)) {
    for (let y = rect.minY; y <= rect.maxY; y += 1) {
      for (let x = rect.minX; x <= rect.maxX; x += 1) {
        terrain[y]![x] = createTerrainCell(x, y, 'grass');
      }
    }
  }
  return terrain;
}

function spawnsFor(variant: CorridorSealVariant): ScenarioSpawnSpec[] {
  const tc = CORRIDOR_SEAL_TOWN_CENTER;
  const scout = CORRIDOR_SEAL_FAR_UNIT[variant];
  const villagers = variant === 'same-decision'
    ? [{ x: 38, y: 15 }, { x: 39, y: 15 }, { x: 40, y: 15 }]
    : [{ x: 37, y: 15 }, { x: 38, y: 15 }];
  const standing = variant === 'same-decision'
    ? [
        ownedSpawn('barracks', 2, 42, 14),
        ownedSpawn('mill', 2, 46, 14),
        ownedSpawn('farm', 2, 42, 18),
        ownedSpawn('farm', 2, 44, 18),
      ]
    : [];
  return [
    ownedSpawn('town-center', 2, tc.x, tc.y, { vision: 7 }),
    ...standing,
    ...villagers.map((cell) => ownedSpawn('villager', 2, cell.x, cell.y, { vision: 4 })),
    ownedSpawn('scout', 1, scout.x, scout.y, { vision: 6 }),
  ];
}

export function createCorridorSealFixture(seed: string): PrototypeScenario {
  const variant = variantOf(seed);
  const scout = CORRIDOR_SEAL_FAR_UNIT[variant];
  // Exactly one barracks' worth of wood (175); in the same-decision variant
  // a watch tower (25 wood, 125 stone) plus a blacksmith (150 wood). No food
  // and no gold, so nothing is trained or researched and the build order is
  // the only thing the AI can spend on.
  const startingResources = variant === 'same-decision'
    ? { food: 0, wood: 175, gold: 0, stone: 125 }
    : { food: 0, wood: 175, gold: 0, stone: 0 };
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: terrainFor(variant),
    starts: [
      { owner: 1, townCenter: { x: scout.x, y: scout.y } },
      {
        owner: 2,
        townCenter: { ...CORRIDOR_SEAL_TOWN_CENTER },
        startingResources,
        difficulty: 'standard',
        // A Watch Tower is a Feudal-Age building; the other two variants stay
        // in the Dark Age, where the barracks is the only thing 175 wood buys.
        ...(variant === 'same-decision' ? { startingAge: 'feudal-age' as const } : {}),
      },
    ],
    spawns: spawnsFor(variant),
  };
}
