import { describe, expect, it } from 'vitest';

import {
  MAX_PLAYERS,
  desaturate,
  ownerTint,
  rotateHue,
} from '../../src/game/simulation/playerColors';
import { buildingTint } from '../../src/game/simulation/prototypeBuildingRules';
import { unitTint } from '../../src/game/simulation/prototypeUnitRules';

// Every tint in this build was a PAIR — `human` and `enemy` — so owners 2, 3
// and 4 all came out the same shade of pink. The spec's in-scope list is "AI
// opponents" and "optional AI allies", so two sides you cannot tell apart is a
// gap rather than a simplification.

const VILLAGER = { human: 0xf3e2b7, enemy: 0xf0b8b8 };

describe('ownerTint', () => {
  it('leaves the two established owners exactly as they were', () => {
    // The whole point of rotating from the ENEMY shade: every screenshot,
    // characterization hash and visual test taken of a 1v1 still holds.
    expect(ownerTint(VILLAGER, 1)).toBe(VILLAGER.human);
    expect(ownerTint(VILLAGER, 2)).toBe(VILLAGER.enemy);
  });

  it('gives every owner up to eight a colour of its own', () => {
    const seen = new Map<number, number>();
    for (let owner = 1; owner <= MAX_PLAYERS; owner += 1) {
      seen.set(owner, ownerTint(VILLAGER, owner));
    }
    expect(new Set(seen.values()).size).toBe(MAX_PLAYERS);
  });

  it('keeps neighbouring owners far enough apart to tell apart', () => {
    // Channel distance, not a perceptual metric — but a pair that differs by
    // under 24 across all three channels is the pink-versus-pink problem again.
    const distance = (a: number, b: number) => (
      Math.abs(((a >>> 16) & 0xff) - ((b >>> 16) & 0xff))
      + Math.abs(((a >>> 8) & 0xff) - ((b >>> 8) & 0xff))
      + Math.abs((a & 0xff) - (b & 0xff))
    );
    for (let owner = 2; owner < MAX_PLAYERS; owner += 1) {
      const here = ownerTint(VILLAGER, owner);
      const next = ownerTint(VILLAGER, owner + 1);
      expect(distance(here, next), `owners ${owner} and ${owner + 1}`).toBeGreaterThan(24);
    }
  });

  it('wraps rather than collapsing past eight players', () => {
    expect(ownerTint(VILLAGER, MAX_PLAYERS + 1)).toBe(ownerTint(VILLAGER, 1));
    expect(ownerTint(VILLAGER, MAX_PLAYERS + 2)).toBe(ownerTint(VILLAGER, 2));
  });
});

describe('the colour maths', () => {
  it('rotates a hue while keeping the colour bright', () => {
    const rotated = rotateHue(0xf0b8b8, 120);
    expect(rotated).not.toBe(0xf0b8b8);
    const luma = (tint: number) => (
      ((tint >>> 16) & 0xff) * 0.213 + ((tint >>> 8) & 0xff) * 0.715 + (tint & 0xff) * 0.072
    );
    expect(luma(rotated)).toBeCloseTo(luma(0xf0b8b8), 0);
  });

  it('leaves a grey alone, whatever the rotation', () => {
    expect(rotateHue(0x808080, 90)).toBe(0x808080);
    expect(rotateHue(0x808080, 200)).toBe(0x808080);
  });

  it('rotating by nothing changes nothing', () => {
    expect(rotateHue(0xf0b8b8, 0)).toBe(0xf0b8b8);
  });

  it('desaturates to a grey of the same brightness', () => {
    const grey = desaturate(0xf0b8b8);
    expect((grey >>> 16) & 0xff).toBe(grey & 0xff);
    expect((grey >>> 8) & 0xff).toBe(grey & 0xff);
  });
});

describe('the tint the world actually paints', () => {
  it('gives a third player its own units and buildings', () => {
    expect(unitTint('villager', 3)).not.toBe(unitTint('villager', 2));
    expect(unitTint('knight', 3)).not.toBe(unitTint('knight', 2));
    expect(buildingTint('town-center', 3, true)).not.toBe(buildingTint('town-center', 2, true));
  });

  it('does not disturb the colours a 1v1 already had', () => {
    for (const unitType of ['villager', 'knight', 'archer', 'monk'] as const) {
      expect(unitTint(unitType, 1)).not.toBe(unitTint(unitType, 2));
    }
  });
});
