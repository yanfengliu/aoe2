import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../types';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Bloodlines (v0.1.65; scope/gate conformance-fixed v0.1.67) fixtures. Player 1
// (human, AI disabled) owns a Knight (cavalry), a Cavalry Archer (mounted
// archer — technologies.csv:78 lists it in Bloodlines' applies-to), and a
// Militia (a NON-mounted control), all idle. A test builds two bridges — one
// with no tech and one with `startingResearchedTechnologies: ['bloodlines']` —
// and compares the units' derived maxHp: the mounted units gain +20 with the
// tech, the Militia is unchanged.
//
// Bloodlines is applied at createCombatState from the researched-tech set (like
// Loom/Sanctity), so pre-seeding the set on boot pre-applies the +20 without
// driving a research cycle in-test. The imperial-stable-fixture covers the
// existing-KNIGHT imperative research path; the Feudal-stable fixture below
// covers the FEUDAL gate + the existing-cavalry-archer imperative path.

interface BloodlinesOptions {
  // Player-1 techs pre-applied on boot (drives the derived +20 cavalry HP).
  researched?: ResearchableTechnologyType[];
}

function createBloodlinesScenario(
  seed: string,
  options: BloodlinesOptions,
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
        // Castle Age so Bloodlines is age-legal to seed; the researched set (not
        // the age) drives the derived bonus.
        startingAge: 'castle-age',
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
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('knight', 1, 10, 13, { vision: 4 }),
      ownedSpawn('militia', 1, 12, 13, { vision: 6 }),
      ownedSpawn('cavalry-archer', 1, 14, 13, { vision: 5 }),
      ownedSpawn('town-center', 2, 40, 24, { vision: 7 }),
    ],
  };
}

// Baseline: no Bloodlines. Knight keeps its base HP, Militia its base HP.
export function createBloodlinesBaselineFixture(seed: string): PrototypeScenario {
  return createBloodlinesScenario(seed, {});
}

// Bloodlines researched: the Knight gains +20 max HP; the Militia (non-cavalry)
// is unaffected.
export function createBloodlinesResearchedFixture(seed: string): PrototypeScenario {
  return createBloodlinesScenario(seed, { researched: ['bloodlines'] });
}

// A Feudal-Age player-1 Stable (completed) with the resources to research
// Bloodlines (150f/100g) and an existing Cavalry Archer. Used to assert the
// FEUDAL gate (technologies.csv:78 — Bloodlines is a Feudal Stable tech, the
// v0.1.67 conformance fix; Husbandry stays Castle and must NOT appear here)
// and the imperative existing-mounted-archer +20 on research completion.
export function createBloodlinesFeudalStableFixture(seed: string): PrototypeScenario {
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
        startingResources: { food: 500, wood: 0, gold: 300, stone: 0 },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 24 },
        startingAge: 'feudal-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('stable', 1, 14, 6),
      ownedSpawn('cavalry-archer', 1, 18, 12, { vision: 5 }),
      ownedSpawn('town-center', 2, 40, 24, { vision: 7 }),
    ],
  };
}
