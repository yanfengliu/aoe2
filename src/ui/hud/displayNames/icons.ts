// Icon glyph + accent color for every selectable entity type.
//
// ONE ROW PER TYPE, glyph and accent together: these used to be FOUR parallel
// switches — `formatUnitIcon`/`formatUnitIconAccent` over the 34 unit types,
// and `formatEntityIcon`/`formatEntityIconAccent` over the 27 building and
// resource types, each falling through to the unit pair — and this file's own
// header warned they "need to stay synchronized … when a new unit type is
// added, both maps gain a case". A table makes that synchronization structural
// rather than a promise: a type cannot ship with a glyph but no accent,
// because there is only one place to add it.
//
// Same shape, and same reasoning, as the sibling `entityNames.ts` table.
// `tests/ui/entityIconsTable.test.ts` pins all 61 rows against the values the
// switches produced.
//
// The unit-only pair is gone rather than kept: nothing outside this module
// ever called it (only a barrel re-export nobody imported), and the entity
// functions reach every unit row through the table directly.

import type { SelectionState } from '../../../game/simulation/types';

type EntityType = NonNullable<SelectionState['selectedEntityType']>;
type IconRow = readonly [icon: string, accent: string];

// Shown for no selection, and for a future entity type not yet in the table.
const UNKNOWN_ICON = '?';
const UNKNOWN_ACCENT = '#c4ae7a';

// `satisfies Record<EntityType, IconRow>` restores the exhaustiveness the four
// switches had between them: a missing type and a typo'd key are both compile
// errors. ('LC' on lumber-camp and light-cavalry, and 'Pl' on paladin and
// palisade-wall, are pre-existing glyph collisions carried across as-is.)
const ENTITY_ICONS = {
  'town-center': ['TC', '#cfb56f'],
  'house': ['H', '#c39355'],
  'mill': ['ML', '#b79a5f'],
  'lumber-camp': ['LC', '#7ca46a'],
  'mining-camp': ['MC', '#9daabd'],
  'barracks': ['BA', '#b78363'],
  'watch-tower': ['WT', '#b6a7be'],
  'bombard-tower': ['BT', '#9e8fa8'],
  'stable': ['ST', '#bf9463'],
  'archery-range': ['AR', '#a6866f'],
  'blacksmith': ['BS', '#8f98aa'],
  'market': ['MK', '#c4a166'],
  'berry-bush': ['BB', '#a16a89'],
  'gold-mine': ['G', '#d7c46a'],
  'stone-mine': ['S', '#b8c0cf'],
  'boar': ['BO', '#bf7d68'],
  'fish': ['F', '#73b9d6'],
  'sheep': ['SH', '#d9e0e5'],
  'wolf': ['WO', '#9ca6b2'],
  'tree': ['T', '#7fb07a'],
  'villager': ['V', '#8fc6a3'],
  'militia': ['M', '#d07a66'],
  'spearman': ['SP', '#d2b16a'],
  'archer': ['A', '#7fb3d5'],
  'skirmisher': ['SK', '#7ec7c0'],
  'knight': ['K', '#c4b0dc'],
  'scout': ['SC', '#c9a160'],
  'crossbowman': ['CB', '#6ba0cc'],
  'pikeman': ['PK', '#a7c98a'],
  'light-cavalry': ['LC', '#d7b87c'],
  'camel': ['Cm', '#d8c18a'],
  'cavalry-archer': ['CA', '#8ca6c8'],
  'mangonel': ['Mg', '#a0805a'],
  'scorpion': ['Sc', '#b09862'],
  'battering-ram': ['Rm', '#8f6a4a'],
  'siege-workshop': ['SW', '#98856a'],
  'monastery': ['My', '#cfc3a8'],
  'university': ['Un', '#c8bd93'],
  'dock': ['Dk', '#8fb0c0'],
  'monk': ['Mn', '#e3d9b5'],
  'relic': ['Rl', '#f5d680'],
  'castle': ['Ct', '#a09f9c'],
  'wonder': ['Wn', '#e6c36a'],
  'longbowman': ['LB', '#6fa070'],
  'arbalest': ['Ab', '#4f8cc2'],
  'halberdier': ['Hb', '#8cba6f'],
  'hussar': ['Hs', '#c09960'],
  'heavy-cavalry-archer': ['HC', '#7188b0'],
  'cavalier': ['Cv', '#ae9fcc'],
  'champion': ['Ch', '#cf8b52'],
  'elite-longbowman': ['EL', '#4f8652'],
  'onager': ['On', '#7a5d3f'],
  'heavy-scorpion': ['HS', '#957848'],
  'siege-ram': ['SR', '#6e4e33'],
  'bombard-cannon': ['BC', '#3a3a42'],
  'trebuchet': ['Tr', '#6a4f2e'],
  'fishing-ship': ['Fs', '#7fb4c4'],
  'transport-ship': ['Tr', '#a98a5c'],
  'galley': ['Ga', '#8a7a58'],
  'war-galley': ['WG', '#93805a'],
  'galleon': ['Gn', '#9c8a60'],
  'fire-ship': ['Fi', '#c4693c'],
  'fast-fire-ship': ['FF', '#d1743f'],
  'demolition-ship': ['De', '#8a7358'],
  'heavy-demolition-ship': ['HD', '#93795c'],
  'cannon-galleon': ['CG', '#8d8b82'],
  'elite-cannon-galleon': ['EC', '#9a9890'],
  'jaguar-warrior': ['JW', '#c9803a'],
  'cataphract': ['CT', '#b8a24c'],
  'woad-raider': ['WR', '#5c8fb8'],
  'chu-ko-nu': ['CK', '#c2543f'],
  'throwing-axeman': ['TA', '#8e9aa8'],
  'huskarl': ['HK', '#9b7d4e'],
  'tarkan': ['TK', '#b2703c'],
  'samurai': ['SM', '#c25a5a'],
  'war-wagon': ['WW', '#8a6a45'],
  'plumed-archer': ['PA', '#4fa87c'],
  'mangudai': ['MG', '#a8823f'],
  'war-elephant': ['WE', '#8d8d96'],
  'mameluke': ['MK', '#cbab5e'],
  'conquistador': ['CQ', '#c9c2a8'],
  'teutonic-knight': ['TN', '#d8d4cc'],
  'janissary': ['JN', '#b45f8c'],
  'berserk': ['BK', '#a2694a'],
  'turtle-ship': ['TS', '#5f7d5a'],
  'longboat': ['LB', '#7d6a9c'],
  'elite-jaguar-warrior': ['JW', '#c9803a'],
  'elite-cataphract': ['CT', '#b8a24c'],
  'elite-woad-raider': ['WR', '#5c8fb8'],
  'elite-chu-ko-nu': ['CK', '#c2543f'],
  'elite-throwing-axeman': ['TA', '#8e9aa8'],
  'elite-huskarl': ['HK', '#9b7d4e'],
  'elite-tarkan': ['TK', '#b2703c'],
  'elite-samurai': ['SM', '#c25a5a'],
  'elite-war-wagon': ['WW', '#8a6a45'],
  'elite-plumed-archer': ['PA', '#4fa87c'],
  'elite-mangudai': ['MG', '#a8823f'],
  'elite-war-elephant': ['WE', '#8d8d96'],
  'elite-mameluke': ['MK', '#cbab5e'],
  'elite-conquistador': ['CQ', '#c9c2a8'],
  'elite-teutonic-knight': ['TN', '#d8d4cc'],
  'elite-janissary': ['JN', '#b45f8c'],
  'elite-berserk': ['BK', '#a2694a'],
  'elite-turtle-ship': ['TS', '#5f7d5a'],
  'elite-longboat': ['LB', '#7d6a9c'],
  'man-at-arms': ['MA', '#c78a5e'],
  'long-swordsman': ['LS', '#b87548'],
  'two-handed-swordsman': ['TH', '#b66b48'],
  'paladin': ['Pl', '#b8a78c'],
  'heavy-camel': ['HCm', '#ccb37d'],
  'stone-wall': ['Wl', '#9aa0a8'],
  'palisade-wall': ['Pl', '#a88555'],
  'stone-gate': ['Gt', '#b4bac2'],
  'palisade-gate': ['Pg', '#c09a63'],
  'farm': ['Fm', '#d9b84a'],
} as const satisfies Record<EntityType, IconRow>;

// `hasOwn`, not bracket access alone: an object literal inherits from
// Object.prototype, so ENTITY_ICONS['toString'] would resolve to that method
// and the `?? fallback` below would never fire. Same hazard the sibling name
// table hit in commit 3c1016e — a table trades the switch's value comparison
// for a property lookup, and the prototype chain comes with it.
function iconRow(entityType: SelectionState['selectedEntityType']): IconRow | undefined {
  if (!entityType) return undefined;
  return Object.hasOwn(ENTITY_ICONS, entityType)
    ? (ENTITY_ICONS as Readonly<Record<string, IconRow>>)[entityType]
    : undefined;
}

export function formatEntityIcon(entityType: SelectionState['selectedEntityType']): string {
  return iconRow(entityType)?.[0] ?? UNKNOWN_ICON;
}

export function formatEntityIconAccent(entityType: SelectionState['selectedEntityType']): string {
  return iconRow(entityType)?.[1] ?? UNKNOWN_ACCENT;
}
