import { beforeAll, describe, expect, it } from 'vitest';

// One long tick-by-tick comparison, run as consecutive cases over the SAME
// worlds, so each case has its own time limit and none runs near it (work 123:
// the 600- and 700-tick comparisons timed out on windows-latest at 30.6-35.7 s
// of 30 s, while every tick's comparison passed).
//
// What the split keeps: every tick and every per-tick check, in the same order,
// on worlds built once and carried from case to case, and the whole-run checks
// after the last tick. What it changes: the time limit is re-armed at each case
// boundary, so a comparison split into six cases gets six limits in all. That
// is a larger budget for the same work, which work 123's brief allows only as
// a split that keeps every check, and only because the work is the price of
// the check: a Node profile of the 600-tick case (2026-10-11) put it at 9%
// stepping, 69% World.serialize and 22% comparison, over a 566 KB snapshot
// that is 90% the 2,160 static terrain tiles, and work 112 spent five routes on
// the serialize-and-compare cost before that. Making it cheaper means changing
// the save format. None of these tests measures speed — the simulation's speed
// is ai:tick-ab's and bridgeSnapshotPerf's to judge — so a limit per case keeps
// what the limit was for here: a case that runs far past its time fails, by
// name. (Vitest checks a synchronous case's time only when it returns, so a
// tick that never returns is the CI job's timeout to catch, as before.)
//
// A case never runs on worlds another case left behind unfinished: each
// requires the cases before it to have completed every tick, so running one
// chunk alone (`-t`), after a failed chunk, or again after failing part-way (a
// retry) fails, naming the ticks it needed, instead of comparing a different
// prefix and passing.
export interface TickChunks<Run> {
  /** Builds the worlds once, before the first chunk (a beforeAll hook). */
  readonly setup: () => Run;
  /** One tick: step the worlds and make every per-tick check. `tick` counts from 0. */
  readonly tick: (run: Run, tick: number) => void;
  /** After the last tick, in the last chunk: the checks over the whole run. */
  readonly finish: (run: Run) => void;
}

/** The three vitest calls the chunks are registered with; a test swaps in its own. */
export interface ChunkRegistrar {
  readonly describe: (name: string, body: () => void) => void;
  readonly beforeAll: (fn: () => void) => void;
  readonly it: (name: string, fn: () => void) => void;
}

const VITEST: ChunkRegistrar = {
  describe: (name, body) => { describe.sequential(name, body); },
  beforeAll: (fn) => { beforeAll(fn); },
  it: (name, fn) => { it(name, fn); },
};

export function describeTickChunks<Run>(
  name: string, ticks: number, chunk: number, body: TickChunks<Run>, registrar: ChunkRegistrar = VITEST,
): void {
  if (!Number.isInteger(ticks) || !Number.isInteger(chunk) || ticks <= 0 || chunk <= 0) {
    throw new Error(`describeTickChunks needs positive whole tick and chunk counts; got ${String(ticks)} and ${String(chunk)}.`);
  }
  registrar.describe(name, () => {
    let run: Run | undefined;
    let completed = 0;
    registrar.beforeAll(() => {
      run = body.setup();
    });
    for (let start = 0; start < ticks; start += chunk) {
      const end = Math.min(ticks, start + chunk);
      const last = end === ticks;
      registrar.it(`ticks ${String(start + 1)}-${String(end)} of ${String(ticks)}${last ? ', then the whole-run checks' : ''}`, () => {
        expect(
          completed,
          start === 0
            ? `ticks 1-${String(end)} must start from the worlds the setup just built, and an earlier run of them stopped part-way`
            : `ticks ${String(start + 1)}-${String(end)} continue the same worlds, so ticks 1-${String(start)} must have completed first`,
        ).toBe(start);
        expect(run, 'the worlds were not built: the setup hook did not run or threw').toBeDefined();
        for (let tick = start; tick < end; tick++) {
          // A tick that throws part-way leaves the worlds between ticks, so
          // nothing may resume from here, not even this case run again.
          completed = -1;
          body.tick(run!, tick);
          completed = tick + 1;
        }
        if (last) body.finish(run!);
      });
    }
  });
}
