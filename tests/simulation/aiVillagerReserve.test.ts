import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

// v0.1.90: the demand-side half of getting the AI to Castle (the supply-side
// half was the v0.1.89 food-priority allocation). Grounded by replaying the
// default-seed corpus: even after the AI gathers food-first, its food stays
// pinned low through Feudal because VILLAGER training drained the food reserved
// for the age-up — the military-training gate respects the age-up reserve
// (`canAffordWithReserve`) but the villager gate used a plain `canAfford`. This
// makes villager training respect the same reserve, so the banked age-up food
// is not immediately re-spent on more villagers.
//
// The `ai-villager-reserve-fixture` isolates exactly this: owner 2 sits in the
// Dark Age with barracks + mill (2 Feudal prerequisites, so the age-up reserve
// {food:500} is active), 250 food (trainable but only 50% of the 500 age-up
// cost, below the 60% `savingForAgeUp` latch so that latch does NOT already
// suppress training), 3 villagers below the Dark cap, and NO food resource on
// the map (zero gather income). Any food change is therefore purely villager
// training. Without the fix the AI trains villagers until the 250 food is gone;
// with it the reserve holds the food intact.

describe('AI villager-reserve — banks age-up food instead of draining it on villagers (v0.1.90)', () => {
  it('holds the reserved food intact instead of training it away', () => {
    const bridge = createSimulationBridge('ai-villager-reserve-fixture');
    const startFood = bridge.getEconomyState().playerResources[2]?.food ?? 0;
    // Sanity: the fixture puts food where the reserve — not the savingForAgeUp
    // latch — is the only thing that can hold it (250 = 50% of the 500 cost).
    expect(startFood).toBe(250);

    for (let i = 0; i < 700; i += 1) {
      bridge.step(100);
    }

    const eco = bridge.getEconomyState();
    const endFood = eco.playerResources[2]?.food ?? 0;
    const villagers = eco.units.filter(
      (u) => u.owner === 2 && u.unitType === 'villager',
    ).length;
    const diagnostic = `startFood=${startFood} endFood=${endFood} villagers=${villagers}`;

    // The reserved food is HELD — no income exists, and villager training must
    // respect the {food:500} age-up reserve, so nothing spends the 250 food.
    expect(endFood, diagnostic).toBe(startFood);
    // And no extra villagers were trained past the 3 the fixture seeded.
    expect(villagers, diagnostic).toBe(3);
  }, 90_000);
});
