import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../types';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Sappers (v0.1.64) fixtures. Player 1 (human, AI disabled) owns a Militia at
// (13, 8) standing adjacent to an enemy (owner 2) House at (14, 8). A test
// issues the Militia to attack the House and counts how long it takes to raze
// it: with `startingResearchedTechnologies: ['sappers']` the Militia deals +15
// per hit vs the building, so the House falls in strictly fewer ticks than the
// no-tech baseline.
//
// Sappers is DERIVED at the unit->building damage site (like the building-arrow
// techs), so pre-seeding the researched set on boot pre-applies the bonus with
// no research cycle in-test. The House does not fire back and AI is disabled,
// so the militia's per-hit building damage is the only variable.

interface SappersOptions {
  // Player-1 techs pre-applied on boot (drives the derived +15 vs buildings).
  researched?: ResearchableTechnologyType[];
}

function createSappersScenario(seed: string, options: SappersOptions): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 20 },
        // Imperial so Sappers is age-legal to seed; the researched set (not the
        // age) drives the derived bonus.
        startingAge: 'imperial-age',
        disableAi: true,
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
      ownedSpawn('town-center', 1, 4, 20, { vision: 7 }),
      ownedSpawn('militia', 1, 13, 8, { vision: 6 }),
      ownedSpawn('house', 2, 14, 8),
      ownedSpawn('town-center', 2, 40, 24, { vision: 7 }),
    ],
  };
}

// Baseline: no Sappers. Militia deals only its base attack to the House.
export function createSappersBaselineFixture(seed: string): PrototypeScenario {
  return createSappersScenario(seed, {});
}

// Sappers researched: the Militia deals +15 per hit vs the House, razing it in
// strictly fewer ticks than the baseline.
export function createSappersResearchedFixture(seed: string): PrototypeScenario {
  return createSappersScenario(seed, { researched: ['sappers'] });
}
