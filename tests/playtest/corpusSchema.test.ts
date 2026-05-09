import { describe, expect, it } from 'vitest';
import { parseCorpusFile } from '../../src/game/playtest/corpusSchema';

describe('parseCorpusFile', () => {
  it('accepts a minimal corpus', () => {
    const json = JSON.stringify({
      runs: [{ name: 'smoke', seed: 'default-seed', maxTicks: 30000 }],
    });
    const corpus = parseCorpusFile(json);
    expect(corpus.runs).toHaveLength(1);
    expect(corpus.runs[0]).toMatchObject({ name: 'smoke', seed: 'default-seed', maxTicks: 30000 });
  });

  it('rejects missing runs', () => {
    expect(() => parseCorpusFile('{}')).toThrow(/runs/);
  });

  it('rejects non-string name', () => {
    const json = JSON.stringify({ runs: [{ name: 1, seed: 'x', maxTicks: 100 }] });
    expect(() => parseCorpusFile(json)).toThrow(/name/);
  });

  it('rejects non-number maxTicks', () => {
    const json = JSON.stringify({ runs: [{ name: 'x', seed: 'x', maxTicks: 'big' }] });
    expect(() => parseCorpusFile(json)).toThrow(/maxTicks/);
  });

  it('rejects zero or negative maxTicks', () => {
    const json = JSON.stringify({ runs: [{ name: 'x', seed: 'x', maxTicks: 0 }] });
    expect(() => parseCorpusFile(json)).toThrow(/maxTicks/);
  });

  it('accepts optional thresholds', () => {
    const json = JSON.stringify({
      runs: [{ name: 'x', seed: 'x', maxTicks: 100, thresholds: { economyByTick: 1000 } }],
    });
    const corpus = parseCorpusFile(json);
    expect(corpus.runs[0]!.thresholds?.economyByTick).toBe(1000);
  });

  it('rejects null thresholds', () => {
    const json = JSON.stringify({ runs: [{ name: 'x', seed: 'x', maxTicks: 100, thresholds: null }] });
    expect(() => parseCorpusFile(json)).toThrow(/thresholds/);
  });
});
