import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../types';
import { createGrassFixtureTerrain } from './common';

// Bloodlines (v0.1.65) fixtures. Player 1 (human, AI disabled) owns a Knight (a
// CAVALRY unit) and a Militia (a NON-cavalry control), both idle. A test builds
// two bridges — one with no tech and one with
// `startingResearchedTechnologies: ['bloodlines']` — and compares the units'
// derived maxHp: the Knight gains +20 with the tech, the Militia is unchanged.
//
// Bloodlines is applied at createCombatState from the researched-tech set (like
// Loom/Sanctity), so pre-seeding the set on boot pre-applies the +20 without
// driving a research cycle in-test. The imperial-stable-fixture is reused for
// the existing-unit (imperative applyTechnology) research path.

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
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'knight',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'militia',
        x: 12,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
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

// Baseline: no Bloodlines. Knight keeps its base HP, Militia its base HP.
export function createBloodlinesBaselineFixture(seed: string): PrototypeScenario {
  return createBloodlinesScenario(seed, {});
}

// Bloodlines researched: the Knight gains +20 max HP; the Militia (non-cavalry)
// is unaffected.
export function createBloodlinesResearchedFixture(seed: string): PrototypeScenario {
  return createBloodlinesScenario(seed, { researched: ['bloodlines'] });
}

// A Feudal-Age player-1 Stable (completed), used to assert Bloodlines is NOT
// offered before Castle Age — the tech is Castle-gated at the Stable.
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
        kind: 'stable',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
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
