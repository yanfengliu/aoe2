// AoE2's multi-builder curve (spec §7 "Use the standard AoE2 multi-builder
// formula" and §16): actual_time = 3 * base_time / (builders + 2), i.e. the
// crew's combined rate is (n + 2) / 3 of one villager's. Two builders finish
// in 75% of the solo time, three in 60%, five in ~43% — never in 1/n.
//
// Until 2026-09-02 every builder simply added one tick of progress per tick,
// so five villagers built five times as fast and the spec formula was written
// but unimplemented. The rule is expressed incrementally — the first builder
// to work a site in a tick contributes a full tick, every other contributes a
// third — which sums to exactly (n + 2) / 3 without counting the crew.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { builderProgressShare } from '../../src/game/simulation/bridge/systems/builderWorkStep';

const HOUSE_ANCHOR = { x: 12, y: 12 };

const villagerIds = (bridge: ReturnType<typeof createSimulationBridge>): number[] =>
  bridge.getEconomyState().units
    .filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
    .map((unit) => unit.id);

describe('multi-builder curve', () => {
  it('sums to (n + 2) / 3 for any crew size', () => {
    for (let crew = 1; crew <= 8; crew += 1) {
      let rate = 0;
      for (let index = 0; index < crew; index += 1) rate += builderProgressShare(index);
      expect(rate, `crew of ${String(crew)}`).toBeCloseTo((crew + 2) / 3, 10);
    }
  });

  it('gives the first builder a full share and every joiner a third', () => {
    expect(builderProgressShare(0)).toBe(1);
    expect(builderProgressShare(1)).toBeCloseTo(1 / 3, 10);
    expect(builderProgressShare(7)).toBeCloseTo(1 / 3, 10);
  });

  it("runs a five-villager crew at (5 + 2) / 3 of one villager's rate, not 5x", () => {
    // Measured as PROGRESS PER TICK once the crew is on site, which is the
    // quantity the rule is about — wall-clock would fold in four extra
    // villagers' walking time and hide the curve behind arrival noise.
    function steadyRate(crewSize: number): number {
      const bridge = createSimulationBridge('multi-villager-construction-fixture');
      const crew = villagerIds(bridge).slice(0, crewSize);
      expect(crew).toHaveLength(crewSize);
      expect(bridge.selectUnitsByIds(crew)).toBe(true);
      expect(bridge.beginBuildingPlacement('house')).toBe(true);
      expect(bridge.confirmBuildingPlacement(HOUSE_ANCHOR.x, HOUSE_ANCHOR.y)).toBe(true);

      const progress = (): number => bridge.getEconomyState().buildings
        .find((b) => b.owner === 1 && b.buildingType === 'house')?.buildProgressTicks ?? 0;

      // Let every walker arrive: wait until the rate stops climbing.
      let best = 0;
      let settled = 0;
      let previous = progress();
      for (let tick = 0; tick < 2000 && settled < 20; tick += 1) {
        bridge.step(100);
        const now = progress();
        const rate = now - previous;
        previous = now;
        // `settled` only counts once work has started: the walk to the site
        // is 20+ ticks of zero rate and would otherwise end the sample there.
        if (rate > best + 1e-9) { best = rate; settled = 0; } else if (best > 0) settled += 1;
      }
      expect(best, `crew of ${String(crewSize)} never made progress`).toBeGreaterThan(0);
      return best;
    }

    const solo = steadyRate(1);
    const five = steadyRate(5);
    expect(solo).toBeCloseTo(1, 6);
    expect(five / solo).toBeCloseTo((5 + 2) / 3, 6);
  });
});
