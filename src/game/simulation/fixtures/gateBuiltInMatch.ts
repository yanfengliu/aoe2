import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';
import { gateWallLine } from './gates';

// The gate a player BUILDS, rather than one the scenario hands them already
// standing (`gate-fixture`). The distinction is the whole point: a seeded
// building has no construction-state entry at all, while a built one keeps its
// entry forever with `isComplete` flipped — so a completion test that reads
// "has no entry" passes on every fixture gate and fails on every real one.
//
// Player 1's wall spans the full map height with a HOLE at y=12 that its own
// villager closes with a Gate during the match. Both scouts can cross the hole
// before it is built; once the Gate stands, its owner still crosses and the
// enemy does not.
export function createGateBuiltInMatchFixture(seed: string): PrototypeScenario {
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
      // A third, idle party for the same reason the seeded gate fixture keeps
      // one: a two-owner match that allies its owners ends by conquest on
      // tick 1 and nobody walks anywhere.
      {
        owner: 3,
        townCenter: { x: 50, y: 4 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 12, { vision: 8 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
      ownedSpawn('town-center', 3, 50, 4, { vision: 7 }),
      // The builder, standing beside the hole it is about to close.
      ownedSpawn('villager', 1, 19, 12, { vision: 4 }),
      // A second villager and a berry bush on the FAR side of the wall: the
      // pair that exercises the unreachable-plan cache across a gate opening
      // (the cached planner is the resource-approach one, not plain moves).
      // Vision 12 so the berries beyond the wall are DISCOVERED: a context
      // order on an unseen entity is refused, which would mask the test.
      ownedSpawn('villager', 1, 18, 13, { vision: 12 }),
      gaiaSpawn('berry-bush', 24, 12, { baseOwner: 1, amount: 400 }),
      // One scout each side of the line.
      ownedSpawn('scout', 1, 17, 12),
      ownedSpawn('scout', 2, 22, 12),
      ...gateWallLine('open'),
    ],
  };
}
