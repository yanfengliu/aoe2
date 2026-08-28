// Integration regression for the campaign-11 gather gridlock (the [high]
// conformance finding: villagers boxed beside buildings must still reach a
// resource and increase the food count). The fixture boxes a player-2-OWNED
// farm (tier-0) with trees so it is unreachable; reachable tier-1 berries sit
// farther east. Player 2's non-human villagers auto-assign to the tier-0 farm
// first (unreachable) — pre-fix they latch there forever and food stays flat;
// the fix reroutes them to the reachable berries so the food count rises.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('villager gather reroute off an unreachable resource (campaign-11 regression)', () => {
  it('villagers auto-assigned to a boxed-in tier-0 resource reroute to a reachable one and net positive food', () => {
    const bridge = createSimulationBridge('gather-unreachable-reroute-fixture');
    const eco0 = bridge.getEconomyState();

    const villagers = eco0.units.filter((u) => u.owner === 2 && u.unitType === 'villager');
    expect(villagers.length).toBe(3);
    // The boxed farm is unreachable and is the only tier-0 food, so pre-fix the
    // villagers never gather anything.
    const foodBefore = eco0.playerResources[2]?.food ?? 0;

    for (let i = 0; i < 800; i += 1) bridge.step(100); // §6.3 retune (v0.3.159): a berry carry now takes 320 gather ticks

    const eco1 = bridge.getEconomyState();
    const foodAfter = eco1.playerResources[2]?.food ?? 0;
    // Pre-fix: the food villagers latch on the unreachable farm, food flat.
    // Post-fix: they reroute to the reachable berries and deposit food.
    expect(foodAfter).toBeGreaterThan(foodBefore);

    // The reachable berries were actually gathered (the food villagers rerouted
    // to them). This is the clean discriminator: pre-fix the berries are
    // untouched. (A bare gathering-count check is not a discriminator here — a
    // villager whose spawn default is wood chops the ring trees pre-fix too.)
    const reachableBerryIds = eco0.resources
      .filter((r) => r.resourceType === 'berry-bush' && r.x >= 12)
      .map((r) => r.id);
    const berryTotal = (eco: ReturnType<typeof bridge.getEconomyState>) =>
      reachableBerryIds.reduce((sum, id) => sum + (eco.resources.find((r) => r.id === id)?.amount ?? 0), 0);
    expect(berryTotal(eco1)).toBeLessThan(berryTotal(eco0));
  }, 60_000);
});
