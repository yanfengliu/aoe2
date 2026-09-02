// Stance and formation glyphs for the command deck's icon buttons (v0.3.187).
//
// Same contract as `glyphs.ts`, which this file extends rather than grows past
// its 500-LOC cap: 100% ORIGINAL hand-authored artwork, drawn as inline
// `<path>`/`<rect>`/`<circle>` primitives on a 24x24 viewBox. NO copyrighted
// Age of Empires II icon or sprite, NO `url(...)`, NO `<image>`, NO icon font,
// NO external href — every glyph is self-contained markup whose only colour is
// `currentColor`, so `hudIcons.css` alone controls the tone.
//
// The glyphs are decorative (`aria-hidden`): the button carries the meaning in
// its `aria-label` and its `data-tooltip`, because these buttons no longer show
// a text label.

import type { UnitFormation } from '../../../game/simulation/unitFormation';
import type { UnitStance } from '../../../game/simulation/unitStance';

// Same wrapper as glyphs.ts — chunky strokes that hold up at ~20-26px.
function svg(cls: string, body: string): string {
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ` +
    `fill="none" stroke="currentColor" stroke-width="1.6" ` +
    `stroke-linejoin="round" stroke-linecap="round">${body}</svg>`
  );
}

// ---- Stance glyphs ---------------------------------------------------

const STANCE_GLYPH_BODY: Record<UnitStance, string> = {
  // A drawn sword, point up and forward: go and find the fight.
  aggressive:
    '<path d="M20 4 10.4 13.6"/>' +
    '<path d="M15.4 4H20v4.6"/>' +
    '<path d="M7.8 11.4 12.6 16.2"/>' +
    '<path d="M10.4 13.6 6.6 17.4"/>' +
    '<circle cx="5.4" cy="18.6" r="1.4"/>',
  // A heraldic shield: hold what you have, hit back at what reaches you.
  defensive:
    '<path d="M12 3.4 19.2 6v6.2c0 3.9-3 6.6-7.2 8.4-4.2-1.8-7.2-4.5-7.2-8.4V6z"/>' +
    '<path d="M12 4.4v15.4"/>' +
    '<path d="M5 10.4h14"/>',
  // One figure between two brackets: this cell, and no other.
  'stand-ground':
    '<path d="M8 4.6H4.6v14.8H8"/>' +
    '<path d="M16 4.6h3.4v14.8H16"/>' +
    '<circle cx="12" cy="8" r="1.8"/>' +
    '<path d="M12 10.4v6.4"/>',
  // A blade struck through: never start anything.
  'no-attack':
    '<circle cx="12" cy="12" r="8.6"/>' +
    '<path d="M5.9 5.9 18.1 18.1"/>' +
    '<path d="M16.6 7.4 8.4 15.6"/>' +
    '<path d="M13.2 7.4h3.4v3.4"/>',
};

export function stanceGlyph(
  stance: UnitStance,
  cls: string = 'hud-command-glyph',
): string {
  return svg(cls, STANCE_GLYPH_BODY[stance]);
}

// ---- Formation glyphs ------------------------------------------------

// Formations read best as the shape the troops stand in, so each glyph IS the
// arrangement: dots for the units, drawn from the marching direction's point
// of view (up the viewBox).
const FORMATION_GLYPH_BODY: Record<UnitFormation, string> = {
  // Two tight ranks across the march.
  line:
    '<circle cx="5" cy="8.6" r="1.5"/><circle cx="9.7" cy="8.6" r="1.5"/>' +
    '<circle cx="14.3" cy="8.6" r="1.5"/><circle cx="19" cy="8.6" r="1.5"/>' +
    '<circle cx="5" cy="15.4" r="1.5"/><circle cx="9.7" cy="15.4" r="1.5"/>' +
    '<circle cx="14.3" cy="15.4" r="1.5"/><circle cx="19" cy="15.4" r="1.5"/>',
  // The same order, offset and spread: no blast covers the group.
  staggered:
    '<circle cx="4.6" cy="6.6" r="1.5"/><circle cx="12" cy="6.6" r="1.5"/>' +
    '<circle cx="19.4" cy="6.6" r="1.5"/>' +
    '<circle cx="8.3" cy="12" r="1.5"/><circle cx="15.7" cy="12" r="1.5"/>' +
    '<circle cx="4.6" cy="17.4" r="1.5"/><circle cx="12" cy="17.4" r="1.5"/>' +
    '<circle cx="19.4" cy="17.4" r="1.5"/>',
  // A closed square with the fragile units inside it.
  box:
    '<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2.6"/>' +
    '<circle cx="12" cy="12" r="1.8"/>' +
    '<path d="M8.6 4.2v2.2M15.4 4.2v2.2M8.6 19.8v-2.2M15.4 19.8v-2.2"/>' +
    '<path d="M4.2 8.6h2.2M4.2 15.4h2.2M19.8 8.6h-2.2M19.8 15.4h-2.2"/>',
  // Two wings with a gap down the middle to part around what is ahead.
  flank:
    '<circle cx="4.6" cy="7.4" r="1.5"/><circle cx="4.6" cy="12" r="1.5"/>' +
    '<circle cx="4.6" cy="16.6" r="1.5"/>' +
    '<circle cx="9.2" cy="9.7" r="1.5"/><circle cx="9.2" cy="14.3" r="1.5"/>' +
    '<circle cx="19.4" cy="7.4" r="1.5"/><circle cx="19.4" cy="12" r="1.5"/>' +
    '<circle cx="19.4" cy="16.6" r="1.5"/>' +
    '<circle cx="14.8" cy="9.7" r="1.5"/><circle cx="14.8" cy="14.3" r="1.5"/>',
};

export function formationGlyph(
  formation: UnitFormation,
  cls: string = 'hud-command-glyph',
): string {
  return svg(cls, FORMATION_GLYPH_BODY[formation]);
}

// ---- Build-page tabs -------------------------------------------------

// The two DE build pages, as the toggle's own icons: a house for Economic, two
// crossed blades for Military. Drawn smaller than a command glyph because they
// sit in the Build heading row beside the group's title.
const BUILD_PAGE_GLYPH_BODY = {
  economic:
    '<path d="M3.6 11 12 4.6l8.4 6.4"/>' +
    '<path d="M5.8 10.4V19h12.4v-8.6"/>' +
    '<path d="M10 19v-4.6h4V19"/>',
  military:
    '<path d="M4.4 19.6 15.6 8.4"/>' +
    '<path d="M12.6 4.4h7v7"/>' +
    '<path d="M19.6 19.6 8.4 8.4"/>' +
    '<path d="M11.4 4.4h-7v7"/>',
} as const;

export type BuildPageGlyphKind = keyof typeof BUILD_PAGE_GLYPH_BODY;

export function buildPageGlyph(
  page: BuildPageGlyphKind,
  cls: string = 'hud-build-page-glyph',
): string {
  return svg(cls, BUILD_PAGE_GLYPH_BODY[page]);
}
