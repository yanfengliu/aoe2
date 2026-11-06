import type { Position } from 'civ-engine';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../../prototypeScenario';
import type { ResourceKind } from '../../types';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from '../common';

// Work 145: villagers share a resource as Definitive Edition's do (spec §6.4,
// "Several villagers on one node"). DE's text names a worker limit only for
// the Farm ("Only one Villager may work a Farm at a time", string 26149); a
// sheep, a carcass, a tree, a mine or a bush takes as many as fit beside it.
// Every scene is grass, owner 1's Town Center at (8,8) and both AIs off.
//
// - `shared-gathering-fixture`, DE's opening: six villagers beside the Town
//   Center, sheep A under its west side, B three cells south of A (the next
//   sheep), C 4.2 cells from A and farther from where the shepherds stand.
//   Six on A eat it together, and when it runs out all six go on to B.
// - `shared-gathering-<kind>-fixture`: eight villagers, a node N of the kind
//   with all four sides open, N2 of the kind 3 cells south of N and N3 4.5
//   cells from N, farther than N2 from N's north side, where the group stands.
// - `shared-gathering-far-fixture`: five villagers 36 cells west of a gold
//   pile, with a second pile 3 cells from it: a walk past the 32 tiles the
//   computer's fan-out waits for.
// - `shared-gathering-farm-fixture`: three villagers, Farm F1 and Farm F2 two
//   cells from it: a Farm takes one villager.
// - `shared-gathering-trap-fixture`: a villager, a sheep two cells from it to
//   be walked onto its cell, and another sheep to eat.
// - `shared-gathering-pile-fixture`: campaign-4's pile. Eighteen villagers
//   and an 8x8 woodline with a Lumber Camp; tree P on its west edge has one
//   open side, whose cell holds 16 (§12.6), and 2,000 wood, so it stands
//   while the two who find no room must find work elsewhere.

export const SHARED_GATHERING_SEED = 'shared-gathering-fixture';
export const SHARED_OPENING = {
  villagers: [
    { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 9 },
    { x: 5, y: 9 }, { x: 4, y: 10 }, { x: 5, y: 10 },
  ],
  A: { x: 7, y: 10 },
  B: { x: 7, y: 13 },
  C: { x: 4, y: 13 },
} as const;

export const SHARED_KINDS = ['sheep', 'tree', 'gold-mine', 'stone-mine', 'berry-bush'] as const;
export type SharedKind = (typeof SHARED_KINDS)[number];
export function sharedKindSeed(kind: SharedKind): string {
  return `shared-gathering-${kind}-fixture`;
}
export const SHARED_KIND_LAYOUT = {
  villagers: [
    { x: 12, y: 12 }, { x: 13, y: 12 }, { x: 14, y: 12 }, { x: 15, y: 12 },
    { x: 12, y: 13 }, { x: 13, y: 13 }, { x: 14, y: 13 }, { x: 15, y: 13 },
  ],
  N: { x: 14, y: 16 },
  N2: { x: 14, y: 19 },
  N3: { x: 18, y: 18 },
} as const;
// A node's amount: enough that eight take several loads before it runs out.
const SHARED_KIND_AMOUNT: Record<SharedKind, number> = {
  sheep: 100, tree: 100, 'gold-mine': 160, 'stone-mine': 160, 'berry-bush': 125,
};

export const SHARED_FAR_SEED = 'shared-gathering-far-fixture';
export const SHARED_FAR = {
  villagers: [{ x: 8, y: 28 }, { x: 8, y: 29 }, { x: 8, y: 30 }, { x: 9, y: 29 }, { x: 9, y: 30 }],
  gold: { x: 44, y: 29 },
  gold2: { x: 44, y: 32 },
} as const;

export const SHARED_FARM_SEED = 'shared-gathering-farm-fixture';
export const SHARED_FARM = {
  villagers: [{ x: 13, y: 13 }, { x: 14, y: 13 }, { x: 15, y: 13 }],
  F1: { x: 14, y: 16 },
  F2: { x: 16, y: 16 },
} as const;

export const SHARED_TRAP_SEED = 'shared-gathering-trap-fixture';
export const SHARED_TRAP = {
  villager: { x: 14, y: 14 },
  walker: { x: 14, y: 12 },
  food: { x: 17, y: 14 },
} as const;

export const SHARED_PILE_SEED = 'shared-gathering-pile-fixture';
export const SHARED_PILE = {
  villagers: Array.from({ length: 18 }, (_, i) => ({ x: 12 + (i % 6), y: 20 + Math.floor(i / 6) })),
  woodline: { x: 20, y: 18, size: 8 },
  P: { x: 20, y: 21 },
  camp: { x: 15, y: 15 },
} as const;

const VISION = { vision: 30 };

function scene(seed: string, spawns: ScenarioSpawnSpec[]): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 }, startingResources: { food: 200, wood: 200, gold: 100, stone: 200 }, disableAi: true },
      { owner: 2, townCenter: { x: 50, y: 4 }, startingResources: { food: 200, wood: 200, gold: 100, stone: 200 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, VISION),
      ownedSpawn('town-center', 2, 50, 4, { vision: 7 }),
      ...spawns,
    ],
  };
}

function node(kind: ResourceKind, at: Position, amount: number): ScenarioSpawnSpec {
  return kind === 'sheep' ? ownedSpawn('sheep', 1, at.x, at.y, { amount }) : gaiaSpawn(kind, at.x, at.y, { amount });
}

const villagersAt = (cells: readonly Position[], vision = VISION): ScenarioSpawnSpec[] => (
  cells.map((cell) => ownedSpawn('villager', 1, cell.x, cell.y, vision))
);

export function createSharedOpeningFixture(seed: string): PrototypeScenario {
  return scene(seed, [
    ...villagersAt(SHARED_OPENING.villagers),
    node('sheep', SHARED_OPENING.A, 100),
    node('sheep', SHARED_OPENING.B, 100),
    node('sheep', SHARED_OPENING.C, 100),
  ]);
}

export function createSharedKindFixture(seed: string): PrototypeScenario {
  const kind = SHARED_KINDS.find((candidate) => sharedKindSeed(candidate) === seed);
  if (!kind) throw new Error(`no shared-gathering kind for seed "${seed}"`);
  const amount = SHARED_KIND_AMOUNT[kind];
  return scene(seed, [
    ...villagersAt(SHARED_KIND_LAYOUT.villagers),
    node(kind, SHARED_KIND_LAYOUT.N, amount),
    node(kind, SHARED_KIND_LAYOUT.N2, amount),
    node(kind, SHARED_KIND_LAYOUT.N3, amount),
  ]);
}

export function createSharedFarFixture(seed: string): PrototypeScenario {
  return scene(seed, [
    // They see the pile they are sent to: a right-click needs it explored.
    ...villagersAt(SHARED_FAR.villagers, { vision: 40 }),
    node('gold-mine', SHARED_FAR.gold, 400),
    node('gold-mine', SHARED_FAR.gold2, 400),
  ]);
}

export function createSharedFarmFixture(seed: string): PrototypeScenario {
  return scene(seed, [
    ...villagersAt(SHARED_FARM.villagers),
    ownedSpawn('farm', 1, SHARED_FARM.F1.x, SHARED_FARM.F1.y, { vision: 4 }),
    ownedSpawn('farm', 1, SHARED_FARM.F2.x, SHARED_FARM.F2.y, { vision: 4 }),
  ]);
}

export function createSharedTrapFixture(seed: string): PrototypeScenario {
  return scene(seed, [
    ...villagersAt([SHARED_TRAP.villager]),
    node('sheep', SHARED_TRAP.walker, 100),
    node('sheep', SHARED_TRAP.food, 100),
  ]);
}

export function createSharedPileFixture(seed: string): PrototypeScenario {
  const { woodline, P } = SHARED_PILE;
  const trees: ScenarioSpawnSpec[] = [];
  for (let y: number = woodline.y; y < woodline.y + woodline.size; y += 1) {
    for (let x: number = woodline.x; x < woodline.x + woodline.size; x += 1) {
      trees.push(node('tree', { x, y }, x === P.x && y === P.y ? 2_000 : 100));
    }
  }
  return scene(seed, [
    ...villagersAt(SHARED_PILE.villagers),
    ownedSpawn('lumber-camp', 1, SHARED_PILE.camp.x, SHARED_PILE.camp.y, { vision: 4 }),
    ...trees,
  ]);
}

/** The scenario registry's entries for this module's scenes. The registry
 *  calls this while it is itself being evaluated, which can be in the middle
 *  of an import cycle through `prototypeScenario` before this module's
 *  constants exist (a spec that imports this module first), so it reads only
 *  literals and function declarations; `sharedGatheringScenarios.test.ts`
 *  holds it to the constants. */
export function sharedGatheringScenarios(): ReadonlyArray<readonly [string, (seed: string) => PrototypeScenario]> {
  const kinds = ['sheep', 'tree', 'gold-mine', 'stone-mine', 'berry-bush'];
  return [
    ['shared-gathering-fixture', createSharedOpeningFixture],
    ...kinds.map((kind) => [`shared-gathering-${kind}-fixture`, createSharedKindFixture] as const),
    ['shared-gathering-far-fixture', createSharedFarFixture],
    ['shared-gathering-farm-fixture', createSharedFarmFixture],
    ['shared-gathering-trap-fixture', createSharedTrapFixture],
    ['shared-gathering-pile-fixture', createSharedPileFixture],
  ];
}
