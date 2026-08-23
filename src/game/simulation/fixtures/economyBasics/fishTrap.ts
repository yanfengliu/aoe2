import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createTerrainCell } from '../../mapGeneration/sharedTerrainHelpers';
import { createGrassFixtureTerrain, ownedSpawn } from '../common';

// A bay with a Dock on its shore and a Fishing Ship already on the water, and
// deliberately NO wild fish anywhere: the only food this player can ever gather
// is a Fish Trap it builds itself, so a rising food count proves the trap.
export const FISH_TRAP_BAY = { minX: 14, maxX: 24, minY: 4, maxY: 16 } as const;

function bayTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = FISH_TRAP_BAY.minY; y <= FISH_TRAP_BAY.maxY; y += 1) {
    for (let x = FISH_TRAP_BAY.minX; x <= FISH_TRAP_BAY.maxX; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return terrain;
}

export function createFishTrapFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: bayTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 5, y: 8 },
        startingResources: { food: 0, wood: 2000, gold: 200, stone: 200 },
      },
      { owner: 2, townCenter: { x: 40, y: 26 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 5, 8, { vision: 7 }),
      // The Dock's 3x3 footprint sits at x=11..13, against the bay's west edge.
      ownedSpawn('dock', 1, 11, 8, { vision: 8 }),
      // The builder and gatherer, already afloat beside the dock.
      ownedSpawn('fishing-ship', 1, 15, 9, { vision: 5 }),
      // A villager on land, to prove the Fish Trap is NOT in its menu.
      ownedSpawn('villager', 1, 8, 12, { vision: 4 }),
      ownedSpawn('town-center', 2, 40, 26, { vision: 4 }),
    ],
  };
}
