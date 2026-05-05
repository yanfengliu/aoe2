// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import type { Marker, SessionMetadata, TickFailure } from 'civ-engine';

import {
  createTimelinePanel,
  replayTimelineUpperBound,
} from '../../src/game/replay/TimelinePanel';
import type {
  ReplayBundle,
  ReplayController,
  ReplayMode,
  ReplayModeListener,
  ReplayTickListener,
} from '../../src/game/replay/ReplayController';

function metadata(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    sessionId: 'timeline-test',
    engineVersion: 'test',
    nodeVersion: 'test',
    recordedAt: new Date(0).toISOString(),
    startTick: 0,
    endTick: 100,
    persistedEndTick: 100,
    durationTicks: 100,
    sourceKind: 'session',
    ...overrides,
  };
}

function marker(overrides: Partial<Marker> = {}): Marker {
  return {
    id: 'm-1',
    tick: 25,
    kind: 'annotation',
    provenance: 'game',
    createdAt: new Date(0).toISOString(),
    text: 'Scout rush spotted',
    data: { author: 'human', severity: 'warning', category: 'combat' },
    ...overrides,
  } as Marker;
}

function tickFailure(overrides: Partial<TickFailure> = {}): TickFailure {
  return {
    schemaVersion: 1,
    tick: 71,
    phase: 'systems',
    subsystem: 'test',
    code: 'boom',
    message: 'sim failed',
    commandType: null,
    submissionSequence: null,
    systemName: null,
    details: null,
    error: null,
    ...overrides,
  };
}

function bundle(overrides: Partial<ReplayBundle> = {}): ReplayBundle {
  return {
    schemaVersion: 1,
    metadata: metadata(),
    initialSnapshot: {} as ReplayBundle['initialSnapshot'],
    ticks: [],
    commands: [
      { sequence: 1, submissionTick: 0, type: 'unit.move', data: {}, result: { accepted: true } },
    ],
    executions: [],
    failures: [],
    snapshots: [],
    markers: [],
    attachments: [],
    ...overrides,
  } as ReplayBundle;
}

class FakeReplayController implements ReplayController {
  mode: ReplayMode = 'live';
  currentTick = 0;
  bundleMetadata: SessionMetadata | null = null;
  bundle: ReplayBundle | null = null;
  world = null;
  playing = false;

  readonly enterReplay = vi.fn((nextBundle: ReplayBundle, atTick = nextBundle.metadata.startTick) => {
    this.mode = 'replay';
    this.bundle = nextBundle;
    this.bundleMetadata = nextBundle.metadata;
    this.currentTick = atTick;
    this.emitMode();
    this.emitTick();
  });

  readonly exitReplay = vi.fn(() => {
    this.mode = 'live';
    this.playing = false;
    this.bundle = null;
    this.bundleMetadata = null;
    this.emitMode();
    this.emitTick();
  });

  readonly scrubTo = vi.fn((tick: number) => {
    this.currentTick = tick;
    this.emitTick();
  });

  readonly commitPendingScrub = vi.fn();
  readonly stepForward = vi.fn(() => this.scrubTo(this.currentTick + 1));
  readonly stepBackward = vi.fn(() => this.scrubTo(this.currentTick - 1));
  readonly jumpToMarker = vi.fn((markerId: string) => {
    const found = this.bundle?.markers.find((candidate) => candidate.id === markerId);
    if (found) this.scrubTo(found.tick);
  });
  readonly play = vi.fn(() => {
    this.playing = true;
  });
  readonly pause = vi.fn(() => {
    this.playing = false;
  });
  readonly isPlaying = vi.fn(() => this.playing);

  private readonly modeListeners = new Set<ReplayModeListener>();
  private readonly tickListeners = new Set<ReplayTickListener>();

  onModeChange(listener: ReplayModeListener): () => void {
    this.modeListeners.add(listener);
    return () => this.modeListeners.delete(listener);
  }

  onTickChange(listener: ReplayTickListener): () => void {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  private emitMode(): void {
    for (const listener of this.modeListeners) listener(this.mode);
  }

  private emitTick(): void {
    for (const listener of this.tickListeners) listener(this.currentTick);
  }
}

function mountPanel(controller = new FakeReplayController()): {
  controller: FakeReplayController;
  host: HTMLElement;
  panel: ReturnType<typeof createTimelinePanel>;
} {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const panel = createTimelinePanel({ controller });
  panel.mount(host);
  return { controller, host, panel };
}

describe('Phase 3C - TimelinePanel', () => {
  it('stays hidden outside replay mode and renders replay ticks, marker pins, and hotspot pins after entry', () => {
    const { controller, host, panel } = mountPanel();
    const replayBundle = bundle({
      metadata: metadata({ endTick: 120, persistedEndTick: 120, durationTicks: 120 }),
      markers: [
        marker({ id: 'm-combat', tick: 24, data: { author: 'agent', category: 'combat' } }),
      ],
      failures: [
        tickFailure(),
      ],
    });

    const root = host.querySelector<HTMLElement>('[data-testid="timeline-panel"]')!;
    expect(root.hidden).toBe(true);

    controller.enterReplay(replayBundle, 10);

    expect(root.hidden).toBe(false);
    expect(host.querySelector('[data-testid="timeline-tick"]')!.textContent).toBe('10 / 120');
    expect(host.querySelectorAll('[data-testid="timeline-marker-pin"]').length).toBe(1);
    expect(host.querySelector<HTMLElement>('[data-testid="timeline-marker-pin"]')!.dataset.markerCategory).toBe('combat');
    expect(host.querySelectorAll('[data-testid="timeline-hotspot-pin"]').length).toBe(1);
    expect(host.querySelector<HTMLElement>('[data-testid="timeline-hotspot-pin"]')!.dataset.hotspotSeverity).toBe('high');

    panel.dispose();
  });

  it('coalesces range drags and commits on change', () => {
    const { controller, host, panel } = mountPanel();
    controller.enterReplay(bundle(), 0);
    const range = host.querySelector<HTMLInputElement>('[data-testid="timeline-range"]')!;

    range.value = '42';
    range.dispatchEvent(new Event('input', { bubbles: true }));

    expect(controller.scrubTo).toHaveBeenLastCalledWith(42, { coalesce: true });
    expect(host.querySelector('[data-testid="timeline-tick"]')!.textContent).toBe('42 / 100');

    range.dispatchEvent(new Event('change', { bubbles: true }));

    expect(controller.commitPendingScrub).toHaveBeenCalledTimes(1);

    panel.dispose();
  });

  it('routes buttons and pins to ReplayController actions', () => {
    const { controller, host, panel } = mountPanel();
    controller.enterReplay(bundle({
      markers: [marker({ id: 'm-econ', tick: 33, data: { category: 'economy' } })],
      failures: [
        tickFailure({
          tick: 70,
          code: 'command_failed',
          message: 'command failed',
        }),
      ],
    }), 10);

    host.querySelector<HTMLButtonElement>('[data-testid="timeline-step-back"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-testid="timeline-step-forward"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-testid="timeline-play-toggle"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-testid="timeline-exit"]')!.click();

    expect(controller.stepBackward).toHaveBeenCalledTimes(1);
    expect(controller.stepForward).toHaveBeenCalledTimes(1);
    expect(controller.play).toHaveBeenCalledTimes(1);
    expect(controller.exitReplay).toHaveBeenCalledTimes(1);

    controller.enterReplay(bundle({ markers: [marker({ id: 'm-econ', tick: 33 })] }), 0);
    host.querySelector<HTMLButtonElement>('[data-testid="timeline-marker-pin"]')!.click();
    expect(controller.jumpToMarker).toHaveBeenCalledWith('m-econ');

    panel.dispose();
  });

  it('does not rebuild static marker and hotspot pins on tick-only updates', () => {
    const { controller, host, panel } = mountPanel();
    controller.enterReplay(bundle({
      markers: [marker({ id: 'm-econ', tick: 33 })],
      failures: [tickFailure({ tick: 70 })],
    }), 10);
    const markerPin = host.querySelector<HTMLButtonElement>('[data-testid="timeline-marker-pin"]')!;
    const hotspotPin = host.querySelector<HTMLButtonElement>('[data-testid="timeline-hotspot-pin"]')!;

    controller.scrubTo(20);

    expect(host.querySelector<HTMLButtonElement>('[data-testid="timeline-marker-pin"]')).toBe(markerPin);
    expect(host.querySelector<HTMLButtonElement>('[data-testid="timeline-hotspot-pin"]')).toBe(hotspotPin);

    panel.dispose();
  });

  it('disables controls and pins that would advance a bundle without command payloads', () => {
    const { controller, host, panel } = mountPanel();
    controller.enterReplay(bundle({
      commands: [],
      metadata: metadata({ startTick: 0, endTick: 20, persistedEndTick: 20, durationTicks: 20 }),
      markers: [marker({ id: 'm-late', tick: 12 })],
      failures: [tickFailure({ tick: 15 })],
    }), 0);

    host.querySelector<HTMLButtonElement>('[data-testid="timeline-play-toggle"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-testid="timeline-step-forward"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-testid="timeline-marker-pin"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-testid="timeline-hotspot-pin"]')!.click();

    expect(host.querySelector<HTMLButtonElement>('[data-testid="timeline-play-toggle"]')!.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[data-testid="timeline-step-forward"]')!.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[data-testid="timeline-marker-pin"]')!.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[data-testid="timeline-hotspot-pin"]')!.disabled).toBe(true);
    expect(controller.play).not.toHaveBeenCalled();
    expect(controller.stepForward).not.toHaveBeenCalled();
    expect(controller.jumpToMarker).not.toHaveBeenCalled();
    expect(controller.scrubTo).not.toHaveBeenCalled();

    panel.dispose();
  });

  it('disables marker and hotspot pins beyond the capped replay range', () => {
    const { controller, host, panel } = mountPanel();
    controller.enterReplay(bundle({
      metadata: metadata({
        startTick: 0,
        endTick: 100,
        persistedEndTick: 100,
        durationTicks: 100,
        failedTicks: [50],
      }),
      markers: [marker({ id: 'm-after-failure', tick: 80 })],
      failures: [tickFailure({ tick: 50 })],
    }), 0);

    const markerPin = host.querySelector<HTMLButtonElement>('[data-testid="timeline-marker-pin"]')!;
    const hotspotPin = host.querySelector<HTMLButtonElement>('[data-testid="timeline-hotspot-pin"]')!;
    markerPin.click();
    hotspotPin.click();

    expect(markerPin.disabled).toBe(true);
    expect(hotspotPin.disabled).toBe(true);
    expect(controller.jumpToMarker).not.toHaveBeenCalled();
    expect(controller.scrubTo).not.toHaveBeenCalled();

    panel.dispose();
  });

  it('uses persistedEndTick and failedTicks to cap the timeline', () => {
    expect(replayTimelineUpperBound(metadata({
      endTick: 100,
      persistedEndTick: 80,
      durationTicks: 100,
      incomplete: true,
    }))).toBe(80);
    expect(replayTimelineUpperBound(metadata({
      endTick: 100,
      persistedEndTick: 100,
      failedTicks: [60, 90],
    }))).toBe(59);
  });
});
