import { describe, expect, it } from 'vitest';

import { marketActionGlyph } from '../../src/ui/hud/icons/glyphs';
import { renderMarketButtons } from '../../src/ui/hud/selectionPanel';

// M7 UI-icons (v0.1.75): the command-card Buy/Sell "market" buttons — the last
// text-only command group after Build/Train/Research got icons — get the
// COMMODITY glyph (food/wood/stone) before the label, reusing the top-bar
// `resourceGlyph` art through an optional class param so it renders at the 17px
// command size instead of the chip size (the v0.1.73 sizing lesson). Icons
// AUGMENT: the `data-command="market-<action>"` hook + "Buy/Sell X" text the
// click handler + browser tests rely on are preserved.

describe('renderMarketButtons — command-card market icons', () => {
  it('prepends the commodity glyph and preserves the hook + label text', () => {
    const html = renderMarketButtons(['buy-food', 'sell-wood']);

    // The click/handler + browser-test hooks are intact.
    expect(html).toContain('data-command="market-buy-food"');
    expect(html).toContain('data-command="market-sell-wood"');

    // The label text is preserved in a label span (textContent unchanged).
    expect(html).toContain('class="hud-command-label"');
    expect(html).toContain('Buy Food');
    expect(html).toContain('Sell Wood');

    // The commodity glyph is present, at the 17px command size (not the chip
    // or selection size), and differs by commodity (food body ≠ wood body).
    expect(html).toContain(marketActionGlyph('buy-food'));
    expect(html).toContain(marketActionGlyph('sell-wood'));
    expect(marketActionGlyph('buy-food')).not.toBe(marketActionGlyph('sell-wood'));
    expect(html).toContain('class="hud-command-glyph"');
    expect(html).not.toContain('hud-chip-glyph');

    // Both directions of the same commodity share the commodity glyph (the
    // label carries buy-vs-sell); the glyph is keyed on the commodity only.
    expect(marketActionGlyph('buy-food')).toBe(marketActionGlyph('sell-food'));

    // The glyph precedes the label (augment-before pattern). Anchor on the
    // unique label-class marker, not the "Buy Food" text (which also appears
    // in the earlier data-tooltip attribute).
    const fb = html.slice(html.indexOf('data-command="market-buy-food"'));
    expect(fb.indexOf('<svg')).toBeLessThan(fb.indexOf('hud-command-label'));
  });

  it('renders nothing for an empty market-option list', () => {
    expect(renderMarketButtons([]).trim()).toBe('');
  });
});
