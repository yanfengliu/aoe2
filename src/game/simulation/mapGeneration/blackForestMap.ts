import type { PrototypeScenario } from '../prototypeScenario';
import {
  applyStandardPlayerOpening,
  createPlayerStarts,
} from './applyStandardPlayerOpening';
import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import {
  createTerrainCell,
  paintDisc,
  seedToNumber,
  type TerrainCellSpec,
} from './sharedTerrainHelpers';
import { createSpawnList } from './spawnList';

// Slice 11: Black Forest-style map. Dense forest covers the map with
// carved-out pockets for each player start and a winding corridor
// between them. Deterministic on the seed so tests and fixtures agree.
// The standard resource patches near each Town Center are preserved so
// the opening 2-3 minutes of play feel like Arabia — the differentiator
// is the wall of trees across the rest of the map.
export function createBlackForestMap(seed: string): PrototypeScenario {
  const terrain: TerrainCellSpec[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'forest')),
  );

  const starts = createPlayerStarts();
  const spawns = createSpawnList();

  // Carve out a base pocket (grass) around each start so the Town Center,
  // villagers, and resource offsets all have valid terrain.
  const POCKET_RADIUS = 6;
  for (const start of starts) {
    paintDisc(terrain, start.townCenter, POCKET_RADIUS, 'grass');
  }

  // Carve a winding corridor between the two starts. The corridor steps
  // from one Town Center to the other one tile at a time; at each step
  // we paint a small disc of grass so the path is passable. The seed
  // drives a small vertical wiggle so the corridor isn't a dead straight
  // line — players on the same seed always get the same corridor.
  const [firstStart, secondStart] = starts;
  if (firstStart && secondStart) {
    const rng = createBlackForestWiggleRng(seed);
    const steps = 28;
    const dx = (secondStart.townCenter.x - firstStart.townCenter.x) / steps;
    const dy = (secondStart.townCenter.y - firstStart.townCenter.y) / steps;
    for (let step = 0; step <= steps; step += 1) {
      const baseX = Math.round(firstStart.townCenter.x + dx * step);
      const baseY = Math.round(firstStart.townCenter.y + dy * step);
      const wiggle = Math.floor(rng() * 3) - 1;
      paintDisc(terrain, { x: baseX, y: baseY + wiggle }, 2, 'grass');
    }
  }

  // Seed tree spawns inside the surviving forest cells so villagers have
  // something to chop. Every forest cell in the final terrain map gets a
  // tree, which matches how the base map builds `spawns` in lockstep
  // with terrain kind.
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (terrain[y][x].kind === 'forest') {
        spawns.addResourceSpawn({
          kind: 'tree',
          x,
          y,
          owner: null,
          baseOwner: null,
          amount: 100,
        });
      }
    }
  }

  applyStandardPlayerOpening(terrain, starts, spawns, seed);

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts,
    spawns: spawns.toArray(),
  };
}

// Simple deterministic RNG used by the Black Forest corridor wiggle.
// Keeps a dependency-free Park-Miller LCG so the corridor shape is
// reproducible from the seed alone.
function createBlackForestWiggleRng(seed: string): () => number {
  let state = seedToNumber(seed);
  return () => {
    state = (state * 48271) % 0x7fffffff;
    return state / 0x7fffffff;
  };
}
