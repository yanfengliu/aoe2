// Slice 2 (replay-load-and-e2e v0.1.9) extracted the HUD HTML template
// out of `createHudController.ts` so the controller stays under the
// 500-LOC budget after the new "Replay (live session)" button landed.
// The template is a pure string constant — no behavior change.

import { HUD_CHIP_TOOLTIPS } from './tooltips';

export const HUD_TEMPLATE_HTML = `
    <div class="hud-top">
      <div class="hud-bar">
        <div class="hud-chip" data-hud-chip="food" data-tooltip="${HUD_CHIP_TOOLTIPS.food}">
          <div class="hud-label">Food</div>
          <div class="hud-value" data-hud="food">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="wood" data-tooltip="${HUD_CHIP_TOOLTIPS.wood}">
          <div class="hud-label">Wood</div>
          <div class="hud-value" data-hud="wood">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="gold" data-tooltip="${HUD_CHIP_TOOLTIPS.gold}">
          <div class="hud-label">Gold</div>
          <div class="hud-value" data-hud="gold">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="stone" data-tooltip="${HUD_CHIP_TOOLTIPS.stone}">
          <div class="hud-label">Stone</div>
          <div class="hud-value" data-hud="stone">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="age" data-tooltip="${HUD_CHIP_TOOLTIPS.age}">
          <div class="hud-label">Age</div>
          <div class="hud-value" data-hud="age">Dark Age</div>
        </div>
        <div class="hud-chip" data-hud-chip="pop" data-tooltip="${HUD_CHIP_TOOLTIPS.pop}">
          <div class="hud-label">Pop</div>
          <div class="hud-value" data-hud="pop">0/0</div>
        </div>
        <div class="hud-chip" data-hud-chip="time" data-tooltip="${HUD_CHIP_TOOLTIPS.time}">
          <div class="hud-label">Time</div>
          <div class="hud-value" data-hud="time">00:00</div>
        </div>
        <div class="hud-chip" data-hud-chip="countdown" data-hud="countdown-chip" data-tooltip="${HUD_CHIP_TOOLTIPS.countdown}" hidden>
          <div class="hud-label" data-hud="countdown-label">Countdown</div>
          <div class="hud-value" data-hud="countdown-value">00:00</div>
        </div>
        <div class="hud-save-load">
          <button
            type="button"
            class="hud-save-load__button"
            data-hud="save-button"
            data-tooltip="Save the current match to browser storage and download a .json copy."
          >Save</button>
          <button
            type="button"
            class="hud-save-load__button"
            data-hud="load-button"
            data-tooltip="Load a saved match from browser storage or paste in a save blob."
          >Load</button>
          <button type="button" class="hud-save-load__button" data-hud="replay-current-session-button" data-tooltip="Open the in-progress live session in replay mode." disabled>Replay</button>
          <button type="button" class="hud-save-load__button" data-hud="replay-file-import-button" data-tooltip="Open a recorded session bundle (JSON file) in replay mode.">Replay file</button>
        </div>
      </div>
      <div class="hud-load-panel" data-hud="load-panel" hidden>
        <div class="hud-load-panel__title">Load saved match</div>
        <label class="hud-load-panel__option">
          <input
            type="radio"
            name="hud-load-source"
            value="localstorage"
            data-hud="load-source-localstorage"
            checked
          />
          <span data-hud="load-source-localstorage-label">From browser storage</span>
        </label>
        <label class="hud-load-panel__option">
          <input
            type="radio"
            name="hud-load-source"
            value="paste"
            data-hud="load-source-paste"
          />
          <span>From pasted JSON</span>
        </label>
        <textarea
          class="hud-load-panel__textarea"
          data-hud="load-paste-textarea"
          placeholder="Paste save-blob JSON here"
          rows="4"
          hidden
        ></textarea>
        <div class="hud-load-panel__actions">
          <button type="button" class="hud-save-load__button" data-hud="load-confirm">Restore</button>
          <button type="button" class="hud-save-load__button hud-save-load__button--ghost" data-hud="load-cancel">Cancel</button>
        </div>
      </div>
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
    <div class="hud-tooltip" data-hud="tooltip" data-hud-tooltip-active="false" role="tooltip" aria-hidden="true"></div>
    <div class="hud-toasts" data-hud="toast-container" aria-live="polite"></div>
    <div
      class="hud-debug-overlay"
      data-hud="debug-overlay"
      data-hud-debug-mode="off"
    ></div>
  `;
