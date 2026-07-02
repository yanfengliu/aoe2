import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../types';
import { createGrassFixtureTerrain } from './common';

// Squires (v0.1.68) movement-race fixtures — the infantry counterpart to the
// Husbandry twins. Player 1 (human, AI disabled) owns a Militia (INFANTRY) and
// a Knight (non-infantry control — Squires must NOT touch it) parked on open
// grass with long clear lanes east, plus a completed Barracks and 1000 food so
// a test can drive a REAL Squires research cycle. Twin scenarios — baseline vs
// `startingResearchedTechnologies: ['squires']` — race identical move commands
// and compare arrival ticks: the boosted Militia rides the movement-speed carry
// accumulator (+10%), the Knight is byte-identical across twins.

interface SquiresOptions {
  researched?: ResearchableTechnologyType[];
}

function createSquiresScenario(seed: string, options: SquiresOptions): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        // Castle Age so Squires is age-legal both to seed and to research live.
        startingAge: 'castle-age',
        disableAi: true,
        startingResources: { food: 1000, wood: 0, gold: 0, stone: 0 },
        ...(options.researched
          ? { startingResearchedTechnologies: options.researched }
          : {}),
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 24 },
        startingAge: 'castle-age',
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
        kind: 'barracks',
        x: 4,
        y: 10,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'militia',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'knight',
        x: 10,
        y: 16,
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

// Baseline: no Squires. Both units walk at the uniform base cadence.
export function createSquiresBaselineFixture(seed: string): PrototypeScenario {
  return createSquiresScenario(seed, {});
}

// Squires researched: the Militia walks +10% faster; the Knight is unaffected.
export function createSquiresResearchedFixture(seed: string): PrototypeScenario {
  return createSquiresScenario(seed, { researched: ['squires'] });
}
