// What a `step()` answers with — the shared constants a refusal returns, the
// constructors a successful one uses, and the tally a run of many comes to.
//
// A halted match, a paused one, and a finished one all refuse on EVERY frame
// for the rest of the session — that is a steady state, not an anomaly — so
// the refusal path must cost nothing. These are frozen module constants: one
// object each for the lifetime of the process, no Error, no stack capture, no
// string building. Only a step that actually ran ticks allocates, and it
// allocates one small literal.

import type { StepRefusal, StepReport } from '../simulationBridgeTypes';

export type { StepRefusal, StepReport };

function refusal(reason: StepRefusal): StepReport {
  return Object.freeze({ ticks: 0, refusedBecause: reason });
}

/** `setPaused(true)` is holding the world still. */
export const STEP_REFUSED_PAUSED: StepReport = refusal('paused');
/** A tick threw; the world is never stepped again. */
export const STEP_REFUSED_HALTED: StepReport = refusal('halted');
/** The match already has an outcome. */
export const STEP_REFUSED_MATCH_OVER: StepReport = refusal('match-over');
/** A replay bridge — ReplayController drives playback, frames do not. */
export const STEP_REFUSED_REPLAY: StepReport = refusal('replay');

/** The world was willing to step but `deltaMs` did not fill a whole tick. Not
 *  a refusal: the next call with the accumulated remainder will run one. */
export const STEP_RAN_NO_TICKS: StepReport = Object.freeze({ ticks: 0, refusedBecause: null });

/** What a RUN of steps came to, for a caller that drives many in a loop and
 *  needs to know it got less than it asked for. Summed from each step's own
 *  report, so the count and the reason come from the same place — a caller
 *  that instead compares tick counters is guessing, and a play session that
 *  guessed published a hazard wrong in both of its forms (defect register
 *  2026-09-06).
 *
 *  `refusedBecause` is the FAULT signal, not a short `ticksAdvanced`: a
 *  `deltaMs` below one tick (100ms at TPS 10) legitimately runs fewer ticks
 *  than steps. */
export interface StepRunTally {
  /** `step()` calls asked for. */
  readonly stepsRequested: number;
  /** `step()` calls the world was willing to take. */
  readonly stepsRun: number;
  /** World ticks that ran, summed from each step's report. */
  readonly ticksAdvanced: number;
  /** Why the world stopped short, or null when it never refused. */
  readonly refusedBecause: StepRefusal | null;
}

/** A step that ran `ticks` world ticks and was still willing at the end. */
export function stepAdvanced(ticks: number): StepReport {
  return ticks === 0 ? STEP_RAN_NO_TICKS : { ticks, refusedBecause: null };
}

const REFUSED_BY_REASON: Readonly<Record<StepRefusal, StepReport>> = Object.freeze({
  paused: STEP_REFUSED_PAUSED,
  halted: STEP_REFUSED_HALTED,
  'match-over': STEP_REFUSED_MATCH_OVER,
  replay: STEP_REFUSED_REPLAY,
});

/** A step that ran `ticks` and then stopped for `reason` — a tick that failed
 *  partway through the call, say. Both halves are true and both are reported.
 *  Zero ticks reuses the shared constant, so no refusal path ever allocates. */
export function stepAdvancedThenRefused(ticks: number, reason: StepRefusal): StepReport {
  return ticks === 0 ? REFUSED_BY_REASON[reason] : { ticks, refusedBecause: reason };
}
