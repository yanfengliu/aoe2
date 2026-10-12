// The tick-chunk split keeps every tick and every check of the one long case it
// replaces (tests/replay/tickChunks.ts, work 123). Two halves: the real vitest
// registration runs setup once, every tick in order across the cases, and the
// whole-run checks once after the last tick; and, with the cases captured
// instead of registered, a case run without the ones before it fails by name
// rather than comparing a different prefix and passing.
import { describe, expect, it } from 'vitest';

import { describeTickChunks, type ChunkRegistrar } from './tickChunks';

const seen: string[] = [];
describeTickChunks('ten ticks in cases of four', 10, 4, {
  setup: () => { seen.push('setup'); return { ticks: 0 }; },
  tick: (run, tick) => { seen.push(`tick ${String(tick)}`); run.ticks++; },
  finish: (run) => { seen.push(`finish after ${String(run.ticks)}`); },
});

describe('tick chunks', () => {
  it('ran setup once, all ten ticks in order across three cases, and the whole-run checks once, last', () => {
    expect(seen).toEqual([
      'setup',
      ...Array.from({ length: 10 }, (_, tick) => `tick ${String(tick)}`),
      'finish after 10',
    ]);
  });

  function capture(ticks: number, chunk: number) {
    const cases: Array<{ name: string; fn: () => void }> = [];
    let setup: (() => void) | undefined;
    const registrar: ChunkRegistrar = {
      describe: (_name, body) => body(),
      beforeAll: (fn) => { setup = fn; },
      it: (name, fn) => { cases.push({ name, fn }); },
    };
    const ran: number[] = [];
    describeTickChunks('captured', ticks, chunk, { setup: () => ({}), tick: (_run, tick) => { ran.push(tick); }, finish: () => undefined }, registrar);
    return { cases, setup: setup!, ran };
  }

  it('names each case by its ticks, the last one carrying the whole-run checks', () => {
    expect(capture(600, 150).cases.map((entry) => entry.name)).toEqual([
      'ticks 1-150 of 600', 'ticks 151-300 of 600', 'ticks 301-450 of 600', 'ticks 451-600 of 600, then the whole-run checks',
    ]);
    expect(capture(700, 300).cases.map((entry) => entry.name)).toEqual([
      'ticks 1-300 of 700', 'ticks 301-600 of 700', 'ticks 601-700 of 700, then the whole-run checks',
    ]);
  });

  it('fails a case run without the cases before it, naming the ticks it needed, and runs none of its ticks', () => {
    const { cases, setup, ran } = capture(12, 4);
    setup();
    expect(() => cases[1]!.fn()).toThrow('ticks 5-8 continue the same worlds, so ticks 1-4 must have completed first');
    expect(ran).toEqual([]);
  });

  it('fails every later case after a case stopped part-way, instead of continuing from the wrong tick', () => {
    const cases: Array<() => void> = [];
    let setup = () => undefined as void;
    const registrar: ChunkRegistrar = { describe: (_name, body) => body(), beforeAll: (fn) => { setup = fn; }, it: (_name, fn) => { cases.push(fn); } };
    describeTickChunks('breaks at tick 2', 9, 3, {
      setup: () => ({}),
      tick: (_run, tick) => { if (tick === 2) throw new Error('state differs at tick 3'); },
      finish: () => undefined,
    }, registrar);
    setup();
    expect(() => cases[0]!()).toThrow('state differs at tick 3');
    expect(() => cases[1]!()).toThrow('so ticks 1-3 must have completed first');
    expect(() => cases[2]!()).toThrow('so ticks 1-6 must have completed first');
  });

  it('fails a case run again after it stopped part-way, as a retry would run it', () => {
    const cases: Array<() => void> = [];
    let setup = () => undefined as void;
    const registrar: ChunkRegistrar = { describe: (_name, body) => body(), beforeAll: (fn) => { setup = fn; }, it: (_name, fn) => { cases.push(fn); } };
    let throwOnce = true;
    describeTickChunks('breaks at its first tick once', 8, 4, {
      setup: () => ({}),
      tick: (_run, tick) => { if (tick === 0 && throwOnce) { throwOnce = false; throw new Error('state differs at tick 1'); } },
      finish: () => undefined,
    }, registrar);
    setup();
    expect(() => cases[0]!()).toThrow('state differs at tick 1');
    expect(() => cases[0]!()).toThrow('must start from the worlds the setup just built, and an earlier run of them stopped part-way');
    expect(() => cases[1]!()).toThrow('so ticks 1-4 must have completed first');
  });

  it('fails a case whose setup never ran', () => {
    const { cases } = capture(4, 4);
    expect(() => cases[0]!.fn()).toThrow('the worlds were not built');
  });

  it('refuses a split it cannot make', () => {
    expect(() => capture(600, 0)).toThrow('positive whole tick and chunk counts');
    expect(() => capture(10.5, 4)).toThrow('positive whole tick and chunk counts');
  });
});
