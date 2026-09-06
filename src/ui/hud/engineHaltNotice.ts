import { escapeHtml } from '../utils/escapeHtml';

// The one surface that tells the player the match has STOPPED — as opposed to
// being paused (the menu says so and the clock is still theirs to restart) or
// finished (the post-game card names a winner). Before this existed both ways
// a match could break were silent: a throw inside `AoeVoxelGameView.frame()`
// killed the animation loop with the HUD still drawing a live-looking match,
// and the bridge's own `HudState.engineHalted` — set when the engine reports a
// tick failure — was read by nothing in the UI at all.
//
// It mounts itself into the HUD root (the `idleVillagerBell` / `MarkerListPanel`
// pattern) so no HUD template or controller edit is needed, and it deliberately
// covers the screen: a stopped simulation is not something to notice later.

export type EngineHaltSource = 'frame' | 'engine';

export interface EngineHaltNoticeDetails {
  readonly source: EngineHaltSource;
  /** What threw, in one line. */
  readonly message: string;
  /** Engine-side halts carry the tick and the system that failed. */
  readonly tick?: number;
  readonly detail?: string;
}

export interface EngineHaltNotice {
  /** Idempotent: the first halt wins, so a later failure cannot overwrite the
   *  cause the player is reading. */
  show(details: EngineHaltNoticeDetails): void;
  isShown(): boolean;
  /** The element, for tests; null until mounted. */
  element(): HTMLElement | null;
  destroy(): void;
}

function headline(source: EngineHaltSource): string {
  return source === 'frame'
    ? 'The game stopped: a frame failed'
    : 'The game stopped: the simulation failed';
}

export function createEngineHaltNotice(
  host: HTMLElement | null,
  onReload: () => void,
): EngineHaltNotice {
  if (!host) {
    return {
      show: () => {},
      isShown: () => false,
      element: () => null,
      destroy: () => {},
    };
  }

  const root = host.ownerDocument.createElement('div');
  root.className = 'hud-halt-notice';
  root.dataset.hud = 'engine-halt';
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-live', 'assertive');
  root.setAttribute('aria-label', 'The game has stopped');
  root.hidden = true;
  host.append(root);

  let shown = false;

  function show(details: EngineHaltNoticeDetails): void {
    if (shown) return;
    shown = true;
    const lines = [details.message];
    if (details.tick !== undefined) lines.push(`Tick ${String(details.tick)}`);
    if (details.detail) lines.push(details.detail);
    root.innerHTML = `
      <div class="hud-halt-notice__panel">
        <div class="hud-halt-notice__title" data-hud="engine-halt-title">${escapeHtml(headline(details.source))}</div>
        <div class="hud-halt-notice__body">This match cannot continue — the world was left part-way through a turn, so it is not safe to keep playing it. Nothing you did caused this. Reload to start a new match; a saved game can be loaded from the menu afterwards.</div>
        <div class="hud-halt-notice__cause" data-hud="engine-halt-cause">${escapeHtml(lines.join(' — '))}</div>
        <button type="button" class="hud-halt-notice__action" data-hud="engine-halt-reload">Reload the game</button>
      </div>`;
    root.hidden = false;
    const button = root.querySelector<HTMLButtonElement>('[data-hud="engine-halt-reload"]');
    button?.addEventListener('click', () => { onReload(); });
    button?.focus({ preventScroll: true });
  }

  return {
    show,
    isShown: () => shown,
    element: () => root,
    destroy: () => { root.remove(); },
  };
}
