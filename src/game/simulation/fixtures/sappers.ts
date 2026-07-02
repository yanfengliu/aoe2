import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../types';
import { createGrassFixtureTerrain } from './common';

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
      {
        kind: 'town-center',
        x: 4,
        y: 20,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'militia',
        x: 13,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'house',
        x: 14,
        y: 8,
        owner: 2,
        baseOwner: 2,
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

// Baseline: no Sappers. Militia deals only its base attack to the House.
export function createSappersBaselineFixture(seed: string): PrototypeScenario {
  return createSappersScenario(seed, {});
}

// Sappers researched: the Militia deals +15 per hit vs the House, razing it in
// strictly fewer ticks than the baseline.
export function createSappersResearchedFixture(seed: string): PrototypeScenario {
  return createSappersScenario(seed, { researched: ['sappers'] });
}
