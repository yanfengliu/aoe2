import { describe, expect, it } from 'vitest';

import { villagerCapForAge } from '../../src/game/simulation/ai';

// The AI's total villager count is hard-capped per age (`villagerCapForAge`).
// The old inline caps (Dark 6 / Feudal+Castle 14 / Imperial 50) starved the
// economy — with ~14 villagers through Castle Age the AI could not fund an army
// or age up efficiently, and it plateaued (AI-vs-AI grounding). The cap now
// scales toward AoE2-realistic counts.
//
// Never shrinking, not strictly growing (work 144 M2, the coordinator's
// decision 6, 2026-11-05). Strictly increasing caps were this AI's own
// invention, and DE's per-age rules do not follow them: DE trains to 29 in the
// Dark Age (`darkvills`, Promisory const.per 3384), in the Feudal Age until it
// can pay for the Castle Age with no count of its own (units.per 409-415), and
// under 50 in the Castle Age (478-486). A Feudal bound below the Dark Age's
// would stop a 29-villager seat from training in the Feudal Age at all, so the
// Feudal bound is the Castle Age's.
describe('villagerCapForAge', () => {
  it('never shrinks the villager cap from one age to the next, toward a real economy', () => {
    const dark = villagerCapForAge('dark-age');
    const feudal = villagerCapForAge('feudal-age');
    const castle = villagerCapForAge('castle-age');
    const imperial = villagerCapForAge('imperial-age');
    expect(dark).toBeLessThan(feudal);
    expect(feudal).toBeLessThanOrEqual(castle);
    expect(castle).toBeLessThan(imperial);
    // Castle Age must support a real economy — well past the old cap of 14.
    expect(castle).toBeGreaterThanOrEqual(30);
  });
});
