import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../common';

// The drop-off DOOR CLOT (2026-08-28, v0.3.160). Found by profiling the
// ai-feudal-stone fixture at spec §12.4.2 walk speed: by tick ~8,300 ten-plus
// carriers stood stacked on one approach cell of the AI's drop-off, arrivals
// outpacing the door's drain rate forever — the economy silently flatlined
// (stone pinned at 130) and the traffic election's recursive dependency
// closure over the ever-growing ball turned single ticks into seconds
// (400ms sustained, 6.5s bursts, ~40MB of Set copies per tick).
//
// AoE2's own answer is the iconic villager ball: ECONOMIC units do not
// collide with each other at work sites, and a deposit lands on TOUCHING the
// building, not on occupying one blessed cell. This fixture pins that
// contract: twelve villagers cycling one Town Center door must sustain
// throughput, not queue single-file into a livelock.
export function createDropOffConvoyFixture(seed: string): PrototypeScenario {
  const villagers: Array<ReturnType<typeof ownedSpawn>> = [];
  // Twelve villagers parked around the berry cluster east of the TC.
  const spots: ReadonlyArray<readonly [number, number]> = [
    [18, 6], [18, 7], [18, 8], [18, 9], [18, 10], [18, 11],
    [19, 6], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11],
  ];
  for (const [x, y] of spots) villagers.push(ownedSpawn('villager', 2, x, y, { vision: 4 }));
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 50, y: 28 }, disableAi: true },
      // Economy under test: planner disabled, auto-gather still runs.
      { owner: 2, townCenter: { x: 8, y: 8 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 50, 28, { vision: 7 }),
      // The ONE food drop-off: every carrier converges on this door.
      ownedSpawn('town-center', 2, 8, 8, { vision: 7 }),
      // A deep berry cluster so gathering never runs dry mid-test.
      gaiaSpawn('berry-bush', 20, 7, { baseOwner: 2, amount: 400 }),
      gaiaSpawn('berry-bush', 21, 7, { baseOwner: 2, amount: 400 }),
      gaiaSpawn('berry-bush', 20, 8, { baseOwner: 2, amount: 400 }),
      gaiaSpawn('berry-bush', 21, 8, { baseOwner: 2, amount: 400 }),
      gaiaSpawn('berry-bush', 20, 9, { baseOwner: 2, amount: 400 }),
      gaiaSpawn('berry-bush', 21, 9, { baseOwner: 2, amount: 400 }),
      ...villagers,
    ],
  };
}
