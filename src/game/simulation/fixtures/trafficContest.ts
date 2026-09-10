// A traffic contest the starvation rule cannot sit out: one owner's villagers
// cycling both ways through a one-cell gap in a wall, with a Town Centre on
// one side and their woodline on the other.
//
// Built for the relief gate (tests/simulation/movementTrafficReliefSelfPlay
// .test.ts, 2026-09-10). That gate asserted two halves on self-play — no
// phantom relief, and the rule still engages — and the second half rested on
// a seed happening to jam. It moved seeds once when the boot map stopped
// starving; with farms walkable `default-seed` stopped too (0 admissions at
// 30,000 ticks), because the jams that fed it were units piling up against
// farm walls. This fixture makes the contest a matter of geometry instead.
//
// Why the traffic has to be two-way and continuous: the arbiter admits one
// mover per origin cell per tick in a narrow lane and a cell takes ~13
// admitted ticks at 0.32 fine units per tick, so a one-shot crowd of twenty
// clears a gap in a few hundred ticks and nobody waits the 750 ticks the rule
// needs (`TRAFFIC_STARVATION_TICKS`). A wait-for cycle — the only thing the
// election runs on — needs traffic meeting head-on, and a wait past the
// threshold needs that traffic replenished. Gatherers give both from ONE
// order: every trip crosses the gap twice, empty-handed out and carrying back,
// for as long as the woodline lasts.
//
// The wall is FOREST TERRAIN, not tree entities, because the villagers that
// make the contest are woodcutters and would chop a tree wall open. The
// woodline east of it is real trees with wood in them.
//
// Parked beside the gap, in the east mouth cell, stand a few villagers with no
// order. They are the phantom half's instrument: a unit that stood still by
// choice and then asks is the case the E1 fix exists for, and the test gives
// them their orders late, into the standing jam.
//
// The parked villagers carry the fixture's long vision, and that is load-
// bearing rather than decoration: a right-click on a FOGGED tree is a move
// order, not a gather order, so with the default radius the whole crowd walked
// to (35,18), stood on the woodline's doorstep and went idle — 24 villagers,
// 1,000 ticks, wood unchanged at 200, zero admissions (measured 2026-09-10).
// `TRAFFIC_CONTEST_PARKED_VISION` reaches the woodline's west face from the
// east mouth, so the order the test gives is the gather order it means.
//
// WHAT THE GEOMETRY IS WORTH, measured through the registered seed at 4,000
// ticks: 52 relief admissions across 3 units, first at tick 1,837, phantom 0,
// human wood 200 -> 720. Widening `gapWidth` from 1 to 4 takes that to 0
// admissions across 0 units while the wood rises FASTER (+1,170), which is the
// proof that the one-cell gap is what contests rather than what blocks.

import type { Position } from 'civ-engine';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../prototypeScenario';
import { setTerrainKind } from '../mapGeneration/sharedTerrainHelpers';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

/** The knobs a probe sweeps; the registered seed uses every default. */
export interface TrafficContestOptions {
  /** Columns of forest the wall is thick, from `WALL_X` eastward. */
  readonly wallThickness?: number;
  /** Rows the gap is wide, from `GAP_Y` southward. One is the contest. */
  readonly gapWidth?: number;
  /** Woodcutters west of the wall. */
  readonly crowd?: number;
  /** Villagers parked in the east mouth cell with no order. */
  readonly parked?: number;
}

/** The wall's west column. */
export const TRAFFIC_CONTEST_WALL_X = 28;
/** Vision on the parked villagers, wide enough to reach the woodline's west
 *  face from the east mouth (7 cells) with room around the gap's row. */
export const TRAFFIC_CONTEST_PARKED_VISION = 10;
/** The gap's row. */
export const TRAFFIC_CONTEST_GAP_Y = 18;
export const TRAFFIC_CONTEST_DEFAULTS: Required<TrafficContestOptions> = {
  wallThickness: 1,
  gapWidth: 1,
  crowd: 24,
  parked: 4,
};
/** Owner 1's Town Centre anchor (4x4, footprint 16..19 x 16..19): the drop-off. */
export const TRAFFIC_CONTEST_TOWN_CENTER: Position = { x: 16, y: 16 };
/** Owner 2's Town Centre, far from everything, so the match has two players. */
export const TRAFFIC_CONTEST_ENEMY_TOWN_CENTER: Position = { x: 52, y: 2 };
/** The woodline's west face; the tree the crowd is sent to. */
export const TRAFFIC_CONTEST_WOODLINE_X = 36;
export const TRAFFIC_CONTEST_FIRST_TREE: Position = { x: TRAFFIC_CONTEST_WOODLINE_X, y: TRAFFIC_CONTEST_GAP_Y };
/** A cell on the Town Centre's side of the wall, for an order that has to cross it westward. */
export const TRAFFIC_CONTEST_WEST_OF_WALL: Position = { x: 22, y: TRAFFIC_CONTEST_GAP_Y };

/** The open cell just west of the gap. */
export function trafficContestWestMouth(): Position {
  return { x: TRAFFIC_CONTEST_WALL_X - 1, y: TRAFFIC_CONTEST_GAP_Y };
}

/** The open cell just east of the gap, where the parked villagers stand. */
export function trafficContestEastMouth(wallThickness = TRAFFIC_CONTEST_DEFAULTS.wallThickness): Position {
  return { x: TRAFFIC_CONTEST_WALL_X + wallThickness, y: TRAFFIC_CONTEST_GAP_Y };
}

function wallTerrain(wallThickness: number, gapWidth: number) {
  const terrain = createGrassFixtureTerrain();
  for (let x = TRAFFIC_CONTEST_WALL_X; x < TRAFFIC_CONTEST_WALL_X + wallThickness; x += 1) {
    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      const inGap = y >= TRAFFIC_CONTEST_GAP_Y && y < TRAFFIC_CONTEST_GAP_Y + gapWidth;
      if (!inGap) setTerrainKind(terrain, x, y, 'forest');
    }
  }
  return terrain;
}

/** A 3-wide block of woodcutters between the Town Centre and the wall. */
function crowdSpawns(crowd: number): ScenarioSpawnSpec[] {
  const spawns: ScenarioSpawnSpec[] = [];
  for (let index = 0; index < crowd; index += 1) {
    const x = 21 + (index % 3);
    const y = 14 + Math.floor(index / 3);
    spawns.push(ownedSpawn('villager', 1, x, y, { vision: 4 }));
  }
  return spawns;
}

/** Five columns of trees with wood in them; the crowd works the west face. */
function woodlineSpawns(): ScenarioSpawnSpec[] {
  const trees: ScenarioSpawnSpec[] = [];
  for (let x = TRAFFIC_CONTEST_WOODLINE_X; x < TRAFFIC_CONTEST_WOODLINE_X + 5; x += 1) {
    for (let y = 8; y <= 28; y += 1) trees.push(gaiaSpawn('tree', x, y, { amount: 100 }));
  }
  return trees;
}

export function createTrafficContestFixture(
  seed: string,
  options: TrafficContestOptions = {},
): PrototypeScenario {
  const { wallThickness, gapWidth, crowd, parked } = { ...TRAFFIC_CONTEST_DEFAULTS, ...options };
  const eastMouth = trafficContestEastMouth(wallThickness);
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: wallTerrain(wallThickness, gapWidth),
    starts: [
      {
        owner: 1,
        townCenter: TRAFFIC_CONTEST_TOWN_CENTER,
        startingResources: { food: 200, wood: 200, gold: 100, stone: 100 },
      },
      { owner: 2, townCenter: TRAFFIC_CONTEST_ENEMY_TOWN_CENTER },
    ],
    spawns: [
      ownedSpawn('town-center', 1, TRAFFIC_CONTEST_TOWN_CENTER.x, TRAFFIC_CONTEST_TOWN_CENTER.y, { vision: 7 }),
      ...crowdSpawns(crowd),
      // Spawned after the crowd so they carry the highest ids: lowest-id never
      // admits them, and only the starvation rule can.
      ...Array.from({ length: parked }, () => (
        ownedSpawn('villager', 1, eastMouth.x, eastMouth.y, { vision: TRAFFIC_CONTEST_PARKED_VISION })
      )),
      ...woodlineSpawns(),
      ownedSpawn('town-center', 2, TRAFFIC_CONTEST_ENEMY_TOWN_CENTER.x, TRAFFIC_CONTEST_ENEMY_TOWN_CENTER.y, { vision: 7 }),
    ],
  };
}
