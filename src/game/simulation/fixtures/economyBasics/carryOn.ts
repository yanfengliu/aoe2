import type { Position } from 'civ-engine';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../../prototypeScenario';
import { createTerrainCell } from '../../mapGeneration/sharedTerrainHelpers';
import type { ResourceKind } from '../../types';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from '../common';

// Work 131: what a gatherer does when the node it works runs out. Definitive
// Edition's villager carries on to more of the SAME kind close by and works
// it, and otherwise stands idle — the player's cue (spec §6.4, "Carrying on
// when a resource runs out"). One villager, one kind per seed:
//
//   A  the node the player orders the villager onto; a load and a half
//   B  the same kind, within the carry-on radius of A (3.6 cells)
//   D  the same kind, OUTSIDE the radius of A and of B (5.4 and 8.9 cells) but
//      beside the Town Center, so a ranking by the walk home picks it first
//   C  where one exists, another kind of the same stockpile resource within
//      the radius (a sheep beside berries, stone beside gold), plus a shore
//      fish beside the berries: what the foragers of the 2026-10-14 play
//      session walked off to
//
// The villager must go A, back to A after its first delivery, then B with the
// partial load it held when A ran out, and stand idle once B is gone, with C
// and D untouched.

export const CARRY_ON_KINDS = [
  'berry-bush', 'tree', 'gold-mine', 'stone-mine', 'sheep', 'fish', 'farm',
] as const;
export type CarryOnFixtureKind = typeof CARRY_ON_KINDS[number];

export function carryOnSeed(kind: CarryOnFixtureKind): string {
  return `carry-on-${kind}-fixture`;
}

export function carryOnSeeds(): string[] {
  return CARRY_ON_KINDS.map(carryOnSeed);
}

export const CARRY_ON_VILLAGER: Position = { x: 12, y: 12 };
export const CARRY_ON_LAYOUT = {
  A: { x: 13, y: 12 },
  B: { x: 16, y: 14 },
  D: { x: 8, y: 10 },
  C: { x: 13, y: 15 },
} as const;
/** Fish need water: A and B sit on a lake's shore, D on a pond by the Town Center. */
export const CARRY_ON_FISH_LAYOUT = {
  A: { x: 13, y: 13 },
  B: { x: 16, y: 13 },
  D: { x: 8, y: 10 },
  C: { x: 12, y: 15 },
} as const;
/** The shore fish beside the berries (spec §6.4's shore fishing). */
export const CARRY_ON_BERRY_FISH: Position = { x: 18, y: 16 };

const AMOUNT_A = 15;
const AMOUNT_B = 8;
const AMOUNT_FAR = 100;

/** The other kind of the same stockpile resource placed at C, if any. */
const DECOY_KIND: Partial<Record<CarryOnFixtureKind, ResourceKind>> = {
  'berry-bush': 'sheep',
  'gold-mine': 'stone-mine',
  'stone-mine': 'gold-mine',
  sheep: 'berry-bush',
  fish: 'berry-bush',
  farm: 'berry-bush',
};

function kindOfSeed(seed: string): CarryOnFixtureKind {
  const kind = CARRY_ON_KINDS.find((candidate) => carryOnSeed(candidate) === seed);
  if (!kind) {
    throw new Error(`Scenario '${seed}' is not a carry-on fixture; expected one of ${carryOnSeeds().join(', ')}.`);
  }
  return kind;
}

function nodeSpawn(kind: CarryOnFixtureKind, at: Position, amount: number): ScenarioSpawnSpec {
  if (kind === 'farm') return ownedSpawn('farm', 1, at.x, at.y, { farmFood: amount, vision: 2 });
  if (kind === 'sheep') return ownedSpawn('sheep', 1, at.x, at.y, { amount });
  return gaiaSpawn(kind, at.x, at.y, { amount, baseOwner: 1 });
}

function withWater(cells: Array<{ minX: number; maxX: number; minY: number; maxY: number }>) {
  const terrain = createGrassFixtureTerrain();
  for (const cell of cells) {
    for (let y = cell.minY; y <= cell.maxY; y += 1) {
      for (let x = cell.minX; x <= cell.maxX; x += 1) {
        terrain[y]![x] = createTerrainCell(x, y, 'water');
      }
    }
  }
  return terrain;
}

export function createCarryOnFixture(seed: string): PrototypeScenario {
  const kind = kindOfSeed(seed);
  const layout = kind === 'fish' ? CARRY_ON_FISH_LAYOUT : CARRY_ON_LAYOUT;
  const decoy = DECOY_KIND[kind];
  const terrain = kind === 'fish'
    ? withWater([
      { minX: 13, maxX: 18, minY: 13, maxY: 17 },
      { minX: 8, maxX: 9, minY: 10, maxY: 11 },
    ])
    : kind === 'berry-bush'
      ? withWater([{ minX: 18, maxX: 21, minY: 15, maxY: 18 }])
      : createGrassFixtureTerrain();
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        // Nothing in the stockpile: no wood reseeds the farm, and every unit
        // the villager delivers is visible.
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      },
      { owner: 2, townCenter: { x: 50, y: 28 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('villager', 1, CARRY_ON_VILLAGER.x, CARRY_ON_VILLAGER.y, { vision: 4 }),
      nodeSpawn(kind, layout.A, AMOUNT_A),
      nodeSpawn(kind, layout.B, AMOUNT_B),
      nodeSpawn(kind, layout.D, AMOUNT_FAR),
      ...(decoy === undefined
        ? []
        : [decoy === 'sheep'
          ? ownedSpawn('sheep', 1, layout.C.x, layout.C.y, { amount: AMOUNT_FAR })
          : gaiaSpawn(decoy, layout.C.x, layout.C.y, { amount: AMOUNT_FAR, baseOwner: 1 })]),
      ...(kind === 'berry-bush'
        ? [gaiaSpawn('fish', CARRY_ON_BERRY_FISH.x, CARRY_ON_BERRY_FISH.y, { amount: AMOUNT_FAR })]
        : []),
      ownedSpawn('town-center', 2, 50, 28, { vision: 7 }),
    ],
  };
}

/** Two live boars 4 cells apart and a sheep 3 cells from the first, with six
 *  villagers (Loom) ringed round the first, as `boar-hunt-fixture` rings them. */
export const CARRY_ON_HUNT = {
  firstBoar: { x: 13, y: 8 },
  secondBoar: { x: 17, y: 8 },
  sheep: { x: 13, y: 11 },
  firstBoarFood: 40,
  secondBoarFood: 60,
} as const;

export function createCarryOnHuntFixture(seed: string): PrototypeScenario {
  const ring = [
    { x: 12, y: 7 }, { x: 13, y: 7 }, { x: 14, y: 7 },
    { x: 12, y: 9 }, { x: 13, y: 9 }, { x: 14, y: 9 },
  ];
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
        startingResearchedTechnologies: ['loom'],
        disableAi: true,
      },
      { owner: 2, townCenter: { x: 50, y: 28 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ...ring.map((cell) => ownedSpawn('villager', 1, cell.x, cell.y, { vision: 4 })),
      gaiaSpawn('boar', CARRY_ON_HUNT.firstBoar.x, CARRY_ON_HUNT.firstBoar.y, { amount: CARRY_ON_HUNT.firstBoarFood }),
      gaiaSpawn('boar', CARRY_ON_HUNT.secondBoar.x, CARRY_ON_HUNT.secondBoar.y, { amount: CARRY_ON_HUNT.secondBoarFood }),
      ownedSpawn('sheep', 1, CARRY_ON_HUNT.sheep.x, CARRY_ON_HUNT.sheep.y, { amount: 100 }),
      ownedSpawn('town-center', 2, 50, 28, { vision: 7 }),
    ],
  };
}
