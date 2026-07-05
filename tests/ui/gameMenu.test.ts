// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { createGameMenu } from '../../src/ui/hud/gameMenu';

// v0.1.95: the in-game menu controller. These test the open/close/toggle logic
// and the Resume/Restart/Quit/Settings wiring against the data-hud contract
// (a minimal fixture — the full template is covered by the browser tests).
const MENU_FIXTURE = `
  <button data-hud="menu-button" aria-expanded="false">☰</button>
  <div data-hud="game-menu" hidden>
    <div data-hud="game-menu-backdrop"></div>
    <button data-hud="menu-resume">Resume</button>
    <button data-hud="menu-restart">Restart match</button>
    <button data-hud="menu-quit">Quit to title</button>
    <button data-hud="menu-debug-cycle"><span data-hud="menu-debug-mode">off</span></button>
  </div>`;

function mount(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = MENU_FIXTURE;
  return root;
}

const menuEl = (root: HTMLElement): HTMLElement =>
  root.querySelector('[data-hud="game-menu"]') as HTMLElement;
const click = (root: HTMLElement, id: string): void =>
  root.querySelector<HTMLButtonElement>(`[data-hud="${id}"]`)!.click();

describe('createGameMenu', () => {
  it('starts closed and toggles open/closed', () => {
    const root = mount();
    const menu = createGameMenu(root, {});
    expect(menuEl(root).hidden).toBe(true);
    menu.toggle();
    expect(menuEl(root).hidden).toBe(false);
    expect(menu.isOpen()).toBe(true);
    menu.toggle();
    expect(menuEl(root).hidden).toBe(true);
  });

  it('opens on the ☰ button and closes on Resume and the backdrop', () => {
    const root = mount();
    createGameMenu(root, {});
    click(root, 'menu-button');
    expect(menuEl(root).hidden).toBe(false);
    click(root, 'menu-resume');
    expect(menuEl(root).hidden).toBe(true);
    click(root, 'menu-button');
    click(root, 'game-menu-backdrop');
    expect(menuEl(root).hidden).toBe(true);
  });

  it('wires Restart and Quit to the deps (and Restart closes the menu)', () => {
    const root = mount();
    const onRestart = vi.fn();
    const onQuit = vi.fn();
    const menu = createGameMenu(root, { onRestart, onQuit });
    menu.open();
    click(root, 'menu-restart');
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(menuEl(root).hidden).toBe(true);
    menu.open();
    click(root, 'menu-quit');
    expect(onQuit).toHaveBeenCalledTimes(1);
  });

  it('cycles the debug overlay and renders the new mode label in Settings', () => {
    const root = mount();
    const cycleDebugOverlay = vi.fn(() => 'perf');
    createGameMenu(root, { cycleDebugOverlay });
    click(root, 'menu-debug-cycle');
    expect(cycleDebugOverlay).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[data-hud="menu-debug-mode"]')!.textContent).toBe('perf');
  });

  it('returns an inert handle when the menu markup is absent (headless mount)', () => {
    const root = document.createElement('div');
    const menu = createGameMenu(root, {});
    expect(menu.isOpen()).toBe(false);
    expect(() => menu.toggle()).not.toThrow();
  });
});
