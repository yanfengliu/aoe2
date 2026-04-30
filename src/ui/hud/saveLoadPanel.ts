import type { SaveBlob } from '../../game/simulation/saveSchema';

// FU5: Save / Load HUD plumbing.
//
// The module owns only the UI: click handlers, the hidden load panel, a
// localStorage key, and a blob-URL download link. The simulation
// serialization lives on the bridge (`saveGame()` / `loadGame(blob)`).
// Whenever the bridge reference swaps (on load), the controller is not
// notified directly — closures keep resolving the bridge lazily through
// the injected `getBridge()` thunk, so the old bridge stays alive until
// `loadGame` replaces it.

const SAVE_STORAGE_KEY = 'aoe2-save-v1';

export interface SaveLoadElements {
  saveButton: HTMLButtonElement | null;
  loadButton: HTMLButtonElement | null;
  loadPanel: HTMLElement | null;
  loadSourceLocalStorageInput: HTMLInputElement | null;
  loadSourceLocalStorageLabel: HTMLElement | null;
  loadSourcePasteInput: HTMLInputElement | null;
  loadPasteTextarea: HTMLTextAreaElement | null;
  loadConfirmButton: HTMLButtonElement | null;
  loadCancelButton: HTMLButtonElement | null;
}

export interface SaveLoadDeps {
  saveGame(): SaveBlob;
  // Spec 2 (annotation-ui v0.1.5) AO-5: widened to async because the
  // matching `HudBridge.loadGame` now awaits the new `RecordingService`'s
  // start() call inside `rebuildAnnotationStack`. The panel awaits this
  // promise and toasts success on resolve / failure on reject.
  loadGame(blob: SaveBlob): Promise<void>;
  showToast(text: string): void;
}

export interface SaveLoadHandle {
  // Kept narrow: FU5 only exposes the Save/Load buttons to the user.
  // Public methods would be future state-sync hooks; currently no
  // caller needs them.
  destroy(): void;
}

export function createSaveLoadPanel(
  elements: SaveLoadElements,
  deps: SaveLoadDeps,
): SaveLoadHandle {
  const {
    saveButton,
    loadButton,
    loadPanel,
    loadSourceLocalStorageInput,
    loadSourceLocalStorageLabel,
    loadSourcePasteInput,
    loadPasteTextarea,
    loadConfirmButton,
    loadCancelButton,
  } = elements;
  const { saveGame, loadGame, showToast } = deps;

  function refreshLoadSourceAvailability(): void {
    if (!loadSourceLocalStorageInput || !loadSourceLocalStorageLabel) {
      return;
    }
    let hasStoredBlob = false;
    try {
      hasStoredBlob = window.localStorage.getItem(SAVE_STORAGE_KEY) !== null;
    } catch {
      // Access to localStorage can throw in privacy-locked browsers.
      hasStoredBlob = false;
    }
    loadSourceLocalStorageInput.disabled = !hasStoredBlob;
    loadSourceLocalStorageLabel.textContent = hasStoredBlob
      ? 'From browser storage'
      : 'From browser storage (no save found)';
    // If the stored option just became unavailable and it was checked,
    // flip selection onto the paste alternative so the confirm button
    // has a valid source.
    if (!hasStoredBlob && loadSourceLocalStorageInput.checked && loadSourcePasteInput) {
      loadSourcePasteInput.checked = true;
      applyLoadSourceSelection();
    }
  }

  function applyLoadSourceSelection(): void {
    if (!loadPasteTextarea) {
      return;
    }
    const pasteSelected = loadSourcePasteInput?.checked === true;
    loadPasteTextarea.hidden = !pasteSelected;
    if (pasteSelected) {
      loadPasteTextarea.focus();
    }
  }

  function openLoadPanel(): void {
    if (!loadPanel) {
      return;
    }
    refreshLoadSourceAvailability();
    // Prefer the available option: if localStorage has a blob, keep
    // that selected; otherwise start on the paste option.
    if (loadSourceLocalStorageInput && !loadSourceLocalStorageInput.disabled) {
      loadSourceLocalStorageInput.checked = true;
    } else if (loadSourcePasteInput) {
      loadSourcePasteInput.checked = true;
    }
    applyLoadSourceSelection();
    loadPanel.hidden = false;
  }

  function closeLoadPanel(): void {
    if (!loadPanel) {
      return;
    }
    loadPanel.hidden = true;
    if (loadPasteTextarea) {
      loadPasteTextarea.value = '';
    }
  }

  function triggerBlobDownload(json: string): void {
    // Vite's preview + playwright environment both support
    // URL.createObjectURL; guard just so the code stays safe in
    // non-browser test harnesses.
    if (typeof URL === 'undefined' || typeof document === 'undefined') {
      return;
    }
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace(/T/, '_')
        .slice(0, 19);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `aoe2-save-${timestamp}.json`;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Revoke asynchronously so Firefox/Safari have time to begin the
      // download before the URL is released.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.warn('Failed to trigger save download:', error);
    }
  }

  function handleSaveClick(): void {
    let json: string;
    try {
      const blob = saveGame();
      json = JSON.stringify(blob);
    } catch (error) {
      console.warn('Save failed:', error);
      showToast('Save failed.');
      return;
    }
    // V5-4: localStorage may be unavailable in private browsing, exhausted
    // by quota, or blocked by security context. The JSON blob is already
    // built — fall back to download so the user keeps the save instead of
    // losing it entirely.
    let storedToLocalStorage = true;
    try {
      window.localStorage.setItem(SAVE_STORAGE_KEY, json);
    } catch (error) {
      storedToLocalStorage = false;
      console.warn('Could not write save to localStorage:', error);
    }
    triggerBlobDownload(json);
    showToast(
      storedToLocalStorage
        ? 'Game saved.'
        : 'Storage unavailable; save downloaded.',
    );
    refreshLoadSourceAvailability();
  }

  // Spec 2 AO-5: button-disable affordance + single-flight guard. The
  // RecordingService.rebuildAnnotationStack helper is single-flight inside
  // createApp, but disabling the Load button between click and resolution
  // gives the user clear feedback and prevents the trivial double-click
  // race (which would otherwise serialize through the rebuild chain).
  let loadInFlight = false;

  async function handleLoadConfirmClick(): Promise<void> {
    if (loadInFlight) return;

    let blobJson: string | null = null;
    if (loadSourcePasteInput?.checked) {
      blobJson = loadPasteTextarea?.value.trim() ?? '';
      if (!blobJson) {
        showToast('Paste a save blob before restoring.');
        return;
      }
    } else {
      try {
        blobJson = window.localStorage.getItem(SAVE_STORAGE_KEY);
      } catch {
        blobJson = null;
      }
      if (!blobJson) {
        showToast('No save found in browser storage.');
        return;
      }
    }

    let parsed: SaveBlob;
    try {
      parsed = JSON.parse(blobJson) as SaveBlob;
    } catch (error) {
      console.warn('Save blob was not valid JSON:', error);
      showToast('Load failed (invalid JSON).');
      return;
    }

    loadInFlight = true;
    if (loadConfirmButton) loadConfirmButton.disabled = true;
    if (loadButton) loadButton.disabled = true;
    try {
      // Spec 2 AO-5: loadGame returns Promise<void>; await for the
      // async recording-service rebuild before showing the success
      // toast. Sync rejections are also caught (Promise.reject /
      // synchronous throw paths).
      await loadGame(parsed);
    } catch (error) {
      console.warn('Load failed:', error);
      const message = error instanceof Error && error.message.length > 0
        ? error.message
        : 'Load failed.';
      showToast(message);
      return;
    } finally {
      loadInFlight = false;
      if (loadConfirmButton) loadConfirmButton.disabled = false;
      if (loadButton) loadButton.disabled = false;
    }

    showToast('Game loaded.');
    closeLoadPanel();
  }

  const handleLoadButton = (): void => {
    if (loadPanel?.hidden === false) {
      closeLoadPanel();
      return;
    }
    openLoadPanel();
  };

  saveButton?.addEventListener('click', handleSaveClick);
  loadButton?.addEventListener('click', handleLoadButton);
  loadCancelButton?.addEventListener('click', closeLoadPanel);
  loadConfirmButton?.addEventListener('click', handleLoadConfirmClick);
  loadSourceLocalStorageInput?.addEventListener('change', applyLoadSourceSelection);
  loadSourcePasteInput?.addEventListener('change', applyLoadSourceSelection);
  // Ensure the label and availability reflect the current localStorage
  // state on boot (prior sessions may have written a save).
  refreshLoadSourceAvailability();

  return {
    destroy: () => {
      saveButton?.removeEventListener('click', handleSaveClick);
      loadButton?.removeEventListener('click', handleLoadButton);
      loadCancelButton?.removeEventListener('click', closeLoadPanel);
      loadConfirmButton?.removeEventListener('click', handleLoadConfirmClick);
      loadSourceLocalStorageInput?.removeEventListener('change', applyLoadSourceSelection);
      loadSourcePasteInput?.removeEventListener('change', applyLoadSourceSelection);
    },
  };
}
