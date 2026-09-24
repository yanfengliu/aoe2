// The menu row's switch: the canvas first, the stored choice second.
import { describe, expect, it, vi } from 'vitest';

import { artStyleLabel, cycleArtStyle, type ArtStyleTarget } from '../../src/app/artStyleSetting';
import type { ArtStyleId } from '../../src/rendering/artStyles';
import type { ArtStyleStorage } from '../../src/rendering/artStylePreference';

function target(start: ArtStyleId): ArtStyleTarget & { setArtStyle: ReturnType<typeof vi.fn> } {
  let current = start;
  return {
    artStyleId: () => current,
    setArtStyle: vi.fn((id: ArtStyleId) => { current = id; }),
  };
}

function storage(): ArtStyleStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('the art-style setting', () => {
  it('switches the canvas to the next style, stores it, and names it', () => {
    const view = target('moebius');
    const stored = storage();

    expect(cycleArtStyle(view, stored)).toBe('Natural');
    expect(view.setArtStyle).toHaveBeenCalledWith('de');
    expect(stored.values.get('aoe2:art-style')).toBe('de');

    expect(cycleArtStyle(view, stored)).toBe('Moebius');
    expect(stored.values.get('aoe2:art-style')).toBe('moebius');
  });

  it('stores nothing when the canvas refuses the switch', () => {
    // Persisting first would make the next boot open in a style this session
    // never managed to draw.
    const view = target('moebius');
    view.setArtStyle.mockImplementationOnce(() => { throw new Error('refused'); });
    const stored = storage();

    expect(() => cycleArtStyle(view, stored)).toThrow('refused');
    expect(stored.values.size).toBe(0);
  });

  it('names the style the canvas is drawn in', () => {
    expect(artStyleLabel(target('moebius'))).toBe('Moebius');
    expect(artStyleLabel(target('de'))).toBe('Natural');
  });
});
