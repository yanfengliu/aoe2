import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { ageUpReserveCost, canAffordWithReserve } from '../../src/game/simulation/ai';

// campaign-11 finding (c): the AI used to stall in the Dark Age — once it had
// 2 Feudal prerequisites and 500 food it kept training a Militia every time
// food crossed 500 (a Militia is pushed BEFORE the age-up research in the same
// decision cycle; 60 + 500 = 560 > 510, and the FIFO handler spent the Militia
// first), so the feudal-age research silently no-op'd and the AI never
// advanced. The fix RESERVES the next age-up's cost so military trains only
// from the surplus above it. These are the reserve helpers + an end-to-end
// regression on the ai-age-up-priority-fixture.

describe('AI age-up priority — reserve helpers (campaign-11 finding c)', () => {
  it('ageUpReserveCost returns the next age cost only when the AI qualifies', () => {
    // Dark Age + prerequisites met → reserve the 500-food Feudal cost.
    expect(ageUpReserveCost('dark-age', true)).toEqual({ food: 500 });
    // Prerequisites NOT met → empty reserve (train military freely).
    expect(ageUpReserveCost('dark-age', false)).toEqual({});
    // Feudal → Castle has a cost when eligible; Imperial has no next age.
    expect(Object.keys(ageUpReserveCost('feudal-age', true)).length).toBeGreaterThan(0);
    expect(ageUpReserveCost('imperial-age', true)).toEqual({});
  });

  it('canAffordWithReserve requires the cost ON TOP OF the reserve', () => {
    const stock = { food: 510, wood: 0, gold: 100, stone: 0 };
    const militia = { food: 60, gold: 20 };
    const feudalReserve = { food: 500 };
    // 510 food covers a 60-food Militia on its own...
    expect(canAffordWithReserve(stock, militia, {})).toBe(true);
    // ...but NOT a Militia on top of the reserved 500 food (60 + 500 > 510).
    expect(canAffordWithReserve(stock, militia, feudalReserve)).toBe(false);
    // A richer stockpile clears both the unit and the reserve.
    expect(
      canAffordWithReserve({ food: 600, wood: 0, gold: 100, stone: 0 }, militia, feudalReserve),
    ).toBe(true);
  });
});

describe('AI age-up priority — end-to-end (campaign-11 finding c)', () => {
  it('commits the age-up research instead of starving it on military', () => {
    // Ground-truth campaign-11: the AI (owner 2) sat at 510 food with a
    // Barracks + Mill (2 Feudal prerequisites) and an idle Town Center yet
    // never left the Dark Age for 3000 ticks. On the priority fixture (520
    // food, deep gold, no food income) the AI is permanently stuck in the Dark
    // Age WITHOUT the fix; WITH it, military yields to the fundable age-up and
    // the AI reaches Feudal (research is 1300 ticks, so 2500 is comfortable).
    const bridge = createSimulationBridge('ai-age-up-priority-fixture');
    let reachedFeudal = false;
    for (let i = 0; i < 2_500; i += 1) {
      bridge.step(100);
      if (bridge.getEconomyState().ages[2] === 'feudal-age') {
        reachedFeudal = true;
        break;
      }
    }
    const eco = bridge.getEconomyState();
    const aiMilitia = eco.units.filter(
      (u) => u.owner === 2 && u.unitType === 'militia',
    ).length;
    const diagnostic =
      `age=${eco.ages[2]} food=${eco.playerResources[2]?.food} militia=${aiMilitia}`;
    expect(reachedFeudal, diagnostic).toBe(true);
  }, 120_000);
});
