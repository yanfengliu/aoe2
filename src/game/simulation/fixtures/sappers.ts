import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../types';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Sappers (v0.1.64) fixtures. Player 1 (human, AI disabled) owns a Villager at
// (13, 8) standing adjacent to an enemy (owner 2) House at (14, 8). A test
// issues the Villager to attack the House and counts how long it takes to raze
// it: with `startingResearchedTechnologies: ['sappers']` the Villager takes 20
// a hit off the Castle Age House instead of 5 (DE: +15 against the Building
// class; work 140), so the House falls in strictly fewer ticks than the
// no-tech baseline.
//
// Sappers is DERIVED at the unit->building damage site (like the building-arrow
// techs), so pre-seeding the researched set on boot pre-applies the bonus with
// no research cycle in-test. The House does not fire back and AI is disabled,
// so the VILLAGER's per-hit building damage is the only variable (v0.3.132:
// technologies.csv applies Sappers to villagers, not infantry).

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
      ownedSpawn('villager', 1, 13, 8, { vision: 6 }),
      ownedSpawn('house', 2, 14, 8),
      ownedSpawn('town-center', 2, 40, 24, { vision: 7 }),
    ],
  };
}

// Baseline: no Sappers. The Villager takes 5 a hit off the House: 2 melee past
// its 1 melee armor and 3 against the Building class (work 140).
export function createSappersBaselineFixture(seed: string): PrototypeScenario {
  return createSappersScenario(seed, {});
}

// Sappers researched: the Villager's Building attack is 18, so it takes 20 a
// hit off the House, razing it in strictly fewer ticks than the baseline.
export function createSappersResearchedFixture(seed: string): PrototypeScenario {
  return createSappersScenario(seed, { researched: ['sappers'] });
}
