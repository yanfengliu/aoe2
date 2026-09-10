import type { Position } from 'civ-engine';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ScenarioSpawnSpec } from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';
import { setTerrainKind } from '../mapGeneration/sharedTerrainHelpers';

// Farms are walkable ground (2026-09-08). In Definitive Edition every land
// unit of every player walks across a farm; only the Mill or Town Centre
// beside it blocks. Here a farm's footprint was an engine occupancy claim like
// any building's, so the AI's farms — up to eight 1x1 per base — were the most
// numerous wall segment on a map that seals itself (register, 2026-09-06).
//
// A forest cross cuts the map into four quadrants. Two gaps in the vertical
// wall are each closed by structures, so a unit ordered across has no way
// round: the north gap by three farms OWNED BY THE ENEMY (a militia must enter
// a farm cell to arrive — positive evidence of the crossing, not inference from
// arrival), the south gap by two houses (the control: the same order must never
// enter a house cell and must not arrive, which is what stops a fix that makes
// every building walkable). The horizontal wall keeps the two apart, so the
// control cannot arrive by walking round through the farm gap.
//
// The player-1 Town Centre is ringed by twenty farms on its whole perimeter:
// the villager it trains has nowhere to appear but a farm cell. That is the
// case a passability-predicate-only fix fails — the engine refuses the unit a
// slot on an engine-claimed cell and the spawn falls to null.
export const WALL_X = 28;
export const WALL_Y = 18;
export const FARM_GAP_ROWS = [8, 9, 10] as const;
export const FARM_GAP_CELLS: readonly Position[] = FARM_GAP_ROWS.map((y) => ({ x: WALL_X, y }));
export const HOUSE_ANCHORS: readonly Position[] = [{ x: WALL_X, y: 26 }, { x: WALL_X, y: 28 }];
/** Every cell the two 2x2 houses cover; the gap they close is x = WALL_X, y 26..29. */
export const HOUSE_CELLS: readonly Position[] = HOUSE_ANCHORS.flatMap(({ x, y }) => [
  { x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 },
]);
export const FARM_MILITIA_START: Position = { x: 24, y: 9 };
export const FARM_MILITIA_GOAL: Position = { x: 33, y: 9 };
export const HOUSE_MILITIA_START: Position = { x: 24, y: 27 };
export const HOUSE_MILITIA_GOAL: Position = { x: 33, y: 27 };
export const TOWN_CENTER: Position = { x: 6, y: 4 };
export const ENEMY_TOWN_CENTER: Position = { x: 44, y: 26 };
/** The builder for the placement case, on open grass well inside the north-west quadrant. */
export const BUILDER_VILLAGER: Position = { x: 14, y: 12 };
/** The showcase farmer stands ON this ring farm, in front of the Town Centre. */
export const SHOWCASE_FARM_CELL: Position = { x: 8, y: 8 };

function ringAround(anchor: Position, width: number, height: number): Position[] {
  const cells: Position[] = [];
  for (let y = anchor.y - 1; y <= anchor.y + height; y += 1) {
    for (let x = anchor.x - 1; x <= anchor.x + width; x += 1) {
      const inside = x >= anchor.x && x < anchor.x + width
        && y >= anchor.y && y < anchor.y + height;
      if (!inside) cells.push({ x, y });
    }
  }
  return cells;
}

/** The 4x4 Town Centre's twenty perimeter cells, every one a farm. */
export const TOWN_CENTER_RING: readonly Position[] = ringAround(TOWN_CENTER, 4, 4);

function quadrantTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = 0; y < MAP_HEIGHT; y += 1) setTerrainKind(terrain, WALL_X, y, 'forest');
  for (let x = 0; x < MAP_WIDTH; x += 1) setTerrainKind(terrain, x, WALL_Y, 'forest');
  for (const cell of FARM_GAP_CELLS) setTerrainKind(terrain, cell.x, cell.y, 'grass');
  for (let y = 26; y <= 29; y += 1) setTerrainKind(terrain, WALL_X, y, 'grass');
  return terrain;
}

function baseSpawns(): ScenarioSpawnSpec[] {
  return [
    ownedSpawn('town-center', 1, TOWN_CENTER.x, TOWN_CENTER.y, { vision: 7 }),
    ...TOWN_CENTER_RING.map((cell) => ownedSpawn('farm', 1, cell.x, cell.y, { vision: 2 })),
    ownedSpawn('town-center', 2, ENEMY_TOWN_CENTER.x, ENEMY_TOWN_CENTER.y, { vision: 7 }),
    // The enemy's farms close the north gap; the enemy's houses close the south one.
    ...FARM_GAP_CELLS.map((cell) => ownedSpawn('farm', 2, cell.x, cell.y, { vision: 2 })),
    ...HOUSE_ANCHORS.map((cell) => ownedSpawn('house', 2, cell.x, cell.y, { vision: 2 })),
    ownedSpawn('militia', 1, FARM_MILITIA_START.x, FARM_MILITIA_START.y, { vision: 5 }),
    ownedSpawn('militia', 1, HOUSE_MILITIA_START.x, HOUSE_MILITIA_START.y, { vision: 5 }),
    ownedSpawn('villager', 1, BUILDER_VILLAGER.x, BUILDER_VILLAGER.y, { vision: 4 }),
  ];
}

function scenario(seed: string, spawns: ScenarioSpawnSpec[]): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: quadrantTerrain(),
    starts: [
      { owner: 1, townCenter: { ...TOWN_CENTER }, disableAi: true },
      { owner: 2, townCenter: { ...ENEMY_TOWN_CENTER }, disableAi: true },
    ],
    spawns,
  };
}

export function createFarmsAreWalkableFixture(seed: string): PrototypeScenario {
  return scenario(seed, baseSpawns());
}

// The visual variant: the same map with one villager standing ON a ring farm in
// front of the Town Centre. `allowOverlappingSpawn` lets the fixture boot on a
// build where farms are still walls, so a before/after capture pair exists;
// on such a build the villager lands in overflow (no slot), on this one it
// holds a real slot on the field.
export function createFarmerOnFarmShowcaseFixture(seed: string): PrototypeScenario {
  return scenario(seed, [
    ...baseSpawns(),
    ownedSpawn('villager', 1, SHOWCASE_FARM_CELL.x, SHOWCASE_FARM_CELL.y, {
      vision: 4,
      allowOverlappingSpawn: true,
    }),
  ]);
}
