// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { HUD_TEMPLATE_HTML } from '../../src/ui/hud/hudTemplate';

const MENU_ACTIONS = [
  { hook: 'menu-resume', label: 'Resume', icon: 'resume' },
  { hook: 'save-button', label: 'Save game', icon: 'save' },
  { hook: 'load-button', label: 'Load game', icon: 'load' },
  { hook: 'replay-load-button', label: 'Watch a replay…', icon: 'replay' },
  { hook: 'menu-restart', label: 'Restart match', icon: 'restart' },
  { hook: 'menu-quit', label: 'Quit to title', icon: 'quit' },
  { hook: 'menu-debug-cycle', label: 'Debug overlay: off', icon: 'debug' },
] as const;

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

  it('removes visible action-name text while retaining the debug mode state', () => {
    const root = mountTemplate();

    for (const action of MENU_ACTIONS.slice(0, -1)) {
      const button = root.querySelector<HTMLButtonElement>(`[data-hud="${action.hook}"]`)!;
      expect(button.textContent?.trim()).toBe('');
    }

    const debugButton = root.querySelector<HTMLButtonElement>('[data-hud="menu-debug-cycle"]')!;
    expect(debugButton.textContent?.trim()).toBe('off');
    expect(debugButton.querySelector('[data-hud="menu-debug-mode"]')?.getAttribute('aria-live')).toBe('polite');
  });

  it('declares the closed state on the persistent game-menu trigger', () => {
    const root = mountTemplate();
    expect(root.querySelector('[data-hud="menu-button"]')?.getAttribute('aria-expanded')).toBe('false');
  });
});
