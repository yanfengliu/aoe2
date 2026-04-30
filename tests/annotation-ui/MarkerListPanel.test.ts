// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { EntityRef, Marker, World } from 'civ-engine';

import { createMarkerListPanel } from '../../src/ui/annotation/MarkerListPanel';
import type { PriorSessionDescriptor } from '../../src/game/recording/IndexedDBMirror';

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

describe('MarkerListPanel — rendering', () => {
  let recording: {
    markers: ReturnType<typeof vi.fn>;
    listPriorSessions: ReturnType<typeof vi.fn>;
    exportPriorSession: ReturnType<typeof vi.fn>;
    discardPriorSession: ReturnType<typeof vi.fn>;
  };
  let pauseControl: { pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; isPaused: () => boolean };
  let toast: { showToast: ReturnType<typeof vi.fn> };
  let bridge: {
    panCameraTo: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
  };
  let world: World;

  beforeEach(() => {
    recording = {
      markers: vi.fn(() => []),
      listPriorSessions: vi.fn(() => Promise.resolve([])),
      exportPriorSession: vi.fn(() => Promise.resolve(new Blob(['{}'], { type: 'application/json' }))),
      discardPriorSession: vi.fn(() => Promise.resolve()),
    };
    pauseControl = { pause: vi.fn(), resume: vi.fn(), isPaused: () => false };
    toast = { showToast: vi.fn() };
    bridge = { panCameraTo: vi.fn(), select: vi.fn() };
    world = {
      tick: 100,
      isCurrent: vi.fn(() => true),
    } as unknown as World;
  });

  it('mount creates the panel hidden; toggleVisibility shows it', () => {
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    const el = host.querySelector<HTMLElement>('[data-testid="marker-list-panel"]')!;
    expect(el.classList.contains('marker-list-panel--hidden')).toBe(true);
    panel.toggleVisibility();
    expect(panel.isVisible()).toBe(true);
    expect(el.classList.contains('marker-list-panel--hidden')).toBe(false);
    panel.dispose();
  });

  it('renders empty state when no markers', () => {
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    panel.toggleVisibility();
    const empty = host.querySelector('[data-testid="marker-list-current-empty"]');
    expect(empty).not.toBeNull();
    panel.dispose();
  });

  it('renders rows for each marker (tick + severity + author)', () => {
    recording.markers = vi.fn(() => [
      stubMarker({ id: 'm1', tick: 10, text: 'first', data: { author: 'human', severity: 'bug', category: 'general' } }),
      stubMarker({ id: 'm2', tick: 5, text: 'second', data: { author: 'agent', severity: 'info', category: 'general' } }),
    ]);
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    panel.toggleVisibility();
    const rows = host.querySelectorAll('[data-testid="marker-list-current-row"]');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.marker-list-panel__tick')!.textContent).toBe('10');
    expect(rows[0].querySelector('.marker-list-panel__author')!.textContent).toBe('human');
    panel.dispose();
  });

  it('truncates long text snippets', () => {
    const longText = 'x'.repeat(200);
    recording.markers = vi.fn(() => [stubMarker({ text: longText })]);
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    panel.toggleVisibility();
    const textEl = host.querySelector<HTMLElement>('.marker-list-panel__text')!;
    expect(textEl.textContent!.length).toBeLessThanOrEqual(60);
    expect(textEl.textContent!.endsWith('…')).toBe(true);
    panel.dispose();
  });
});

describe('MarkerListPanel — row click stale-ref filter (DESIGN §7)', () => {
  let recording: {
    markers: ReturnType<typeof vi.fn>;
    listPriorSessions: ReturnType<typeof vi.fn>;
    exportPriorSession: ReturnType<typeof vi.fn>;
    discardPriorSession: ReturnType<typeof vi.fn>;
  };
  let pauseControl: { pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; isPaused: () => boolean };
  let toast: { showToast: ReturnType<typeof vi.fn> };
  let bridge: { panCameraTo: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> };
  let isCurrent: ReturnType<typeof vi.fn>;
  let world: World;

  beforeEach(() => {
    recording = {
      markers: vi.fn(),
      listPriorSessions: vi.fn(() => Promise.resolve([])),
      exportPriorSession: vi.fn(),
      discardPriorSession: vi.fn(),
    };
    pauseControl = { pause: vi.fn(), resume: vi.fn(), isPaused: () => false };
    toast = { showToast: vi.fn() };
    bridge = { panCameraTo: vi.fn(), select: vi.fn() };
    isCurrent = vi.fn();
    world = { tick: 100, isCurrent } as unknown as World;
  });

  it('clicking a row with a current entity ref pans + selects it', () => {
    isCurrent.mockReturnValue(true);
    const ref: EntityRef = { id: 7, generation: 0 };
    recording.markers = vi.fn(() => [
      stubMarker({ id: 'm1', refs: { entities: [ref] } }),
    ]);
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    panel.toggleVisibility();
    const row = host.querySelector<HTMLElement>('[data-testid="marker-list-current-row"]')!;
    row.click();
    expect(pauseControl.pause).toHaveBeenCalledTimes(1);
    expect(bridge.panCameraTo).toHaveBeenCalledWith(ref);
    expect(bridge.select).toHaveBeenCalledWith([ref]);
    panel.dispose();
  });

  it('all-stale entity refs falls back to first cell', () => {
    isCurrent.mockReturnValue(false); // every ref is stale
    recording.markers = vi.fn(() => [
      stubMarker({
        id: 'm1',
        refs: {
          entities: [{ id: 7, generation: 0 }],
          cells: [{ x: 5, y: 8 }],
        },
      }),
    ]);
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    panel.toggleVisibility();
    const row = host.querySelector<HTMLElement>('[data-testid="marker-list-current-row"]')!;
    row.click();
    expect(bridge.select).not.toHaveBeenCalled();
    expect(bridge.panCameraTo).toHaveBeenCalledWith({ x: 5, y: 8 });
    panel.dispose();
  });

  it('all-stale entity refs and no cells: toast + leave selection', () => {
    isCurrent.mockReturnValue(false);
    recording.markers = vi.fn(() => [
      stubMarker({ id: 'm1', refs: { entities: [{ id: 7, generation: 0 }] } }),
    ]);
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    panel.toggleVisibility();
    const row = host.querySelector<HTMLElement>('[data-testid="marker-list-current-row"]')!;
    row.click();
    expect(bridge.select).not.toHaveBeenCalled();
    expect(bridge.panCameraTo).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith('marker target no longer exists in this world');
    panel.dispose();
  });

  it('mixed current + stale entity refs: pans + selects only current ones', () => {
    isCurrent.mockImplementation((ref: EntityRef) => ref.id === 7);
    const validRef: EntityRef = { id: 7, generation: 0 };
    const staleRef: EntityRef = { id: 9, generation: 0 };
    recording.markers = vi.fn(() => [
      stubMarker({ id: 'm1', refs: { entities: [staleRef, validRef] } }),
    ]);
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    panel.toggleVisibility();
    const row = host.querySelector<HTMLElement>('[data-testid="marker-list-current-row"]')!;
    row.click();
    expect(bridge.panCameraTo).toHaveBeenCalledWith(validRef);
    expect(bridge.select).toHaveBeenCalledWith([validRef]);
    panel.dispose();
  });
});

describe('MarkerListPanel — Prior Sessions section', () => {
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

  const makePrior = (id: string, overrides: Partial<PriorSessionDescriptor> = {}): PriorSessionDescriptor => ({
    sessionId: id,
    recordedAt: new Date().toISOString(),
    startTick: 0,
    endTick: 100,
    markerCount: 5,
    schemaVersion: 1,
    closedNormally: true,
    ...overrides,
  });

  beforeEach(() => {
    recording = {
      markers: vi.fn(() => []),
      listPriorSessions: vi.fn(() => Promise.resolve([])),
      exportPriorSession: vi.fn(() => Promise.resolve(new Blob(['{}']))),
      discardPriorSession: vi.fn(() => Promise.resolve()),
    };
    pauseControl = { pause: vi.fn(), resume: vi.fn(), isPaused: () => false };
    toast = { showToast: vi.fn() };
    bridge = { panCameraTo: vi.fn(), select: vi.fn() };
    world = { tick: 100, isCurrent: () => true } as unknown as World;
  });

  it('expanding prior sessions calls listPriorSessions', async () => {
    recording.listPriorSessions = vi.fn(() => Promise.resolve([makePrior('s1'), makePrior('s2')]));
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    panel.toggleVisibility();
    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-toggle"]')!;
    toggle.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(recording.listPriorSessions).toHaveBeenCalledTimes(1);
    const rows = host.querySelectorAll('[data-testid="marker-list-prior-row"]');
    expect(rows.length).toBe(2);
    panel.dispose();
  });

  it('Export click downloads the bundle', async () => {
    const blob = new Blob(['{"sessionId":"s1"}'], { type: 'application/json' });
    recording.listPriorSessions = vi.fn(() => Promise.resolve([makePrior('s1')]));
    recording.exportPriorSession = vi.fn(() => Promise.resolve(blob));
    if (typeof URL.createObjectURL !== 'function') {
      (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob://stub';
      (URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL = () => {};
    }
    // jsdom emits "Not implemented: navigation to another Document" stderr
    // for HTMLAnchorElement.click() on a download link. The click is the
    // right semantic in real browsers (triggers download); in tests it's
    // a no-op anyway. Stub on the prototype so the real click path runs
    // through a vi.fn that doesn't navigate.
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = vi.fn();
    try {
      const host = mountedHost();
      const panel = createMarkerListPanel({
        recording: recording as never,
        pauseControl,
        toast,
        bridge,
        worldRef: () => world,
        autoRefresh: false,
      });
      panel.mount(host);
      panel.toggleVisibility();
      const toggle = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-toggle"]')!;
      toggle.click();
      await new Promise((r) => setTimeout(r, 0));
      const exportBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-export"]')!;
      exportBtn.click();
      await new Promise((r) => setTimeout(r, 0));
      expect(recording.exportPriorSession).toHaveBeenCalledWith('s1');
      panel.dispose();
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  it('Discard with confirm=true calls discardPriorSession + re-renders', async () => {
    recording.listPriorSessions = vi.fn()
      .mockResolvedValueOnce([makePrior('s1'), makePrior('s2')])
      .mockResolvedValueOnce([makePrior('s2')]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    panel.toggleVisibility();
    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-toggle"]')!;
    toggle.click();
    await new Promise((r) => setTimeout(r, 0));
    const discardBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-discard"]')!;
    discardBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(recording.discardPriorSession).toHaveBeenCalledWith('s1');
    confirmSpy.mockRestore();
    panel.dispose();
  });

  it('schema-mismatched session has disabled Export button', async () => {
    recording.listPriorSessions = vi.fn(() => Promise.resolve([makePrior('s-old', { schemaVersion: 0 })]));
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    panel.toggleVisibility();
    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-toggle"]')!;
    toggle.click();
    await new Promise((r) => setTimeout(r, 0));
    const exportBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-export"]')!;
    expect(exportBtn.disabled).toBe(true);
    panel.dispose();
  });

  it('closedNormally:false adds warning indicator', async () => {
    recording.listPriorSessions = vi.fn(() => Promise.resolve([makePrior('s-crash', { closedNormally: false })]));
    const host = mountedHost();
    const panel = createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
    });
    panel.mount(host);
    panel.toggleVisibility();
    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-toggle"]')!;
    toggle.click();
    await new Promise((r) => setTimeout(r, 0));
    const warn = host.querySelector('.marker-list-panel__warn');
    expect(warn).not.toBeNull();
    panel.dispose();
  });
});
