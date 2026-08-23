// The AI's economy froze for the last thirteen thousand ticks of a measured
// 30000-tick match because six villagers held one unreachable sheep forever:
// the reachability-aware recovery gave up and left them idle, and the ordinary
// idle→assign — which does not check reachability — handed the same sheep
// straight back. A villager with no reachable food must take other work, which
// is what `assignIdleGatherer` exists to do and what a real player does.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('a villager with no reachable food takes other work', () => {
  it('gives up on a marooned sheep and chops wood instead', () => {
    const bridge = createSimulationBridge('gather-island-food-fixture');
    const before = bridge.getEconomyState();

    const villagers = before.villagers.filter((v) => v.owner === 2);
    expect(villagers).toHaveLength(2);
    // Both start on the food role, so nothing here chops wood by default.
    expect(villagers.every((v) => v.desiredResource === 'food')).toBe(true);
    const woodBefore = before.playerResources[2]?.wood ?? 0;
    const treesBefore = before.resources
      .filter((r) => r.resourceType === 'tree')
      .reduce((sum, r) => sum + r.amount, 0);

    for (let i = 0; i < 400; i += 1) bridge.step(100);

    const after = bridge.getEconomyState();
    // The discriminator: wood was actually delivered. Pre-fix both villagers
    // stand still holding the sheep and the stockpile never moves.
    expect(after.playerResources[2]?.wood ?? 0).toBeGreaterThan(woodBefore);
    const treesAfter = after.resources
      .filter((r) => r.resourceType === 'tree')
      .reduce((sum, r) => sum + r.amount, 0);
    expect(treesAfter).toBeLessThan(treesBefore);
    // And the sheep is untouched — it was never reachable.
    const sheepAfter = after.resources.find((r) => r.resourceType === 'sheep');
    expect(sheepAfter?.amount).toBe(before.resources.find((r) => r.resourceType === 'sheep')?.amount);
  }, 60_000);
});
