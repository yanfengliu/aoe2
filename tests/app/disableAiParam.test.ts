import { describe, it, expect, vi } from 'vitest';
import { parseDisableAiParam } from '../../src/app/bootstrap/disableAiParam';

describe('parseDisableAiParam', () => {
  it('returns empty set when param absent', () => {
    expect(parseDisableAiParam('http://localhost/?seed=foo')).toEqual(new Set());
  });

  it('returns empty set when param is empty', () => {
    expect(parseDisableAiParam('http://localhost/?disableAi=')).toEqual(new Set());
  });

  it('parses single owner', () => {
    expect(parseDisableAiParam('http://localhost/?disableAi=2')).toEqual(new Set([2]));
  });

  it('parses comma-separated owners', () => {
    expect(parseDisableAiParam('http://localhost/?disableAi=2,3,4')).toEqual(new Set([2, 3, 4]));
  });

  it('trims whitespace around tokens', () => {
    expect(parseDisableAiParam('http://localhost/?disableAi=2,%203,%20%204')).toEqual(
      new Set([2, 3, 4]),
    );
  });

  it('rejects owner 1 (the human slot) with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseDisableAiParam('http://localhost/?disableAi=1,2')).toEqual(new Set([2]));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('rejected owner 1'));
    warn.mockRestore();
  });

  it('skips non-integer tokens with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseDisableAiParam('http://localhost/?disableAi=abc,2,3.5')).toEqual(new Set([2]));
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('skips zero and negative numbers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseDisableAiParam('http://localhost/?disableAi=0,-1,2')).toEqual(new Set([2]));
    warn.mockRestore();
  });

  it('dedupes repeated values', () => {
    expect(parseDisableAiParam('http://localhost/?disableAi=2,2,3,3')).toEqual(new Set([2, 3]));
  });

  it('ignores empty tokens between commas', () => {
    expect(parseDisableAiParam('http://localhost/?disableAi=2,,3,')).toEqual(new Set([2, 3]));
  });
});
