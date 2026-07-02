import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../types';
import { createGrassFixtureTerrain } from './common';

// Wheelbarrow / Hand Cart villager movement-speed fixtures (v0.1.69). Player 1
// (human, AI disabled) owns a single Villager on open grass with a long clear
// lane east, plus a Town Center. Twin/triple scenarios — no carry tech,
// Wheelbarrow only, and both — let a test race an identical move command and
// confirm the villager moves faster (110% / 121%) via the shared movement-speed
// carry accumulator. Feudal age so Wheelbarrow/Hand Cart are age-legal to seed.

interface VillagerSpeedOptions {
  researched?: ResearchableTechnologyType[];
}

function createVillagerSpeedScenario(
  seed: string,
  options: VillagerSpeedOptions,
): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'feudal-age',
        disableAi: true,
        ...(options.researched
          ? { startingResearchedTechnologies: options.researched }
          : {}),
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 24 },
        startingAge: 'feudal-age',
        disableAi: true,
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'villager',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 24,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Baseline: no carry techs. The villager walks at the uniform base cadence.
export function createVillagerSpeedBaselineFixture(seed: string): PrototypeScenario {
  return createVillagerSpeedScenario(seed, {});
}

// Wheelbarrow only: the villager walks at 110%.
export function createVillagerSpeedWheelbarrowFixture(seed: string): PrototypeScenario {
  return createVillagerSpeedScenario(seed, { researched: ['wheelbarrow'] });
}

// Wheelbarrow + Hand Cart: the villager walks at 121% (the halves stack).
export function createVillagerSpeedBothFixture(seed: string): PrototypeScenario {
  return createVillagerSpeedScenario(seed, { researched: ['wheelbarrow', 'hand-cart'] });
}
