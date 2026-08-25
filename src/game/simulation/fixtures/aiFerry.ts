import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';

// The AI ferry (spec §5.4 Islands, v0.3.95): owner 2's island holds its Town
// Center, a completed shore Dock, two militia (past the Dark-Age attack
// threshold of 1), and 300 wood; the human's island lies west across an
// eight-cell channel. The AI must board, sail, unload, and march — or, in the
// no-transport variant, first train the Transport Ship itself.
const CHANNEL = { minX: 22, maxX: 29 } as const;

function islandsTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = CHANNEL.minX; x <= CHANNEL.maxX; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return terrain;
}

function createFerryScenario(seed: string, withTransport: boolean): PrototypeScenario {
  // The no-transport variant starts FEUDAL (the Transport Ship is a Feudal
  // unit — units.csv) with the Feudal attack-group threshold of five militia
  // and houses to hold them; the with-transport variant stays Dark Age with
  // its threshold of one, proving the crossing mechanics minimally.
  const militia = withTransport
    ? [ownedSpawn('militia', 2, 36, 18), ownedSpawn('militia', 2, 37, 18)]
    : [
      ownedSpawn('militia', 2, 36, 18),
      ownedSpawn('militia', 2, 37, 18),
      ownedSpawn('militia', 2, 38, 18),
      ownedSpawn('militia', 2, 36, 19),
      ownedSpawn('militia', 2, 37, 19),
    ];
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: islandsTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 16 } },
      {
        owner: 2,
        townCenter: { x: 40, y: 16 },
        ...(withTransport ? {} : { startingAge: 'feudal-age' as const }),
        startingResources: { food: 300, wood: 300, gold: 100, stone: 100 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 16, { vision: 7 }),
      ownedSpawn('villager', 1, 12, 18, { vision: 4 }),
      ownedSpawn('town-center', 2, 40, 16, { vision: 7 }),
      // The Dock sits against the channel's east bank (3x3 footprint at
      // x=30..32 — its west column touches the water at x=29).
      ownedSpawn('dock', 2, 30, 14),
      ...militia,
      ...(withTransport ? [] : [ownedSpawn('house', 2, 46, 14), ownedSpawn('house', 2, 49, 14)]),
      ownedSpawn('villager', 2, 45, 20, { vision: 4 }),
      ...(withTransport ? [ownedSpawn('transport-ship', 2, 28, 15, { vision: 5 })] : []),
    ],
  };
}

export function createAiFerryFixture(seed: string): PrototypeScenario {
  return createFerryScenario(seed, true);
}

export function createAiFerryTrainFixture(seed: string): PrototypeScenario {
  return createFerryScenario(seed, false);
}
