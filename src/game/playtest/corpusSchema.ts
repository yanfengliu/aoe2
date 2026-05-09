import type { OracleThresholds } from './types';

export interface PlaytestCorpus {
  runs: PlaytestCorpusRun[];
}

export interface PlaytestCorpusRun {
  name: string;
  seed: string;
  maxTicks: number;
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
    if (r.thresholds !== undefined && (typeof r.thresholds !== 'object' || r.thresholds === null)) {
      throw new Error(`corpus.runs[${i}]: thresholds must be object`);
    }
  }
  return obj as PlaytestCorpus;
}
