// v0.3.140: DE retired Tracking (LoS folded into the units sheet) and
// Cartography (allies share sight from the start). This pins the shape of the
// game AFTER the retirement — the techs gone from every table, and the
// Portuguese team bonus that replaced free Cartography in current DE:
// technologies research 25% faster for the whole side.

import { describe, expect, it } from 'vitest';

import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { RESEARCHES_BY_BUILDING } from '../../src/game/simulation/buildingProductionTables';
import {
  PORTUGUESE_TEAM_RESEARCH_MULTIPLIER,
  teamResearchTimeMultiplier,
} from '../../src/game/simulation/bridge/teamProductionBonuses';
import {
  playerCivilizationsCodec,
  playerTeamsCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';

function fakeAccessor(
  civilizations: ReadonlyMap<number, string>,
  teams: ReadonlyMap<number, number>,
): BridgeStateAccessor {
  return {
    get: (codec: unknown) => {
      if (codec === playerCivilizationsCodec) return civilizations;
      if (codec === playerTeamsCodec) return teams;
      throw new Error('unexpected codec in this test');
    },
  } as unknown as BridgeStateAccessor;
}

describe('the retired technologies are gone from every table', () => {
  it('has no cost, and no building hosts them', () => {
    expect('tracking' in RESEARCH_COSTS).toBe(false);
    expect('cartography' in RESEARCH_COSTS).toBe(false);
    for (const [, technologies] of RESEARCHES_BY_BUILDING) {
      expect(technologies).not.toContain('tracking');
      expect(technologies).not.toContain('cartography');
    }
  });
});

describe('Portuguese team bonus: research 25% faster (replaced free Cartography)', () => {
  const CIVS = new Map([[1, 'Britons'], [2, 'Portuguese'], [3, 'Turks']]);

  it('applies to the Portuguese player and every ally, at any building', () => {
    const teams = new Map([[1, 1], [2, 1], [3, 2]]);
    const accessor = fakeAccessor(CIVS, teams);
    expect(teamResearchTimeMultiplier(accessor, 2, 'blacksmith')).toBe(0.8);
    expect(teamResearchTimeMultiplier(accessor, 1, 'monastery')).toBe(0.8);
    // The enemy Turk gets nothing.
    expect(teamResearchTimeMultiplier(accessor, 3, 'blacksmith')).toBe(1);
  });

  it('composes with the Malians university bonus instead of replacing it', () => {
    const civs = new Map([[1, 'Malians'], [2, 'Portuguese']]);
    const teams = new Map([[1, 1], [2, 1]]);
    const accessor = fakeAccessor(civs, teams);
    const atUniversity = teamResearchTimeMultiplier(accessor, 1, 'university');
    expect(atUniversity).toBeLessThan(PORTUGUESE_TEAM_RESEARCH_MULTIPLIER);
    expect(teamResearchTimeMultiplier(accessor, 1, 'blacksmith')).toBe(0.8);
  });
});
