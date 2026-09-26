import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { UnitType } from '../types';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Shots in the air, for looking at (spec §10.4; defect register, 2026-09-26,
// "The Siege Onager, the Capped Ram and the Elite Skirmisher were left out of
// tables that named the rest of their line"). Capture it a few ticks in with
// `SEED=projectile-look-showcase-fixture TICKS=5 FOCUS=27,17
// node scripts/captureMapScreenshot.mjs`.
//
// Each of owner 1's shooters has one target of owner 2's in its own lane, and
// sees exactly as far as that target, so on its Aggressive stance it opens
// fire at it and at nothing else. The lanes are further apart than any
// shooter sees. The sea carries the Cannon Galleon and Turtle Ship lines,
// whose shots DE draws as cannonballs, and a Galley as the arrow control; the
// land carries the Siege Onager, with the Onager (its line's stone) and the
// Bombard Cannon (the cannonball) as controls. Targets have no attack and
// owner 2 has no AI, so nothing shoots back.

const SEA = { minX: 18, maxX: 46, minY: 4, maxY: 16 } as const;

interface Lane {
  readonly shooter: UnitType;
  readonly x: number;
  readonly y: number;
  readonly distance: number;
}

const SEA_LANES: readonly Lane[] = [
  { shooter: 'cannon-galleon', x: 22, y: 6, distance: 5 },
  { shooter: 'elite-cannon-galleon', x: 22, y: 9, distance: 5 },
  { shooter: 'turtle-ship', x: 22, y: 12, distance: 5 },
  { shooter: 'elite-turtle-ship', x: 22, y: 15, distance: 5 },
  { shooter: 'galley', x: 33, y: 6, distance: 5 },
];

const LAND_LANES: readonly Lane[] = [
  { shooter: 'siege-onager', x: 22, y: 20, distance: 6 },
  { shooter: 'onager', x: 22, y: 24, distance: 6 },
  { shooter: 'bombard-cannon', x: 22, y: 28, distance: 7 },
];

function terrain() {
  const cells = createGrassFixtureTerrain();
  for (let y = SEA.minY; y <= SEA.maxY; y += 1) {
    for (let x = SEA.minX; x <= SEA.maxX; x += 1) {
      cells[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return cells;
}

export function createProjectileLookShowcaseFixture(seed: string): PrototypeScenario {
  const lanes = (list: readonly Lane[], target: UnitType) => list.flatMap((lane) => [
    ownedSpawn(lane.shooter, 1, lane.x, lane.y, { vision: lane.distance }),
    ownedSpawn(target, 2, lane.x + lane.distance, lane.y),
  ]);
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: terrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 30 }, startingAge: 'imperial-age', disableAi: true },
      { owner: 2, townCenter: { x: 52, y: 30 }, startingAge: 'imperial-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 30, { vision: 7 }),
      ownedSpawn('town-center', 2, 52, 30, { vision: 7 }),
      ...lanes(SEA_LANES, 'transport-ship'),
      ...lanes(LAND_LANES, 'villager'),
    ],
  };
}
