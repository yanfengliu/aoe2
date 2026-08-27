// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { HUD_TEMPLATE_HTML } from '../../src/ui/hud/hudTemplate';

// `state` is the visible text a settings toggle shows beside its glyph. Plain
// actions show none. Keyed by content rather than by position in this list: an
// earlier version asserted "every entry but the last is text-free", which
// silently meant "debug is the only toggle" and broke the moment a second one
// was added below it.
const MENU_ACTIONS = [
  { hook: 'menu-resume', label: 'Resume', icon: 'resume', state: '' },
  { hook: 'save-button', label: 'Save game', icon: 'save', state: '' },
  { hook: 'load-button', label: 'Load game', icon: 'load', state: '' },
  { hook: 'menu-tech-tree', label: 'Technology tree', icon: 'techTree', state: '' },
  { hook: 'replay-load-button', label: 'Watch a replay…', icon: 'replay', state: '' },
  { hook: 'menu-restart', label: 'Restart match', icon: 'restart', state: '' },
  { hook: 'menu-quit', label: 'Quit to title', icon: 'quit', state: '' },
  { hook: 'menu-debug-cycle', label: 'Debug overlay: off', icon: 'debug', state: 'off' },
  { hook: 'menu-art-style-cycle', label: 'Art style: Moebius', icon: 'artStyle', state: 'Moebius' },
] as const;

// Every toggle's state must be announced, not just rendered.
const LIVE_STATE_HOOKS = ['menu-debug-mode', 'menu-art-style'] as const;

function mountTemplate(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = HUD_TEMPLATE_HTML;
  return root;
}

describe('game-menu dedicated action icons', () => {
  it('renders every menu item as one distinct decorative SVG with an accessible name', () => {
    const root = mountTemplate();
    const glyphBodies = new Set<string>();

    for (const action of MENU_ACTIONS) {
      const button = root.querySelector<HTMLButtonElement>(`[data-hud="${action.hook}"]`);
      expect(button, action.hook).not.toBeNull();
      expect(button!.getAttribute('aria-label')).toBe(action.label);
      expect(button!.getAttribute('data-tooltip')).toContain(action.label.split(':')[0]);

      const glyph = button!.querySelector<SVGElement>(`svg[data-menu-icon="${action.icon}"]`);
      expect(glyph, action.icon).not.toBeNull();
      expect(glyph!.classList.contains('hud-menu-item__glyph')).toBe(true);
      expect(glyph!.getAttribute('aria-hidden')).toBe('true');
      expect(glyph!.getAttribute('focusable')).toBe('false');
      expect(glyph!.querySelector('image')).toBeNull();
      expect(glyph!.outerHTML).not.toMatch(/(?:href=|url\(|<style|data:)/i);
      expect(glyph!.innerHTML.trim().length).toBeGreaterThan(0);
      glyphBodies.add(glyph!.innerHTML);
    }

    expect(root.querySelectorAll('.hud-menu-item__glyph')).toHaveLength(MENU_ACTIONS.length);
    expect(glyphBodies.size).toBe(MENU_ACTIONS.length);
  });

  it('removes visible action-name text while retaining each toggle state', () => {
    const root = mountTemplate();

    for (const action of MENU_ACTIONS) {
      const button = root.querySelector<HTMLButtonElement>(`[data-hud="${action.hook}"]`)!;
      expect(button.textContent?.trim(), action.hook).toBe(action.state);
    }

    for (const hook of LIVE_STATE_HOOKS) {
      const state = root.querySelector(`[data-hud="${hook}"]`);
      expect(state, hook).not.toBeNull();
      expect(state!.getAttribute('aria-live'), hook).toBe('polite');
      expect(state!.getAttribute('aria-atomic'), hook).toBe('true');
    }
  });

  it('declares the closed state on the persistent game-menu trigger', () => {
    const root = mountTemplate();
    expect(root.querySelector('[data-hud="menu-button"]')?.getAttribute('aria-expanded')).toBe('false');
  });
});
