// M7 "UI icons" slice 1 (v0.1.39): original, hand-authored procedural
// SVG glyphs for the top-bar resource chips and the build-command
// buttons.
//
// These are 100% ORIGINAL artwork — simple recognizable silhouettes
// hand-drawn as inline `<path>`/`<rect>`/`<circle>` primitives on a 24×24
// viewBox. There is NO copyrighted Age of Empires II icon/sprite, NO
// `url(...)` to an image, NO `<image>` element, NO icon-font: every glyph
// is self-contained markup. Stroke/fill use `currentColor` only, so the
// existing warm gold-on-dark-teal palette (set in `hudIcons.css`) controls
// the tone — no new hues are introduced here.
//
// Glyphs are decorative: the text label beside/under each glyph carries
// the meaning, so every <svg> is `aria-hidden="true"` and `focusable="false"`.

import type { BuildableBuildingType } from '../../../game/simulation/types';

// Resource-chip glyph keys. The four economy resources are the priority;
// pop / age / time get a natural glyph too since they share the top bar.
export type ResourceGlyphKind =
  | 'food'
  | 'wood'
  | 'gold'
  | 'stone'
  | 'pop'
  | 'age'
  | 'time';

// Shared wrapper. `cls` is the hook class the CSS targets for sizing +
// colour; `body` is the hand-authored inner markup. `stroke-width`,
// `stroke-linejoin`, `stroke-linecap` give the chunky readable line that
// holds up at ~16–20px. No `width`/`height` attribute — the CSS sizes the
// element so the glyph scales with the chip/button font.
function svg(cls: string, body: string): string {
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ` +
    `fill="none" stroke="currentColor" stroke-width="1.6" ` +
    `stroke-linejoin="round" stroke-linecap="round">${body}</svg>`
  );
}

// ---- Resource glyphs -------------------------------------------------

// A wheat sheaf: a central stalk with two angled side stalks and a tie
// band near the base — the classic "food" read.
const FOOD_GLYPH =
  '<path d="M12 3v18"/>' +
  '<path d="M12 7c-2-1.4-4-1.4-5.5-.6C7 8.6 9 9 12 8.4"/>' +
  '<path d="M12 7c2-1.4 4-1.4 5.5-.6C17 8.6 15 9 12 8.4"/>' +
  '<path d="M12 12c-2.2-1.5-4.3-1.5-6-.6 1.6 2.4 3.8 2.8 6 2.1"/>' +
  '<path d="M12 12c2.2-1.5 4.3-1.5 6-.6-1.6 2.4-3.8 2.8-6 2.1"/>' +
  '<path d="M9 17.5c1 .9 2 1.2 3 1.2s2-.3 3-1.2"/>';

// A stacked pair of logs (end-grain circles) bound as a woodpile.
const WOOD_GLYPH =
  '<rect x="3.5" y="9" width="17" height="5.5" rx="2.4"/>' +
  '<rect x="6" y="14.5" width="12" height="5" rx="2.2"/>' +
  '<circle cx="6.4" cy="11.7" r="1.1"/>' +
  '<circle cx="12" cy="11.7" r="1.1"/>' +
  '<circle cx="17.6" cy="11.7" r="1.1"/>';

// A coin: outer rim + an inner "minted" ring mark.
const GOLD_GLYPH =
  '<circle cx="12" cy="12" r="8"/>' +
  '<circle cx="12" cy="12" r="3.6"/>' +
  '<path d="M12 4.2v1.6M12 18.2v1.6M4.2 12h1.6M18.2 12h1.6"/>';

// A faceted rock / boulder cluster — angular stone block.
const STONE_GLYPH =
  '<path d="M5 14.5 9 7l5 .5 4.5 6-2.5 5.5H7.5z"/>' +
  '<path d="M9 7.5 11 13l-4 1.4"/>' +
  '<path d="M14 7.8 11 13l5.8.8"/>';

// Population: a little house with a person silhouette inside the doorway.
const POP_GLYPH =
  '<path d="M4 11 12 5l8 6"/>' +
  '<path d="M6 10.5V19h12v-8.5"/>' +
  '<circle cx="12" cy="12.4" r="1.5"/>' +
  '<path d="M9.5 19v-2.2c0-1.4 1.1-2.4 2.5-2.4s2.5 1 2.5 2.4V19"/>';

// Age: a small banner/standard on a pole — "march of ages" pennant.
const AGE_GLYPH =
  '<path d="M7 3v18"/>' +
  '<path d="M7 4.5h11l-2.5 3L18 10.5H7z"/>' +
  '<path d="M7 20h6"/>';

// Time: a simple clock face with hands.
const TIME_GLYPH =
  '<circle cx="12" cy="12" r="8"/>' +
  '<path d="M12 7.5V12l3 2"/>';

const RESOURCE_GLYPH_BODY: Record<ResourceGlyphKind, string> = {
  food: FOOD_GLYPH,
  wood: WOOD_GLYPH,
  gold: GOLD_GLYPH,
  stone: STONE_GLYPH,
  pop: POP_GLYPH,
  age: AGE_GLYPH,
  time: TIME_GLYPH,
};

// Returns the inline-SVG markup for a top-bar resource chip glyph. The
// `hud-chip-glyph` class is the CSS hook; the glyph is a sibling of the
// `.hud-value` element so the value text stays "200" (the browser tests
// assert exact value text).
export function resourceGlyph(kind: ResourceGlyphKind): string {
  return svg('hud-chip-glyph', RESOURCE_GLYPH_BODY[kind]);
}

// ---- Building glyphs -------------------------------------------------

// A pitched-roof house outline.
const HOUSE_GLYPH =
  '<path d="M4 11 12 5l8 6"/>' +
  '<path d="M6 10.5V19h12v-8.5"/>' +
  '<rect x="10.5" y="14" width="3" height="5"/>';

// Town Center: a large keep with a banner on top.
const TOWN_CENTER_GLYPH =
  '<path d="M5 10 12 5l7 5"/>' +
  '<path d="M6.5 9.5V19h11V9.5"/>' +
  '<rect x="10.3" y="13.5" width="3.4" height="5.5"/>' +
  '<path d="M12 5V2.5h3l-1 1.2 1 1.2h-3"/>';

// Mill: a windmill — round body + four sail blades.
const MILL_GLYPH =
  '<path d="M8.5 19h7l-1-8h-5z"/>' +
  '<circle cx="12" cy="10" r="1.2"/>' +
  '<path d="M12 10 6.5 6M12 10l5.5-4M12 10l-4 5.5M12 10l4 5.5"/>';

// Lumber Camp: a felling axe (head + handle) over a small log.
const LUMBER_CAMP_GLYPH =
  '<path d="M6 18 15 6"/>' +
  '<path d="M13 4.5c2-1 4 0 4.5 2.2.4 2-1 3.6-3 3.6-1.2 0-2.3-.7-2.8-1.8z"/>' +
  '<rect x="4" y="16.5" width="9" height="3" rx="1.4"/>';

// Mining Camp: a pickaxe crossed feel — curved head + handle + ore bits.
const MINING_CAMP_GLYPH =
  '<path d="M4.5 8.5c4-2.5 11-2.5 15 0"/>' +
  '<path d="M12 8 11 19"/>' +
  '<circle cx="6" cy="17" r="1"/>' +
  '<circle cx="17.5" cy="16.5" r="1.2"/>';

// Barracks: crossed swords behind a small shield.
const BARRACKS_GLYPH =
  '<path d="M5 5l9 9M5 7V5h2"/>' +
  '<path d="M19 5l-9 9M19 7V5h-2"/>' +
  '<path d="M12 11.5 8.5 13v3.2c0 2 1.6 3.3 3.5 4 1.9-.7 3.5-2 3.5-4V13z"/>';

// Watch Tower: a tall tower with crenellations.
const WATCH_TOWER_GLYPH =
  '<path d="M8 19V8h8v11"/>' +
  '<path d="M7.5 8V5.5h1.6V7h1.6V5.5h1.6V7h1.6V5.5h1.6V8"/>' +
  '<path d="M10.5 19v-4h3v4"/>';

// Stable: a horse head/arch silhouette under a roof.
const STABLE_GLYPH =
  '<path d="M4 10 12 5l8 5"/>' +
  '<path d="M6 9.5V19h12V9.5"/>' +
  '<path d="M9.5 19v-4.5c0-1.6 1.1-2.7 2.5-2.7s2.5 1.1 2.5 2.7V19"/>';

// Archery Range: a bow with a nocked arrow.
const ARCHERY_RANGE_GLYPH =
  '<path d="M7 4c5 2.2 5 13.8 0 16"/>' +
  '<path d="M7 4v16"/>' +
  '<path d="M5 12h13"/>' +
  '<path d="M16 9.5 18.5 12 16 14.5"/>';

// Blacksmith: an anvil.
const BLACKSMITH_GLYPH =
  '<path d="M4 9h11c0 2-1.5 3.2-3.5 3.4"/>' +
  '<path d="M15 9c1.5-1 3-.6 3.5.8"/>' +
  '<path d="M9 12.4 8 16"/>' +
  '<rect x="5.5" y="16" width="8" height="2.6" rx="0.6"/>';

// Market: a stall with a striped awning.
const MARKET_GLYPH =
  '<path d="M4 9l1.5-3.5h13L20 9"/>' +
  '<path d="M4 9c1.3 1.5 3.4 1.5 4.7 0 1.3 1.5 3.3 1.5 4.6 0 1.3 1.5 3.4 1.5 4.7 0"/>' +
  '<path d="M6 10.5V19h12v-8.5"/>';

// Siege Workshop: a catapult / trebuchet arm.
const SIEGE_WORKSHOP_GLYPH =
  '<path d="M4 18l11-9"/>' +
  '<circle cx="16" cy="8" r="1.6"/>' +
  '<path d="M4 18h8"/>' +
  '<path d="M6.5 18l3.5-5"/>' +
  '<circle cx="6.5" cy="18.5" r="1.2"/>' +
  '<circle cx="11.5" cy="18.5" r="1.2"/>';

// Monastery: a chapel with a cross on the roof peak.
const MONASTERY_GLYPH =
  '<path d="M12 3v3"/>' +
  '<path d="M10.5 4.5h3"/>' +
  '<path d="M6 11 12 6.5 18 11"/>' +
  '<path d="M7.5 10.5V19h9v-8.5"/>' +
  '<path d="M10.5 19v-3.5a1.5 1.5 0 0 1 3 0V19"/>';

// Castle: a battlemented keep with two towers.
const CASTLE_GLYPH =
  '<path d="M5 19V9l1.6 1V8h1.6v2H10V7h1.5l.5-1 .5 1H14v3h1.2V8h1.6v2L18 9v10z"/>' +
  '<path d="M10.5 19v-3.5h3V19"/>';

// Wonder: a grand domed monument.
const WONDER_GLYPH =
  '<path d="M12 3c2.5 1.5 4 4 4 6H8c0-2 1.5-4.5 4-6z"/>' +
  '<path d="M7 9h10"/>' +
  '<path d="M8 9v10M16 9v10M12 9v10"/>' +
  '<path d="M5.5 19h13"/>';

// Stone Wall: a stacked-block wall segment with battlements.
const STONE_WALL_GLYPH =
  '<path d="M5 9h2.6V7H10v2h4V7h2.4v2H19v9H5z"/>' +
  '<path d="M5 13.5h14"/>' +
  '<path d="M9.5 9v4.5M14.5 9v4.5M7 13.5V18M12 13.5V18M17 13.5V18"/>';

// Palisade Wall: vertical sharpened wooden stakes lashed together.
const PALISADE_WALL_GLYPH =
  '<path d="M7 19V8l1.5-2L10 8v11"/>' +
  '<path d="M11 19V8l1.5-2L14 8v11"/>' +
  '<path d="M15 19V8l1.5-2L18 8v11"/>' +
  '<path d="M6 12.5h13"/>';

// Farm: a tilled field — a bordered plot with furrow rows.
const FARM_GLYPH =
  '<rect x="4" y="6" width="16" height="12" rx="1.5"/>' +
  '<path d="M4 10h16M4 14h16"/>' +
  '<path d="M9 6v12M14 6v12"/>';

const BUILDING_GLYPH_BODY: Record<BuildableBuildingType, string> = {
  'town-center': TOWN_CENTER_GLYPH,
  house: HOUSE_GLYPH,
  mill: MILL_GLYPH,
  'lumber-camp': LUMBER_CAMP_GLYPH,
  'mining-camp': MINING_CAMP_GLYPH,
  barracks: BARRACKS_GLYPH,
  'watch-tower': WATCH_TOWER_GLYPH,
  stable: STABLE_GLYPH,
  'archery-range': ARCHERY_RANGE_GLYPH,
  blacksmith: BLACKSMITH_GLYPH,
  market: MARKET_GLYPH,
  'siege-workshop': SIEGE_WORKSHOP_GLYPH,
  monastery: MONASTERY_GLYPH,
  castle: CASTLE_GLYPH,
  wonder: WONDER_GLYPH,
  'stone-wall': STONE_WALL_GLYPH,
  'palisade-wall': PALISADE_WALL_GLYPH,
  farm: FARM_GLYPH,
};

// Returns the inline-SVG markup for a build-command button glyph. The
// `hud-command-glyph` class is the CSS hook; the glyph sits before the
// "Build <Name>" text inside the button (the text label is preserved).
export function buildingGlyph(buildingType: BuildableBuildingType): string {
  return svg('hud-command-glyph', BUILDING_GLYPH_BODY[buildingType]);
}

// Returns the building-glyph markup with a caller-supplied hook class, so
// the selection panel (slice 2) can reuse the SAME 18-type building art
// under its own `hud-selection-unit-glyph` CSS hook without duplicating
// the path data. The build-button path above keeps its own class.
export function buildingGlyphWithClass(
  buildingType: BuildableBuildingType,
  cls: string,
): string {
  return svg(cls, BUILDING_GLYPH_BODY[buildingType]);
}

// Membership test for the buildable building types, keyed off the glyph
// map itself so it can never drift from the set of types that have a
// glyph. Used by the selection-glyph dispatcher to route a building
// entityType to the building glyph. The `unknown`-narrowing keeps it usable
// against the wider `SelectionState['selectedEntityType']` union. Uses
// `Object.hasOwn` (not `in`) so prototype keys like 'constructor'/'toString'
// can never spuriously match and route to non-string garbage markup.
export function isBuildableBuildingType(
  value: unknown,
): value is BuildableBuildingType {
  return typeof value === 'string' && Object.hasOwn(BUILDING_GLYPH_BODY, value);
}

// ---- Command glyphs (non-build/train command buttons) ----------------

// A single generic RESEARCH glyph for the "Research <Name>" command buttons:
// an open book (center spine + two feathered pages) with a small upgrade
// chevron above it — the universal "study / advance" read. One glyph for
// every tech (the button label carries the specific tech name); per-tech or
// per-category research art is a later slice. Defaults to the 17px command
// class so it matches the neighbouring Build/Train glyphs.
const RESEARCH_GLYPH_BODY =
  '<path d="M12 8.4v9.4"/>' +
  '<path d="M12 8.4C9.7 7 6.3 6.8 4 7.6v9.4c2.3-0.8 5.7-0.6 8 0.8"/>' +
  '<path d="M12 8.4c2.3-1.4 5.7-1.6 8-0.8v9.4c-2.3-0.8-5.7-0.6-8 0.8"/>' +
  '<path d="M9.6 5.4 12 3.4l2.4 2"/>';

export function researchGlyph(cls: string = 'hud-command-glyph'): string {
  return svg(cls, RESEARCH_GLYPH_BODY);
}
