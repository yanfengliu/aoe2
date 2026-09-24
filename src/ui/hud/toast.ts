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

const TOAST_LIFETIME_MS = 2400;
const ALERT_TOAST_LIFETIME_MS = 5000;
const TOAST_FADE_MS = 240;

export interface ToastOptions {
  kind?: 'alert';
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
