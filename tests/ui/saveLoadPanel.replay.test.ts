// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSaveLoadPanel, type SaveLoadElements } from '../../src/ui/hud/saveLoadPanel';
import type { SaveBlob } from '../../src/game/simulation/saveSchema';

// Full-review iter-1 H2: the Save button stayed live during replay. Because
// the HUD's saveGame closure resolves the *current* (replay) bridge, clicking
// Save while watching a replay serialized the historical replay world over the
// player's single live save key. The panel must refuse to save in replay mode.

function elementsWith(saveButton: HTMLButtonElement): SaveLoadElements {
  return {
    saveButton,
    loadButton: null,
    loadPanel: null,
    loadSourceLocalStorageInput: null,
    loadSourceLocalStorageLabel: null,
    loadSourcePasteInput: null,
    loadPasteTextarea: null,
    loadConfirmButton: null,
    loadCancelButton: null,
  };
}

const FAKE_BLOB = { schema: 2, seed: 's', worldSnapshot: {} } as unknown as SaveBlob;

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('saveLoadPanel refuses to save during replay (full-review H2)', () => {
  it('does not call saveGame or write localStorage while in replay mode', () => {
    const saveButton = document.createElement('button');
    const saveGame = vi.fn((): SaveBlob => FAKE_BLOB);
    const showToast = vi.fn();
    const setItem = vi.spyOn(window.localStorage.__proto__, 'setItem');

    const panel = createSaveLoadPanel(elementsWith(saveButton), {
      saveGame,
      loadGame: async () => {},
      showToast,
      isReplayMode: () => true,
    });

    saveButton.click();

    expect(saveGame).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.mock.calls[0]![0]).toMatch(/replay/i);
    panel.destroy();
  });

  it('saves normally when not in replay mode', () => {
    const saveButton = document.createElement('button');
    const saveGame = vi.fn((): SaveBlob => FAKE_BLOB);
    const showToast = vi.fn();

    const panel = createSaveLoadPanel(elementsWith(saveButton), {
      saveGame,
      loadGame: async () => {},
      showToast,
      isReplayMode: () => false,
    });

    saveButton.click();

    expect(saveGame).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('aoe2-save-v1')).not.toBeNull();
    panel.destroy();
  });

  it('returns focus to the Load action after its nested panel closes', () => {
    const loadButton = document.createElement('button');
    const loadPanel = document.createElement('div');
    const loadCancelButton = document.createElement('button');
    loadPanel.hidden = true;
    loadPanel.append(loadCancelButton);
    document.body.append(loadButton, loadPanel);
    const panel = createSaveLoadPanel({
      ...elementsWith(document.createElement('button')),
      loadButton,
      loadPanel,
      loadCancelButton,
    }, {
      saveGame: () => FAKE_BLOB,
      loadGame: async () => {},
      showToast: () => {},
    });

    loadButton.click();
    loadCancelButton.focus();
    loadCancelButton.click();

    expect(loadPanel.hidden).toBe(true);
    expect(loadButton).toBe(document.activeElement);
    panel.destroy();
    loadButton.remove();
    loadPanel.remove();
  });
});
