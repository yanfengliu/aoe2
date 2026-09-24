// The stored art-style choice: a player setting that must never stop the game
// from booting, and must never strand a player on a style this build does not
// ship (spec §14.5).
import { describe, expect, it } from 'vitest';

import { DEFAULT_ART_STYLE_ID } from '../../src/rendering/artStyles';
import {
  ART_STYLE_STORAGE_KEY,
  readArtStylePreference,
  writeArtStylePreference,
  type ArtStyleStorage,
} from '../../src/rendering/artStylePreference';

function memoryStorage(initial: Record<string, string> = {}): ArtStyleStorage & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('the art-style preference', () => {
  it('stores under aoe2:art-style', () => {
    expect(ART_STYLE_STORAGE_KEY).toBe('aoe2:art-style');
  });

  it('reads back what was written', () => {
    const storage = memoryStorage();
    writeArtStylePreference('de', storage);
    expect(storage.values.get('aoe2:art-style')).toBe('de');
    expect(readArtStylePreference(storage)).toBe('de');
    writeArtStylePreference('moebius', storage);
    expect(readArtStylePreference(storage)).toBe('moebius');
  });

  it('falls back to the default when nothing is stored', () => {
    expect(readArtStylePreference(memoryStorage())).toBe(DEFAULT_ART_STYLE_ID);
  });

  it('falls back to the default for a style this build does not ship', () => {
    // `painted` was written by every build from v0.3.x to v0.3.195.
    expect(readArtStylePreference(memoryStorage({ 'aoe2:art-style': 'painted' }))).toBe(DEFAULT_ART_STYLE_ID);
    expect(readArtStylePreference(memoryStorage({ 'aoe2:art-style': '' }))).toBe(DEFAULT_ART_STYLE_ID);
    expect(readArtStylePreference(memoryStorage({ 'aoe2:art-style': 'DE' }))).toBe(DEFAULT_ART_STYLE_ID);
  });

  it('falls back to the default when storage is missing or throws', () => {
    expect(readArtStylePreference(null)).toBe(DEFAULT_ART_STYLE_ID);
    const throwing: ArtStyleStorage = {
      getItem: () => { throw new Error('SecurityError: storage disabled'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
    };
    expect(readArtStylePreference(throwing)).toBe(DEFAULT_ART_STYLE_ID);
    // A write that cannot persist still must not throw into the menu click.
    expect(() => writeArtStylePreference('de', throwing)).not.toThrow();
    expect(() => writeArtStylePreference('de', null)).not.toThrow();
  });
});
