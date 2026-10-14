import type { Position } from 'civ-engine';

// Values from the map constants, types only from the scenario module: a test
// that imports this file first must not load the scenario registry, which
// imports this file back.
import { MAP_HEIGHT, MAP_WIDTH } from '../mapGeneration/constants';
import type { PrototypeScenario, ScenarioSpawnSpec } from '../prototypeScenario';
import { setTerrainKind } from '../mapGeneration/sharedTerrainHelpers';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

// Work 122 (defect register 2026-09-23; spec §12.1): what lies under
// unexplored ground must not decide where the player may put a building.
//
// One map in two variants. The human's only sight near the middle of the map
// is one villager, so the ground it has explored at boot is the disc of radius
// VILLAGER_VISION around it, and everything in the ring just outside that disc
// is unexplored. In 'unexplored-placement-open-fixture' that ring is open grass.
// In 'unexplored-placement-hidden-fixture' the same ring holds every kind of
// obstacle: water, forest, gold, an enemy house and an enemy militia, packed
// against the edge of what the villager can see. Nothing the human has explored
// differs between the two, and neither does any vision source the human has,
// so a placement verdict that differs between them read the fog.
//
// A third variant, 'unexplored-placement-lookout-fixture', is the hidden one
// with the villager starting at LOOKOUT_CELL, where it sees one cell of the
// enemy house. At boot the frame draws that house whole while fog memory has
// not yet recorded it (the memory pass first runs in the first step), so only
// the frame's live rule can tell the placement it is there (review round 1).
//
// The named footprints below put exactly one hidden obstacle under a house the
// player is allowed to place, so the start check (update 46295) has one thing
// to find in each.
export const UNEXPLORED_PLACEMENT_OPEN_SEED = 'unexplored-placement-open-fixture';
export const UNEXPLORED_PLACEMENT_HIDDEN_SEED = 'unexplored-placement-hidden-fixture';
export const UNEXPLORED_PLACEMENT_LOOKOUT_SEED = 'unexplored-placement-lookout-fixture';

export const VILLAGER_CELL: Position = { x: 20, y: 14 };
/** Where the lookout variant's villager starts: it sees (24,17) of the enemy
 *  house, and not (24,18), (25,17) or (25,18). */
export const LOOKOUT_CELL: Position = { x: 21, y: 15 };
export const VILLAGER_VISION = 4;
/** The ring the hidden variant fills: farther than VILLAGER_VISION, within this. */
export const HIDDEN_RING_OUTER = 7;

/** A house here covers three explored cells and hides water at (24,13). */
export const HOUSE_OVER_HIDDEN_WATER: Position = { x: 23, y: 13 };
export const HIDDEN_WATER_CELL: Position = { x: 24, y: 13 };
/** A house here covers three explored cells and hides forest at (16,13). */
export const HOUSE_OVER_HIDDEN_FOREST: Position = { x: 16, y: 13 };
export const HIDDEN_TREE_CELL: Position = { x: 16, y: 13 };
/** The enemy house stands wholly under the fog; a house at HOUSE_OVER_HIDDEN_HOUSE overlaps its corner. */
export const ENEMY_HOUSE: Position = { x: 24, y: 17 };
export const HOUSE_OVER_HIDDEN_HOUSE: Position = { x: 23, y: 16 };
/** The enemy militia stands under the fog; a house at HOUSE_OVER_HIDDEN_UNIT covers it. */
export const ENEMY_MILITIA_CELL: Position = { x: 20, y: 9 };
export const HOUSE_OVER_HIDDEN_UNIT: Position = { x: 20, y: 9 };
/** Wholly unexplored, and open grass in both variants. */
export const HOUSE_ON_UNEXPLORED_GRASS: Position = { x: 34, y: 14 };
/** An explored stone mine, in both variants; a house at HOUSE_OVER_KNOWN_STONE also covers three unexplored cells. */
export const KNOWN_STONE_CELL: Position = { x: 17, y: 16 };
export const HOUSE_OVER_KNOWN_STONE: Position = { x: 16, y: 16 };

const ENEMY_HOUSE_CELLS: readonly Position[] = [
  { x: 24, y: 17 }, { x: 25, y: 17 }, { x: 24, y: 18 }, { x: 25, y: 18 },
];
/** Unexplored cells of the named footprints that stay grass, so each footprint hides one thing. */
const KEPT_OPEN: readonly Position[] = [
  { x: 24, y: 16 }, { x: 23, y: 17 }, { x: 21, y: 9 }, { x: 21, y: 10 },
];

const distanceSquared = (x: number, y: number): number =>
  (x - VILLAGER_CELL.x) ** 2 + (y - VILLAGER_CELL.y) ** 2;

/** Whether the villager's sight covers this cell at boot (the engine's own rule: dx² + dy² ≤ r²). */
export function villagerSeesAtBoot(x: number, y: number): boolean {
  return distanceSquared(x, y) <= VILLAGER_VISION ** 2;
}

type HiddenKind = 'water' | 'forest' | 'gold' | 'enemy-house' | 'enemy-unit';

/** Every cell the hidden variant fills, and with what. */
export function hiddenObstacleCells(): Array<Position & { kind: HiddenKind }> {
  const cells: Array<Position & { kind: HiddenKind }> = [];
  const same = (a: Position, x: number, y: number): boolean => a.x === x && a.y === y;
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const d2 = distanceSquared(x, y);
      if (d2 <= VILLAGER_VISION ** 2 || d2 > HIDDEN_RING_OUTER ** 2) continue;
      if (KEPT_OPEN.some((cell) => same(cell, x, y))) continue;
      if (ENEMY_HOUSE_CELLS.some((cell) => same(cell, x, y))) {
        cells.push({ x, y, kind: 'enemy-house' });
      } else if (same(ENEMY_MILITIA_CELL, x, y)) {
        cells.push({ x, y, kind: 'enemy-unit' });
      } else if (same(HIDDEN_WATER_CELL, x, y)) {
        cells.push({ x, y, kind: 'water' });
      } else if (same(HIDDEN_TREE_CELL, x, y)) {
        cells.push({ x, y, kind: 'forest' });
      } else {
        // Every fourth cell stays open, so most footprints straddle a mix.
        const pattern = (x + 2 * y) % 4;
        if (pattern === 0) cells.push({ x, y, kind: 'water' });
        else if (pattern === 1) cells.push({ x, y, kind: 'forest' });
        else if (pattern === 2) cells.push({ x, y, kind: 'gold' });
      }
    }
  }
  return cells;
}

export function createUnexploredPlacementFixture(seed: string): PrototypeScenario {
  const hidden = seed === UNEXPLORED_PLACEMENT_HIDDEN_SEED || seed === UNEXPLORED_PLACEMENT_LOOKOUT_SEED;
  const villagerCell = seed === UNEXPLORED_PLACEMENT_LOOKOUT_SEED ? LOOKOUT_CELL : VILLAGER_CELL;
  const terrain = createGrassFixtureTerrain();
  const spawns: ScenarioSpawnSpec[] = [
    // Both Town Centres sit in far corners with short sight, so neither
    // reaches the villager's ground.
    ownedSpawn('town-center', 1, 1, 1, { vision: 3 }),
    ownedSpawn('town-center', 2, 54, 30, { vision: 3 }),
    ownedSpawn('villager', 1, villagerCell.x, villagerCell.y, { vision: VILLAGER_VISION }),
    gaiaSpawn('stone-mine', KNOWN_STONE_CELL.x, KNOWN_STONE_CELL.y, { amount: 350 }),
  ];
  if (hidden) {
    for (const cell of hiddenObstacleCells()) {
      if (cell.kind === 'water') setTerrainKind(terrain, cell.x, cell.y, 'water');
      if (cell.kind === 'forest') {
        setTerrainKind(terrain, cell.x, cell.y, 'forest');
        spawns.push(gaiaSpawn('tree', cell.x, cell.y, { amount: 100 }));
      }
      if (cell.kind === 'gold') spawns.push(gaiaSpawn('gold-mine', cell.x, cell.y, { amount: 800 }));
    }
    spawns.push(ownedSpawn('house', 2, ENEMY_HOUSE.x, ENEMY_HOUSE.y));
    spawns.push(ownedSpawn('militia', 2, ENEMY_MILITIA_CELL.x, ENEMY_MILITIA_CELL.y));
  }
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      // The human seat: no AI unless a test forces one onto it to show that an
      // AI seat still places by the true map.
      {
        owner: 1,
        townCenter: { x: 1, y: 1 },
        startingResources: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
      },
      { owner: 2, townCenter: { x: 54, y: 30 }, disableAi: true },
    ],
    spawns,
  };
}
