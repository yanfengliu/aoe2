// @vitest-environment jsdom
//
// Slice 6 (replay-load-and-e2e v0.1.13): integration coverage for the
// replay-load flow. Uses the real `recordCommandReplayFixture` (which
// builds a `SimulationBridge` via `createSimulationBridge` and records
// a unit.move command) so the resulting bundle has actual command
// payloads and round-trips through the engine. The tests here exercise
// the helpers + dialog end-to-end against a real-world fixture without
// standing up Phaser.

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createReplayController } from '../../src/game/replay/ReplayController';
import { loadCurrentSessionAsReplay } from '../../src/game/replay/loadCurrentSession';
import { parseSessionBundleFile } from '../../src/game/replay/parseSessionBundleFile';
import { createReplayLoadDialog } from '../../src/ui/replay/replayLoadDialog';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { recordCommandReplayFixture } from '../replay/replayCommandHelpers';

const stubBridge = (world: GameWorld): SimulationBridge => ({
  world,
  step: vi.fn(),
  setPaused: vi.fn(),
  getSelectedEntityRefs: vi.fn(() => []),
  select: vi.fn(),
} as unknown as SimulationBridge);

const installDialogPolyfill = (): void => {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
      Object.defineProperty(this, 'open', { value: true, configurable: true });
    };
  }
  if (typeof proto.close !== 'function') {
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      Object.defineProperty(this, 'open', { value: false, configurable: true });
    };
  }
};

const noBundleRecording = {
  bundle: () => null,
  listPriorSessions: () => Promise.resolve([] as never[]),
  loadPriorSessionBundle: () => Promise.reject(new Error('no IDB in this stub')),
};

describe('Integration: replay flow against real recorded bundle', () => {
  beforeEach(() => {
    installDialogPolyfill();
  });

  it('loadCurrentSessionAsReplay drives a real bundle through the controller', () => {
    const fixture = recordCommandReplayFixture();
    const recording = {
      bundle: () => fixture.bundle as unknown as Parameters<typeof loadCurrentSessionAsReplay>[0]['recording']['bundle'] extends () => infer B ? B : never,
    };

    let bridge: SimulationBridge = fixture.bridge;
    const controller = createReplayController({
      bridgeCell: { current: () => bridge, replace: (next) => { bridge = next; } },
      isLivePaused: () => false,
      makeReplayBridge: stubBridge,
    });

    const result = loadCurrentSessionAsReplay({ replayController: controller, recording });
    expect(result.status).toBe('ok');
    expect(controller.mode).toBe('replay');
    expect(controller.bundle).not.toBeNull();
    expect(controller.bundle?.commands.length).toBeGreaterThan(0);
  });

  it('parseSessionBundleFile + enterReplay round-trips a real exported JSON', () => {
    const fixture = recordCommandReplayFixture();
    const json = JSON.stringify(fixture.bundle);
    const parseResult = parseSessionBundleFile(json);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) throw new Error('parse failed');

    let bridge: SimulationBridge = fixture.bridge;
    const controller = createReplayController({
      bridgeCell: { current: () => bridge, replace: (next) => { bridge = next; } },
      isLivePaused: () => false,
      makeReplayBridge: stubBridge,
    });

    controller.enterReplay(parseResult.bundle as unknown as Parameters<typeof controller.enterReplay>[0]);
    expect(controller.mode).toBe('replay');
    expect(controller.currentTick).toBe(parseResult.bundle.metadata.startTick);
  });

  it('ReplayLoadDialog live tab confirms a real bundle and closes', async () => {
    const fixture = recordCommandReplayFixture();
    const recording = {
      bundle: () => fixture.bundle as never,
      listPriorSessions: () => Promise.resolve([]),
      loadPriorSessionBundle: () => Promise.reject(new Error('no IDB in this stub')),
    };

    let bridge: SimulationBridge = fixture.bridge;
    const controller = createReplayController({
      bridgeCell: { current: () => bridge, replace: (next) => { bridge = next; } },
      isLivePaused: () => false,
      makeReplayBridge: stubBridge,
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const dialog = createReplayLoadDialog({
      host,
      replayController: controller,
      recording,
      toast: { showToast: vi.fn() },
    });

    await dialog.open();
    expect(dialog.isOpen()).toBe(true);
    const liveConfirm = host.querySelector<HTMLButtonElement>('[data-testid="replay-load-live-confirm"]')!;
    liveConfirm.click();
    expect(controller.mode).toBe('replay');
    expect(dialog.isOpen()).toBe(false);
    dialog.dispose();
  });

  it('ReplayLoadDialog file tab parses + enters replay from a real exported JSON', async () => {
    const fixture = recordCommandReplayFixture();
    const json = JSON.stringify(fixture.bundle);

    let bridge: SimulationBridge = fixture.bridge;
    const controller = createReplayController({
      bridgeCell: { current: () => bridge, replace: (next) => { bridge = next; } },
      isLivePaused: () => false,
      makeReplayBridge: stubBridge,
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const dialog = createReplayLoadDialog({
      host,
      replayController: controller,
      recording: noBundleRecording,
      toast: { showToast: vi.fn() },
    });

    await dialog.open();
    host.querySelector<HTMLButtonElement>('[data-testid="replay-load-tab-file"]')!.click();
    const fileInput = host.querySelector<HTMLInputElement>('[data-testid="replay-load-file-input"]')!;
    const file = new File([json], 'bundle.json', { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', {
      value: { length: 1, item: () => file, 0: file } as unknown as FileList,
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 10));
    expect(controller.mode).toBe('replay');
    expect(dialog.isOpen()).toBe(false);
    dialog.dispose();
  });

  it('transactional enterReplay: malformed second bundle preserves first replay session', async () => {
    const fixture = recordCommandReplayFixture();
    let bridge: SimulationBridge = fixture.bridge;
    let failNext = false;
    const controller = createReplayController({
      bridgeCell: { current: () => bridge, replace: (next) => { bridge = next; } },
      isLivePaused: () => false,
      makeReplayBridge: stubBridge,
      worldFactory: (() => {
        if (failNext) throw new Error('engine rejected bundle');
        // Returns the fixture's already-stepped world rather than a
        // fresh hydration. CAVEAT: this is only valid for the
        // transactional state-preservation assertion in this test
        // (controller.mode/currentTick after a rejected second call).
        // It would mis-report `controller.world.tick` because the
        // returned world is at tick 80 (advanced by the fixture)
        // while `displayedTick` is set to bundle.metadata.startTick = 0.
        // Do not reuse this stub for tests that assert on world state.
        return fixture.bridge.world;
      }) as never,
    });

    // First entry: legitimate.
    controller.enterReplay(fixture.bundle as unknown as Parameters<typeof controller.enterReplay>[0]);
    expect(controller.mode).toBe('replay');
    const tickAtFirst = controller.currentTick;

    // Second entry: factory throws. Controller should retain the first
    // session's state.
    failNext = true;
    expect(() => controller.enterReplay(fixture.bundle as unknown as Parameters<typeof controller.enterReplay>[0])).toThrow('engine rejected bundle');
    expect(controller.mode).toBe('replay');
    expect(controller.currentTick).toBe(tickAtFirst);
  });
});

describe('Integration: parser rejection paths surface clean toasts in dialog', () => {
  beforeEach(() => {
    installDialogPolyfill();
  });

  it('non-JSON file in dialog → "Invalid bundle file: invalid JSON" toast', async () => {
    const fixture = recordCommandReplayFixture();
    let bridge: SimulationBridge = fixture.bridge;
    const controller = createReplayController({
      bridgeCell: { current: () => bridge, replace: (next) => { bridge = next; } },
      isLivePaused: () => false,
      makeReplayBridge: stubBridge,
    });

    const showToast = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const dialog = createReplayLoadDialog({
      host,
      replayController: controller,
      recording: noBundleRecording,
      toast: { showToast },
    });

    await dialog.open();
    host.querySelector<HTMLButtonElement>('[data-testid="replay-load-tab-file"]')!.click();
    const fileInput = host.querySelector<HTMLInputElement>('[data-testid="replay-load-file-input"]')!;
    const file = new File(['<not json>'], 'bad.json', { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', {
      value: { length: 1, item: () => file, 0: file } as unknown as FileList,
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 10));
    expect(controller.mode).toBe('live');
    expect(dialog.isOpen()).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Invalid bundle file: invalid JSON');
    dialog.dispose();
  });
});
