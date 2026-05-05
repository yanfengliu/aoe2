// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import type { SessionMetadata } from 'civ-engine';

import { createHotkeyRegistry } from '../../src/game/control/HotkeyRegistry';
import { registerReplayHotkeys } from '../../src/game/replay/ReplayHotkeys';
import type {
  ReplayBundle,
  ReplayController,
  ReplayMode,
  ReplayModeListener,
  ReplayTickListener,
} from '../../src/game/replay/ReplayController';

function metadata(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    sessionId: 'hotkey-test',
    engineVersion: 'test',
    nodeVersion: 'test',
    recordedAt: new Date(0).toISOString(),
    startTick: 3,
    endTick: 50,
    persistedEndTick: 50,
    durationTicks: 47,
    sourceKind: 'session',
    ...overrides,
  };
}

function bundle(meta = metadata()): ReplayBundle {
  return {
    schemaVersion: 1,
    metadata: meta,
    initialSnapshot: {} as ReplayBundle['initialSnapshot'],
    ticks: [],
    commands: [
      { sequence: 1, submissionTick: meta.startTick, type: 'unit.move', data: {}, result: { accepted: true } },
    ],
    executions: [],
    failures: [],
    snapshots: [],
    markers: [],
    attachments: [],
  } as unknown as ReplayBundle;
}

class HotkeyController implements ReplayController {
  mode: ReplayMode = 'live';
  currentTick = 3;
  bundleMetadata: SessionMetadata | null = null;
  bundle: ReplayBundle | null = null;
  world = null;
  playing = false;

  readonly enterReplay = vi.fn((nextBundle: ReplayBundle) => {
    this.mode = 'replay';
    this.bundle = nextBundle;
    this.bundleMetadata = nextBundle.metadata;
  });
  readonly exitReplay = vi.fn(() => {
    this.mode = 'live';
  });
  readonly scrubTo = vi.fn();
  readonly commitPendingScrub = vi.fn();
  readonly stepForward = vi.fn();
  readonly stepBackward = vi.fn();
  readonly jumpToMarker = vi.fn();
  readonly play = vi.fn(() => {
    this.playing = true;
  });
  readonly pause = vi.fn(() => {
    this.playing = false;
  });
  readonly isPlaying = vi.fn(() => this.playing);
  private readonly modeListeners = new Set<ReplayModeListener>();

  onModeChange(listener: ReplayModeListener): () => void {
    this.modeListeners.add(listener);
    return () => this.modeListeners.delete(listener);
  }

  onTickChange(listener: ReplayTickListener): () => void {
    void listener;
    return () => {};
  }

  emitMode(): void {
    for (const listener of this.modeListeners) {
      listener(this.mode);
    }
  }
}

function dispatch(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  document.dispatchEvent(event);
  return event;
}

describe('Phase 3C - ReplayHotkeys', () => {
  it('maps replay keyboard controls while replay mode is active', () => {
    const controller = new HotkeyController();
    controller.enterReplay(bundle(metadata({ startTick: 3, endTick: 50, persistedEndTick: 50 })));
    const panel = { toggleVisibility: vi.fn(), isVisible: vi.fn(() => true), refresh: vi.fn() };
    const registry = createHotkeyRegistry();
    const hotkeys = registerReplayHotkeys({ hotkeys: registry, controller, panel });

    dispatch(' ');
    expect(controller.play).toHaveBeenCalledTimes(1);
    controller.playing = true;
    dispatch(' ');
    expect(controller.pause).toHaveBeenCalledTimes(1);
    dispatch('ArrowRight');
    dispatch('ArrowLeft');
    dispatch('Home');
    dispatch('End');
    dispatch('t', { altKey: true });
    dispatch('Escape');

    expect(controller.stepForward).toHaveBeenCalledTimes(1);
    expect(controller.stepBackward).toHaveBeenCalledTimes(1);
    expect(controller.scrubTo).toHaveBeenCalledWith(3);
    expect(controller.scrubTo).toHaveBeenCalledWith(50);
    expect(panel.toggleVisibility).toHaveBeenCalledTimes(1);
    expect(panel.refresh).toHaveBeenCalled();
    expect(controller.exitReplay).toHaveBeenCalledTimes(1);

    hotkeys.dispose();
    registry.dispose();
  });

  it('ignores replay playback keys outside replay mode', () => {
    const controller = new HotkeyController();
    const panel = { toggleVisibility: vi.fn(), isVisible: vi.fn(() => false), refresh: vi.fn() };
    const registry = createHotkeyRegistry();
    registerReplayHotkeys({ hotkeys: registry, controller, panel });

    const event = dispatch(' ');
    dispatch('ArrowRight');
    dispatch('t', { altKey: true });

    expect(controller.play).not.toHaveBeenCalled();
    expect(controller.stepForward).not.toHaveBeenCalled();
    expect(panel.toggleVisibility).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);

    registry.dispose();
  });

  it('binds replay keys only while replay mode is active', () => {
    const controller = new HotkeyController();
    const panel = { toggleVisibility: vi.fn(), isVisible: vi.fn(() => false), refresh: vi.fn() };
    const registry = createHotkeyRegistry();
    const hotkeys = registerReplayHotkeys({ hotkeys: registry, controller, panel });

    expect(dispatch('ArrowRight').defaultPrevented).toBe(false);

    controller.enterReplay(bundle());
    controller.emitMode();
    const replayEvent = dispatch('ArrowRight');

    expect(replayEvent.defaultPrevented).toBe(true);
    expect(controller.stepForward).toHaveBeenCalledTimes(1);

    controller.exitReplay();
    controller.emitMode();
    expect(dispatch('ArrowRight').defaultPrevented).toBe(false);
    expect(controller.stepForward).toHaveBeenCalledTimes(1);

    hotkeys.dispose();
    registry.dispose();
  });

  it('does not advance no-payload replay bundles from hotkeys', () => {
    const controller = new HotkeyController();
    const panel = { toggleVisibility: vi.fn(), isVisible: vi.fn(() => true), refresh: vi.fn() };
    const registry = createHotkeyRegistry();
    const hotkeys = registerReplayHotkeys({ hotkeys: registry, controller, panel });
    controller.enterReplay({
      ...bundle(metadata({ startTick: 0, endTick: 10, persistedEndTick: 10 })),
      commands: [],
      executions: [],
    });
    controller.emitMode();

    expect(dispatch(' ').defaultPrevented).toBe(true);
    dispatch('ArrowRight');
    dispatch('End');

    expect(controller.play).not.toHaveBeenCalled();
    expect(controller.stepForward).not.toHaveBeenCalled();
    expect(controller.scrubTo).not.toHaveBeenCalledWith(10);

    hotkeys.dispose();
    registry.dispose();
  });
});
