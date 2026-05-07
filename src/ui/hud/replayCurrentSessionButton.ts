// Slice 2 (replay-load-and-e2e v0.1.9): wires the "Replay (live session)"
// HUD button. The button is enabled when the live session has replay
// payloads AND replay mode is not already active; clicking it invokes
// the supplied click handler. Disabled state refreshes on three signals:
// (a) immediately on mode-change events from `subscribeToModeChange`
//     (so enter/exit replay flips the button without poll lag);
// (b) the 500ms poll interval (catches recording-bundle changes that
//     have no event channel);
// (c) just before the click handler invokes `onClick` (closes the
//     window between the last poll and a click on a stale button).

const POLL_INTERVAL_MS = 500;

export interface ReplayCurrentSessionButtonConfig {
  readonly button: HTMLButtonElement;
  readonly onClick: () => void;
  readonly isAvailable: () => boolean;
  readonly isReplayMode: () => boolean;
  /** Subscribe to immediate mode-change notifications. Returns an
   *  unsubscribe function. When omitted, the button relies on the poll
   *  alone (used by tests that simulate mode flips manually). */
  readonly subscribeToModeChange?: (listener: () => void) => () => void;
  /** When false, the button never auto-polls; tests call `refresh()` manually. */
  readonly autoRefresh?: boolean;
}

export interface ReplayCurrentSessionButtonHandle {
  refresh(): void;
  destroy(): void;
}

export function createReplayCurrentSessionButton(
  config: ReplayCurrentSessionButtonConfig,
): ReplayCurrentSessionButtonHandle {
  const { button, onClick, isAvailable, isReplayMode, subscribeToModeChange } = config;
  const autoRefresh = config.autoRefresh ?? true;
  let pollHandle: ReturnType<typeof setInterval> | null = null;
  let unsubscribeModeChange: (() => void) | null = null;

  const refresh = (): void => {
    button.disabled = isReplayMode() || !isAvailable();
  };

  const handleClick = (): void => {
    // Re-evaluate disabled state inline so a stale button (e.g., the
    // 500ms poll hasn't caught up to a just-finished replay exit, or a
    // bundle that just lost its payloads) cannot trigger `onClick`. The
    // browser already suppresses native click events on `disabled`
    // buttons, so this guard primarily defends against the
    // synthetic-click race window between two refresh ticks.
    refresh();
    if (button.disabled) return;
    onClick();
  };

  button.addEventListener('click', handleClick);
  refresh();
  if (subscribeToModeChange) {
    unsubscribeModeChange = subscribeToModeChange(refresh);
  }
  if (autoRefresh && typeof setInterval === 'function') {
    pollHandle = setInterval(refresh, POLL_INTERVAL_MS);
  }

  return {
    refresh,
    destroy(): void {
      if (pollHandle !== null) {
        clearInterval(pollHandle);
        pollHandle = null;
      }
      unsubscribeModeChange?.();
      unsubscribeModeChange = null;
      button.removeEventListener('click', handleClick);
    },
  };
}
