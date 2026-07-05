// v0.1.95: the in-game menu controller. Opened by the ☰ top-bar button or the
// Esc key (Esc wired through the app's HotkeyRegistry → `toggle`). Owns show /
// hide, pauses the sim while it is up (restoring the prior pause state on
// close), and wires Resume / Restart / Quit / the Settings debug-overlay cycle.
// Save / Load / Replay live inside the menu markup but keep their original
// `data-hud` ids, so they stay bound by createSaveLoadPanel + the replay dialog
// — this controller does not touch them.

export interface GameMenuDeps {
  // Pause/resume the simulation while the menu is open. Optional so tests and
  // headless mounts can omit them.
  setPaused?: (paused: boolean) => void;
  isPaused?: () => boolean;
  // Restart the current scenario from the beginning.
  onRestart?: () => void;
  // Leave the match (return to a fresh start / title).
  onQuit?: () => void;
  // Advance the debug overlay to its next mode; returns the new mode label to
  // render in the Settings row.
  cycleDebugOverlay?: () => string;
}

export interface GameMenuHandle {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

const NOOP_HANDLE: GameMenuHandle = {
  open: () => {},
  close: () => {},
  toggle: () => {},
  isOpen: () => false,
  destroy: () => {},
};

export function createGameMenu(root: HTMLElement, deps: GameMenuDeps): GameMenuHandle {
  const menu = root.querySelector<HTMLElement>('[data-hud="game-menu"]');
  if (!menu) {
    return NOOP_HANDLE;
  }
  const menuButton = root.querySelector<HTMLButtonElement>('[data-hud="menu-button"]');
  const resumeButton = root.querySelector<HTMLButtonElement>('[data-hud="menu-resume"]');
  const restartButton = root.querySelector<HTMLButtonElement>('[data-hud="menu-restart"]');
  const quitButton = root.querySelector<HTMLButtonElement>('[data-hud="menu-quit"]');
  const backdrop = root.querySelector<HTMLElement>('[data-hud="game-menu-backdrop"]');
  const debugCycleButton = root.querySelector<HTMLButtonElement>('[data-hud="menu-debug-cycle"]');
  const debugModeLabel = root.querySelector<HTMLElement>('[data-hud="menu-debug-mode"]');

  const isOpen = (): boolean => !menu.hidden;

  // v0.1.97: whether the sim was ALREADY paused when the menu opened, so close()
  // restores that state rather than blindly resuming — the menu must never
  // un-pause a game the player had paused independently.
  let wasPausedBeforeOpen = false;

  const open = (): void => {
    if (isOpen()) {
      return;
    }
    menu.hidden = false;
    menuButton?.setAttribute('aria-expanded', 'true');
    // Auto-pause the sim while the menu is up (players expect Esc to pause),
    // remembering the prior pause state for close().
    wasPausedBeforeOpen = deps.isPaused?.() ?? false;
    deps.setPaused?.(true);
    resumeButton?.focus();
  };

  const close = (): void => {
    if (!isOpen()) {
      return;
    }
    menu.hidden = true;
    menuButton?.setAttribute('aria-expanded', 'false');
    // Only resume if the player had NOT already paused before opening the menu.
    if (!wasPausedBeforeOpen) {
      deps.setPaused?.(false);
    }
    menuButton?.focus();
  };

  const toggle = (): void => {
    if (isOpen()) {
      close();
    } else {
      open();
    }
  };

  const onMenuButton = (): void => toggle();
  const onResume = (): void => close();
  const onBackdrop = (): void => close();
  const onRestart = (): void => {
    close();
    deps.onRestart?.();
  };
  const onQuit = (): void => {
    deps.onQuit?.();
  };
  const onDebugCycle = (): void => {
    const mode = deps.cycleDebugOverlay?.();
    if (mode !== undefined && debugModeLabel) {
      debugModeLabel.textContent = mode;
    }
  };

  menuButton?.addEventListener('click', onMenuButton);
  resumeButton?.addEventListener('click', onResume);
  backdrop?.addEventListener('click', onBackdrop);
  restartButton?.addEventListener('click', onRestart);
  quitButton?.addEventListener('click', onQuit);
  debugCycleButton?.addEventListener('click', onDebugCycle);

  return {
    open,
    close,
    toggle,
    isOpen,
    destroy: () => {
      menuButton?.removeEventListener('click', onMenuButton);
      resumeButton?.removeEventListener('click', onResume);
      backdrop?.removeEventListener('click', onBackdrop);
      restartButton?.removeEventListener('click', onRestart);
      quitButton?.removeEventListener('click', onQuit);
      debugCycleButton?.removeEventListener('click', onDebugCycle);
    },
  };
}
