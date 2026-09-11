// Escape belongs to whatever is ON TOP.
//
// Before this file the Escape key was a single handler that arbitrated three
// cases inline (`createApp.ts`, v0.1.95): replay mode first, then "yield if a
// native <dialog> is open", then toggle the game menu. Everything else the
// game can put on the screen — the technology tree, the civilizations
// compendium, an armed building placement — was invisible to it, so pressing
// Escape with the tech tree open over the game menu closed the MENU, left the
// tech tree on screen with no way out but its own ✕, and resumed the clock
// underneath it (play-test 2026-09-11, screenshots `03-techtree.png` /
// `04-techtree-after-escape.png`).
//
// The fix is not another `if`. A key that means "back out of the thing I am
// in" needs a notion of which thing that is, so the layers are declared as an
// ORDERED LIST, topmost first, and Escape dismisses the first one that is up.
// Adding a new overlay means adding a row here; forgetting to is the defect
// this file exists to make visible.
//
// Native `<dialog>` is the one exception and it is not a row: an open modal
// dialog handles Escape itself (the browser closes it and fires `cancel`), so
// this stack YIELDS entirely rather than racing it.

import {
  cancelBuildingPlacement,
  isBuildingPlacementArmed,
  type PlacementCancelBridge,
} from '../cancelBuildingPlacement';

export interface EscapeLayer {
  /** Short id — used in diagnostics and by the browser specs. */
  readonly name: string;
  /** Is this layer on screen right now? */
  isOpen(): boolean;
  /** Take this layer down. Called only when `isOpen()` was true. */
  dismiss(): void;
}

export interface EscapeLayerStackDeps {
  /**
   * Layers TOPMOST FIRST. The first one reporting `isOpen()` takes the key;
   * nothing below it sees the press.
   */
  readonly layers: readonly EscapeLayer[];
  /**
   * A native modal `<dialog>` is open and owns the key. When this is true the
   * stack does nothing at all — not even the fallback.
   */
  isNativeDialogOpen(): boolean;
  /** What Escape means when no layer is up (here: open the game menu). */
  onNothingOpen(): void;
}

export interface EscapeLayerStack {
  /**
   * Handles one Escape press. Returns the name of the layer that took it,
   * `'dialog'` when a native dialog owns the key, or `null` when the press
   * fell through to `onNothingOpen`.
   */
  handleEscape(): string | null;
  /** The layer that WOULD take the next press, for diagnostics and specs. */
  topmostOpenLayerName(): string | null;
}

/** The collaborators the game's own Escape stack is built from. */
export interface EscapeLayerHotkeyDeps {
  hotkeyRegistry: { register(binding: { key: string }, handler: () => void): void };
  hudController: { isGameMenuOpen(): boolean; closeGameMenu(): void; toggleGameMenu(): void };
  referencePanels: { isAnyOpen(): boolean; closeAll(): void };
  replayController: { readonly mode: string; exitReplay(): void };
  getBridge(): PlacementCancelBridge;
}

/**
 * Registers Escape against the game's real layer stack, TOPMOST FIRST:
 *
 *  1. a native `<dialog>` (the replay-load modal) — the browser owns the key;
 *  2. a reference panel (technology tree, civilizations) — these open OVER the
 *     game menu, so they have to outrank it;
 *  3. the game menu;
 *  4. an armed building placement — cancelling it leaves the villagers selected;
 *  5. replay mode.
 *
 * With none of them up, Escape opens the game menu, which is what it has meant
 * since v0.1.95.
 */
export function registerEscapeLayerHotkey(deps: EscapeLayerHotkeyDeps): EscapeLayerStack {
  const stack = createEscapeLayerStack({
    isNativeDialogOpen: () => document.querySelector('dialog[open]') !== null,
    layers: [
      {
        name: 'reference-panel',
        isOpen: () => deps.referencePanels.isAnyOpen(),
        dismiss: () => { deps.referencePanels.closeAll(); },
      },
      {
        name: 'game-menu',
        isOpen: () => deps.hudController.isGameMenuOpen(),
        dismiss: () => { deps.hudController.closeGameMenu(); },
      },
      {
        name: 'building-placement',
        isOpen: () => isBuildingPlacementArmed(deps.getBridge()),
        dismiss: () => { cancelBuildingPlacement(deps.getBridge()); },
      },
      {
        name: 'replay',
        isOpen: () => deps.replayController.mode === 'replay',
        dismiss: () => { deps.replayController.exitReplay(); },
      },
    ],
    onNothingOpen: () => { deps.hudController.toggleGameMenu(); },
  });
  deps.hotkeyRegistry.register({ key: 'Escape' }, () => { stack.handleEscape(); });
  return stack;
}

export function createEscapeLayerStack(deps: EscapeLayerStackDeps): EscapeLayerStack {
  const topmostOpen = (): EscapeLayer | null =>
    deps.layers.find((layer) => layer.isOpen()) ?? null;

  return {
    handleEscape: () => {
      if (deps.isNativeDialogOpen()) {
        return 'dialog';
      }
      const layer = topmostOpen();
      if (layer === null) {
        deps.onNothingOpen();
        return null;
      }
      layer.dismiss();
      return layer.name;
    },
    topmostOpenLayerName: () => topmostOpen()?.name ?? null,
  };
}
