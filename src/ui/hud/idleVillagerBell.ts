// The idle villager bell (v0.3.103): AoE2's little button that answers "who
// is standing around?". Anchored bottom-left above the selection panel,
// always in the DOM (the countdown-chip rule — appearing elements must never
// reflow the HUD): it dims to near-invisible at zero and wakes with the
// count. Click = select the next idle villager round-robin and centre the
// camera on them; the '.' hotkey does the same.

export interface IdleVillagerBellDeps {
  countIdleVillagers: () => number;
  selectNext: () => void;
}

export interface IdleVillagerBell {
  mount(root: HTMLElement): void;
  dispose(): void;
}

export function createIdleVillagerBell(deps: IdleVillagerBellDeps): IdleVillagerBell {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.hud = 'idle-villager-bell';
  button.title = 'Select next idle villager (.)';
  button.setAttribute('aria-label', 'Select next idle villager');
  button.style.cssText = [
    'position:absolute', 'left:12px', 'bottom:190px', 'z-index:6',
    // #hud-root is pointer-events:none; interactive children opt back in.
    'pointer-events:auto',
    'min-width:44px', 'min-height:44px', 'padding:4px 10px',
    'border-radius:10px', 'border:1px solid rgba(255,255,255,0.18)',
    'background:rgba(16,24,22,0.82)', 'color:#e8e4d8',
    'font:600 13px/1.2 system-ui,sans-serif', 'cursor:pointer',
    'display:flex', 'align-items:center', 'gap:6px',
    'transition:opacity 160ms ease',
  ].join(';');
  // Original inline-SVG villager glyph (a head over shoulders) — the HUD's
  // no-image-assets rule.
  button.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">'
    + '<circle cx="8" cy="5" r="3" fill="#d8c9a0"/>'
    + '<path d="M2.5 14c0-3 2.4-5 5.5-5s5.5 2 5.5 5z" fill="#a48b60"/>'
    + '</svg><span data-idle-count>0</span>';
  const count = button.querySelector('[data-idle-count]') as HTMLElement;

  let rafHandle: number | null = null;
  let lastShown = -1;
  function refresh(): void {
    const idle = deps.countIdleVillagers();
    if (idle !== lastShown) {
      lastShown = idle;
      count.textContent = String(idle);
      button.style.opacity = idle > 0 ? '1' : '0.25';
      button.disabled = idle === 0;
    }
    rafHandle = requestAnimationFrame(refresh);
  }

  button.addEventListener('click', () => deps.selectNext());

  return {
    mount(root: HTMLElement): void {
      root.appendChild(button);
      rafHandle = requestAnimationFrame(refresh);
    },
    dispose(): void {
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      button.remove();
    },
  };
}
