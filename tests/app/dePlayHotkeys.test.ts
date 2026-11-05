// @vitest-environment jsdom
// The boot-time Home and Space (work 142) in replay mode: the registry is
// first-match and both are registered before the replay's own keys, so each
// must arbitrate. Home passes the key on to the replay's jump to the start;
// Space stays the replay's play/pause toggle. Live, Home goes to the last
// raid. The live keys themselves are tests/browser/de-global-keys.spec.ts.

import { describe, expect, it, vi } from 'vitest';

import { registerDePlayHotkeys } from '../../src/app/bootstrap/dePlayHotkeys';
import { createHotkeyRegistry } from '../../src/game/control/HotkeyRegistry';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';

function setup(mode: 'live' | 'replay') {
  const registry = createHotkeyRegistry();
  const view = {
    adjustSpeed: vi.fn(() => 1),
    centerCameraOnWorldPosition: vi.fn(),
    getCameraState: () => ({ zoom: 1.2 }),
    setCameraZoom: vi.fn((zoom: number) => zoom),
  };
  const replayController = { mode, isPlaying: () => false, play: vi.fn(), pause: vi.fn() };
  registerDePlayHotkeys({
    hotkeyRegistry: registry,
    view,
    pauseControl: { isPaused: () => false, pause: vi.fn(), resume: vi.fn() },
    replayController,
    bridgeRef: () => ({ getSelectionState: () => ({ selectedEntityId: null }) }) as unknown as SimulationBridge,
    getLastHomeAttackPosition: () => ({ x: 10, y: 20 }),
  });
  // What ReplayHotkeys registers once the replay viewer opens.
  const replayHome = vi.fn();
  registry.register({ key: 'Home' }, replayHome);
  return { registry, view, replayController, replayHome };
}

const press = (key: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  return event;
};

describe('the boot-time Home and Space beside the replay viewer', () => {
  it("passes Home on to the replay's own Home in replay mode", () => {
    const { registry, view, replayHome } = setup('replay');
    expect(press('Home').defaultPrevented).toBe(true);
    expect(replayHome).toHaveBeenCalledTimes(1);
    expect(view.centerCameraOnWorldPosition).not.toHaveBeenCalled();
    registry.dispose();
  });

  it('takes Home to the last raid in a live match', () => {
    const { registry, view, replayHome } = setup('live');
    press('Home');
    expect(view.centerCameraOnWorldPosition).toHaveBeenCalledWith(10.5, 20.5);
    expect(replayHome).not.toHaveBeenCalled();
    registry.dispose();
  });

  it('keeps Space the replay play/pause toggle in replay mode', () => {
    const { registry, replayController, view } = setup('replay');
    press(' ');
    expect(replayController.play).toHaveBeenCalledTimes(1);
    expect(view.centerCameraOnWorldPosition).not.toHaveBeenCalled();
    registry.dispose();
  });
});
