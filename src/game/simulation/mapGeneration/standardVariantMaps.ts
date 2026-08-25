// The §5.4 map roster beyond the three originals: Coastal, Fortress, and
// Gold Rush — each the standard opening on a differently-shaped world, the
// way AoE2's scripts differ, plus Nomad (v0.3.94 — the AI opens
// lumber-camp-first and stands up its own Town Center). (Arabia is the
// standard map's own character and ships as an alias; Islands stays deferred
// — the AI cannot cross open water with an army, and a map the AI cannot
// play is a screenshot, not a map.)

import type { Position } from 'civ-engine';

import type { PrototypeScenario } from '../prototypeScenario';
import {
  applyForestPatch,
  applyResourcePatch,
  applyStandardPlayerOpening,
  createPlayerStarts,
} from './applyStandardPlayerOpening';
import {
  STARTING_BERRIES,
  FOREST_PATCHES,
  STARTING_BOARS,
  STARTING_GOLD,
  STARTING_STONE,
  STARTING_VILLAGERS,
} from './startingOffsets';
import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import { createSpawnList } from './spawnList';
import {
  createBaseTerrain,
  createTerrainCell,
  paintDisc,
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

/** Nomad: every player opens as three villagers on open ground — no Town
 *  Center, no scout — with their resource patches scattered around the start
 *  point exactly as the standard opening lays them (the TC-relative offsets
 *  become start-point-relative). The first Town Center may be built in ANY
 *  age (`nomadStart` — buildOptions + matchSettings), and the AI opens
 *  lumber-camp-first to bank the 275 wood. Sheep are deliberately absent:
 *  with no starting TC they would stand unclaimed on open ground. */
export function createNomadMap(seed: string): PrototypeScenario {
  const terrain = createBaseTerrain(seed, { width: MAP_WIDTH, height: MAP_HEIGHT });
  const starts = createPlayerStarts();
  const spawns = createSpawnList();
  for (const start of starts) {
    paintDisc(terrain, start.townCenter, 4, 'grass');
    applyResourcePatch(terrain, start.townCenter, STARTING_BOARS, 'boar', 340, start.owner, spawns);
    applyResourcePatch(terrain, start.townCenter, STARTING_BERRIES, 'berry-bush', 125, start.owner, spawns);
    applyResourcePatch(terrain, start.townCenter, STARTING_GOLD, 'gold-mine', 800, start.owner, spawns);
    applyResourcePatch(terrain, start.townCenter, STARTING_STONE, 'stone-mine', 350, start.owner, spawns);
    for (const patch of FOREST_PATCHES) {
      applyForestPatch(terrain, start.townCenter, patch, start.owner, spawns);
    }
    for (const offset of STARTING_VILLAGERS) {
      spawns.addUnitSpawn({
        kind: 'villager',
        x: start.townCenter.x + offset.x,
        y: start.townCenter.y + offset.y,
        owner: start.owner,
        baseOwner: start.owner,
        vision: { playerId: start.owner, radius: 4 },
        requiresSafeSpawn: true,
      });
    }
  }
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts,
    spawns: spawns.toArray(),
    nomadStart: true,
  };
}

/** Islands: two land masses split by open sea — the map the AI could not play
 *  until it learned to ferry (aiFerryPhase, v0.3.95). Each island carries the
 *  full standard opening plus its forest; shore fish line the channel so
 *  Docks are worth building early. */
export function createIslandsMap(seed: string): PrototypeScenario {
  const terrain: TerrainCellSpec[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'water')));
  const WEST = { minX: 2, maxX: 24 };
  const EAST = { minX: MAP_WIDTH - 25, maxX: MAP_WIDTH - 3 };
  for (let y = 2; y < MAP_HEIGHT - 2; y += 1) {
    for (let x = WEST.minX; x <= WEST.maxX; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'grass');
    }
    for (let x = EAST.minX; x <= EAST.maxX; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'grass');
    }
  }
  const starts = createPlayerStarts();
  const spawns = createSpawnList();
  // Pin the two standard starts onto their islands.
  if (starts[0]) starts[0].townCenter = { x: 12, y: Math.floor(MAP_HEIGHT / 2) };
  if (starts[1]) starts[1].townCenter = { x: MAP_WIDTH - 13, y: Math.floor(MAP_HEIGHT / 2) };
  applyStandardPlayerOpening(terrain, starts, spawns, seed);
  for (const start of starts) {
    for (const patch of FOREST_PATCHES) {
      applyForestPatch(terrain, start.townCenter, patch, start.owner, spawns);
    }
  }
  return { seed, width: MAP_WIDTH, height: MAP_HEIGHT, terrain, starts, spawns: spawns.toArray() };
}
