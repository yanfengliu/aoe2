import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Visual-only capture target for the behind-building unit silhouette cue
// (spec §14.5 "units behind buildings"). One completed human Town Center with
// a villager parked on the cell diagonally behind its mass (fully covered at
// default zoom) and a control villager in the open, so a single paused frame
// proves the cue fires exactly once. Generous vision keeps both villagers
// fog-visible to player 1 at boot; AI disabled so the frame is deterministic.
export function createOcclusionShowcaseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: { food: 200, wood: 200, gold: 100, stone: 100 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 14 }),
      // Hidden: diagonally behind the TC volume from the fixed iso camera.
      ownedSpawn('villager', 1, 7, 7, { vision: 6 }),
      // Control: in the open, must never receive the cue.
      ownedSpawn('villager', 1, 3, 12, { vision: 6 }),
    ],
  };
}
