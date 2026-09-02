// @vitest-environment jsdom

// The command deck's icon buttons (v0.3.187): Orders, Stance and Formation are
// square glyph tiles the way DE's command card is, so the meaning has to reach
// the player through the tooltip and an assistive user through the accessible
// name — the visible text label is gone.
//
// The art constraint is the same one `glyphs.ts` has carried since v0.1.39:
// 100% hand-authored inline SVG, no url(), no <image>, no icon font, no
// external href, colour from `currentColor` only.

import { describe, expect, it } from 'vitest';

import {
  buildPageGlyph,
  formationGlyph,
  stanceGlyph,
} from '../../src/ui/hud/icons/commandGlyphs';
import { renderActionButtons } from '../../src/ui/hud/selectionPanel/buttons';
import {
  renderFormationButtons,
  renderStanceButtons,
} from '../../src/ui/hud/selectionPanel/render';
import { renderBuildPageTabs } from '../../src/ui/hud/selectionPanel/buildPalette';
import {
  BUILDABLE_BUILDING_TYPES,
  partitionBuildOptions,
} from '../../src/ui/hud/selectionPanel/buildPages';
import { buildingGlyph } from '../../src/ui/hud/icons/glyphs';
import type { UnitFormation } from '../../src/game/simulation/unitFormation';
import type { UnitStance } from '../../src/game/simulation/unitStance';

const STANCES: UnitStance[] = ['aggressive', 'defensive', 'stand-ground', 'no-attack'];
const FORMATIONS: UnitFormation[] = ['line', 'staggered', 'box', 'flank'];

function expectOriginalInlineSvg(markup: string): void {
  expect(markup).toMatch(/^<svg /);
  expect(markup).toContain('viewBox="0 0 24 24"');
  expect(markup).toContain('stroke="currentColor"');
  expect(markup).toContain('aria-hidden="true"');
  expect(markup).not.toMatch(/url\(/i);
  expect(markup).not.toMatch(/<image\b/i);
  expect(markup).not.toMatch(/@font-face|font-family/i);
  expect(markup).not.toMatch(/href\s*=/i);
  expect(markup).not.toMatch(/https?:/i);
  expect(markup).not.toMatch(/data:/i);
}

describe('stance and formation glyphs', () => {
  it('draws an original inline glyph for every stance and every formation', () => {
    const seen = new Set<string>();
    for (const stance of STANCES) {
      const markup = stanceGlyph(stance);
      expectOriginalInlineSvg(markup);
      seen.add(markup);
    }
    for (const formation of FORMATIONS) {
      const markup = formationGlyph(formation);
      expectOriginalInlineSvg(markup);
      seen.add(markup);
    }
    // Eight options, eight DIFFERENT pictures: an icon shared between two
    // options is a button whose meaning the player cannot read.
    expect(seen.size).toBe(STANCES.length + FORMATIONS.length);
  });

  it('draws a distinct original glyph for each build page tab', () => {
    expectOriginalInlineSvg(buildPageGlyph('economic'));
    expectOriginalInlineSvg(buildPageGlyph('military'));
    expect(buildPageGlyph('economic')).not.toBe(buildPageGlyph('military'));
  });
});

describe('building glyphs, now that a build card is an icon', () => {
  it('draws a DIFFERENT picture for every buildable building', () => {
    const byGlyph = new Map<string, string[]>();
    for (const buildingType of BUILDABLE_BUILDING_TYPES) {
      const markup = buildingGlyph(buildingType);
      expectOriginalInlineSvg(markup);
      byGlyph.set(markup, [...(byGlyph.get(markup) ?? []), buildingType]);
    }
    // Two buildings sharing a picture are two indistinguishable tiles now that
    // the card carries no visible name: the Watch Tower and the Bombard Tower
    // shared one until v0.3.187 — 25 wood/10 stone against 100 wood/50 gold.
    const collisions = [...byGlyph.values()].filter((types) => types.length > 1);
    expect(collisions, 'buildings sharing one glyph').toEqual([]);
    expect(byGlyph.size).toBe(BUILDABLE_BUILDING_TYPES.length);
  });
});

describe('icon command buttons', () => {
  it('keeps the data-command hook, the tooltip and an accessible name on every stance tile', () => {
    const html = renderStanceButtons(STANCES, 'defensive');
    const host = document.createElement('div');
    host.innerHTML = html;
    for (const stance of STANCES) {
      const button = host.querySelector<HTMLButtonElement>(`[data-command="stance-${stance}"]`);
      expect(button, stance).not.toBeNull();
      expect(button!.classList.contains('hud-command-button--icon')).toBe(true);
      expect(button!.getAttribute('aria-label')).toMatch(/stance$/);
      expect(button!.getAttribute('data-tooltip')?.length ?? 0).toBeGreaterThan(20);
      expect(button!.querySelector('svg'), `${stance} has a glyph`).not.toBeNull();
      // The label stays in the DOM (the CSS hides it), so the accessible name
      // and every textContent reader are unchanged.
      expect(button!.querySelector('.hud-command-label')).not.toBeNull();
    }
    expect(
      host.querySelector('[data-command="stance-defensive"]')?.getAttribute('aria-pressed'),
    ).toBe('true');
    // The glyph comes before the label, as every other command button's does.
    expect(html.indexOf('<svg')).toBeLessThan(html.indexOf('hud-command-label'));
  });

  it('does the same for formation tiles and for the Orders group', () => {
    const host = document.createElement('div');
    host.innerHTML = renderFormationButtons(FORMATIONS, 'box');
    for (const formation of FORMATIONS) {
      const button = host.querySelector<HTMLButtonElement>(`[data-command="formation-${formation}"]`);
      expect(button, formation).not.toBeNull();
      expect(button!.getAttribute('aria-label')).toMatch(/formation$/);
      expect(button!.querySelector('svg')).not.toBeNull();
    }
    expect(
      host.querySelector('[data-command="formation-box"]')?.getAttribute('aria-pressed'),
    ).toBe('true');

    host.innerHTML = renderActionButtons(['ungarrison', 'ring-town-bell']);
    const ungarrison = host.querySelector<HTMLButtonElement>('[data-command="action-ungarrison"]')!;
    expect(ungarrison.classList.contains('hud-command-button--icon')).toBe(true);
    expect(ungarrison.getAttribute('aria-label')).toBe('Ungarrison');
    expect(ungarrison.querySelector('svg')).not.toBeNull();
  });
});

describe('build page tabs', () => {
  it('offers both DE pages, marks the active one, and disables a page with nothing on it', () => {
    const host = document.createElement('div');
    host.innerHTML = renderBuildPageTabs(
      partitionBuildOptions(['house', 'mill', 'barracks']),
      'economic',
    );
    const economic = host.querySelector<HTMLButtonElement>('button[data-build-page="economic"]')!;
    const military = host.querySelector<HTMLButtonElement>('button[data-build-page="military"]')!;
    expect(economic.getAttribute('aria-pressed')).toBe('true');
    expect(economic.getAttribute('aria-label')).toBe('Economic Buildings');
    expect(economic.getAttribute('data-tooltip')).toContain('2 available');
    expect(military.getAttribute('aria-pressed')).toBe('false');
    expect(military.disabled).toBe(false);

    host.innerHTML = renderBuildPageTabs(partitionBuildOptions(['fish-trap']), 'economic');
    const emptyMilitary = host.querySelector<HTMLButtonElement>('button[data-build-page="military"]')!;
    // The tab stays — a control that vanishes is a control that moved — but it
    // cannot be pressed.
    expect(emptyMilitary.disabled).toBe(true);
    expect(emptyMilitary.getAttribute('data-tooltip')).toContain('nothing this unit can build');
  });
});
