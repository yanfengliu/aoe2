import { describe, expect, it } from 'vitest';

import {
  selectionGlyph,
  unitGlyphRole,
  unitRoleGlyph,
  type UnitGlyphRole,
} from '../../src/ui/hud/icons/unitGlyphs';
import { buildingGlyph, buildingGlyphWithClass } from '../../src/ui/hud/icons/glyphs';
import { unitRole } from '../../src/phaser/scenes/gameScene/unitRenderer';
import { ALL_UNIT_TYPES } from '../../src/phaser/scenes/gameScene/unitTypeMap';
import { renderSelectionIcons } from '../../src/ui/hud/selectionPanel';
import type {
  BuildableBuildingType,
  EconomyState,
  SelectionState,
  UnitType,
} from '../../src/game/simulation/types';

// M7 UI-icons slice 2 (v0.1.44): original procedural glyph icons for the
// SELECTION-panel badge — one inline-SVG per unit RENDER ROLE (mirroring
// the on-map unitRenderer roles) + the existing per-building glyph reused
// for selected buildings. These tests pin the "100% original / procedural,
// no asset or font reference" constraint AND the augment-don't-replace
// contract: the two-letter badge code (the text the Playwright browser
// specs assert via toHaveText) + every data-* hook survive, with the glyph
// added as a SIBLING (exactly like slice 1's resource-chip glyph).

const ALL_ROLES: UnitGlyphRole[] = [
  'villager',
  'infantry',
  'archer',
  'cavalry',
  'cavalry-archer',
  'siege',
  'monk',
];

const ALL_BUILDINGS: BuildableBuildingType[] = [
  'town-center',
  'house',
  'mill',
  'lumber-camp',
  'mining-camp',
  'barracks',
  'watch-tower',
  'stable',
  'archery-range',
  'blacksmith',
  'market',
  'siege-workshop',
  'monastery',
  'castle',
  'wonder',
  'stone-wall',
  'palisade-wall',
  'farm',
];

// Mirror of hudIcons.test.ts's guard: no external asset/font reference is
// allowed — glyphs must be 100% inline-authored SVG, never a url() to an
// image, an <image>/<use href>, an icon-font, or a remote/data href.
function expectNoExternalAssetRefs(markup: string): void {
  expect(markup).not.toMatch(/url\(/i);
  expect(markup).not.toMatch(/<image\b/i);
  expect(markup).not.toMatch(/<use\b/i);
  expect(markup).not.toMatch(/@font-face/i);
  expect(markup).not.toMatch(/font-family/i);
  expect(markup).not.toMatch(/href\s*=/i);
  expect(markup).not.toMatch(/https?:/i);
  expect(markup).not.toMatch(/@import/i);
  expect(markup).not.toMatch(/data:/i);
}

describe('unitRoleGlyph — procedural inline-SVG selection role icons', () => {
  it('returns a self-contained inline <svg> for every role', () => {
    for (const role of ALL_ROLES) {
      const markup = unitRoleGlyph(role);
      expect(markup).toMatch(/<svg\b/);
      expect(markup).toContain('</svg>');
      // Decorative — the two-letter code + the unit-label name carry the
      // meaning, so the glyph is hidden from the accessibility tree.
      expect(markup).toContain('aria-hidden="true"');
      expectNoExternalAssetRefs(markup);
    }
  });

  it('uses currentColor so the existing palette (CSS) controls the tone — no baked hex hues', () => {
    for (const role of ALL_ROLES) {
      const markup = unitRoleGlyph(role);
      expect(markup).toContain('currentColor');
      expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('carries the selection-glyph hook class so the CSS can size/colour it', () => {
    expect(unitRoleGlyph('villager')).toContain('class="hud-selection-unit-glyph"');
  });

  it('produces distinct markup per role (a villager is not a siege engine)', () => {
    const set = new Set(ALL_ROLES.map((role) => unitRoleGlyph(role)));
    expect(set.size).toBe(ALL_ROLES.length);
  });
});

describe('unitGlyphRole — role map agrees with the on-map renderer (drift guard)', () => {
  it('returns a role for every UnitType (exhaustive)', () => {
    for (const unitType of Object.keys(ALL_UNIT_TYPES) as UnitType[]) {
      expect(ALL_ROLES).toContain(unitGlyphRole(unitType));
    }
  });

  it('matches unitRenderer.unitRole for every UnitType (so the badge glyph and the map silhouette never diverge)', () => {
    for (const unitType of Object.keys(ALL_UNIT_TYPES) as UnitType[]) {
      expect(unitGlyphRole(unitType)).toBe(unitRole(unitType));
    }
  });
});

describe('selectionGlyph — dispatcher (unit role / building / else)', () => {
  it('returns the role glyph for a unit', () => {
    expect(selectionGlyph('villager')).toBe(unitRoleGlyph('villager'));
    expect(selectionGlyph('knight')).toBe(unitRoleGlyph('cavalry'));
    expect(selectionGlyph('mangonel')).toBe(unitRoleGlyph('siege'));
    expect(selectionGlyph('skirmisher')).toBe(unitRoleGlyph('archer'));
  });

  it('reuses the slice-1 building ART for every buildable building type, under the selection hook class', () => {
    for (const buildingType of ALL_BUILDINGS) {
      const markup = selectionGlyph(buildingType);
      // Same path data as the build-button glyph (art reused, not
      // duplicated), but rendered under the selection sizing hook so the
      // whole selection badge sizes consistently.
      expect(markup).toBe(buildingGlyphWithClass(buildingType, 'hud-selection-unit-glyph'));
      expect(markup).toContain('class="hud-selection-unit-glyph"');
      // And it carries the same inner path body as buildingGlyph.
      const inner = (s: string): string =>
        s.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>$/, '');
      expect(inner(markup)).toBe(inner(buildingGlyph(buildingType)));
    }
  });

  it('returns empty for resources / wildlife / relic (out of this slice) and for null', () => {
    for (const kind of [
      'sheep',
      'boar',
      'fish',
      'berry-bush',
      'tree',
      'gold-mine',
      'stone-mine',
      'wolf',
      'relic',
    ] as const) {
      expect(selectionGlyph(kind)).toBe('');
    }
    expect(selectionGlyph(null)).toBe('');
  });
});

// ---- renderSelectionIcons: augment-don't-replace contract --------------

function economyStateWith(
  units: EconomyState['units'],
  resources: EconomyState['resources'] = [],
): EconomyState {
  return {
    ages: {},
    playerResources: {},
    population: {},
    villagers: [],
    resources,
    units,
    buildings: [],
  };
}

function baseSelectionState(overrides: Partial<SelectionState>): SelectionState {
  return {
    selectedEntityId: null,
    selectedEntityIds: [],
    selectedCount: 0,
    selectedKind: null,
    selectedEntityType: null,
    owner: null,
    health: null,
    attack: null,
    armor: null,
    pierceArmor: null,
    faction: null,
    civ: null,    inventory: null,
    activity: null,
    activityBreakdown: null,
    x: null,
    y: null,
    tileX: null,
    tileY: null,
    tileEntityIndex: null,
    tileEntityCount: 0,
    resourceAmount: null,
    resourceMaxAmount: null,
    actionOptions: [],
    buildOptions: [],
    marketOptions: [],
    trainOptions: [],
    visibleResearchOptions: [],
    researchOptions: [],
    queue: [],
    placementMode: null,
    ...overrides,
  };
}

function villagerUnit(id: number): EconomyState['units'][number] {
  return {
    id,
    owner: 1,
    unitType: 'villager',
    x: 0,
    y: 0,
    task: 'idle',
    attackDamage: 3,
    attackRange: 1,
    armor: 0,
  };
}

function sheepResource(id: number): EconomyState['resources'][number] {
  return {
    id,
    resourceType: 'sheep',
    amount: 100,
    maxAmount: 100,
    owner: 1,
    baseOwner: 1,
    x: 0,
    y: 0,
  };
}

describe('renderSelectionIcons — glyph augments the badge (slice 2)', () => {
  it('single villager: emits the role glyph AND keeps the V code + unit hooks/label', () => {
    const html = renderSelectionIcons(
      baseSelectionState({
        selectedEntityIds: [1],
        selectedCount: 1,
        selectedKind: 'unit',
        selectedEntityType: 'villager',
        owner: 1,
      }),
      economyStateWith([villagerUnit(1)]),
    );

    expect(html).toContain('class="hud-selection-unit-glyph"');
    expect(html).toContain('data-selection-unit-icon="villager"');
    expect(html).toContain('data-selection-unit-label="villager"');
    // The badge keeps holding exactly its two-letter code (the browser
    // specs assert toHaveText('V') on the badge element). The badge inner
    // text (whitespace-trimmed) must still be exactly "V".
    const badge = html.match(
      /data-selection-unit-icon="villager">([\s\S]*?)<\/div>/,
    );
    expect(badge?.[1].trim()).toBe('V');
  });

  it('single town-center (building): emits the building glyph AND keeps the TC code + entity hook', () => {
    const html = renderSelectionIcons(
      baseSelectionState({
        selectedEntityIds: [50],
        selectedCount: 1,
        selectedKind: 'building',
        selectedEntityType: 'town-center',
        owner: 1,
      }),
      economyStateWith([]),
    );

    expect(html).toContain('class="hud-selection-unit-glyph"');
    expect(html).toContain('data-selection-entity-icon="town-center"');
    expect(html).toContain('TC');
  });

  it('multi villager + sheep: every UNIT chip gets a glyph, counts + hooks preserved, sheep chip stays glyph-free', () => {
    const villagerIds = [1, 2];
    const sheepIds = [100, 101, 102];
    const html = renderSelectionIcons(
      baseSelectionState({
        selectedEntityIds: [...villagerIds, ...sheepIds],
        selectedCount: villagerIds.length + sheepIds.length,
        selectedKind: 'unit',
        selectedEntityType: 'villager',
        owner: 1,
      }),
      economyStateWith(villagerIds.map(villagerUnit), sheepIds.map(sheepResource)),
    );

    // Existing compact-grid contract intact.
    expect(html).toContain('data-selection-unit-icon="villager"');
    expect(html).toContain('data-selection-unit-count="villager"');
    expect(html).toContain('data-selection-unit-icon="sheep"');
    expect(html).toContain('data-selection-unit-count="sheep"');
    expect(html).toContain('x2');
    expect(html).toContain('x3');
    // The villager chip carries a glyph; sheep is out of scope so the
    // selection panel shows exactly ONE glyph (the villager role).
    const glyphCount = html.match(/hud-selection-unit-glyph/g)?.length ?? 0;
    expect(glyphCount).toBe(1);
  });

  it('single sheep stays on the entity-icon path with NO glyph (resources out of scope)', () => {
    const html = renderSelectionIcons(
      baseSelectionState({
        selectedEntityIds: [100],
        selectedCount: 1,
        selectedKind: 'resource',
        selectedEntityType: 'sheep',
        owner: 1,
      }),
      economyStateWith([], [sheepResource(100)]),
    );

    expect(html).toContain('data-selection-entity-icon="sheep"');
    expect(html).toContain('SH');
    expect(html).not.toContain('hud-selection-unit-glyph');
  });
});
