// Definitive Edition's game speeds (spec §4.5, work 149): its four presets,
// their multipliers, its default, and the steps its numpad keys take.
//
// Sources (plan 149): the names are the install's strings 13101 Slow, 13126
// Casual, 13102 Normal and 13103 Fast; the multipliers 1.0, 1.5, 1.7 and 2.0
// and the Normal default are community-documented (forum t/84298, t/267350,
// Steam 3821912677678091112 and 4148446223173923942). The keys are
// hotkeys.json's SPEED_UP (VK_ADD) and SPEED_DOWN (VK_SUBTRACT), which stop at
// Slow and Fast.
//
// BOUNDS: pure tables and parsing. That the lobby's row, Start Match, the real
// numpad keys and the readout reach a running match is
// `tests/browser/game-speed.spec.ts`; that a match runs at the multiplier and
// is the same match at every speed is `gameSpeedPace.test.ts`.

import { describe, expect, it } from 'vitest';

import { parseSpeedParam } from '../../src/app/bootstrap/matchOptionParams';
import { setupQueryString, type SetupChoices } from '../../src/app/bootstrap/setupScreen';
import {
  DEFAULT_GAME_SPEED,
  formatGameSpeed,
  GAME_SPEED_LADDER,
  GAME_SPEEDS,
  stepGameSpeed,
} from '../../src/game/simulation/matchOptions';

describe("DE's speed presets", () => {
  it('are Slow, Casual, Normal and Fast, slowest first, at 1.0x, 1.5x, 1.7x and 2.0x', () => {
    expect(GAME_SPEED_LADDER).toEqual(['slow', 'casual', 'normal', 'fast']);
    expect(GAME_SPEED_LADDER.map((id) => [GAME_SPEEDS[id].label, GAME_SPEEDS[id].multiplier])).toEqual([
      ['Slow', 1.0], ['Casual', 1.5], ['Normal', 1.7], ['Fast', 2.0],
    ]);
  });

  it("start on DE's default, Normal", () => {
    expect(DEFAULT_GAME_SPEED).toBe('normal');
    expect(GAME_SPEEDS[DEFAULT_GAME_SPEED].multiplier).toBe(1.7);
  });

  it('are read back as the bracketed multiplier the time display shows', () => {
    expect(GAME_SPEED_LADDER.map((id) => formatGameSpeed(GAME_SPEEDS[id].multiplier))).toEqual([
      '(1.0)', '(1.5)', '(1.7)', '(2.0)',
    ]);
  });
});

describe('the ?speed= parameter', () => {
  it('takes the four names, in any case', () => {
    expect(parseSpeedParam('http://x/?speed=slow')).toBe(1);
    expect(parseSpeedParam('http://x/?speed=casual')).toBe(1.5);
    expect(parseSpeedParam('http://x/?speed=normal')).toBe(1.7);
    expect(parseSpeedParam('http://x/?speed=Fast')).toBe(2);
  });

  it('runs a URL without it, or with anything else, at Slow (1.0x), the rate the data is defined at', () => {
    expect(parseSpeedParam('http://x/?seed=aoe2-prototype')).toBe(1);
    expect(parseSpeedParam('http://x/?speed=')).toBe(1);
    expect(parseSpeedParam('http://x/?speed=ludicrous')).toBe(1);
    expect(parseSpeedParam('http://x/?speed=1.7')).toBe(1);
  });

  it('is what the lobby writes for each preset, and a Slow start leaves it out', () => {
    const choices: SetupChoices = {
      seed: 'aoe2-prototype', players: 2, civilization: 'Britons', teams: 'ffa', difficulty: 'standard',
      resources: 'standard', victory: 'standard', speed: 'slow', popCap: 200,
    };
    for (const id of GAME_SPEED_LADDER) {
      const query = setupQueryString({ ...choices, speed: id });
      expect(new URLSearchParams(query).get('speed'), id).toBe(id === 'slow' ? null : id);
      expect(parseSpeedParam(`http://x/?${query}`), id).toBe(GAME_SPEEDS[id].multiplier);
    }
  });
});

describe("the numpad's speed keys", () => {
  it('step up through every preset and hold at Fast', () => {
    const seen: number[] = [];
    let speed = 1;
    for (let press = 0; press < 5; press += 1) seen.push(speed = stepGameSpeed(speed, 1));
    expect(seen).toEqual([1.5, 1.7, 2, 2, 2]);
  });

  it('step down through every preset and hold at Slow', () => {
    const seen: number[] = [];
    let speed = 2;
    for (let press = 0; press < 5; press += 1) seen.push(speed = stepGameSpeed(speed, -1));
    expect(seen).toEqual([1.7, 1.5, 1, 1, 1]);
  });

  it('step from a speed between presets to the next preset that way', () => {
    expect(stepGameSpeed(1.6, 1)).toBe(1.7);
    expect(stepGameSpeed(1.6, -1)).toBe(1.5);
    expect(stepGameSpeed(0.5, 1)).toBe(1);
    expect(stepGameSpeed(0.5, -1)).toBe(1);
    expect(stepGameSpeed(3, -1)).toBe(2);
    expect(stepGameSpeed(3, 1)).toBe(2);
  });
});
