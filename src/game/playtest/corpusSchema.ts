import type { OracleThresholds } from './types';

export interface PlaytestCorpus {
  runs: PlaytestCorpusRun[];
}

export interface PlaytestCorpusRun {
  name: string;
  seed: string;
  maxTicks: number;
  // Score-timer game length (spec §4.3). When set, the match ends on score at
  // this tick so a run terminates (stopReason `stopWhen`) instead of hitting
  // the `maxTicks` cap — required if `thresholds.matchCompleteRequired` is on.
  // Must be positive and strictly below `maxTicks` so the timer fires inside
  // the run loop (the cap stays a backstop).
  gameLength?: number;
  // Headless AI-vs-AI: when true, force an AI onto the human slot so the run is
  // a competitive match instead of AI(enemy)-vs-inert(human). Defaults to false.
  allAi?: boolean;
  // Economy-progression gate: when set, the run FAILS (a HIGH) unless at least
  // one LIVING owner reached this age by match end (checked by replaying the
  // bundle). Guards against the drop-off-freeze class where an economy stalls
  // and no one leaves the Dark Age. Only meaningful for a long run.
  requireAgeByEnd?: 'feudal-age' | 'castle-age' | 'imperial-age';
  thresholds?: OracleThresholds;
}

export function parseCorpusFile(raw: string): PlaytestCorpus {
  const obj = JSON.parse(raw);
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.runs)) {
    throw new Error('corpus: missing or invalid `runs` array');
  }
  for (const [i, r] of obj.runs.entries()) {
    if (typeof r.name !== 'string') throw new Error(`corpus.runs[${i}]: name must be string`);
    if (typeof r.seed !== 'string') throw new Error(`corpus.runs[${i}]: seed must be string`);
    if (typeof r.maxTicks !== 'number' || r.maxTicks <= 0) {
      throw new Error(`corpus.runs[${i}]: maxTicks must be positive number`);
    }
    if (r.gameLength !== undefined) {
      // Integer, not just positive: a fractional gameLength can pass the
      // `< maxTicks` guard yet never satisfy the timer's integer-tick fire
      // condition, so the run would hit the cap and trip the completion oracle.
      if (!Number.isInteger(r.gameLength) || r.gameLength <= 0) {
        throw new Error(`corpus.runs[${i}]: gameLength must be a positive integer`);
      }
      if (r.gameLength >= r.maxTicks) {
        throw new Error(
          `corpus.runs[${i}]: gameLength (${r.gameLength}) must be below maxTicks (${r.maxTicks}) so the score timer fires inside the run`,
        );
      }
    }
    if (r.allAi !== undefined && typeof r.allAi !== 'boolean') {
      throw new Error(`corpus.runs[${i}]: allAi must be boolean`);
    }
    if (
      r.requireAgeByEnd !== undefined
      && !['feudal-age', 'castle-age', 'imperial-age'].includes(r.requireAgeByEnd)
    ) {
      throw new Error(
        `corpus.runs[${i}]: requireAgeByEnd must be one of feudal-age, castle-age, imperial-age`,
      );
    }
    if (r.thresholds !== undefined && (typeof r.thresholds !== 'object' || r.thresholds === null)) {
      throw new Error(`corpus.runs[${i}]: thresholds must be object`);
    }
  }
  return obj as PlaytestCorpus;
}
