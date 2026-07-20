import { describe, expect, it } from 'vitest';

import {
  buildingGlyph,
  resourceGlyph,
} from '../../src/ui/hud/icons/glyphs';
import { renderBuildButtons } from '../../src/ui/hud/selectionPanel';
import type { BuildableBuildingType } from '../../src/game/simulation/types';

// M7 UI-icons slice 1: original procedural glyph icons for the resource
// chips (top bar) and the build-command buttons. These tests pin the
// "100% original / procedural, no asset or font references" constraint
// AND the augment-don't-replace contract (the text labels + the
// data-command hooks survive so the existing HUD/browser tests still
// pass against the same selectors + text).

const RESOURCE_KINDS = ['food', 'wood', 'gold', 'stone', 'pop', 'age', 'time'] as const;

// Every buildable building type the selection panel can surface — the
// glyph map must cover all of them so no build button renders without a
// glyph (and TS would already flag a missing case, but this guards the
// runtime fallback too).
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

// No external asset/font reference is allowed: the glyphs must be 100%
// inline-authored SVG markup, never a url() to an image, an <image>
// element, an icon-font @font-face, or an external href.
function expectNoExternalAssetRefs(markup: string): void {
  expect(markup).not.toMatch(/url\(/i);
  expect(markup).not.toMatch(/<image\b/i);
  expect(markup).not.toMatch(/@font-face/i);
  expect(markup).not.toMatch(/font-family/i);
  // No remote/import refs (data: would be a smell too — we hand-author paths).
  expect(markup).not.toMatch(/href\s*=/i);
  expect(markup).not.toMatch(/https?:/i);
  expect(markup).not.toMatch(/@import/i);
  expect(markup).not.toMatch(/data:/i);
}

describe('resourceGlyph — procedural inline-SVG resource icons', () => {
  it('returns a self-contained inline <svg> for every resource kind', () => {
    for (const kind of RESOURCE_KINDS) {
      const markup = resourceGlyph(kind);
      expect(markup).toMatch(/<svg\b/);
      expect(markup).toContain('</svg>');
      // The glyph is decorative (the text label carries the meaning) so it
      // must be hidden from the accessibility tree.
      expect(markup).toContain('aria-hidden="true"');
      expectNoExternalAssetRefs(markup);
    }
  });

  it('uses currentColor so the existing palette (CSS) controls the tone — no hard-coded hex hues', () => {
    for (const kind of RESOURCE_KINDS) {
      const markup = resourceGlyph(kind);
      expect(markup).toContain('currentColor');
      // No new hex colors baked into the glyph — tone comes from CSS.
      expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('carries a stable glyph hook class so the CSS can size/colour it', () => {
    expect(resourceGlyph('food')).toContain('class="hud-chip-glyph"');
  });

  it('produces distinct markup per resource kind (a wheat sheaf is not a coin)', () => {
    const food = resourceGlyph('food');
    const wood = resourceGlyph('wood');
    const gold = resourceGlyph('gold');
    const stone = resourceGlyph('stone');
    const set = new Set([food, wood, gold, stone]);
    expect(set.size).toBe(4);
  });
});

describe('buildingGlyph — procedural inline-SVG build icons', () => {
  it('returns a self-contained inline <svg> for every buildable building type', () => {
    for (const buildingType of ALL_BUILDINGS) {
      const markup = buildingGlyph(buildingType);
      expect(markup).toMatch(/<svg\b/);
      expect(markup).toContain('</svg>');
      expect(markup).toContain('aria-hidden="true"');
      expectNoExternalAssetRefs(markup);
    }
  });

  it('uses currentColor and bakes no hex hues (palette comes from CSS)', () => {
    for (const buildingType of ALL_BUILDINGS) {
      const markup = buildingGlyph(buildingType);
      expect(markup).toContain('currentColor');
      expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('carries the command-glyph hook class', () => {
    expect(buildingGlyph('house')).toContain('class="hud-command-glyph"');
  });
});

describe('renderBuildButtons — augments, does not replace', () => {
  it('keeps the data-command hook and the "Build <Name>" text label intact alongside the glyph', () => {
    const html = renderBuildButtons(
      ['house', 'mill', 'lumber-camp'],
      { food: 200, wood: 200, gold: 100, stone: 200 },
      null,
    );

    // Contract preserved for the existing browser tests + click handler.
    expect(html).toContain('data-command="build-house"');
    expect(html).toContain('data-command="build-mill"');
    expect(html).toContain('data-command="build-lumber-camp"');

    // Text labels survive (icons augment, not replace).
    expect(html).toContain('Build House');
    expect(html).toContain('Build Mill');
    expect(html).toContain('Build Lumber Camp');

    // And each button carries its glyph.
    expect(html).toContain('class="hud-command-glyph"');
  });

  it('renders nothing for an empty build-options list', () => {
    expect(
      renderBuildButtons([], { food: 200, wood: 200, gold: 100, stone: 200 }, null),
    ).toBe('');
  });
});
