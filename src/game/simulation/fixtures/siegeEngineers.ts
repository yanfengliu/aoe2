import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../types';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Siege Engineers (v0.1.62) fixtures. Player 1 (human, AI disabled) owns a
// completed Siege Workshop plus one Mangonel (a SIEGE unit) and one Archer (a
// NON-siege control). Both stand idle. A test builds two bridges — one with no
// tech and one with `startingResearchedTechnologies: ['siege-engineers']` — and
// compares the units' derived attackRange: the Mangonel gains +1 with the tech,
// the Archer is unchanged.
//
// Siege Engineers is DERIVED at createCombatState from the researched-tech set
// (like Fletching/Guard-Tower), so pre-seeding the set on boot pre-applies the
// bonus without driving a research cycle in-test. The imperial-siege-fixture is
// reused for the existing-unit (imperative applyTechnology) research path.

interface SiegeEngineersOptions {
  // Player-1 techs pre-applied on boot (drives the derived +1 range).
  researched?: ResearchableTechnologyType[];
}

function createSiegeEngineersScenario(
  seed: string,
  options: SiegeEngineersOptions,
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
        // Imperial so Siege Engineers is age-legal to seed; the researched set
        // (not the age) drives the derived bonus.
        startingAge: 'imperial-age',
        disableAi: true,
        ...(options.researched
          ? { startingResearchedTechnologies: options.researched }
          : {}),
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('siege-workshop', 1, 14, 6),
      ownedSpawn('mangonel', 1, 10, 13, { vision: 9 }),
      ownedSpawn('archer', 1, 12, 13, { vision: 6 }),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
    ],
  };
}

// Baseline: no siege techs. Mangonel keeps its base range 7, Archer base 4.
export function createSiegeEngineersBaselineFixture(seed: string): PrototypeScenario {
  return createSiegeEngineersScenario(seed, {});
}

// Siege Engineers researched: the Mangonel gains +1 range (7 → 8); the Archer
// (non-siege) is unaffected.
export function createSiegeEngineersResearchedFixture(seed: string): PrototypeScenario {
  return createSiegeEngineersScenario(seed, { researched: ['siege-engineers'] });
}
