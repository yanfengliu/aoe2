import { describe, it, expect } from 'vitest';
import {
  CorpusLlmParseError,
  parseCorpusLlmFile,
} from '../../src/game/playtest/corpusLlmSchema';

describe('parseCorpusLlmFile', () => {
  it('parses a minimal single-row corpus', () => {
    const out = parseCorpusLlmFile(
      JSON.stringify({
        runs: [{ name: 'smoke', seed: 'aoe2-prototype', maxTicks: 1000 }],
      }),
    );
    expect(out.runs).toHaveLength(1);
    expect(out.runs[0]).toEqual({ name: 'smoke', seed: 'aoe2-prototype', maxTicks: 1000 });
  });

  it('preserves optional decisionInterval / owners / costBudgetUsd', () => {
    const out = parseCorpusLlmFile(
      JSON.stringify({
        runs: [
          {
            name: 'smoke',
            seed: 'aoe2-prototype',
            maxTicks: 5000,
            decisionInterval: 100,
            owners: [2, 3],
            costBudgetUsd: 10,
          },
        ],
      }),
    );
    expect(out.runs[0]).toMatchObject({
      decisionInterval: 100,
      owners: [2, 3],
      costBudgetUsd: 10,
    });
  });

  it('rejects malformed JSON', () => {
    expect(() => parseCorpusLlmFile('not json')).toThrow(CorpusLlmParseError);
  });

  it('rejects when runs field is missing', () => {
    expect(() => parseCorpusLlmFile('{}')).toThrow(/runs/);
  });

  it('rejects empty name', () => {
    expect(() =>
      parseCorpusLlmFile(JSON.stringify({ runs: [{ name: '', seed: 's', maxTicks: 1 }] })),
    ).toThrow(/name/);
  });

  it('rejects non-positive maxTicks', () => {
    expect(() =>
      parseCorpusLlmFile(JSON.stringify({ runs: [{ name: 'a', seed: 's', maxTicks: 0 }] })),
    ).toThrow(/maxTicks/);
    expect(() =>
      parseCorpusLlmFile(JSON.stringify({ runs: [{ name: 'a', seed: 's', maxTicks: -1 }] })),
    ).toThrow(/maxTicks/);
  });

  it('rejects empty owners array', () => {
    expect(() =>
      parseCorpusLlmFile(
        JSON.stringify({
          runs: [{ name: 'a', seed: 's', maxTicks: 1, owners: [] }],
        }),
      ),
    ).toThrow(/owners/);
  });

  it('rejects non-integer owners', () => {
    expect(() =>
      parseCorpusLlmFile(
        JSON.stringify({
          runs: [{ name: 'a', seed: 's', maxTicks: 1, owners: [1.5] }],
        }),
      ),
    ).toThrow(/owners/);
  });

  it('rejects non-positive costBudgetUsd', () => {
    expect(() =>
      parseCorpusLlmFile(
        JSON.stringify({
          runs: [{ name: 'a', seed: 's', maxTicks: 1, costBudgetUsd: 0 }],
        }),
      ),
    ).toThrow(/costBudgetUsd/);
  });

  // Phase-6.B (impl-2 M7): omniscient field is optional, must be a boolean.
  it('preserves omniscient when set true', () => {
    const out = parseCorpusLlmFile(
      JSON.stringify({
        runs: [{ name: 'a', seed: 's', maxTicks: 1, omniscient: true }],
      }),
    );
    expect(out.runs[0]).toMatchObject({ omniscient: true });
  });

  it('preserves omniscient when set false', () => {
    const out = parseCorpusLlmFile(
      JSON.stringify({
        runs: [{ name: 'a', seed: 's', maxTicks: 1, omniscient: false }],
      }),
    );
    expect(out.runs[0]).toMatchObject({ omniscient: false });
  });

  it('omits omniscient from the parsed row when absent', () => {
    const out = parseCorpusLlmFile(
      JSON.stringify({ runs: [{ name: 'a', seed: 's', maxTicks: 1 }] }),
    );
    expect(out.runs[0]).not.toHaveProperty('omniscient');
  });

  it('rejects non-boolean omniscient', () => {
    expect(() =>
      parseCorpusLlmFile(
        JSON.stringify({
          runs: [{ name: 'a', seed: 's', maxTicks: 1, omniscient: 'true' }],
        }),
      ),
    ).toThrow(/omniscient/);
  });

  // Phase-6.C.2: observation field is optional + must be boolean.
  it('preserves observation when set', () => {
    const out = parseCorpusLlmFile(
      JSON.stringify({
        runs: [{ name: 'a', seed: 's', maxTicks: 1, observation: true }],
      }),
    );
    expect(out.runs[0]).toMatchObject({ observation: true });
  });

  it('omits observation from the parsed row when absent', () => {
    const out = parseCorpusLlmFile(
      JSON.stringify({ runs: [{ name: 'a', seed: 's', maxTicks: 1 }] }),
    );
    expect(out.runs[0]).not.toHaveProperty('observation');
  });

  it('rejects non-boolean observation', () => {
    expect(() =>
      parseCorpusLlmFile(
        JSON.stringify({
          runs: [{ name: 'a', seed: 's', maxTicks: 1, observation: 1 }],
        }),
      ),
    ).toThrow(/observation/);
  });
});
