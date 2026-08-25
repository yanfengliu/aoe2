// The AI sends tribute to a starving ally (spec section 6.8, AoE2 team play):
// a rich allied AI with a completed Market tops up an ally that is nearly dry,
// paying the 30% fee itself, through the same recorded tribute.send channel a
// human uses.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

describe('AI tribute to a poor ally', () => {
  it('the rich allied AI sends food; the human stockpile jumps by the chunk', () => {
    const bridge = createSimulationBridge('ai-tribute-fixture');
    const food = (owner: number): number => bridge.getEconomyState().playerResources[owner]!.food;
    expect(food(1)).toBe(50);
    expect(
      stepBridgeUntil(bridge, () => food(1) >= 150, { maxSteps: 900 }),
    ).toBe(true);
  });

  it('an ENEMY in the same need gets nothing', () => {
    const bridge = createSimulationBridge('ai-tribute-fixture');
    const food = (owner: number): number => bridge.getEconomyState().playerResources[owner]!.food;
    // Owner 3 (team 2) is as poor as the human but hostile - starts at the
    // standard fixture default and must never be topped up by owner 2.
    const enemyStart = food(3);
    for (let index = 0; index < 900; index += 1) bridge.step(100);
    expect(food(3)).toBeLessThanOrEqual(enemyStart);
  });
});
