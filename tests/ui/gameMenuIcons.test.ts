// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { ART_STYLES } from '../../src/rendering/artStyles';
import { DEBUG_OVERLAY_CYCLE } from '../../src/ui/hud/debugOverlay';
import { createGameMenu } from '../../src/ui/hud/gameMenu';
import {
  GAME_MENU_CAPTIONS,
  GAME_MENU_SETTING_NAMES,
  GAME_MENU_TITLE,
} from '../../src/ui/hud/gameMenuCaptions';
import { HUD_TEMPLATE_HTML } from '../../src/ui/hud/hudTemplate';
import { GAME_MENU_ICON_KINDS } from '../../src/ui/hud/icons/menuGlyphs';

// The menu's actions in the order they are drawn, one to a row. `caption` is
// the text a player reads on the button. `de` is the id of Definitive
// Edition's own English string that the caption is (its in-match "Main Menu"
// dialog, read from the install's string table on 2026-11-11), or null where
// DE's menu has no such action and the caption is this game's own name.
// `name` is the accessible name, which is kept as it was before the captions
// (the coordinator's terms), so it differs from the caption for some actions.
const MENU_ACTIONS = [
  { hook: 'menu-resume', name: 'Resume', icon: 'resume', caption: 'Return to Game', de: 9445 },
  { hook: 'save-button', name: 'Save game', icon: 'save', caption: 'Save Game', de: 9272 },
  { hook: 'load-button', name: 'Load game', icon: 'load', caption: 'Load Game', de: 9276 },
  { hook: 'menu-tech-tree', name: 'Technology tree', icon: 'techTree', caption: 'Technology Tree', de: null },
  { hook: 'menu-civilizations', name: 'Civilizations', icon: 'civilizations', caption: 'Civilizations', de: null },
  { hook: 'replay-load-button', name: 'Watch a replay…', icon: 'replay', caption: 'Watch a Replay…', de: null },
  { hook: 'menu-restart', name: 'Restart match', icon: 'restart', caption: 'Restart', de: 9279 },
  { hook: 'menu-quit', name: 'Quit to title', icon: 'quit', caption: 'Quit Current Game', de: 9273 },
] as const;

// The two settings rows: the setting's name, then its state. Keyed by content
// rather than by position: an earlier version of this file asserted "every
// entry but the last is text-free", which silently meant "debug is the only
// toggle" and broke the moment a second one was added below it.
const MENU_SETTINGS = [
  { hook: 'menu-debug-cycle', stateHook: 'menu-debug-mode', icon: 'debug', label: 'Debug overlay', state: 'off' },
  { hook: 'menu-art-style-cycle', stateHook: 'menu-art-style', icon: 'artStyle', label: 'Art style', state: 'Natural' },
] as const;

const MENU_ITEMS = [
  ...MENU_ACTIONS.map((action) => ({ hook: action.hook, icon: action.icon, name: action.name })),
  ...MENU_SETTINGS.map((setting) => ({
    hook: setting.hook,
    icon: setting.icon,
    name: `${setting.label}: ${setting.state}`,
  })),
];

function mountTemplate(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = HUD_TEMPLATE_HTML;
  return root;
}

/** What a button shows as text, its runs of whitespace (the template's line breaks) folded to one space. */
function visibleText(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function comesBefore(first: Node, second: Node): boolean {
  return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe('game-menu actions: a glyph and a name on every row', () => {
  it('renders every menu item as one distinct decorative SVG with an accessible name', () => {
    const root = mountTemplate();
    const glyphBodies = new Set<string>();

    for (const item of MENU_ITEMS) {
      const button = root.querySelector<HTMLButtonElement>(`[data-hud="${item.hook}"]`);
      expect(button, item.hook).not.toBeNull();
      expect(button!.getAttribute('aria-label')).toBe(item.name);
      expect(button!.getAttribute('data-tooltip')).toContain(item.name.split(':')[0]);

      const glyph = button!.querySelector<SVGElement>(`svg[data-menu-icon="${item.icon}"]`);
      expect(glyph, item.icon).not.toBeNull();
      expect(glyph!.classList.contains('hud-menu-item__glyph')).toBe(true);
      expect(glyph!.getAttribute('aria-hidden')).toBe('true');
      expect(glyph!.getAttribute('focusable')).toBe('false');
      expect(glyph!.querySelector('image')).toBeNull();
      expect(glyph!.outerHTML).not.toMatch(/(?:href=|url\(|<style|data:)/i);
      expect(glyph!.innerHTML.trim().length).toBeGreaterThan(0);
      glyphBodies.add(glyph!.innerHTML);
    }

    expect(root.querySelectorAll('.hud-menu-item__glyph')).toHaveLength(MENU_ITEMS.length);
    expect(glyphBodies.size).toBe(MENU_ITEMS.length);
  });

  // Until 2026-11-11 this case read "removes visible action-name text while
  // retaining each toggle state" and required every action's text to be empty:
  // the icon-only menu was the owner's own request of 2026-07-19 (v0.3.8).
  // Asked on 2026-11-11 whether the in-match menu should get text labels like
  // Definitive Edition's, the owner answered "Yes, DE's labels" (spec §14.1;
  // plan 148), so the claim is now the reverse: every action shows its name,
  // and every settings row its setting's name before its state.
  it('shows every action name as visible text after its glyph (the owner reversed the icon-only menu on 2026-11-11)', () => {
    const root = mountTemplate();

    for (const action of MENU_ACTIONS) {
      const button = root.querySelector<HTMLButtonElement>(`[data-hud="${action.hook}"]`)!;
      const glyph = button.querySelector('svg.hud-menu-item__glyph')!;
      const label = button.querySelector('.hud-menu-item__label');
      expect(label, action.hook).not.toBeNull();
      expect(label!.textContent, action.hook).toBe(action.caption);
      expect(comesBefore(glyph, label!), `${action.hook}: the glyph comes before the name`).toBe(true);
      // The caption is all of the button's text: nothing else is written on it.
      expect(visibleText(button), action.hook).toBe(action.caption);
      expect(button.querySelector('.hud-menu-item__state'), action.hook).toBeNull();
    }

    for (const setting of MENU_SETTINGS) {
      const button = root.querySelector<HTMLButtonElement>(`[data-hud="${setting.hook}"]`)!;
      const glyph = button.querySelector('svg.hud-menu-item__glyph')!;
      const label = button.querySelector('.hud-menu-item__label');
      const state = button.querySelector(`[data-hud="${setting.stateHook}"]`);
      expect(label, setting.hook).not.toBeNull();
      expect(state, setting.stateHook).not.toBeNull();
      expect(label!.textContent, setting.hook).toBe(setting.label);
      expect(state!.textContent, setting.stateHook).toBe(setting.state);
      expect(state!.classList.contains('hud-menu-item__state'), setting.stateHook).toBe(true);
      expect(comesBefore(glyph, label!), `${setting.hook}: the glyph comes before the name`).toBe(true);
      expect(comesBefore(label!, state!), `${setting.hook}: the name comes before the state`).toBe(true);
      expect(visibleText(button), setting.hook).toBe(`${setting.label} ${setting.state}`);
      // Every toggle's state must be announced, not just rendered.
      expect(state!.getAttribute('aria-live'), setting.stateHook).toBe('polite');
      expect(state!.getAttribute('aria-atomic'), setting.stateHook).toBe('true');
    }
  });

  it('titles the dialog "Main Menu", as Definitive Edition titles its own, and keeps the Settings heading', () => {
    const root = mountTemplate();
    expect(root.querySelector('.hud-game-menu__title')?.textContent).toBe('Main Menu');
    expect(root.querySelector('.hud-game-menu__section-title')?.textContent).toBe('Settings');
  });

  it('lists the actions one to a row in their order, with the Load form under its own row', () => {
    const root = mountTemplate();
    const actionRows = [...root.querySelectorAll('.hud-game-menu__actions > button.hud-menu-item')]
      .map((row) => row.getAttribute('data-hud'));
    expect(actionRows).toEqual(MENU_ACTIONS.map((action) => action.hook));

    const settingRows = [...root.querySelectorAll('.hud-game-menu__section > button.hud-menu-item')]
      .map((row) => row.getAttribute('data-hud'));
    expect(settingRows).toEqual(MENU_SETTINGS.map((setting) => setting.hook));
    // No row hides inside another container: these ten are every menu item.
    expect(root.querySelectorAll('.hud-game-menu .hud-menu-item')).toHaveLength(MENU_ITEMS.length);

    // The form a click on Load Game opens is the next thing after that row, so
    // it opens where the player is looking and the Tab order follows what is
    // drawn. It sat after the Settings rows, below the fold of a one-column menu.
    const loadButton = root.querySelector('[data-hud="load-button"]')!;
    expect(loadButton.nextElementSibling?.getAttribute('data-hud')).toBe('load-panel');
    expect(loadButton.nextElementSibling?.hasAttribute('hidden')).toBe(true);
  });

  it('takes each caption from Definitive Edition where its menu has the action, and names the rest itself', () => {
    expect(GAME_MENU_TITLE).toEqual({ caption: 'Main Menu', deString: 9446 });
    for (const action of MENU_ACTIONS) {
      expect(GAME_MENU_CAPTIONS[action.icon], action.icon).toEqual({ caption: action.caption, deString: action.de });
    }
    for (const setting of MENU_SETTINGS) {
      expect(GAME_MENU_SETTING_NAMES[setting.icon], setting.icon).toBe(setting.label);
    }
    // Every glyph the menu can draw is an action with a caption or a setting
    // with a name, and nothing is captioned that the menu does not draw.
    expect([...Object.keys(GAME_MENU_CAPTIONS), ...Object.keys(GAME_MENU_SETTING_NAMES)].sort())
      .toEqual([...GAME_MENU_ICON_KINDS].sort());
    // The captions that are NOT Definitive Edition's strings, by name, so a
    // change to this list is a change somebody reads: DE's menu has no
    // technology tree (it is the bar's civilization icon), no civilization
    // compendium and no replay browser (its recorded games are on its title
    // screen).
    const ownNames = Object.values(GAME_MENU_CAPTIONS)
      .filter((entry) => entry.deString === null)
      .map((entry) => entry.caption);
    expect(ownNames.sort()).toEqual(['Civilizations', 'Technology Tree', 'Watch a Replay…']);
  });

  it('keeps a settings row\'s name on it while its state changes', () => {
    const root = mountTemplate();
    document.body.append(root);
    const handle = createGameMenu(root, {
      cycleDebugOverlay: () => 'coarse-vs-fine',
      cycleArtStyle: () => 'Moebius',
      artStyleLabel: () => 'Natural',
    });
    try {
      const debugRow = root.querySelector<HTMLButtonElement>('[data-hud="menu-debug-cycle"]')!;
      debugRow.click();
      expect(debugRow.querySelector('.hud-menu-item__label')?.textContent).toBe('Debug overlay');
      expect(visibleText(debugRow)).toBe('Debug overlay coarse-vs-fine');
      expect(debugRow.getAttribute('aria-label')).toBe('Debug overlay: coarse-vs-fine');

      const artRow = root.querySelector<HTMLButtonElement>('[data-hud="menu-art-style-cycle"]')!;
      artRow.click();
      expect(artRow.querySelector('.hud-menu-item__label')?.textContent).toBe('Art style');
      expect(visibleText(artRow)).toBe('Art style Moebius');
      expect(artRow.getAttribute('aria-label')).toBe('Art style: Moebius');
    } finally {
      handle.destroy();
      root.remove();
    }
  });

  it('opens the list at its top, whatever it was scrolled to when it closed', () => {
    const root = mountTemplate();
    document.body.append(root);
    const handle = createGameMenu(root, {});
    try {
      const panel = root.querySelector<HTMLElement>('.hud-game-menu__panel')!;
      handle.open();
      panel.scrollTop = 91;
      handle.close();
      // The control: the offset is still there for open() to clear.
      expect(panel.scrollTop).toBe(91);
      handle.open();
      expect(panel.scrollTop).toBe(0);
    } finally {
      handle.destroy();
      root.remove();
    }
  });

  it('knows every state a settings row can show, which the browser spec measures the room of', () => {
    // tests/browser/de-game-menu.spec.ts steps the debug overlay through
    // DEBUG_OVERLAY_CYCLE and the art style through the two labels it lists by
    // hand (a browser spec cannot import the renderer's module), and holds
    // each state to a quarter of its own width to spare in its row. A new art
    // style, or a state longer than today's longest, changes this case first,
    // and whoever changes it reads that one.
    const artLabels = ART_STYLES.map((style) => style.label);
    expect([...artLabels].sort()).toEqual(['Moebius', 'Natural']);
    const states = [...DEBUG_OVERLAY_CYCLE, ...artLabels];
    const longest = states.reduce((a, b) => (b.length > a.length ? b : a));
    expect(longest).toBe('selection-bounds');
  });

  it('declares the closed state on the persistent game-menu trigger', () => {
    const root = mountTemplate();
    expect(root.querySelector('[data-hud="menu-button"]')?.getAttribute('aria-expanded')).toBe('false');
  });
});
