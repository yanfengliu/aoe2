import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain } from './common';

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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 14 },
      },
      // Hidden: diagonally behind the TC volume from the fixed iso camera.
      { kind: 'villager', x: 7, y: 7, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 6 } },
      // Control: in the open, must never receive the cue.
      { kind: 'villager', x: 3, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 6 } },
    ],
  };
}
