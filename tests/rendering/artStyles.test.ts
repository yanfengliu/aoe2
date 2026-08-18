import { describe, expect, it } from 'vitest';

import {
  ART_STYLES,
  DEFAULT_ART_STYLE_ID,
  artStyleById,
  isArtStyleId,
  nextArtStyleId,
} from '../../src/rendering/artStyles';
import {
  ART_STYLE_STORAGE_KEY,
  readArtStylePreference,
  writeArtStylePreference,
  type ArtStyleStorage,
} from '../../src/rendering/artStylePreference';

function memoryStorage(initial: Record<string, string> = {}): ArtStyleStorage {
  const map = new Map(Object.entries(initial));

  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
  };
}

const THROWING_STORAGE: ArtStyleStorage = {
  getItem: () => { throw new Error('storage is disabled for this origin'); },
  setItem: () => { throw new Error('quota exceeded'); },
};

describe('art styles', () => {
  it('defaults to Moebius', () => {
    expect(DEFAULT_ART_STYLE_ID).toBe('moebius');
    expect(artStyleById(DEFAULT_ART_STYLE_ID).resolve).not.toBeNull();
  });

  it('makes Painted the absence of the pass, not a neutral configuration of it', () => {
    // Painted has to cost nothing: no second scene render, no fullscreen
    // resolve, no offscreen targets.
    expect(artStyleById('painted').resolve).toBeNull();
  });

  it('cycles through every style and wraps', () => {
    const seen = new Set<string>();
    let id = DEFAULT_ART_STYLE_ID;

    for (let i = 0; i < ART_STYLES.length; i++) {
      seen.add(id);
      id = nextArtStyleId(id);
    }

    expect(seen.size).toBe(ART_STYLES.length);
    expect(id).toBe(DEFAULT_ART_STYLE_ID);
  });

  it('names the available styles when asked for one that does not exist', () => {
    expect(() => artStyleById('watercolour')).toThrow(/watercolour/);
    expect(() => artStyleById('watercolour')).toThrow(/moebius/);
    expect(() => artStyleById('watercolour')).toThrow(/painted/);
  });

  it('recognises only real ids', () => {
    expect(isArtStyleId('moebius')).toBe(true);
    expect(isArtStyleId('watercolour')).toBe(false);
    expect(isArtStyleId(null)).toBe(false);
    expect(isArtStyleId(7)).toBe(false);
  });
});

describe('art style preference', () => {
  it('round-trips a chosen style', () => {
    const storage = memoryStorage();

    writeArtStylePreference('painted', storage);

    expect(storage.getItem(ART_STYLE_STORAGE_KEY)).toBe('painted');
    expect(readArtStylePreference(storage)).toBe('painted');
  });

  it('falls back to the default rather than stranding a withdrawn style', () => {
    // Withdrawing a style must not stop the game booting for the players who
    // had it selected.
    expect(readArtStylePreference(memoryStorage({ [ART_STYLE_STORAGE_KEY]: 'ink' })))
      .toBe(DEFAULT_ART_STYLE_ID);
    expect(readArtStylePreference(memoryStorage())).toBe(DEFAULT_ART_STYLE_ID);
  });

  it('survives storage that throws on read or write', () => {
    // Private browsing, a disabled origin, or a full quota must not be able to
    // stop the game over a question about outlines.
    expect(readArtStylePreference(THROWING_STORAGE)).toBe(DEFAULT_ART_STYLE_ID);
    expect(() => { writeArtStylePreference('painted', THROWING_STORAGE); }).not.toThrow();
  });

  it('keeps a failed write from poisoning the next read', () => {
    // The write failing is not a reason to refuse the switch — only the memory
    // of it across sessions is lost, and the next read must still answer.
    const storage = memoryStorage({ [ART_STYLE_STORAGE_KEY]: 'painted' });

    writeArtStylePreference('moebius', THROWING_STORAGE);

    expect(readArtStylePreference(THROWING_STORAGE)).toBe(DEFAULT_ART_STYLE_ID);
    expect(readArtStylePreference(storage)).toBe('painted');
  });
});
