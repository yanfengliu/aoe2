// The AI crews a big building (2026-09-02). Until DE build times landed, an
// AI put exactly ONE villager on everything it built and nobody could tell:
// the old Wonder took 1200 ticks, so one builder finished it inside any test
// budget. At DE's 35,030 ticks a solo builder needs 58 minutes of game time —
// the ai-wonder-fixture's 42 idle villagers watched one of their own build it,
// and the AI could never win by Wonder at all.
//
// DE's answer, and every human's, is a crew. The rule under test is the
// CLASS — a long build attracts more builders, a short one does not — not the
// Wonder specifically, so a Town Center gets a crew and a House does not.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Bridge = ReturnType<typeof createSimulationBridge>;

/** Progress ticks the site gained per simulation tick, averaged over `window`. */
function buildRate(bridge: Bridge, owner: number, buildingType: string, window: number): number {
  const site = () => bridge.getEconomyState().buildings
    .find((b) => b.owner === owner && b.buildingType === buildingType && !b.isComplete);
  const before = site()?.buildProgressTicks ?? 0;
  for (let i = 0; i < window; i += 1) bridge.step(100);
  const after = site()?.buildProgressTicks ?? before;
  return (after - before) / window;
}

describe('AI construction crews', () => {
  it('puts a real crew on a Wonder rather than one villager', () => {
    const bridge = createSimulationBridge('ai-wonder-fixture');
    // Let the AI place the Wonder and gather a crew onto it.
    let placed = false;
    for (let tick = 0; tick < 1_200 && !placed; tick += 1) {
      bridge.step(100);
      placed = bridge.getEconomyState().buildings
        .some((b) => b.owner === 2 && b.buildingType === 'wonder');
    }
    expect(placed, 'AI never placed a Wonder').toBe(true);
    for (let tick = 0; tick < 600; tick += 1) bridge.step(100);

    const rate = buildRate(bridge, 2, 'wonder', 300);
    // One builder is exactly 1.0 progress per tick. AoE2's curve makes a crew
    // of n worth (n + 2) / 3, so anything above 2 means at least 5 builders.
    expect(rate, `wonder build rate ${String(rate)} — a lone builder is 1.0`)
      .toBeGreaterThan(2);
  }, 180_000);
});
