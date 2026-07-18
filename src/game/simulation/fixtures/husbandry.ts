import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../types';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Husbandry (v0.1.66) movement-race fixtures. Player 1 (human, AI disabled)
// owns a Knight (MOUNTED) and a Militia (non-mounted control) parked on open
// grass with long clear straight lanes east, plus a completed Stable and 1000
// food so a test can drive a REAL husbandry research cycle. Twin scenarios —
// baseline vs `startingResearchedTechnologies: ['husbandry']` — let a test race
// identical move commands and compare arrival ticks: the boosted Knight banks
// fractional entitlement in the per-unit carry accumulator (+10% — an extra
// subgrid step whenever the bank crosses a whole fine unit), the Militia
// cadence is byte-identical across twins. Both AIs are disabled and player 2
// is far away so nothing perturbs the runs.

interface HusbandryOptions {
  // Player-1 techs pre-applied on boot (drives the derived speed multiplier).
  researched?: ResearchableTechnologyType[];
}

function createHusbandryScenario(
  seed: string,
  options: HusbandryOptions,
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
        // Castle Age so Husbandry is age-legal both to seed and to research
        // live at the Stable.
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
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('stable', 1, 4, 10),
      ownedSpawn('knight', 1, 10, 13, { vision: 4 }),
      ownedSpawn('militia', 1, 10, 16, { vision: 6 }),
      ownedSpawn('town-center', 2, 40, 24, { vision: 7 }),
    ],
  };
}

// Baseline: no Husbandry. Knight and Militia both walk at the uniform base
// cadence (2 subgrid steps per tick).
export function createHusbandryBaselineFixture(seed: string): PrototypeScenario {
  return createHusbandryScenario(seed, {});
}

// Husbandry researched: the Knight walks +10% faster; the Militia is
// unaffected.
export function createHusbandryResearchedFixture(seed: string): PrototypeScenario {
  return createHusbandryScenario(seed, { researched: ['husbandry'] });
}
