import { describe, expect, it } from 'vitest';

import {
  parsePlaytestLlmArgs,
  PlaytestLlmArgError,
} from '../../src/game/playtest/playtestLlmArgs';

// Full-review iter-2 H8: the safety-critical numeric validation (a bad
// --cost-budget/--max-ticks used to become NaN and silently disable the spend
// and run bounds) now has a real regression test.
const argv = (...flags: string[]): string[] => ['node', 'playtest-llm.mjs', ...flags];

describe('parsePlaytestLlmArgs (full-review H8)', () => {
  it('parses valid flags and honours defaults', () => {
    const a = parsePlaytestLlmArgs(argv('--max-ticks', '1000', '--cost-budget', '2.5', '--owners', '1,2'));
    expect(a.maxTicks).toBe(1000);
    expect(a.costBudget).toBe(2.5);
    expect(a.owners).toEqual([1, 2]);
    const d = parsePlaytestLlmArgs(argv());
    expect(d.maxTicks).toBe(5000);
    expect(d.costBudget).toBe(5.0);
    expect(d.owners).toEqual([1]);
    expect(d.provider).toBeNull();
  });

  it('rejects a non-finite cost budget instead of silently disabling the bound', () => {
    expect(() => parsePlaytestLlmArgs(argv('--cost-budget', 'nope'))).toThrow(PlaytestLlmArgError);
    expect(() => parsePlaytestLlmArgs(argv('--cost-budget', 'nope'))).toThrow(/finite number >= 0/);
    expect(() => parsePlaytestLlmArgs(argv('--cost-budget', '-1'))).toThrow(/>= 0/);
  });

  it('rejects a non-integer / out-of-range tick flag', () => {
    expect(() => parsePlaytestLlmArgs(argv('--max-ticks', '3.5'))).toThrow(/integer >= 1/);
    expect(() => parsePlaytestLlmArgs(argv('--max-ticks', '0'))).toThrow(/integer >= 1/);
    expect(() => parsePlaytestLlmArgs(argv('--decision-interval', 'abc'))).toThrow(PlaytestLlmArgError);
  });

  it('rejects a missing flag value, an unknown flag, and a bad provider', () => {
    expect(() => parsePlaytestLlmArgs(argv('--seed'))).toThrow(/requires a value/);
    expect(() => parsePlaytestLlmArgs(argv('--cost-budget'))).toThrow(/finite number/);
    expect(() => parsePlaytestLlmArgs(argv('--bogus'))).toThrow(/unknown argument/);
    expect(() => parsePlaytestLlmArgs(argv('--provider', 'x'))).toThrow(/must be 'claude-code' or 'api'/);
  });
});
