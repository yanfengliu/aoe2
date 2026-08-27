// agent-affordances A1: the "why can't I research this" reason engine.
// Pure unit tests over fake player-query deps. The contract under test:
// every reason names the actual unmet rule so an agent (or the HUD
// toast) can act on it instead of reverse-engineering hidden rules
// (campaign-1 burned ~7 decisions on exactly this).

import { describe, it, expect } from 'vitest';

import {
  createResearchAvailability,
  type ResearchAvailabilityDeps,
} from '../../src/game/simulation/bridge/researchAvailability';
import type {
  BuildingType,
  ResearchableTechnologyType,
} from '../../src/game/simulation/types';

type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';

function makeDeps(overrides: {
  age?: AgeType;
  researched?: ResearchableTechnologyType[];
  prereqCounts?: Partial<Record<'feudal-age' | 'castle-age' | 'imperial-age', number>>;
  options?: Partial<Record<BuildingType, ResearchableTechnologyType[]>>;
  denyingCivilization?: string;
} = {}): ResearchAvailabilityDeps {
  const researched = new Set(overrides.researched ?? []);
  return {
    getPlayerAge: () => overrides.age ?? 'dark-age',
    hasTechnology: (_owner, tech) => researched.has(tech),
    countCompletedAgePrerequisites: (_owner, forTech) =>
      overrides.prereqCounts?.[forTech] ?? 0,
    getResearchOptions: (_owner, buildingType) =>
      overrides.options?.[buildingType] ?? [],
    civilizationDenying: () => overrides.denyingCivilization,
  };
}

describe('researchUnavailableReason', () => {
  it('names the right building when the tech is researched elsewhere', () => {
    const { researchUnavailableReason } = createResearchAvailability(makeDeps());
    const reason = researchUnavailableReason(1, 'barracks', 'feudal-age');
    expect(reason).toContain('cannot be researched at a barracks');
    expect(reason).toContain('town-center');
  });

  it('states the prerequisite-building count for an age-up (the campaign-1 case)', () => {
    const { researchUnavailableReason } = createResearchAvailability(
      makeDeps({ age: 'dark-age', prereqCounts: { 'feudal-age': 1 } }),
    );
    const reason = researchUnavailableReason(1, 'town-center', 'feudal-age');
    expect(reason).toContain('2 completed Dark Age buildings');
    expect(reason).toContain('you have 1');
    // The candidate buildings are named so the agent knows WHAT to build.
    expect(reason).toContain('mill');
    expect(reason).toContain('barracks');
  });

  it('uses the matching prerequisite era label per age-up tech', () => {
    const { researchUnavailableReason } = createResearchAvailability(
      makeDeps({ age: 'feudal-age', prereqCounts: { 'castle-age': 0 } }),
    );
    const reason = researchUnavailableReason(1, 'town-center', 'castle-age');
    expect(reason).toContain('2 completed Feudal Age buildings');
    expect(reason).toContain('you have 0');
    expect(reason).toContain('blacksmith');
  });

  it('explains the age gate when researching an age-up from the wrong age', () => {
    const { researchUnavailableReason } = createResearchAvailability(
      makeDeps({ age: 'dark-age' }),
    );
    const reason = researchUnavailableReason(1, 'town-center', 'castle-age');
    expect(reason).toContain('requires being in feudal-age');
    expect(reason).toContain('you are dark-age');
  });

  it('says so when the age-up is already behind you', () => {
    const { researchUnavailableReason } = createResearchAvailability(
      makeDeps({ age: 'castle-age' }),
    );
    const reason = researchUnavailableReason(1, 'town-center', 'feudal-age');
    expect(reason).toContain('already castle-age');
  });

  it('reports already-researched techs', () => {
    const { researchUnavailableReason } = createResearchAvailability(
      makeDeps({ age: 'feudal-age', researched: ['fletching'] }),
    );
    const reason = researchUnavailableReason(1, 'blacksmith', 'fletching');
    expect(reason).toContain('fletching is already researched');
  });

  it('falls back to listing what IS researchable here', () => {
    const { researchUnavailableReason } = createResearchAvailability(
      makeDeps({
        age: 'feudal-age',
        options: { blacksmith: ['fletching', 'forging'] },
      }),
    );
    const reason = researchUnavailableReason(1, 'blacksmith', 'iron-casting');
    expect(reason).toContain('Currently researchable here: fletching, forging');
  });

  it('falls back to "nothing" when the building has no options right now', () => {
    const { researchUnavailableReason } = createResearchAvailability(
      makeDeps({ age: 'dark-age' }),
    );
    const reason = researchUnavailableReason(1, 'blacksmith', 'fletching');
    expect(reason).toContain('Nothing is currently researchable at this building');
  });
});

describe('tech-tree denial reasons (spec §11.1)', () => {
  it('says a denied technology is PERMANENTLY out, not "not yet"', () => {
    const { researchUnavailableReason } = createResearchAvailability(
      makeDeps({ age: 'imperial-age', denyingCivilization: 'Franks' }),
    );
    const reason = researchUnavailableReason(1, 'blacksmith', 'bracer');
    expect(reason).toContain('not in the Franks technology tree');
    expect(reason).toContain('will ever unlock');
    expect(reason).not.toContain('yet');
  });
});
