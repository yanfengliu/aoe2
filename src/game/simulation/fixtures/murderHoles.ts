import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../types';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Murder Holes fixtures. Player 1 holds a Watch Tower at (20,12) with an enemy
// militia in the cell touching its footprint — inside the minimum range, where
// an un-teched tower cannot shoot. The two fixtures differ only in whether the
// tower's owner has researched Murder Holes, so the militia's hit points are
// the whole measurement.
function createHuggedTowerFixture(
  seed: string,
  towerTechnologies: readonly ResearchableTechnologyType[],
): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 6 },
        startingAge: 'castle-age',
        disableAi: true,
        startingResearchedTechnologies: [...towerTechnologies],
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 30 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 8 }),
      ownedSpawn('watch-tower', 1, 20, 12, { vision: 8 }),
      // Pressed against the tower's west face — one cell from the footprint.
      ownedSpawn('militia', 2, 19, 12, { vision: 4 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
    ],
  };
}

export function createMurderHolesHuggedFixture(seed: string): PrototypeScenario {
  return createHuggedTowerFixture(seed, []);
}

export function createMurderHolesResearchedFixture(seed: string): PrototypeScenario {
  return createHuggedTowerFixture(seed, ['murder-holes']);
}
