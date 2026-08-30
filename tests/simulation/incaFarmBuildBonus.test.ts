// The Incas team bonus: "Farms built 50% faster" (civilizations.csv).
//
// It was the only unimplemented team bonus not covered by a spec deferral.
// §9.2.2 lists the four that are deferred and why — the Genitour and the
// Condottiero need units that do not exist, the Vietnamese Imperial Skirmisher
// needs a tier, the Burmese minimap reveal is a UI surface — and this is not
// among them. The seam already existed: `buildRateMultiplier` was the site the
// Spanish builder bonus and Treadmill Crane already shared. It simply had no
// idea what was being built, so a bonus scoped to one building could not be
// expressed there.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { buildRateMultiplier } from '../../src/game/simulation/buildingTechEffects';
import { INCAS_TEAM_FARM_BUILD_MULTIPLIER } from '../../src/game/simulation/teamBonuses';
import type { ResearchableTechnologyType } from '../../src/game/simulation/technologyTypes';

const NONE: ReadonlySet<ResearchableTechnologyType> = new Set();

describe('Incas team bonus — farms built 50% faster', () => {
  it('speeds a farm up by half', () => {
    expect(INCAS_TEAM_FARM_BUILD_MULTIPLIER).toBeCloseTo(1.5, 5);
    expect(buildRateMultiplier(NONE, undefined, { farmTeamBonus: true, buildingType: 'farm' }))
      .toBeCloseTo(1.5, 5);
  });

  it('leaves every other building alone', () => {
    // The control, and the reason the multiplier takes a building type at all.
    // A bonus that reads "farms" and applies to houses is a different bonus.
    for (const other of ['house', 'mill', 'castle', 'town-center'] as const) {
      expect(
        buildRateMultiplier(NONE, undefined, { farmTeamBonus: true, buildingType: other }),
        `${other} must not get the Incas farm bonus`,
      ).toBeCloseTo(1, 5);
    }
  });

  it('is inert for a side without the bonus', () => {
    expect(buildRateMultiplier(NONE, undefined, { farmTeamBonus: false, buildingType: 'farm' }))
      .toBeCloseTo(1, 5);
  });

  it('composes with the bonuses that already shared this seam', () => {
    // Spanish builders (+30%) and Treadmill Crane (+20%) both multiply here.
    // An Incas-teamed Spanish player with the tech building a farm gets all
    // three, which is how AoE2 stacks independent multipliers.
    expect(
      buildRateMultiplier(new Set(['treadmill-crane']), 'Spanish', {
        farmTeamBonus: true,
        buildingType: 'farm',
      }),
    ).toBeCloseTo(1.2 * 1.3 * 1.5, 5);
  });

  it('keeps the existing call shape working', () => {
    // The options argument is optional so every existing caller is unchanged.
    expect(buildRateMultiplier(NONE, 'Spanish')).toBeCloseTo(1.3, 5);
    expect(buildRateMultiplier(new Set(['treadmill-crane']), 'Spanish')).toBeCloseTo(1.56, 5);
  });
});

describe('the bonus reaches a real farm, not just the table', () => {
  // The audit that found this gap found it by looking for tech rows whose
  // effect nothing reads. A constant plus a unit test would have been exactly
  // that shape, so this builds an actual farm in an actual match and compares
  // the tick it completes on.
  function ticksToBuildFarm(civilization: string): number {
    const bridge = createSimulationBridge('single-villager-construction-fixture', {
      civilizationsByOwner: new Map([[1, civilization]]),
    });
    const builder = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager')!;
    expect(bridge.selectUnitsByIds([builder.id])).toBe(true);
    expect(bridge.beginBuildingPlacement('farm')).toBe(true);
    expect(bridge.confirmBuildingPlacement(12, 12)).toBe(true);

    for (let tick = 1; tick <= 4000; tick += 1) {
      bridge.step(100);
      const farm = bridge
        .getEconomyState()
        .buildings.find((building) => building.buildingType === 'farm');
      if (farm?.isComplete) return tick;
    }
    return Number.POSITIVE_INFINITY;
  }

  it('an Incas farm finishes exactly 50 ticks sooner than a Britons one', () => {
    // The MAGNITUDE, not the direction. A first version asserted only
    // `incas < britons`, and review set the multiplier to 1.01 and watched it
    // pass — so the 50% was pinned by nothing but the unit test on the
    // constant, which is the shape this whole change was meant to avoid.
    //
    // The exact numbers are knowable and so they are asserted. A farm is 150
    // build ticks plus a ~50-tick walk that both civs share: 150 / 1.5 = 100,
    // so Incas finish at 150 and Britons at 200.
    const incas = ticksToBuildFarm('Incas');
    const britons = ticksToBuildFarm('Britons');
    expect(britons, 'the Britons farm never finished').toBe(200);
    expect(
      incas,
      `Incas farm took ${incas} ticks against Britons' ${britons} — expected the `
      + 'full 50-tick saving, so the bonus is reaching the builder at the wrong size',
    ).toBe(150);
  }, 120_000);
});
