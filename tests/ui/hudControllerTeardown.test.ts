// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHudController } from '../../src/ui/hud/createHudController';

// Full-review M2: createHudController owns the per-frame RAF loop plus mouse
// listeners on the minimap element AND window. Its destroy() must drop ALL of
// them — the minimap `mousedown`/`mousemove` listeners were previously added
// with un-removable inline handlers, so they leaked on teardown (test
// isolation / HMR / future return-to-title). We stub the RAF so the render
// loop never runs (a Proxy bridge answers construction-time calls), then assert
// destroy() removes each listener it registered.
function proxyBridge(overrides: Record<PropertyKey, unknown> = {}) {
  // Every method returns a no-op function; construction only invokes optional-
  // chained probes, and the RAF update() (which reads real state) is stubbed
  // out below, so undefined returns are safe.
  return new Proxy(overrides, {
    get: (target, property) => Reflect.has(target, property)
      ? Reflect.get(target, property)
      : () => undefined,
  }) as never;
}

describe('createHudController teardown (full-review M2)', () => {
  beforeEach(() => {
    // Neutralize the render loop: schedule returns a handle, cancel is a no-op,
    // and update() is never invoked, so the Proxy bridge is never asked for a
    // real RenderState/CameraState.
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('destroy() removes the minimap and window mouse listeners it registered', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = createHudController(root, proxyBridge());
    const minimap = root.querySelector<HTMLElement>('[data-hud="minimap"]');
    expect(minimap).not.toBeNull();

    const minimapRemove = vi.spyOn(minimap!, 'removeEventListener');
    const windowRemove = vi.spyOn(window, 'removeEventListener');

    controller.destroy();

    // The minimap element's own drag listeners must be dropped (the leak).
    expect(minimapRemove).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(minimapRemove).toHaveBeenCalledWith('mousemove', expect.any(Function));
    // The window-level drag-tracking listeners too (already removable pre-fix).
    expect(windowRemove).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(windowRemove).toHaveBeenCalledWith('mouseup', expect.any(Function));
  });

  it('destroy() is idempotent (safe to call twice)', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = createHudController(root, proxyBridge());
    expect(() => {
      controller.destroy();
      controller.destroy();
    }).not.toThrow();
  });

  it('keeps replay-unavailable icon actions focusable but non-actionable', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const openReplayLoadDialog = vi.fn();
    const controller = createHudController(root, proxyBridge({
      isReplayMode: () => true,
      subscribeReplayModeChange: () => () => {},
      openReplayLoadDialog,
    }));
    const save = root.querySelector<HTMLButtonElement>('[data-hud="save-button"]')!;
    const replay = root.querySelector<HTMLButtonElement>('[data-hud="replay-load-button"]')!;

    expect(save.disabled).toBe(false);
    expect(replay.disabled).toBe(false);
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(replay.getAttribute('aria-disabled')).toBe('true');
    replay.click();
    expect(openReplayLoadDialog).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('mirrors F2 debug cycles into the menu state and accessible name', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = createHudController(root, proxyBridge());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', cancelable: true }));
    controller.toggleGameMenu();

    expect(root.querySelector('[data-hud="menu-debug-mode"]')?.textContent).toBe('selection-bounds');
    expect(root.querySelector('[data-hud="menu-debug-cycle"]')?.getAttribute('aria-label')).toBe('Debug overlay: selection-bounds');

    controller.destroy();
  });
});
