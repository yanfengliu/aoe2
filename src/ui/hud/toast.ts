// Slice 11: lightweight toast stream. Command rejections from the
// simulation bridge + FU5 save/load outcomes flow through `showToast()`,
// which creates a DOM element inside `toastContainer` and fades it out
// after a short lifetime. The controller leaves layout / styling to
// `hud.css`.
//
// v0.3.229: an ALERT toast is the attack warning's words. It is styled to
// stand apart from a rejection (`data-hud-toast-kind="alert"`) and stays up
// longer, because it is news the player did not ask for rather than the
// answer to a click they just made.
//
// An alert also carries the simulation tick of the blow it announces, as
// `data-hud-toast-hit-tick`. The page draws the words up to a frame of ticks
// after that blow, so the tick it is at by then is not the tick the horn's
// throttle counts from: a spec that stamped each alert with the page's tick
// read 199 between two horns that were exactly 200 ticks apart (defect
// register 2026-09-24).

const TOAST_LIFETIME_MS = 2400;
const ALERT_TOAST_LIFETIME_MS = 5000;
const TOAST_FADE_MS = 240;

export interface ToastOptions {
  kind?: 'alert';
  /** An alert's blow: the simulation tick the words announce. */
  hitTick?: number;
}

export interface ToastHandle {
  showToast(text: string, options?: ToastOptions): void;
}

export function createToastController(
  toastContainer: HTMLElement | null,
): ToastHandle {
  if (!toastContainer) {
    return { showToast: () => {} };
  }

  function showToast(text: string, options: ToastOptions = {}): void {
    if (!toastContainer || text.trim().length === 0) {
      return;
    }
    const el = document.createElement('div');
    el.className = 'hud-toast';
    el.dataset.hud = 'toast';
    if (options.kind) el.dataset.hudToastKind = options.kind;
    if (options.hitTick !== undefined) el.dataset.hudToastHitTick = String(options.hitTick);
    el.textContent = text;
    toastContainer.appendChild(el);
    // Flush layout so the enter transition has an initial state to animate from.
    void el.offsetWidth;
    el.dataset.hudToastActive = 'true';
    window.setTimeout(() => {
      el.dataset.hudToastActive = 'false';
      window.setTimeout(() => {
        el.remove();
      }, TOAST_FADE_MS);
    }, options.kind === 'alert' ? ALERT_TOAST_LIFETIME_MS : TOAST_LIFETIME_MS);
  }

  return { showToast };
}
