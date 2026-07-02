import { describe, expect, it } from 'vitest';

import { renderTrainButtons } from '../../src/ui/hud/selectionPanel';
import { unitRoleGlyph, unitGlyphRole } from '../../src/ui/hud/icons/unitGlyphs';

// M7 UI-icons (v0.1.72): the command-card "Train X" buttons — previously
// text-only — get an original procedural UNIT glyph before the label, reusing
// the per-role glyph art from the v0.1.44 selection-panel slice. Icons AUGMENT,
// they do not replace: the `data-command="train-<unit>"` hook the click handler
// + browser tests rely on and the "Train <Name>" text are preserved.

describe('renderTrainButtons — command-card unit icons', () => {
  it('prepends the unit role glyph and preserves the data-command hook + label text', () => {
    const html = renderTrainButtons(['villager', 'knight']);

    // The click/handler + browser-test hook is intact.
    expect(html).toContain('data-command="train-villager"');
    expect(html).toContain('data-command="train-knight"');

    // The label text is preserved (in a label span so textContent is unchanged).
    expect(html).toContain('Train Villager');
    expect(html).toContain('Train Knight');
    expect(html).toContain('class="hud-command-label"');

    // The unit glyph for each role is present (villager and cavalry differ).
    expect(html).toContain(unitRoleGlyph(unitGlyphRole('villager')));
    expect(html).toContain(unitRoleGlyph(unitGlyphRole('knight')));

    // The glyph precedes the label (augment-before pattern, like build buttons).
    const knightButton = html.slice(html.indexOf('data-command="train-knight"'));
    expect(knightButton.indexOf('<svg')).toBeLessThan(knightButton.indexOf('Train Knight'));
  });

  it('renders nothing for an empty train-option list', () => {
    expect(renderTrainButtons([]).trim()).toBe('');
  });
});
