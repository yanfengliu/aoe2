// The interleaved A/B instrument (scripts/aiTickAb.mjs) reports what it
// measured: the gate for the 2026-09-25 register entry, where "did v0.3.235
// make the simulation slower?" had no tool that could answer it on a shared
// machine and was answered by a one-off probe.
//
// What can go wrong with such an instrument without anyone noticing is its
// arithmetic, not its clock: a ratio taken the wrong way up reads a slowdown
// as a speed-up; a loop that always runs the same tree first charges that
// tree for whatever the machine did at the start of every chunk; a warm-up
// chunk left in the ratios charges the first-loaded tree for compiling shared
// engine code; and a state comparison that is never made lets a change that
// alters the match report the new match's cost as the code's. So the arms
// here are stubs on a FAKE clock, whose costs are exact, and every case checks
// one of those four.
//
// BOUND: this proves the instrument's bookkeeping, not that a real run is
// quiet enough to trust. The noise floor of real runs is in the script's
// header, measured by running one commit against itself.

import { describe, expect, it } from 'vitest';

import { runInterleaved, summarize } from '../../scripts/aiTickAb.mjs';

interface StubArm {
  label: string;
  step(n: number): number;
  fingerprint(): string;
}

/** A fake clock and two stub arms whose ticks cost `costs[i]` ms each. The
 *  first chunk of arm A costs `firstChunkExtra` more, like a cold JIT. */
function stubs(costs: [number, number], options: {
  firstChunkExtra?: number;
  divergeAtTick?: number;
  resolveAtTick?: number;
} = {}) {
  let nowMs = 0;
  const calls: string[] = [];
  const ticks = [0, 0];
  const arms: StubArm[] = [0, 1].map((i) => ({
    label: i === 0 ? 'A' : 'B',
    step(n: number) {
      calls.push(i === 0 ? 'A' : 'B');
      const room = options.resolveAtTick === undefined ? n : Math.max(0, Math.min(n, options.resolveAtTick - ticks[i]!));
      nowMs += room * costs[i]! + (i === 0 && ticks[i] === 0 ? options.firstChunkExtra ?? 0 : 0);
      ticks[i]! += room;
      return room;
    },
    fingerprint() {
      const diverged = i === 1 && options.divergeAtTick !== undefined && ticks[i]! >= options.divergeAtTick;
      return `${ticks[i]}|${diverged ? 'other' : 'same'}`;
    },
  }));
  return {
    arms,
    calls,
    clock: () => ({ wallMs: nowMs, cpuMs: nowMs }),
    busyCores: () => 3,
  };
}

describe('aiTickAb: the ratio is the second tree over the first', () => {
  it('reads a tree that costs 1.5x per tick as 1.5, on wall time and on CPU time', () => {
    const { arms, clock, busyCores } = stubs([2, 3]);
    const summary = summarize(runInterleaved({ arms, chunkTicks: 100, maxTicks: 1000, clock, busyCores }));
    expect(summary.wallRatioTotal).toBeCloseTo(1.5, 10);
    expect(summary.wallRatioMedian).toBeCloseTo(1.5, 10);
    expect(summary.cpuRatioTotal).toBeCloseTo(1.5, 10);
    expect(summary.cpuMsPerTick[0]).toBeCloseTo(2, 10);
    expect(summary.cpuMsPerTick[1]).toBeCloseTo(3, 10);
  });

  it('reads two trees of equal cost as 1.0', () => {
    const { arms, clock, busyCores } = stubs([2, 2]);
    const summary = summarize(runInterleaved({ arms, chunkTicks: 100, maxTicks: 1000, clock, busyCores }));
    expect(summary.wallRatioTotal).toBeCloseTo(1, 10);
    expect(summary.cpuRatioMedian).toBeCloseTo(1, 10);
  });
});

describe('aiTickAb: interleaving', () => {
  it('alternates which tree goes first in each chunk, so neither is always first', () => {
    const { arms, calls, clock, busyCores } = stubs([1, 1]);
    const result = runInterleaved({ arms, chunkTicks: 100, maxTicks: 400, clock, busyCores });
    expect(calls).toEqual(['A', 'B', 'B', 'A', 'A', 'B', 'B', 'A']);
    expect(result.rows.map((row: { order: string[] }) => row.order.join(''))).toEqual(['AB', 'BA', 'AB', 'BA']);
  });

  it('leaves the first chunk, which carries each tree\'s warm-up, out of the ratios', () => {
    // A 5,000 ms cold start on tree A would read as B being 0.2x A if it counted.
    const { arms, clock, busyCores } = stubs([2, 2], { firstChunkExtra: 5000 });
    const summary = summarize(runInterleaved({ arms, chunkTicks: 100, maxTicks: 1000, clock, busyCores }));
    expect(summary.steadyChunks).toBe(9);
    expect(summary.wallRatioTotal).toBeCloseTo(1, 10);
  });

  it('hands each chunk to onChunk as it finishes, so a 45,000-tick run shows progress', () => {
    const { arms, clock, busyCores } = stubs([1, 1]);
    const heard: number[] = [];
    const result = runInterleaved({
      arms, chunkTicks: 100, maxTicks: 300, clock, busyCores, onChunk: (row: { chunk: number }) => heard.push(row.chunk),
    });
    expect(heard).toEqual([0, 1, 2]);
    expect(result.rows).toHaveLength(3);
  });

  it('stops when a match resolves, and counts only the ticks that ran', () => {
    const { arms, clock, busyCores } = stubs([1, 1], { resolveAtTick: 250 });
    const result = runInterleaved({ arms, chunkTicks: 100, maxTicks: 1000, clock, busyCores });
    expect(result.rows).toHaveLength(3);
    expect(summarize(result).ticks).toBe(250);
  });
});

describe('aiTickAb: the two trees must be playing the same match', () => {
  it('names the first chunk whose states differ', () => {
    const { arms, clock, busyCores } = stubs([1, 1], { divergeAtTick: 300 });
    const result = runInterleaved({ arms, chunkTicks: 100, maxTicks: 600, clock, busyCores });
    expect(result.divergedAt).toBe(2);
    expect(summarize(result).lockstep).toBe('DIVERGED at chunk 2');
  });

  it('says so when they never differ', () => {
    const { arms, clock, busyCores } = stubs([1, 1]);
    expect(summarize(runInterleaved({ arms, chunkTicks: 100, maxTicks: 600, clock, busyCores })).lockstep)
      .toBe('identical at every chunk');
  });

  it('refuses anything but two arms', () => {
    const { arms, clock, busyCores } = stubs([1, 1]);
    expect(() => runInterleaved({ arms: [arms[0]!], chunkTicks: 100, maxTicks: 100, clock, busyCores }))
      .toThrow('runInterleaved compares exactly two arms; got 1');
  });

  it('refuses chunk sizes that would stall or skip the measurement, and invalid tick bounds', () => {
    const { arms, clock, busyCores } = stubs([1, 1]);
    for (const chunkTicks of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => runInterleaved({ arms, chunkTicks, maxTicks: 100, clock, busyCores }))
        .toThrow('chunkTicks must be a positive safe integer');
    }
    for (const maxTicks of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => runInterleaved({ arms, chunkTicks: 10, maxTicks, clock, busyCores }))
        .toThrow('maxTicks must be a positive safe integer');
    }
  });
});

describe('aiTickAb: a measurement actually ran', () => {
  it('rejects an empty result instead of claiming identical state', () => {
    expect(() => summarize({ rows: [], divergedAt: null })).toThrow('No comparable steady ticks');
  });

  it('rejects a match that resolved before either arm ran steady ticks', () => {
    const { arms, clock, busyCores } = stubs([1, 1], { resolveAtTick: 0 });
    const result = runInterleaved({ arms, chunkTicks: 100, maxTicks: 1000, clock, busyCores });
    expect(() => summarize(result)).toThrow('No comparable steady ticks');
  });
});

describe('aiTickAb: the foreign load is reported beside the ratio', () => {
  it('subtracts this process\'s own share from the machine\'s busy CPUs', () => {
    // The stub clock charges wall and CPU equally, so the process is one busy
    // CPU of the three the machine reports.
    const { arms, clock, busyCores } = stubs([1, 1]);
    const summary = summarize(runInterleaved({ arms, chunkTicks: 100, maxTicks: 300, clock, busyCores }));
    expect(summary.foreignCores.median).toBeCloseTo(2, 10);
  });
});
