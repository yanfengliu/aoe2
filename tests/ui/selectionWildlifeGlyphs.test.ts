import { describe, expect, it } from 'vitest';

import { selectionExtraGlyph } from '../../src/ui/hud/icons/glyphs';
import { selectionGlyph } from '../../src/ui/hud/icons/unitGlyphs';

// M7 UI-icons (v0.1.78): the last text-only selection badges — wildlife
// (sheep/boar/wolf/fish) + relic — get a glyph, completing the selection
// panel. Land animals share a generic fauna (paw) glyph (the label carries the
// species, like the generic research scroll); fish and relic get their own.

describe('selectionGlyph — wildlife + relic badges (v0.1.78)', () => {
  it('gives every wildlife + relic kind a glyph at the selection size', () => {
    for (const kind of ['sheep', 'boar', 'wolf', 'fish', 'relic'] as const) {
      const g = selectionGlyph(kind);
      expect(g).not.toBe('');
      expect(g).toContain('class="hud-selection-unit-glyph"');
      expect(g).not.toContain('hud-chip-glyph');
    }
  });

  it('shares one fauna glyph across land animals; fish + relic are distinct', () => {
    expect(selectionGlyph('sheep')).toBe(selectionGlyph('boar'));
    expect(selectionGlyph('boar')).toBe(selectionGlyph('wolf'));
    expect(selectionGlyph('fish')).not.toBe(selectionGlyph('sheep'));
    expect(selectionGlyph('relic')).not.toBe(selectionGlyph('sheep'));
    expect(selectionGlyph('relic')).not.toBe(selectionGlyph('fish'));
  });

  it('selectionExtraGlyph returns the body for wildlife/relic, empty otherwise', () => {
    expect(selectionExtraGlyph('relic')).not.toBe('');
    expect(selectionExtraGlyph('fish')).not.toBe('');
    // Resource nodes are handled by resourceNodeGlyph, not this helper.
    expect(selectionExtraGlyph('tree')).toBe('');
    expect(selectionExtraGlyph('villager')).toBe('');
  });
});
