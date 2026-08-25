// M7 "UI icons" slice 2 (v0.1.44): original, hand-authored procedural SVG
// glyphs for the SELECTION-panel badge.
//
// Slice 1 (v0.1.39) iconified the top-bar resource chips and the
// "Build <Name>" command buttons (see ./glyphs.ts). This slice gives the
// SELECTION badge a glyph: one inline-SVG per unit RENDER ROLE (mirroring
// the on-map voxel silhouettes in `src/rendering/voxel/aoeVoxelUnitRecipes.ts`),
// plus the existing per-building glyph reused for a selected building.
//
// Authoring rules are identical to slice 1: every glyph is 100% ORIGINAL
// markup on a 24×24 viewBox (hand-drawn `<path>`/`<rect>`/`<circle>`
// primitives) — NO copyrighted Age of Empires sprite/icon, NO `url(...)`,
// NO `<image>`/`<use href>` element, NO icon-font. Stroke/fill use
// `currentColor` only, so the warm gold-on-dark-teal palette set in
// `hudIcons.css` controls the tone. Glyphs are decorative (the two-letter
// code in the badge + the unit-label name carry the meaning), so every
// <svg> is `aria-hidden="true"` and `focusable="false"`.
//
// CONTRACT: the glyph is rendered as a SIBLING of the badge `<div>` (which
// keeps holding only its two-letter code), exactly mirroring how slice 1
// keeps `.hud-value` holding only the number with the glyph as a sibling —
// so the Playwright browser specs that assert exact badge text via
// `toHaveText('V')` / `'TC'` still pass.

import type { SelectionState, UnitType } from '../../../game/simulation/types';
import { isUnitType } from '../displayNames';
import {
  buildingGlyphWithClass,
  isBuildableBuildingType,
  resourceNodeGlyph,
  selectionExtraGlyph,
} from './glyphs';

// The seven AoE-owned visual roles used by both DOM glyphs and voxel recipes.
export type UnitGlyphRole =
  | 'villager'
  | 'infantry'
  | 'archer'
  | 'cavalry'
  | 'cavalry-archer'
  | 'siege'
  | 'monk'
  | 'ship';

// The CSS hook the selection panel + `hudIcons.css` target for sizing and
// colour. ONE hook for the whole selection badge (units AND buildings) so
// the badge sizes consistently regardless of entity kind.
const SELECTION_GLYPH_CLASS = 'hud-selection-unit-glyph';

// Shared wrapper — same chunky, readable stroke as slice 1's `svg()`. No
// width/height attribute: the CSS sizes the element so the glyph scales
// with the badge.
function svg(body: string, cls: string = SELECTION_GLYPH_CLASS): string {
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ` +
    `fill="none" stroke="currentColor" stroke-width="1.6" ` +
    `stroke-linejoin="round" stroke-linecap="round">${body}</svg>`
  );
}

// ---- per-role glyph bodies. Each roughly echoes the on-map role
// silhouette so a player who learns the map shape recognizes the badge. ---

// Villager: a rounded head + body with a small tool over the shoulder
// (civilian, not a soldier).
const VILLAGER_GLYPH =
  '<circle cx="12" cy="6.5" r="2.6"/>' +
  '<path d="M7.5 19v-4.5c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5V19"/>' +
  '<path d="M15.5 11 18 5.5"/>';

// Infantry (foot melee): a kite shield with an upright sword behind it.
const INFANTRY_GLYPH =
  '<path d="M12 3v8"/>' +
  '<path d="M10.5 5h3"/>' +
  '<path d="M8 11.5 12 10l4 1.5v4c0 2.4-1.8 4-4 4.8-2.2-.8-4-2.4-4-4.8z"/>';

// Archer (foot ranged): a vertical bow with a nocked arrow drawn across it.
const ARCHER_GLYPH =
  '<path d="M8 4c4 2.4 4 13.6 0 16"/>' +
  '<path d="M8 4v16"/>' +
  '<path d="M6 12h12"/>' +
  '<path d="M15.5 9.5 18.5 12 15.5 14.5"/>';

// Cavalry (mounted melee): a horse-and-rider profile — an elongated mount
// body with a head and a rider bump, plus a lance.
const CAVALRY_GLYPH =
  '<path d="M5 16c0-2.2 2.2-3.6 5-3.6h3.5c2 0 3.5 1 4.5 2.4"/>' +
  '<path d="M18 14.8 19.5 11l-2-1"/>' +
  '<path d="M7 16v2.5M16 15.5V18.5"/>' +
  '<circle cx="11.5" cy="9.5" r="2"/>' +
  '<path d="M13 8 18 5"/>';

// Cavalry archer (mounted ranged): the mount profile with a bow instead of
// a lance.
const CAVALRY_ARCHER_GLYPH =
  '<path d="M5 16c0-2.2 2.2-3.6 5-3.6h3.5c2 0 3.5 1 4.5 2.4"/>' +
  '<path d="M7 16v2.5M16 15.5V18.5"/>' +
  '<circle cx="11.5" cy="9.5" r="2"/>' +
  '<path d="M16 5c2.4 1.4 2.4 6.6 0 8"/>' +
  '<path d="M16 5v8"/>';

// Siege (machine): a catapult — a wheeled base with a throwing arm and a
// payload, the most rectilinear/mechanical silhouette.
const SIEGE_GLYPH =
  '<path d="M4 17 16 7"/>' +
  '<circle cx="16" cy="6.5" r="1.8"/>' +
  '<path d="M4 17h9"/>' +
  '<path d="M6.5 17 10 11.5"/>' +
  '<circle cx="6.5" cy="18" r="1.3"/>' +
  '<circle cx="11.5" cy="18" r="1.3"/>';

// Monk: a hooded robe (triangle) with a cross — unarmed, orientation-free.
const MONK_GLYPH =
  '<path d="M12 3 7 19h10z"/>' +
  '<path d="M12 8v6"/>' +
  '<path d="M9.5 10.5h5"/>';

// Ship: a hull with a mast and a furled sail.
const SHIP_GLYPH =
  '<path d="M4 14.5h16l-2.2 4.5H6.2z"/>' +
  '<path d="M12 14V4"/>' +
  '<path d="M12 5.5 17 10h-5"/>';

const UNIT_ROLE_GLYPH_BODY: Record<UnitGlyphRole, string> = {
  villager: VILLAGER_GLYPH,
  infantry: INFANTRY_GLYPH,
  archer: ARCHER_GLYPH,
  cavalry: CAVALRY_GLYPH,
  'cavalry-archer': CAVALRY_ARCHER_GLYPH,
  siege: SIEGE_GLYPH,
  monk: MONK_GLYPH,
  ship: SHIP_GLYPH,
};

// Exhaustive, selection-owned mapping of every UnitType to its visual role.
// `satisfies Record<UnitType, UnitGlyphRole>` makes a newly-added UnitType a
// compile error here. A drift-guard test compares this mapping with the voxel
// recipe classification so the badge glyph and world silhouette agree.
const UNIT_GLYPH_ROLES = {
  villager: 'villager',
  // Infantry (foot melee).
  militia: 'infantry',
  'man-at-arms': 'infantry',
  'long-swordsman': 'infantry',
  'two-handed-swordsman': 'infantry',
  champion: 'infantry',
  spearman: 'infantry',
  pikeman: 'infantry',
  halberdier: 'infantry',
  // Archer (foot ranged). skirmisher is foot-ranged but NOT in the sim's
  // ARCHER_LINE — the render role is independent of combat class.
  archer: 'archer',
  crossbowman: 'archer',
  arbalest: 'archer',
  skirmisher: 'archer',
  'elite-skirmisher': 'archer',
  'eagle-warrior': 'infantry',
  'elite-eagle-warrior': 'infantry',
  'hand-cannoneer': 'archer',
  longbowman: 'archer',
  'elite-longbowman': 'archer',
  // Cavalry (mounted melee).
  scout: 'cavalry',
  'light-cavalry': 'cavalry',
  hussar: 'cavalry',
  camel: 'cavalry',
  'heavy-camel': 'cavalry',
  knight: 'cavalry',
  cavalier: 'cavalry',
  paladin: 'cavalry',
  // Cavalry archer (mounted ranged).
  'cavalry-archer': 'cavalry-archer',
  'heavy-cavalry-archer': 'cavalry-archer',
  // Siege (machines).
  mangonel: 'siege',
  onager: 'siege',
  scorpion: 'siege',
  'heavy-scorpion': 'siege',
  'battering-ram': 'siege',
  'siege-ram': 'siege',
  'capped-ram': 'siege',
  'siege-onager': 'siege',
  'bombard-cannon': 'siege',
  trebuchet: 'siege',
  petard: 'infantry',
  'trade-cart': 'siege',
  // M5 naval.
  'fishing-ship': 'ship',
  'transport-ship': 'ship',
  'galley': 'ship',
  'war-galley': 'ship',
  'galleon': 'ship',
  'fire-ship': 'ship',
  'fast-fire-ship': 'ship',
  'demolition-ship': 'ship',
  'heavy-demolition-ship': 'ship',
  'cannon-galleon': 'ship',
  'elite-cannon-galleon': 'ship',
  'jaguar-warrior': 'infantry',
  'cataphract': 'cavalry',
  'woad-raider': 'infantry',
  'chu-ko-nu': 'archer',
  'throwing-axeman': 'archer',
  'huskarl': 'infantry',
  'tarkan': 'cavalry',
  'samurai': 'infantry',
  'war-wagon': 'cavalry-archer',
  'plumed-archer': 'archer',
  'mangudai': 'cavalry-archer',
  'war-elephant': 'cavalry',
  'mameluke': 'cavalry',
  'conquistador': 'cavalry-archer',
  'teutonic-knight': 'infantry',
  'janissary': 'archer',
  'berserk': 'infantry',
  'turtle-ship': 'ship',
  'longboat': 'ship',
  'elite-jaguar-warrior': 'infantry',
  'elite-cataphract': 'cavalry',
  'elite-woad-raider': 'infantry',
  'elite-chu-ko-nu': 'archer',
  'elite-throwing-axeman': 'archer',
  'elite-huskarl': 'infantry',
  'elite-tarkan': 'cavalry',
  'elite-samurai': 'infantry',
  'elite-war-wagon': 'cavalry-archer',
  'elite-plumed-archer': 'archer',
  'elite-mangudai': 'cavalry-archer',
  'elite-war-elephant': 'cavalry',
  'elite-mameluke': 'cavalry',
  'elite-conquistador': 'cavalry-archer',
  'elite-teutonic-knight': 'infantry',
  'elite-janissary': 'archer',
  'elite-berserk': 'infantry',
  'elite-turtle-ship': 'ship',
  'elite-longboat': 'ship',
  // Monk.
  monk: 'monk',
} as const satisfies Record<UnitType, UnitGlyphRole>;

export function unitGlyphRole(unitType: UnitType): UnitGlyphRole {
  return UNIT_GLYPH_ROLES[unitType];
}

// Returns the inline-SVG markup for a unit role glyph. `cls` overrides the
// sizing/colour hook class: the selection panel uses the default (34px accent
// `hud-selection-unit-glyph`); command-card Train buttons pass
// `hud-command-glyph` so the glyph matches the 17px currentColor Build glyphs.
export function unitRoleGlyph(role: UnitGlyphRole, cls?: string): string {
  return svg(UNIT_ROLE_GLYPH_BODY[role], cls);
}

// Dispatcher the selection panel calls with the badge `kind`. Units map to
// their role glyph; buildings reuse the slice-1 building glyph; a gatherable
// resource node (tree/gold-mine/stone-mine/berry-bush) reuses the top-bar
// commodity glyph (v0.1.77); wildlife (sheep/boar/wolf/fish) + relic get a
// fauna/relic glyph (v0.1.78). Only `null` (and a bare 'town-center', which has
// no glyph yet) falls through to '' (text-only badge).
export function selectionGlyph(
  entityType: SelectionState['selectedEntityType'] | 'sheep',
): string {
  if (entityType === null) {
    return '';
  }
  if (isUnitType(entityType)) {
    return unitRoleGlyph(unitGlyphRole(entityType));
  }
  if (isBuildableBuildingType(entityType)) {
    return buildingGlyphWithClass(entityType, SELECTION_GLYPH_CLASS);
  }
  return (
    resourceNodeGlyph(entityType, SELECTION_GLYPH_CLASS) ||
    selectionExtraGlyph(entityType, SELECTION_GLYPH_CLASS)
  );
}
