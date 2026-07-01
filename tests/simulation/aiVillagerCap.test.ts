import { describe, expect, it } from 'vitest';

import { villagerCapForAge } from '../../src/game/simulation/ai';

// The AI's total villager count is hard-capped per age (`villagerCapForAge`).
// The old inline caps (Dark 6 / Feudal+Castle 14 / Imperial 50) starved the
// economy — with ~14 villagers through Castle Age the AI could not fund an army
// or age up efficiently, and it plateaued (AI-vs-AI grounding). The cap now
// scales toward AoE2-realistic counts.
describe('villagerCapForAge', () => {
  it('grows the villager cap monotonically across ages toward a real economy', () => {
    const dark = villagerCapForAge('dark-age');
    const feudal = villagerCapForAge('feudal-age');
    const castle = villagerCapForAge('castle-age');
    const imperial = villagerCapForAge('imperial-age');
    expect(dark).toBeLessThan(feudal);
    expect(feudal).toBeLessThan(castle);
    expect(castle).toBeLessThan(imperial);
    // Castle Age must support a real economy — well past the old cap of 14.
    expect(castle).toBeGreaterThanOrEqual(30);
  });
});
