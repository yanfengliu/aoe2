// Slice 2 (replay-load-and-e2e v0.1.9) extracted the HUD HTML template
// out of `createHudController.ts` so the controller stays under the
// 500-LOC budget after the new "Replay (live session)" button landed.
// The template is a pure string constant — no behavior change.

import { HUD_CHIP_TOOLTIPS } from './tooltips';
import {
  GAME_MENU_CAPTIONS,
  GAME_MENU_SETTING_NAMES,
  GAME_MENU_TITLE,
  type GameMenuActionKind,
  type GameMenuSettingKind,
} from './gameMenuCaptions';
import { resourceGlyph } from './icons/glyphs';
import { gameMenuGlyph } from './icons/menuGlyphs';

// M7 UI-icons slice 1 (v0.1.39): each resource chip gains an original
// procedural glyph in its label row, BEFORE the `.hud-value` element.
// The glyph + label sit in a `.hud-chip-head` row; the value element is
// left pristine (only the number) so the existing browser tests that
// assert `[data-hud="food"]` `.toHaveText('200')` still pass.
function chip(
  key: 'food' | 'wood' | 'gold' | 'stone' | 'age' | 'pop' | 'time',
  label: string,
  initialValue: string,
): string {
  // Work 149: the time shows the game speed in brackets under the clock, as
  // DE's game-time display does (spec §4.5), laid out as a resource's workers.
  const workers = ['food', 'wood', 'gold', 'stone'].includes(key)
    ? `<span class="hud-resource-workers" data-resource-workers="${key}" aria-label="${label} workers: 0" data-tooltip="${label} workers: 0"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="4" r="3" fill="currentColor"/><path d="M2 15c0-4 2-6 6-6s6 2 6 6Z" fill="currentColor"/></svg><span data-resource-worker-count="${key}">0</span></span>`
    : key === 'time' ? '<span class="hud-game-speed" data-hud="speed" aria-label="Game speed">(1.0)</span>' : '';
  const readout = key === 'time' ? 'hud-time-readout' : 'hud-resource-readout';
  return `
        <div class="hud-chip" data-hud-chip="${key}" data-tooltip="${HUD_CHIP_TOOLTIPS[key]}">
          <div class="hud-chip-head">
            ${resourceGlyph(key)}
            <div class="hud-label">${label}</div>
          </div>
          ${workers ? `<div class="${readout}">` : ''}<div class="hud-value" data-hud="${key}">${initialValue}</div>${workers}${workers ? '</div>' : ''}
        </div>`;
}

// v0.1.95: the in-game menu (opened by Esc or the ☰ button). Save / Load /
// Replay were moved OFF the top bar into here (so the bar's button positions can
// never shift), and Restart / Quit-to-title / a Settings section were added. The
// Save/Load/Replay buttons keep their original `data-hud` ids so the existing
// createSaveLoadPanel + replay-dialog wiring binds to them unchanged; the load
// panel moved here with them.
//
// Work 148 (owner decision, 2026-11-11): the menu is Definitive Edition's
// shape, a titled column of text buttons. Each action is one row, its glyph
// and then its caption (`gameMenuCaptions.ts`); each settings row is its
// glyph, the setting's name and then its state, which `gameMenu.ts` writes.
// The Load form sits directly under the Load Game row, so it opens where the
// player is looking: after the Settings rows, where it was, it would open
// below the fold of a one-column menu.
//
// A row's accessible name is the words written on it, and its tooltip opens
// with them (WCAG 2.5.3, label in name: a person speaking to the page says
// what is written, and a screen reader says what is shown). Both come from the
// caption table through these two helpers, which take what a row DOES and no
// name, so there is no second name to drift from the first. When the captions
// first shipped the names and tooltips of the icon-only menu were kept, and
// "Return to Game" was announced as "Resume" and "Quit Current Game" as "Quit
// to title".
function menuAction(
  kind: GameMenuActionKind,
  hook: string,
  /** What the action does: the tooltip's words after the caption. */
  help: string,
  modifier?: 'primary' | 'danger',
): string {
  const caption = GAME_MENU_CAPTIONS[kind].caption;
  const modifierClass = modifier ? ` hud-menu-item--${modifier}` : '';
  return `<button type="button" class="hud-menu-item${modifierClass}" data-hud="${hook}" aria-label="${caption}" data-tooltip="${caption} — ${help}">${gameMenuGlyph(kind)}<span class="hud-menu-item__label">${caption}</span></button>`;
}

function menuSetting(
  kind: GameMenuSettingKind,
  hook: string,
  stateHook: string,
  state: string,
  /** What a click on the setting does: the tooltip's words after its name. */
  help: string,
): string {
  const name = GAME_MENU_SETTING_NAMES[kind];
  return `<button type="button" class="hud-menu-item hud-menu-item--toggle" data-hud="${hook}" aria-label="${name}: ${state}" data-tooltip="${name} — ${help}">
              ${gameMenuGlyph(kind)}
              <span class="hud-menu-item__label">${name}</span>
              <span class="hud-menu-item__state" data-hud="${stateHook}" aria-live="polite" aria-atomic="true">${state}</span>
            </button>`;
}

const LOAD_PANEL_HTML = `<div class="hud-load-panel" data-hud="load-panel" hidden>
              <div class="hud-load-panel__title">Load saved match</div>
              <label class="hud-load-panel__option">
                <input type="radio" name="hud-load-source" value="localstorage" data-hud="load-source-localstorage" checked />
                <span data-hud="load-source-localstorage-label">From browser storage</span>
              </label>
              <label class="hud-load-panel__option">
                <input type="radio" name="hud-load-source" value="paste" data-hud="load-source-paste" />
                <span>From pasted JSON</span>
              </label>
              <textarea class="hud-load-panel__textarea" data-hud="load-paste-textarea" placeholder="Paste save-blob JSON here" rows="4" hidden></textarea>
              <div class="hud-load-panel__actions">
                <button type="button" class="hud-save-load__button" data-hud="load-confirm">Restore</button>
                <button type="button" class="hud-save-load__button hud-save-load__button--ghost" data-hud="load-cancel">Cancel</button>
              </div>
            </div>`;

const GAME_MENU_HTML = `
      <div class="hud-game-menu" data-hud="game-menu" role="dialog" aria-modal="true" aria-label="${GAME_MENU_TITLE.caption}" hidden>
        <div class="hud-game-menu__backdrop" data-hud="game-menu-backdrop"></div>
        <div class="hud-game-menu__panel">
          <div class="hud-game-menu__title">${GAME_MENU_TITLE.caption}</div>
          <div class="hud-game-menu__actions">
            ${menuAction('resume', 'menu-resume', 'resume the paused match (or press Esc).', 'primary')}
            ${menuAction('save', 'save-button', 'store the current match in this browser and download a .json copy.')}
            ${menuAction('load', 'load-button', 'restore a browser save or paste in a save blob.')}
            ${LOAD_PANEL_HTML}
            ${menuAction('techTree', 'menu-tech-tree', "browse your civilization's units and technologies; dimmed entries are its holes.")}
            ${menuAction('civilizations', 'menu-civilizations', 'compare all thirty side by side: army type, unique unit, team bonus and every civilization bonus.')}
            ${menuAction('replay', 'replay-load-button', 'open a live, prior-session, or imported recording.')}
            ${menuAction('restart', 'menu-restart', 'start this scenario again from the beginning.')}
            ${menuAction('quit', 'menu-quit', 'leave this match and return to a fresh start.', 'danger')}
          </div>
          <div class="hud-game-menu__section">
            <div class="hud-game-menu__section-title">Settings</div>
            ${menuSetting('debug', 'menu-debug-cycle', 'menu-debug-mode', 'off', 'cycle its mode (same as pressing F2).')}
            ${menuSetting('artStyle', 'menu-art-style-cycle', 'menu-art-style', 'Natural', 'switch between natural light and colour with no outlines (Natural) and ink contours over flat colour (Moebius).')}
          </div>
        </div>
      </div>`;

export const HUD_TEMPLATE_HTML = `
    <div class="hud-top">
      <div class="hud-bar">
        <div class="hud-chips" data-hud="chips">
          ${chip('food', 'Food', '0')}
          ${chip('wood', 'Wood', '0')}
          ${chip('gold', 'Gold', '0')}
          ${chip('stone', 'Stone', '0')}
          ${chip('age', 'Age', 'Dark Age')}
          ${chip('pop', 'Pop', '0/0')}
          ${chip('time', 'Time', '00:00')}
          <div class="hud-chip hud-chip--countdown" data-hud-chip="countdown" data-hud="countdown-chip" data-tooltip="${HUD_CHIP_TOOLTIPS.countdown}" data-hud-countdown-active="false">
            <div class="hud-chip-head">
              <div class="hud-label" data-hud="countdown-label">Countdown</div>
            </div>
            <div class="hud-value" data-hud="countdown-value">00:00</div>
          </div>
        </div>
        <button
          type="button"
          class="hud-menu-button"
          data-hud="menu-button"
          aria-label="Game menu"
          aria-haspopup="dialog"
          aria-expanded="false"
          data-tooltip="Open the game menu (or press Esc): save, load, replay, restart, settings."
        >☰</button>
      </div>
      ${GAME_MENU_HTML}
    </div>
    <div class="hud-bottom">
      <div
        class="hud-panel hud-panel--selection"
        data-hud="selection-panel"
      ></div>
      <div class="hud-panel hud-panel--map">
        <div class="hud-label">Minimap</div>
        <canvas
          class="hud-minimap"
          width="220"
          height="160"
          data-hud="minimap"
        ></canvas>
      </div>
      <div class="hud-footer" data-hud="match-summary" hidden></div>
    </div>
    <div id="hud-tooltip" class="hud-tooltip" data-hud="tooltip" data-hud-tooltip-active="false" role="tooltip" aria-hidden="true"></div>
    <div class="hud-toasts" data-hud="toast-container" aria-live="polite"></div>
    <div
      class="hud-debug-overlay"
      data-hud="debug-overlay"
      data-hud-debug-mode="off"
    ></div>
  `;
