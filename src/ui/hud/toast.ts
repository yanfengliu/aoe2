// Slice 11: lightweight toast stream. Command rejections from the
// simulation bridge + FU5 save/load outcomes flow through `showToast()`,
// which creates a DOM element inside `toastContainer` and fades it out
// after a short lifetime. The controller leaves layout / styling to
// `hud.css`.

const TOAST_LIFETIME_MS = 2400;
const TOAST_FADE_MS = 240;

export interface ToastHandle {
  showToast(text: string): void;
}

export function createToastController(
  toastContainer: HTMLElement | null,
): ToastHandle {
  if (!toastContainer) {
    return { showToast: () => {} };
  }

  function showToast(text: string): void {
    if (!toastContainer || text.trim().length === 0) {
      return;
    }
    const el = document.createElement('div');
    el.className = 'hud-toast';
    el.dataset.hud = 'toast';
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
    }, TOAST_LIFETIME_MS);
  }

  return { showToast };
}
