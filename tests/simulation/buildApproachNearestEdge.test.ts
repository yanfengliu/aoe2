// A builder walks to the NEAREST free edge of its site (2026-09-02, play-test
// finding F2). `findMovementPathToCandidates` returned the first candidate in
// ENUMERATION order that happened to be reachable, so a villager two tiles west
// of a House site walked around to the east edge: measured on the boot map,
// villager 2205 at (6,8) ordered to build a House at (7,6) walked
// (2,8)->(2,5)->(5,4)->(9,5)->(9,6) and took 22 s of game time to lay the first
// hammer blow, against DE's second or so.
//
// The same defect capped every construction CREW at one working builder — 37
// AI villagers ordered onto one Wonder all queued for the single approach cell
// the enumeration named first — so this is the ordering rule, not a House fix.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Bridge = ReturnType<typeof createSimulationBridge>;

const HOUSE = { x: 7, y: 6 };

function nearestVillagerTo(bridge: Bridge, target: { x: number; y: number }) {
  return bridge.getEconomyState().units
    .filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
    .sort((a, b) =>
      (Math.abs(a.x - target.x) + Math.abs(a.y - target.y))
      - (Math.abs(b.x - target.x) + Math.abs(b.y - target.y)))[0];
}

describe('build approach', () => {
  it('starts a House two tiles away within seconds, not half a minute', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const villager = nearestVillagerTo(bridge, HOUSE);
    expect(villager).toBeDefined();
    const walk = Math.abs(villager!.x - HOUSE.x) + Math.abs(villager!.y - HOUSE.y);
    expect(walk, 'fixture moved: pick a villager near the site').toBeLessThanOrEqual(4);

    expect(bridge.selectUnitsByIds([villager!.id])).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(HOUSE.x, HOUSE.y)).toBe(true);

    const progress = (): number => bridge.getEconomyState().buildings
      .find((b) => b.owner === 1 && b.buildingType === 'house')?.buildProgressTicks ?? 0;

    let startedAt = -1;
    for (let tick = 0; tick < 400 && startedAt < 0; tick += 1) {
      bridge.step(100);
      if (progress() > 0) startedAt = tick;
    }
    // A villager walks 0.8 tiles/s (§12.4.2), so ~4 tiles is ~5 s = 50 ticks.
    // The observed defect took 220. 100 ticks leaves room for a step around a
    // corner without admitting a lap of the building.
    expect(startedAt, `first build tick at ${String(startedAt)}`).toBeGreaterThanOrEqual(0);
    expect(startedAt).toBeLessThan(100);
  }, 60_000);
});
