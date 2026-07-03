import { describe, expect, it } from 'vitest';

import { resourceGlyph, resourceNodeGlyph } from '../../src/ui/hud/icons/glyphs';
import { selectionGlyph } from '../../src/ui/hud/icons/unitGlyphs';

// M7 UI-icons (v0.1.77): the selection-panel badge for a gatherable RESOURCE
// NODE (tree / gold-mine / stone-mine / berry-bush) now shows the matching
// top-bar COMMODITY glyph, reusing `resourceGlyph` through the selection sizing
// class — the resource-node analogue of the v0.1.75 market-button icons. A
// selected Farm keeps its building silhouette (it is a buildable building), and
// wildlife (boar/sheep/wolf/fish) + relic stay text-only until a later slice.

const SELECTION = 'hud-selection-unit-glyph';

describe('selectionGlyph / resourceNodeGlyph — resource-node badges', () => {
  it('maps each gatherable node to its commodity glyph at the selection size', () => {
    expect(selectionGlyph('tree')).toBe(resourceGlyph('wood', SELECTION));
    expect(selectionGlyph('gold-mine')).toBe(resourceGlyph('gold', SELECTION));
    expect(selectionGlyph('stone-mine')).toBe(resourceGlyph('stone', SELECTION));
    expect(selectionGlyph('berry-bush')).toBe(resourceGlyph('food', SELECTION));

    // The badge carries the selection sizing class, not the top-bar chip class.
    expect(selectionGlyph('tree')).toContain('class="hud-selection-unit-glyph"');
    expect(selectionGlyph('tree')).not.toContain('hud-chip-glyph');
  });

  it('leaves wildlife + relic text-only (next slice) and returns empty for null', () => {
    for (const kind of ['boar', 'sheep', 'wolf', 'fish', 'relic'] as const) {
      expect(selectionGlyph(kind)).toBe('');
    }
    expect(selectionGlyph(null)).toBe('');
  });

  it('resourceNodeGlyph returns the commodity glyph or empty, defaulting to the chip class', () => {
    // Default class is the chip class (backwards compatible with any chip use).
    expect(resourceNodeGlyph('tree')).toBe(resourceGlyph('wood'));
    expect(resourceNodeGlyph('tree', SELECTION)).toBe(resourceGlyph('wood', SELECTION));
    // Non-gatherable kinds (wildlife/relic) have no commodity glyph.
    expect(resourceNodeGlyph('wolf')).toBe('');
    expect(resourceNodeGlyph('relic')).toBe('');
  });
});
