import { describe, expect, it } from 'vitest';

import { actionGlyph } from '../../src/ui/hud/icons/glyphs';
import { renderActionButtons } from '../../src/ui/hud/selectionPanel';

// M7 UI-icons (v0.1.76): the "action" command-card buttons — the LAST text-only
// command group after Build/Train/Research/Market got icons — get a procedural
// glyph before the label. The only action is Ungarrison (units exiting a
// building), drawn as an arrow rising out of an open container. Icons AUGMENT:
// the `data-command="action-<type>"` hook + "Ungarrison" text the click handler
// + browser tests rely on are preserved, at the 17px command size.

describe('renderActionButtons — command-card action icons', () => {
  it('prepends the action glyph and preserves the hook + label text', () => {
    const html = renderActionButtons(['ungarrison']);

    // The click/handler + browser-test hook is intact.
    expect(html).toContain('data-command="action-ungarrison"');

    // The label text is preserved in a label span (textContent unchanged).
    expect(html).toContain('class="hud-command-label"');
    expect(html).toContain('Ungarrison');

    // The action glyph is present at the 17px command size (not chip/selection).
    expect(html).toContain(actionGlyph('ungarrison'));
    expect(html).toContain('class="hud-command-glyph"');
    expect(html).not.toContain('hud-chip-glyph');
    expect(html).not.toContain('hud-selection-unit-glyph');

    // The glyph precedes the label (augment-before pattern). Anchor on the
    // unique label-class marker, not the "Ungarrison" text (which also appears
    // in the earlier data-tooltip attribute).
    const fb = html.slice(html.indexOf('data-command="action-ungarrison"'));
    expect(fb.indexOf('<svg')).toBeLessThan(fb.indexOf('hud-command-label'));
  });

  it('renders nothing for an empty action-option list', () => {
    expect(renderActionButtons([]).trim()).toBe('');
  });
});
