// Characterization test for the entity icon + accent table.
//
// Captured from the pre-table implementation (FOUR parallel switches:
// formatUnitIcon / formatUnitIconAccent over 34 unit types, and
// formatEntityIcon / formatEntityIconAccent over 27 building+resource types
// that fell through to the unit pair) and asserted against the one table that
// replaced them. Same shape as `entityNamesTable.test.ts`, which pins the
// sibling name table: EXPECTED is typed as a TOTAL Record over the entity
// union, so the COMPILER forces all 61 types to be pinned rather than letting
// a row go silently unchecked.
//
// The rows below were extracted mechanically by calling the OLD switches for
// every key of ENTITY_NAMES — never hand-transcribed. ('LC' on both
// lumber-camp and light-cavalry, and 'Pl' on both paladin and palisade-wall,
// are pre-existing glyph collisions carried across verbatim, not typos.)

import { describe, expect, it } from 'vitest';

import type { SelectionState } from '../../src/game/simulation/types';
import { formatEntityIcon, formatEntityIconAccent } from '../../src/ui/hud/displayNames/icons';

type Entity = NonNullable<SelectionState['selectedEntityType']>;

const EXPECTED: Readonly<Record<Entity, readonly [icon: string, accent: string]>> = {
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
  'deer': ['De', '#c09a68'],
  'fish': ['F', '#73b9d6'],
  'sheep': ['SH', '#d9e0e5'],
  'wolf': ['WO', '#9ca6b2'],
  'tree': ['T', '#7fb07a'],
  'villager': ['V', '#8fc6a3'],
  'militia': ['M', '#d07a66'],
  'spearman': ['SP', '#d2b16a'],
  'archer': ['A', '#7fb3d5'],
  'skirmisher': ['SK', '#7ec7c0'],
  'elite-skirmisher': ['ES', '#9fdcd6'],
  'eagle-warrior': ['EW', '#8fd6a8'],
  'elite-eagle-warrior': ['EE', '#7ec99a'],
  'hand-cannoneer': ['HC', '#9aa8bd'],
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
  'outpost': ['Op', '#c0a878'],
  'fish-trap': ['FT', '#7fb8c0'],
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
  'siege-onager': ['SO', '#96714b'],
  'heavy-scorpion': ['HS', '#957848'],
  'siege-ram': ['SR', '#6e4e33'],
  'capped-ram': ['CR', '#7d6349'],
  'bombard-cannon': ['BC', '#3a3a42'],
  'trebuchet': ['Tr', '#6a4f2e'],
  'petard': ['Pe', '#8a6b46'],
  'trade-cart': ['Tr', '#b08d57'],
  'trade-cog': ['Tc', '#b08d57'],
  'missionary': ['Ms', '#d8cfc0'],
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
  'elite-jaguar-warrior': ['JW', '#c9803a'],
  'cataphract': ['CT', '#b8a24c'],
  'elite-cataphract': ['CT', '#b8a24c'],
  'woad-raider': ['WR', '#5c8fb8'],
  'elite-woad-raider': ['WR', '#5c8fb8'],
  'chu-ko-nu': ['CK', '#c2543f'],
  'elite-chu-ko-nu': ['CK', '#c2543f'],
  'throwing-axeman': ['TA', '#8e9aa8'],
  'elite-throwing-axeman': ['TA', '#8e9aa8'],
  'huskarl': ['HK', '#9b7d4e'],
  'elite-huskarl': ['HK', '#9b7d4e'],
  'tarkan': ['TK', '#b2703c'],
  'elite-tarkan': ['TK', '#b2703c'],
  'samurai': ['SM', '#c25a5a'],
  'elite-samurai': ['SM', '#c25a5a'],
  'war-wagon': ['WW', '#8a6a45'],
  'elite-war-wagon': ['WW', '#8a6a45'],
  'plumed-archer': ['PA', '#4fa87c'],
  'elite-plumed-archer': ['PA', '#4fa87c'],
  'mangudai': ['MG', '#a8823f'],
  'elite-mangudai': ['MG', '#a8823f'],
  'war-elephant': ['WE', '#8d8d96'],
  'elite-war-elephant': ['WE', '#8d8d96'],
  'mameluke': ['MK', '#cbab5e'],
  'elite-mameluke': ['MK', '#cbab5e'],
  'conquistador': ['CQ', '#c9c2a8'],
  'elite-conquistador': ['CQ', '#c9c2a8'],
  'teutonic-knight': ['TN', '#d8d4cc'],
  'elite-teutonic-knight': ['TN', '#d8d4cc'],
  'janissary': ['JN', '#b45f8c'],
  'elite-janissary': ['JN', '#b45f8c'],
  'berserk': ['BK', '#a2694a'],
  'elite-berserk': ['BK', '#a2694a'],
  'turtle-ship': ['TS', '#5f7d5a'],
  'elite-turtle-ship': ['TS', '#5f7d5a'],
  'longboat': ['LB', '#7d6a9c'],
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
};

describe('entity icons', () => {
  it('renders the same icon and accent as the pre-table switches', () => {
    for (const [entityType, [icon, accent]] of Object.entries(EXPECTED) as [
      Entity, readonly [string, string],
    ][]) {
      expect(formatEntityIcon(entityType), `${entityType} icon`).toBe(icon);
      expect(formatEntityIconAccent(entityType), `${entityType} accent`).toBe(accent);
    }
  });

  it('keeps the no-selection fallbacks', () => {
    expect(formatEntityIcon(null)).toBe('?');
    expect(formatEntityIconAccent(null)).toBe('#c4ae7a');
  });

  it('falls back for an unknown future type instead of returning undefined', () => {
    // The pre-table `formatEntityIcon` default arm was
    // `entityType ? formatUnitIcon(entityType) : '?'` — no isUnitType guard —
    // so an unknown id reached the unit switch, matched no case, and fell out
    // as UNDEFINED from a `: string` signature. Its sibling accent arm DID
    // guard and returned the fallback. Probed on the pre-table code:
    //   formatEntityIcon('<unknown>')       -> undefined
    //   formatEntityIconAccent('<unknown>') -> '#c4ae7a'
    // (Probed with 'trade-cog' before v0.3.69 made that a REAL unit — the
    // probe id must stay one the roster will never contain.)
    // Unreachable through the typed API (the 27 cases exhausted BuildingType
    // and ResourceKind, so TS narrowed the default arm to UnitType | null), so
    // this is the one deliberate delta of the table refactor: the icon now
    // honours its declared return type, matching the accent that never broke.
    const unknown = 'ox-wagon' as Entity;
    expect(formatEntityIcon(unknown)).toBe('?');
    expect(formatEntityIconAccent(unknown)).toBe('#c4ae7a');
  });

  it('rejects inherited Object.prototype members instead of returning them', () => {
    // The hazard a table introduces that the switches did not have: an object
    // literal inherits from Object.prototype, so ENTITY_ICONS['toString']
    // resolves to that method and a bare `?? fallback` never fires. This is
    // the exact bug fixed in the sibling name table (commit 3c1016e); the
    // lookup must use Object.hasOwn, and this test is what holds it there.
    for (const inherited of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
      expect(formatEntityIcon(inherited as Entity), `${inherited} icon`).toBe('?');
      expect(formatEntityIconAccent(inherited as Entity), `${inherited} accent`)
        .toBe('#c4ae7a');
    }
  });
});
