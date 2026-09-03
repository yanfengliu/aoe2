// Slice 2 (replay-load-and-e2e v0.1.9) extracted the HUD HTML template
// out of `createHudController.ts` so the controller stays under the
// 500-LOC budget after the new "Replay (live session)" button landed.
// The template is a pure string constant — no behavior change.

import { HUD_CHIP_TOOLTIPS } from './tooltips';
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
  return `
        <div class="hud-chip" data-hud-chip="${key}" data-tooltip="${HUD_CHIP_TOOLTIPS[key]}">
          <div class="hud-chip-head">
            ${resourceGlyph(key)}
            <div class="hud-label">${label}</div>
          </div>
          <div class="hud-value" data-hud="${key}">${initialValue}</div>
        </div>`;
}

// v0.1.95: the in-game menu (opened by Esc or the ☰ button). Save / Load /
// Replay were moved OFF the top bar into here (so the bar's button positions can
// never shift), and Restart / Quit-to-title / a Settings section were added. The
// Save/Load/Replay buttons keep their original `data-hud` ids so the existing
// createSaveLoadPanel + replay-dialog wiring binds to them unchanged; the load
// panel moved here with them.
const GAME_MENU_HTML = `
      <div class="hud-game-menu" data-hud="game-menu" role="dialog" aria-modal="true" aria-label="Game menu" hidden>
        <div class="hud-game-menu__backdrop" data-hud="game-menu-backdrop"></div>
        <div class="hud-game-menu__panel">
          <div class="hud-game-menu__title">Menu</div>
          <div class="hud-game-menu__actions">
            <button type="button" class="hud-menu-item hud-menu-item--primary" data-hud="menu-resume" aria-label="Resume" data-tooltip="Resume — return to the paused match (or press Esc).">${gameMenuGlyph('resume')}</button>
            <button type="button" class="hud-menu-item" data-hud="save-button" aria-label="Save game" data-tooltip="Save game — store the current match in this browser and download a .json copy.">${gameMenuGlyph('save')}</button>
            <button type="button" class="hud-menu-item" data-hud="load-button" aria-label="Load game" data-tooltip="Load game — restore a browser save or paste in a save blob.">${gameMenuGlyph('load')}</button>
            <button type="button" class="hud-menu-item" data-hud="menu-tech-tree" aria-label="Technology tree" data-tooltip="Technology tree — browse your civilization's units and technologies; dimmed entries are its holes.">${gameMenuGlyph('techTree')}</button>
            <button type="button" class="hud-menu-item" data-hud="replay-load-button" aria-label="Watch a replay…" data-tooltip="Watch a replay… — open a live, prior-session, or imported recording.">${gameMenuGlyph('replay')}</button>
            <button type="button" class="hud-menu-item" data-hud="menu-restart" aria-label="Restart match" data-tooltip="Restart match — start this scenario again from the beginning.">${gameMenuGlyph('restart')}</button>
            <button type="button" class="hud-menu-item hud-menu-item--danger" data-hud="menu-quit" aria-label="Quit to title" data-tooltip="Quit to title — leave this match and return to a fresh start.">${gameMenuGlyph('quit')}</button>
          </div>
          <div class="hud-game-menu__section">
            <div class="hud-game-menu__section-title">Settings</div>
            <button type="button" class="hud-menu-item hud-menu-item--toggle" data-hud="menu-debug-cycle" aria-label="Debug overlay: off" data-tooltip="Debug overlay — cycle its mode (same as pressing F2).">
              ${gameMenuGlyph('debug')}
              <span class="hud-menu-item__state" data-hud="menu-debug-mode" aria-live="polite" aria-atomic="true">off</span>
            </button>
          </div>
          <div class="hud-load-panel" data-hud="load-panel" hidden>
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
