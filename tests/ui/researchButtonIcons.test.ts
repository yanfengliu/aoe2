import { describe, expect, it } from 'vitest';

import { researchGlyph } from '../../src/ui/hud/icons/glyphs';
import { renderResearchButtons } from '../../src/ui/hud/selectionPanel';

// M7 UI-icons (v0.1.74): the command-card "Research X" buttons — previously
// text-only — get an original procedural RESEARCH glyph (an open book with an
// upgrade chevron) before the label, matching the Build/Train buttons. Icons
// AUGMENT: the `data-command="research-<tech>"` hook, the "Research <Name>"
// text, and the locked/disabled state the click handler + browser tests rely
// on are preserved. The glyph carries the 17px `hud-command-glyph` class so it
// matches the neighbouring command icons (the v0.1.73 sizing lesson).

describe('renderResearchButtons — command-card research icons', () => {
  it('prepends the research glyph and preserves the hook, label, and locked state', () => {
    // loom is visible-but-unavailable here (not in the available list) → locked.
    const html = renderResearchButtons(['fletching', 'loom'], ['fletching']);

    // The click/handler + browser-test hooks are intact.
    expect(html).toContain('data-command="research-fletching"');
    expect(html).toContain('data-command="research-loom"');

    // The label text is preserved in a label span (textContent unchanged).
    expect(html).toContain('class="hud-command-label"');
    expect(html).toContain('Research Fletching');
    expect(html).toContain('Research Loom');

    // The research glyph is present and carries the 17px command-glyph class
    // (matching Build/Train), NOT a chip/selection sizing class.
    expect(html).toContain(researchGlyph());
    expect(html).toContain('class="hud-command-glyph"');
    expect(html).not.toContain('hud-chip-glyph');
    expect(html).not.toContain('hud-selection-unit-glyph');

    // The locked state is preserved for the unavailable tech...
    const loomButton = html.slice(html.indexOf('data-command="research-loom"'));
    expect(loomButton.slice(0, loomButton.indexOf('</button>'))).toContain(
      'data-command-locked="true"',
    );
    // ...and the available tech is NOT locked.
    const fletchButton = html.slice(
      html.indexOf('data-command="research-fletching"'),
      html.indexOf('data-command="research-loom"'),
    );
    expect(fletchButton).not.toContain('data-command-locked');

    // The glyph precedes the label (augment-before pattern, like build buttons).
    // Key on the unique `hud-command-label` marker, not the "Research Fletching"
    // text, since that text also appears in the earlier `data-tooltip` attribute.
    const fb = html.slice(html.indexOf('data-command="research-fletching"'));
    expect(fb.indexOf('<svg')).toBeLessThan(fb.indexOf('hud-command-label'));
  });

  it('renders nothing for an empty research-option list', () => {
    expect(renderResearchButtons([], []).trim()).toBe('');
  });
});
