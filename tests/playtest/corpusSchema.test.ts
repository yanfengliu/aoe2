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
      runs: [{ name: 'x', seed: 'x', maxTicks: 100, thresholds: { perfP99WarmupTicks: 1000 } }],
    });
    const corpus = parseCorpusFile(json);
    expect(corpus.runs[0]!.thresholds?.perfP99WarmupTicks).toBe(1000);
  });

  it('rejects null thresholds', () => {
    const json = JSON.stringify({ runs: [{ name: 'x', seed: 'x', maxTicks: 100, thresholds: null }] });
    expect(() => parseCorpusFile(json)).toThrow(/thresholds/);
  });

  it('accepts an optional gameLength below maxTicks', () => {
    const json = JSON.stringify({
      runs: [{ name: 'x', seed: 'x', maxTicks: 8100, gameLength: 8000 }],
    });
    expect(parseCorpusFile(json).runs[0]!.gameLength).toBe(8000);
  });

  it('rejects a non-positive gameLength', () => {
    const json = JSON.stringify({ runs: [{ name: 'x', seed: 'x', maxTicks: 100, gameLength: 0 }] });
    expect(() => parseCorpusFile(json)).toThrow(/gameLength/);
  });

  it('rejects a fractional gameLength (integer tick counts only)', () => {
    const json = JSON.stringify({ runs: [{ name: 'x', seed: 'x', maxTicks: 100, gameLength: 50.5 }] });
    expect(() => parseCorpusFile(json)).toThrow(/gameLength/);
  });

  it('rejects a gameLength that is not below maxTicks (timer would never fire)', () => {
    const json = JSON.stringify({ runs: [{ name: 'x', seed: 'x', maxTicks: 100, gameLength: 100 }] });
    expect(() => parseCorpusFile(json)).toThrow(/gameLength .* below maxTicks/);
  });

  it('accepts an optional allAi boolean', () => {
    const json = JSON.stringify({ runs: [{ name: 'x', seed: 'x', maxTicks: 100, allAi: true }] });
    expect(parseCorpusFile(json).runs[0]!.allAi).toBe(true);
  });

  it('rejects a non-boolean allAi', () => {
    const json = JSON.stringify({ runs: [{ name: 'x', seed: 'x', maxTicks: 100, allAi: 'yes' }] });
    expect(() => parseCorpusFile(json)).toThrow(/allAi/);
  });

  it('accepts a valid requireAgeByEnd', () => {
    const json = JSON.stringify({
      runs: [{ name: 'x', seed: 'x', maxTicks: 8100, requireAgeByEnd: 'feudal-age' }],
    });
    expect(parseCorpusFile(json).runs[0]!.requireAgeByEnd).toBe('feudal-age');
  });

  it('rejects an unknown requireAgeByEnd', () => {
    const json = JSON.stringify({
      runs: [{ name: 'x', seed: 'x', maxTicks: 100, requireAgeByEnd: 'dark-age' }],
    });
    expect(() => parseCorpusFile(json)).toThrow(/requireAgeByEnd/);
  });
});
