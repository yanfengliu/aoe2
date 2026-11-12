// A world of Definitive Edition's smallest two-player size, for the gates that COUNT what a frame or a tick does
// (work 150 M2b). No seed reaches a 120x120 map until the lobby's maps grow (plan 150, step 2), and the saved late
// matches the costs were measured on are megabytes each, so the gates build one here: 14,400 cells, two starts on
// Arabia's ring for Tiny (about 79 cells apart), each with its Town Center, three villagers, a scout, sheep,
// berries, gold, stone, boar and two woodlines, and about 1,600 trees in all. It is DE Tiny's SCALE, laid out on a
// grid with no random draw; it is not DE's map, and nothing here is map generation the game ships.
//
// It is handed to `createWorld` as a scenario and loaded through `savedGame`, the way work 150's measuring driver
// booted its scratch maps, because the bridge takes a scenario only from its registry or from a save. The computer
// plays both seats, so units move, buildings rise and the fog remembers things without a script.
//
// A gate that stands on this world counts; it never times. What building the world costs a test is the boot (one
// world made, saved and loaded) and the ticks the test steps.
import { createSimulationBridge, type SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createWorld } from '../../src/game/simulation/bridge/createWorld';
import { LayeredVisibilityMap } from '../../src/game/simulation/bridge/layeredVisibilityMap';
import { seedForestTrees } from '../../src/game/simulation/mapGeneration/seedForestTrees';
import { createTerrainCell, type TerrainCellSpec } from '../../src/game/simulation/mapGeneration/sharedTerrainHelpers';
import { createSpawnList } from '../../src/game/simulation/mapGeneration/spawnList';
import { scoutWanderBoundsAround } from '../../src/game/simulation/mapGeneration/startingOffsets';
import { HUMAN_PLAYER_ID, type PlayerStartSpec, type PrototypeScenario } from '../../src/game/simulation/prototypeScenario';
import type { ResourceKind } from '../../src/game/simulation/types';

export const DE_TINY_SIDE = 120;

/** The Town Centers' centres: opposite each other, 39.7 cells from the map's centre (Arabia's 33% ring on Tiny). */
const CENTRES = [{ x: 27, y: 38 }, { x: 93, y: 82 }] as const;
const CIVILIZATIONS = ['Britons', 'Franks'] as const;

/** A 120x120 scenario of DE Tiny's scale; every call returns an equal one. */
export function createDeTinySizedScenario(seed = 'de-tiny-sized'): PrototypeScenario {
  const side = DE_TINY_SIDE;
  const size = { width: side, height: side };
  const terrain: TerrainCellSpec[][] = Array.from({ length: side }, (_, y) => (
    Array.from({ length: side }, (__, x) => createTerrainCell(x, y, 'grass'))
  ));
  const spawns = createSpawnList();
  const forest = (x0: number, y0: number, width: number, height: number): void => {
    for (let y = y0; y < y0 + height; y += 1) {
      for (let x = x0; x < x0 + width; x += 1) terrain[y]![x] = createTerrainCell(x, y, 'forest');
    }
  };
  const resource = (kind: ResourceKind, owner: number, amount: number, cells: ReadonlyArray<readonly [number, number]>): void => {
    for (const [x, y] of cells) spawns.addResourceSpawn({ kind, x, y, owner: null, baseOwner: owner, amount });
  };

  const starts: PlayerStartSpec[] = CENTRES.map((centre, index) => ({
    owner: index + 1,
    townCenter: { x: centre.x - 2, y: centre.y - 2 },
    civilization: CIVILIZATIONS[index],
  }));
  for (const start of starts) {
    const owner = start.owner;
    const c = CENTRES[owner - 1]!;
    spawns.addBuildingSpawn({ kind: 'town-center', x: start.townCenter.x, y: start.townCenter.y, owner, baseOwner: owner });
    for (const dy of [-1, 0, 1]) {
      spawns.addUnitSpawn({ kind: 'villager', x: c.x - 5, y: c.y + dy, owner, baseOwner: owner, vision: { playerId: owner, radius: 4 }, requiresSafeSpawn: true });
    }
    spawns.addUnitSpawn({
      kind: 'scout', x: c.x + 4, y: c.y - 5, owner, baseOwner: owner,
      velocity: { dx: c.x < side / 2 ? 1 : -1, dy: c.y < side / 2 ? 1 : -1 },
      wanderBounds: scoutWanderBoundsAround(start.townCenter, size), vision: { playerId: owner, radius: 6 }, requiresSafeSpawn: true,
    });
    resource('sheep', owner, 100, [[c.x + 5, c.y + 5], [c.x + 6, c.y + 5], [c.x + 5, c.y + 6], [c.x + 6, c.y + 6]]);
    resource('berry-bush', owner, 125, [[c.x - 9, c.y + 7], [c.x - 8, c.y + 7], [c.x - 7, c.y + 7], [c.x - 9, c.y + 8], [c.x - 8, c.y + 8], [c.x - 7, c.y + 8]]);
    resource('gold-mine', owner, 800, [[c.x + 9, c.y - 8], [c.x + 10, c.y - 8], [c.x + 11, c.y - 8], [c.x + 9, c.y - 7], [c.x + 10, c.y - 7], [c.x + 11, c.y - 7], [c.x + 10, c.y - 6]]);
    resource('stone-mine', owner, 350, [[c.x - 12, c.y - 10], [c.x - 11, c.y - 10], [c.x - 10, c.y - 10], [c.x - 12, c.y - 9], [c.x - 11, c.y - 9]]);
    resource('boar', owner, 340, [[c.x + 14, c.y + 2], [c.x - 2, c.y + 14]]);
    // Two woodlines within a drop-off's reach, and five stragglers by the Town Center, as DE gives a start.
    forest(c.x - 19, c.y - 5, 5, 11);
    forest(c.x - 5, c.y + 16, 11, 5);
    for (const [dx, dy] of [[7, -6], [-8, -6], [8, 1], [-1, 8], [3, -9]] as const) forest(c.x + dx, c.y + dy, 1, 1);
  }
  // Neutral forest: 7x6 clumps on a 16-cell grid, kept 26 cells clear of both Town Centers, with lanes nine and ten
  // cells wide between them so the map stays one piece.
  for (let gy = 5; gy + 6 <= side - 4; gy += 16) {
    for (let gx = 5; gx + 7 <= side - 4; gx += 16) {
      if (CENTRES.some((c) => Math.hypot(gx + 3 - c.x, gy + 3 - c.y) < 26)) continue;
      forest(gx, gy, 7, 6);
    }
  }
  seedForestTrees(terrain, spawns, size);
  return { seed, width: side, height: side, terrain, starts, spawns: spawns.toArray() };
}

/**
 * A live bridge on that world, the computer playing both seats, at tick 0. Conquest only, so a match stepped a
 * long way does not end on a Wonder or a relic count.
 */
export function createDeTinySizedBridge(seed = 'de-tiny-sized'): SimulationBridge {
  const options = { forceAiForOwners: new Set([HUMAN_PLAYER_ID]), victory: 'conquest-only' as const };
  const scenario = createDeTinySizedScenario(seed);
  const world = createWorld(seed, new LayeredVisibilityMap(scenario.width, scenario.height), undefined, 'live', {
    ...options, playerCount: 2, scenario,
  });
  return createSimulationBridge(seed, { ...options, savedGame: world.saveGame() });
}
