// The §5.4 map roster beyond the three originals: Coastal, Fortress, and
// Gold Rush — each the standard opening on a differently-shaped world, the
// way AoE2's scripts differ. (Arabia is the standard map's own character and
// ships as an alias; Islands and Nomad stay deferred — the AI can neither
// cross open water with an army nor open without a Town Center yet, and a
// map the AI cannot play is a screenshot, not a map.)

import type { Position } from 'civ-engine';

import type { PrototypeScenario } from '../prototypeScenario';
import {
  applyStandardPlayerOpening,
  createPlayerStarts,
} from './applyStandardPlayerOpening';
import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import { createSpawnList } from './spawnList';
import {
  createBaseTerrain,
  createTerrainCell,
  type TerrainCellSpec,
} from './sharedTerrainHelpers';

function grassWorld(): TerrainCellSpec[][] {
  return Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'grass')));
}

/** Coastal: the standard interior with a SEA along the whole southern edge —
 *  shore fish to work, Docks worth building, and a land route between every
 *  start, so the AI plays it exactly like the open map. */
export function createCoastalMap(seed: string): PrototypeScenario {
  const terrain = createBaseTerrain(seed, { width: MAP_WIDTH, height: MAP_HEIGHT });
  const SEA_FROM_Y = MAP_HEIGHT - 6;
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (y >= SEA_FROM_Y) {
        terrain[y]![x] = createTerrainCell(x, y, 'water');
      } else if (terrain[y]![x]!.kind === 'water') {
        // The interior stays dry: one coast, not lakes — that is the script's
        // whole identity.
        terrain[y]![x] = createTerrainCell(x, y, 'grass');
      }
    }
  }
  const starts = createPlayerStarts();
  const spawns = createSpawnList();
  applyStandardPlayerOpening(terrain, starts, spawns, seed);
  return { seed, width: MAP_WIDTH, height: MAP_HEIGHT, terrain, starts, spawns: spawns.toArray() };
}

/** Fortress: every player opens behind their own stone walls with a Castle
 *  already standing — AoE2's script starts the siege phase early. The wall
 *  square sits at 11 cells, outside every mine and berry patch; a TREE on the
 *  wall line is felled (walls win over decoration), while any rarer collision
 *  leaves that one cell open rather than eating a resource. */
export function createFortressMap(seed: string): PrototypeScenario {
  const terrain = grassWorld();
  const starts = createPlayerStarts();
  const spawns = createSpawnList();
  applyStandardPlayerOpening(terrain, starts, spawns, seed);

  const HALF = 11;
  for (const start of starts) {
    const { townCenter } = start;
    const towardCenterX = townCenter.x < MAP_WIDTH / 2 ? 1 : -1;
    const wallCells: Position[] = [];
    for (let dx = -HALF; dx <= HALF; dx += 1) {
      for (const dy of [-HALF, HALF]) wallCells.push({ x: dx, y: dy });
    }
    for (let dy = -HALF + 1; dy <= HALF - 1; dy += 1) {
      for (const dx of [-HALF, HALF]) wallCells.push({ x: dx, y: dy });
    }
    for (const cell of wallCells) {
      const x = townCenter.x + cell.x;
      const y = townCenter.y + cell.y;
      if (x < 1 || y < 1 || x >= MAP_WIDTH - 1 || y >= MAP_HEIGHT - 1) continue;
      // The gate: three cells centred on the face toward the map's middle.
      if (cell.x === towardCenterX * HALF && Math.abs(cell.y) <= 1) continue;
      const standing = spawns.toArray().find((spawn) => spawn.x === x && spawn.y === y);
      if (standing && standing.kind === 'tree') {
        spawns.removeSpawnAt(x, y);
      } else if (standing) {
        continue;
      }
      terrain[y]![x] = createTerrainCell(x, y, 'grass');
      spawns.addBuildingSpawn({ kind: 'stone-wall', x, y, owner: start.owner, baseOwner: start.owner });
    }
    // The Castle: the first candidate whose 4x4 footprint touches nothing.
    const candidates: Position[] = [
      { x: towardCenterX * 4, y: -7 }, { x: towardCenterX * 5, y: 5 },
      { x: -towardCenterX * 7, y: -3 }, { x: towardCenterX * 2, y: 6 },
    ];
    const taken = new Set(spawns.toArray().map((spawn) => `${spawn.x},${spawn.y}`));
    for (const offset of candidates) {
      const anchor = { x: townCenter.x + offset.x, y: townCenter.y + offset.y };
      let free = true;
      for (let dy = 0; dy < 4 && free; dy += 1) {
        for (let dx = 0; dx < 4 && free; dx += 1) {
          if (taken.has(`${anchor.x + dx},${anchor.y + dy}`)) free = false;
        }
      }
      if (!free) continue;
      spawns.addBuildingSpawn({
        kind: 'castle', x: anchor.x, y: anchor.y, owner: start.owner, baseOwner: start.owner,
        vision: { playerId: start.owner, radius: 9 },
      });
      break;
    }
  }
  return { seed, width: MAP_WIDTH, height: MAP_HEIGHT, terrain, starts, spawns: spawns.toArray() };
}

/** Gold Rush: a rich shared goldfield in the middle of an open plain — the
 *  map IS the fight over it. Each start still has its own small patch. */
export function createGoldRushMap(seed: string): PrototypeScenario {
  const terrain = grassWorld();
  const starts = createPlayerStarts();
  const spawns = createSpawnList();
  applyStandardPlayerOpening(terrain, starts, spawns, seed);

  const centre = { x: Math.floor(MAP_WIDTH / 2), y: Math.floor(MAP_HEIGHT / 2) };
  const OFFSETS: ReadonlyArray<[number, number]> = [
    [0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, -1], [2, 1], [1, 2],
  ];
  for (const [dx, dy] of OFFSETS) {
    spawns.addResourceSpawn({
      kind: 'gold-mine',
      x: centre.x + dx,
      y: centre.y + dy,
      owner: null,
      baseOwner: null,
      // Twice a home patch node: the centre is worth marching for.
      amount: 1600,
    });
  }
  return { seed, width: MAP_WIDTH, height: MAP_HEIGHT, terrain, starts, spawns: spawns.toArray() };
}
