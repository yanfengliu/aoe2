// AoE2-correct population supply (roadmap M1, gap #1). Spec §6.10 says
// Houses, Town Centers, AND Castles contribute population capacity. The
// prior implementation gave Town Centers and Castles 0 pop — a spec
// divergence. These unit tests pin the corrected per-building values.
// (The standard 200 population LIMIT is a planned follow-up — it needs
// raw-supply tracking to clamp over-housing/destruction correctly — so it
// is intentionally not asserted here yet.)

import { describe, it, expect } from 'vitest';

import { buildingPopulationProvided } from '../../src/game/simulation/prototypeBuildingRules';

describe('AoE2 population supply (spec §6.10)', () => {
  it('Town Center, House, and Castle each provide population', () => {
    expect(buildingPopulationProvided('town-center')).toBe(5);
    expect(buildingPopulationProvided('house')).toBe(5);
    expect(buildingPopulationProvided('castle')).toBe(20);
  });

  it('non-housing buildings provide no population', () => {
    expect(buildingPopulationProvided('barracks')).toBe(0);
    expect(buildingPopulationProvided('mill')).toBe(0);
    expect(buildingPopulationProvided('watch-tower')).toBe(0);
    expect(buildingPopulationProvided('wonder')).toBe(0);
  });
});
