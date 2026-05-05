import {
  bundleHotspots,
  type BundleHotspot,
  type Marker,
  type SessionMetadata,
} from 'civ-engine';

import type { ReplayBundle, ReplayController } from './ReplayController';

export interface TimelinePanel {
  mount(host: HTMLElement): void;
  show(): void;
  hide(): void;
  toggleVisibility(): void;
  isVisible(): boolean;
  refresh(): void;
  dispose(): void;
}

export interface TimelinePanelConfig {
  readonly controller: ReplayController;
}

interface MountedElements {
  root: HTMLDivElement;
  range: HTMLInputElement;
  tick: HTMLSpanElement;
  source: HTMLSpanElement;
  pins: HTMLDivElement;
  stepBack: HTMLButtonElement;
  playToggle: HTMLButtonElement;
  stepForward: HTMLButtonElement;
  exit: HTMLButtonElement;
}

const CATEGORY_COLORS: Record<string, string> = {
  general: '#78aaf0',
  combat: '#e07b61',
  economy: '#d4b35f',
  pathfinding: '#7fc18a',
  ui: '#c992e8',
};

const HOTSPOT_COLORS: Record<BundleHotspot['severity'], string> = {
  low: '#78aaf0',
  medium: '#d4b35f',
  high: '#df6262',
};

export function replayTimelineUpperBound(metadata: SessionMetadata): number {
  const nominalEnd = metadata.incomplete
    ? metadata.persistedEndTick
    : metadata.endTick;
  const firstFailedTick = metadata.failedTicks
    ?.filter((tick) => tick <= nominalEnd)
    .sort((left, right) => left - right)[0];
  return firstFailedTick === undefined
    ? nominalEnd
    : Math.max(metadata.startTick, firstFailedTick - 1);
}

export function replayCanReachTick(bundle: ReplayBundle, targetTick: number): boolean {
  return targetTick <= bundle.metadata.startTick || bundle.commands.length > 0;
}

export function replayCanAdvanceFrom(bundle: ReplayBundle, currentTick: number): boolean {
  return currentTick < replayTimelineUpperBound(bundle.metadata)
    && replayCanReachTick(bundle, currentTick + 1);
}

export function createTimelinePanel(config: TimelinePanelConfig): TimelinePanel {
  const { controller } = config;
  let host: HTMLElement | null = null;
  let mounted: MountedElements | null = null;
  let visible = false;
  let rangeHasPendingCoalescedScrub = false;
  let renderedPinsFor: {
    readonly bundle: ReplayBundle;
    readonly startTick: number;
    readonly endTick: number;
  } | null = null;
  const teardownCallbacks: Array<() => void> = [];

  const render = (): void => {
    if (!mounted) return;
    const bundle = controller.bundle;
    const metadata = controller.bundleMetadata;
    const replayActive = controller.mode === 'replay' && bundle !== null && metadata !== null;
    mounted.root.hidden = !replayActive || !visible;
    if (!replayActive || !metadata || !bundle) {
      mounted.pins.replaceChildren();
      renderedPinsFor = null;
      return;
    }
    if (!visible) {
      return;
    }

    const startTick = metadata.startTick;
    const endTick = replayTimelineUpperBound(metadata);
    const currentTick = clampTick(controller.currentTick, startTick, endTick);
    const canAdvance = replayCanAdvanceFrom(bundle, currentTick);
    const playing = controller.isPlaying();

    mounted.range.min = String(startTick);
    mounted.range.max = String(endTick);
    mounted.range.value = String(currentTick);
    mounted.range.disabled = endTick <= startTick || !replayCanReachTick(bundle, endTick);
    mounted.tick.textContent = `${currentTick} / ${endTick}`;
    mounted.source.textContent = metadata.sourceLabel ?? metadata.sourceKind;
    mounted.playToggle.textContent = playing ? 'Pause' : 'Play';
    mounted.playToggle.disabled = !playing && !canAdvance;
    mounted.playToggle.setAttribute(
      'aria-label',
      playing ? 'Pause replay playback' : 'Play replay playback',
    );
    mounted.stepBack.disabled = currentTick <= startTick;
    mounted.stepForward.disabled = !canAdvance;
    if (
      renderedPinsFor?.bundle !== bundle
      || renderedPinsFor.startTick !== startTick
      || renderedPinsFor.endTick !== endTick
    ) {
      renderPins(mounted.pins, bundle, startTick, endTick, controller);
      renderedPinsFor = { bundle, startTick, endTick };
    }
  };

  const commitPendingRangeScrub = (): void => {
    if (!rangeHasPendingCoalescedScrub) return;
    rangeHasPendingCoalescedScrub = false;
    controller.commitPendingScrub();
    render();
  };

  const handleRangeInput = (): void => {
    if (!mounted) return;
    const tick = Number(mounted.range.value);
    if (!Number.isFinite(tick)) return;
    const bundle = controller.bundle;
    if (!bundle || !replayCanReachTick(bundle, tick)) return;
    rangeHasPendingCoalescedScrub = true;
    controller.scrubTo(tick, { coalesce: true });
    render();
  };

  const handlePlayToggle = (): void => {
    if (controller.isPlaying()) {
      controller.pause();
    } else if (controller.bundle && replayCanAdvanceFrom(controller.bundle, controller.currentTick)) {
      controller.play();
    }
    render();
  };

  const buildDom = (): MountedElements => {
    const root = document.createElement('div');
    root.className = 'timeline-panel';
    root.dataset.testid = 'timeline-panel';
    root.hidden = true;
    root.innerHTML = `
      <div class="timeline-panel__controls">
        <button type="button" class="timeline-panel__button" data-testid="timeline-step-back" aria-label="Step replay back one tick">-1</button>
        <button type="button" class="timeline-panel__button timeline-panel__button--primary" data-testid="timeline-play-toggle" aria-label="Play replay playback">Play</button>
        <button type="button" class="timeline-panel__button" data-testid="timeline-step-forward" aria-label="Step replay forward one tick">+1</button>
        <span class="timeline-panel__tick" data-testid="timeline-tick">0 / 0</span>
        <span class="timeline-panel__source" data-testid="timeline-source"></span>
        <button type="button" class="timeline-panel__button timeline-panel__button--exit" data-testid="timeline-exit" aria-label="Exit replay mode">Exit</button>
      </div>
      <div class="timeline-panel__track-wrap">
        <input class="timeline-panel__range" data-testid="timeline-range" type="range" min="0" max="0" value="0" step="1" aria-label="Replay timeline" />
        <div class="timeline-panel__pins" data-testid="timeline-pins"></div>
      </div>
    `;
    return {
      root,
      range: mustQuery(root, '[data-testid="timeline-range"]', HTMLInputElement),
      tick: mustQuery(root, '[data-testid="timeline-tick"]', HTMLSpanElement),
      source: mustQuery(root, '[data-testid="timeline-source"]', HTMLSpanElement),
      pins: mustQuery(root, '[data-testid="timeline-pins"]', HTMLDivElement),
      stepBack: mustQuery(root, '[data-testid="timeline-step-back"]', HTMLButtonElement),
      playToggle: mustQuery(root, '[data-testid="timeline-play-toggle"]', HTMLButtonElement),
      stepForward: mustQuery(root, '[data-testid="timeline-step-forward"]', HTMLButtonElement),
      exit: mustQuery(root, '[data-testid="timeline-exit"]', HTMLButtonElement),
    };
  };

  return {
    mount(nextHost: HTMLElement): void {
      if (mounted) return;
      host = nextHost;
      mounted = buildDom();
      host.appendChild(mounted.root);
      mounted.range.addEventListener('input', handleRangeInput);
      mounted.range.addEventListener('change', commitPendingRangeScrub);
      mounted.range.addEventListener('pointerup', commitPendingRangeScrub);
      mounted.stepBack.addEventListener('click', controller.stepBackward);
      mounted.stepForward.addEventListener('click', controller.stepForward);
      mounted.playToggle.addEventListener('click', handlePlayToggle);
      mounted.exit.addEventListener('click', controller.exitReplay);
      teardownCallbacks.push(controller.onModeChange((mode) => {
        visible = mode === 'replay';
        render();
      }));
      teardownCallbacks.push(controller.onTickChange(render));
      render();
    },
    show(): void {
      if (controller.mode !== 'replay') return;
      visible = true;
      render();
    },
    hide(): void {
      visible = false;
      render();
    },
    toggleVisibility(): void {
      if (controller.mode !== 'replay') return;
      visible = !visible;
      render();
    },
    isVisible(): boolean {
      return visible && controller.mode === 'replay';
    },
    refresh(): void {
      render();
    },
    dispose(): void {
      for (let index = teardownCallbacks.length - 1; index >= 0; index -= 1) {
        teardownCallbacks[index]();
      }
      teardownCallbacks.length = 0;
      if (mounted) {
        mounted.range.removeEventListener('input', handleRangeInput);
        mounted.range.removeEventListener('change', commitPendingRangeScrub);
        mounted.range.removeEventListener('pointerup', commitPendingRangeScrub);
        mounted.stepBack.removeEventListener('click', controller.stepBackward);
        mounted.stepForward.removeEventListener('click', controller.stepForward);
        mounted.playToggle.removeEventListener('click', handlePlayToggle);
        mounted.exit.removeEventListener('click', controller.exitReplay);
        mounted.root.remove();
      }
      mounted = null;
      host = null;
      visible = false;
      rangeHasPendingCoalescedScrub = false;
      renderedPinsFor = null;
    },
  };
}

function renderPins(
  pins: HTMLDivElement,
  bundle: ReplayBundle,
  startTick: number,
  endTick: number,
  controller: ReplayController,
): void {
  pins.replaceChildren();
  for (const marker of bundle.markers) {
    pins.appendChild(createMarkerPin(marker, bundle, startTick, endTick, controller));
  }
  for (const hotspot of bundleHotspots(bundle, { includeMarkers: false })) {
    pins.appendChild(createHotspotPin(hotspot, bundle, startTick, endTick, controller));
  }
}

function createMarkerPin(
  marker: Marker,
  bundle: ReplayBundle,
  startTick: number,
  endTick: number,
  controller: ReplayController,
): HTMLButtonElement {
  const category = markerCategory(marker);
  const canReach = marker.tick >= startTick
    && marker.tick <= endTick
    && replayCanReachTick(bundle, marker.tick);
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.disabled = !canReach;
  pin.className = 'timeline-panel__pin timeline-panel__pin--marker';
  pin.dataset.testid = 'timeline-marker-pin';
  pin.dataset.markerId = marker.id;
  pin.dataset.markerCategory = category;
  pin.style.left = `${tickPercent(marker.tick, startTick, endTick)}%`;
  pin.style.setProperty('--timeline-pin-color', CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general);
  pin.title = `Marker ${marker.id} at tick ${marker.tick}${marker.text ? `: ${marker.text}` : ''}`;
  pin.setAttribute('aria-label', `Jump to marker at tick ${marker.tick}`);
  if (canReach) {
    pin.addEventListener('click', () => controller.jumpToMarker(marker.id));
  }
  return pin;
}

function createHotspotPin(
  hotspot: BundleHotspot,
  bundle: ReplayBundle,
  startTick: number,
  endTick: number,
  controller: ReplayController,
): HTMLButtonElement {
  const canReach = hotspot.tick >= startTick
    && hotspot.tick <= endTick
    && replayCanReachTick(bundle, hotspot.tick);
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.disabled = !canReach;
  pin.className = 'timeline-panel__pin timeline-panel__pin--hotspot';
  pin.dataset.testid = 'timeline-hotspot-pin';
  pin.dataset.hotspotKind = hotspot.kind;
  pin.dataset.hotspotSeverity = hotspot.severity;
  pin.dataset.hotspotTick = String(hotspot.tick);
  pin.style.left = `${tickPercent(hotspot.tick, startTick, endTick)}%`;
  pin.style.setProperty('--timeline-pin-color', HOTSPOT_COLORS[hotspot.severity]);
  pin.title = hotspot.message;
  pin.setAttribute('aria-label', `Jump to ${hotspot.severity} hotspot at tick ${hotspot.tick}`);
  if (canReach) {
    pin.addEventListener('click', () => controller.scrubTo(hotspot.tick));
  }
  return pin;
}

function markerCategory(marker: Marker): string {
  const data = marker.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'general';
  const category = (data as Record<string, unknown>).category;
  if (typeof category !== 'string') return 'general';
  const normalized = category.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return normalized || 'general';
}

function tickPercent(tick: number, startTick: number, endTick: number): number {
  if (endTick <= startTick) return 0;
  const clamped = clampTick(tick, startTick, endTick);
  return ((clamped - startTick) / (endTick - startTick)) * 100;
}

function clampTick(tick: number, startTick: number, endTick: number): number {
  return Math.max(startTick, Math.min(endTick, Math.round(tick)));
}

function mustQuery<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
  ctor: { new (...args: never[]): T },
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof ctor)) {
    throw new Error(`TimelinePanel expected ${selector}`);
  }
  return element;
}
