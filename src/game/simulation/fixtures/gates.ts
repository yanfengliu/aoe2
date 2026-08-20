import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ScenarioSpawnSpec } from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

const WALL_COLUMN = 20;
const GATE_ROW = 12;

// Gate fixture. Player 1 walls the map in two at x=20 — a stone wall on every
// row except y=12, which holds a Gate — with a scout of its own west of the line
// and an enemy scout east of it. The wall spans the FULL map height on purpose:
// a short line can simply be walked around, which would let both tests pass
// without the gate doing anything at all.
export function createGatesFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 12 },
        startingAge: 'castle-age',
        disableAi: true,
        startingResources: { food: 0, wood: 200, gold: 0, stone: 200 },
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 30 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 12, { vision: 8 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
      // One unit each side of the line.
      ownedSpawn('scout', 1, 18, 12),
      ownedSpawn('scout', 2, 22, 12),
      ...wallLine(),
    ],
  };
}

// x=20 from edge to edge, with the single Gate at y=12.
function wallLine(): ScenarioSpawnSpec[] {
  const line: ScenarioSpawnSpec[] = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    line.push(y === GATE_ROW
      ? ownedSpawn('stone-gate', 1, WALL_COLUMN, y, { vision: 4 })
      : ownedSpawn('stone-wall', 1, WALL_COLUMN, y));
  }
  return line;
}
