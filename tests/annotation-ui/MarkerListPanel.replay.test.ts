// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Marker, World } from 'civ-engine';

import { createMarkerListPanel } from '../../src/ui/annotation/MarkerListPanel';

const mountedHost = (): HTMLElement => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
};

const stubMarker = (overrides: Partial<Marker> = {}): Marker => ({
  id: 'm-stub',
  tick: 5,
  kind: 'annotation',
  provenance: 'game',
  createdAt: new Date().toISOString(),
  text: 'stub marker',
  data: { author: 'human', severity: 'info', category: 'general' },
  ...overrides,
} as Marker);

describe('MarkerListPanel — replay-mode behavior (Slice 1 — v0.1.8)', () => {
  type ReplayMode = 'live' | 'replay';
  let recording: {
    markers: ReturnType<typeof vi.fn>;
    listPriorSessions: ReturnType<typeof vi.fn>;
    exportPriorSession: ReturnType<typeof vi.fn>;
    discardPriorSession: ReturnType<typeof vi.fn>;
  };
  let pauseControl: { pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; isPaused: () => boolean };
  let toast: { showToast: ReturnType<typeof vi.fn> };
  let bridge: { panCameraTo: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> };
  let world: World;
  let mode: ReplayMode;
  let modeListeners: Set<(m: ReplayMode) => void>;
  let bundleRef: { markers: Marker[] } | null;
  let jumpToMarker: ReturnType<typeof vi.fn>;

  const stubReplayAdapter = () => ({
    mode: () => mode,
    bundle: () => bundleRef,
    jumpToMarker,
    onModeChange: (listener: (m: ReplayMode) => void) => {
      modeListeners.add(listener);
      return () => {
        modeListeners.delete(listener);
      };
    },
  });

  const makePanel = () =>
    createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
      replay: stubReplayAdapter(),
    });

  beforeEach(() => {
    recording = {
      markers: vi.fn(() => [stubMarker({ id: 'live-only', tick: 999, text: 'live mode marker' })]),
      listPriorSessions: vi.fn(() => Promise.resolve([])),
      exportPriorSession: vi.fn(),
      discardPriorSession: vi.fn(),
    };
    pauseControl = { pause: vi.fn(), resume: vi.fn(), isPaused: () => false };
    toast = { showToast: vi.fn() };
    bridge = { panCameraTo: vi.fn(), select: vi.fn() };
    world = { tick: 100, isCurrent: () => true } as unknown as World;
    mode = 'live';
    modeListeners = new Set();
    bundleRef = {
      markers: [
        stubMarker({ id: 'r-low', tick: 50, text: 'replay marker A' }),
        stubMarker({ id: 'r-high', tick: 200, text: 'replay marker B' }),
      ],
    };
    jumpToMarker = vi.fn();
  });

  it('replay mode renders the replay bundle markers in tick-desc order, ignoring recording.markers()', () => {
    mode = 'replay';
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    const rows = host.querySelectorAll<HTMLElement>('[data-testid="marker-list-current-row"]');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.marker-list-panel__tick')!.textContent).toBe('200');
    expect(rows[1].querySelector('.marker-list-panel__tick')!.textContent).toBe('50');
    expect(recording.markers).not.toHaveBeenCalled();
    panel.dispose();
  });

  it('replay mode hides the Prior Sessions section (toggle + list container)', () => {
    mode = 'replay';
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    const container = host.querySelector<HTMLElement>('.marker-list-panel__prior');
    expect(container).not.toBeNull();
    expect(container!.hidden).toBe(true);
    panel.dispose();
  });

  it('replay mode row click calls replay.jumpToMarker, NOT pause/pan/select', () => {
    mode = 'replay';
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    const rows = host.querySelectorAll<HTMLElement>('[data-testid="marker-list-current-row"]');
    rows[0].click();
    expect(jumpToMarker).toHaveBeenCalledWith('r-high');
    expect(pauseControl.pause).not.toHaveBeenCalled();
    expect(bridge.panCameraTo).not.toHaveBeenCalled();
    expect(bridge.select).not.toHaveBeenCalled();
    panel.dispose();
  });

  it('switching live → replay re-renders without explicit refresh()', () => {
    mode = 'live';
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    expect(host.querySelectorAll('[data-testid="marker-list-current-row"]').length).toBe(1);
    expect(host.querySelector('.marker-list-panel__tick')!.textContent).toBe('999');
    mode = 'replay';
    for (const listener of modeListeners) listener('replay');
    const rows = host.querySelectorAll<HTMLElement>('[data-testid="marker-list-current-row"]');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.marker-list-panel__tick')!.textContent).toBe('200');
    panel.dispose();
  });

  it('switching replay → live restores live-mode behavior', () => {
    mode = 'replay';
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    expect(host.querySelectorAll('[data-testid="marker-list-current-row"]').length).toBe(2);
    mode = 'live';
    for (const listener of modeListeners) listener('live');
    const rows = host.querySelectorAll<HTMLElement>('[data-testid="marker-list-current-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('.marker-list-panel__tick')!.textContent).toBe('999');
    const container = host.querySelector<HTMLElement>('.marker-list-panel__prior');
    expect(container).not.toBeNull();
    expect(container!.hidden).toBe(false);
    rows[0].click();
    expect(pauseControl.pause).toHaveBeenCalledTimes(1);
    panel.dispose();
  });

  it('replay mode with null bundle renders the empty state', () => {
    mode = 'replay';
    bundleRef = null;
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    const empty = host.querySelector('[data-testid="marker-list-current-empty"]');
    expect(empty).not.toBeNull();
    panel.dispose();
  });

  it('dispose() unsubscribes the mode-change listener', () => {
    mode = 'live';
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.dispose();
    expect(modeListeners.size).toBe(0);
  });

  it('prototype-pollution severities (constructor/__proto__/toString) clamp to "info"', () => {
    mode = 'replay';
    bundleRef = {
      markers: [
        stubMarker({ id: 'p1', tick: 10, text: 'evil-ctor', data: { author: 'agent', severity: 'constructor', category: 'general' } }),
        stubMarker({ id: 'p2', tick: 20, text: 'evil-proto', data: { author: 'agent', severity: '__proto__', category: 'general' } }),
        stubMarker({ id: 'p3', tick: 30, text: 'evil-toString', data: { author: 'agent', severity: 'toString', category: 'general' } }),
      ],
    };
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    const sevSpans = host.querySelectorAll<HTMLElement>('.marker-list-panel__sev');
    expect(sevSpans.length).toBe(3);
    for (const span of sevSpans) {
      expect(span.classList.contains('marker-list-panel__sev--info')).toBe(true);
      expect(span.textContent).toBe('i');
    }
    panel.dispose();
  });
});
