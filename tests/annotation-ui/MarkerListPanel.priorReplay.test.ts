// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { World } from 'civ-engine';

import { createMarkerListPanel } from '../../src/ui/annotation/MarkerListPanel';
import type { PriorSessionDescriptor } from '../../src/game/recording/IndexedDBMirror';
import { SchemaMismatchError } from '../../src/game/recording/IndexedDBMirrorErrors';

const mountedHost = (): HTMLElement => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
};

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

describe('MarkerListPanel — Prior Sessions Replay button (Slice 3 — v0.1.10)', () => {
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
  let onReplayPriorSession: ReturnType<typeof vi.fn>;

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
    onReplayPriorSession = vi.fn(() => Promise.resolve());
  });

  const expandPriorSessions = async (host: HTMLElement): Promise<void> => {
    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-toggle"]')!;
    toggle.click();
    await new Promise((r) => setTimeout(r, 0));
  };

  const makePanel = (extra: Partial<Parameters<typeof createMarkerListPanel>[0]> = {}) =>
    createMarkerListPanel({
      recording: recording as never,
      pauseControl,
      toast,
      bridge,
      worldRef: () => world,
      autoRefresh: false,
      onReplayPriorSession,
      ...extra,
    });

  it('renders a Replay button per Prior Sessions row when callback is wired', async () => {
    recording.listPriorSessions = vi.fn(() => Promise.resolve([makePrior('s1'), makePrior('s2')]));
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    await expandPriorSessions(host);
    const replayButtons = host.querySelectorAll<HTMLButtonElement>('[data-testid="marker-list-prior-replay"]');
    expect(replayButtons.length).toBe(2);
    panel.dispose();
  });

  it('does NOT render Replay buttons when callback is not wired', async () => {
    recording.listPriorSessions = vi.fn(() => Promise.resolve([makePrior('s1')]));
    const host = mountedHost();
    const panel = makePanel({ onReplayPriorSession: undefined });
    panel.mount(host);
    panel.toggleVisibility();
    await expandPriorSessions(host);
    const replayButtons = host.querySelectorAll<HTMLButtonElement>('[data-testid="marker-list-prior-replay"]');
    expect(replayButtons.length).toBe(0);
    panel.dispose();
  });

  it('Replay button is disabled when schemaVersion mismatches', async () => {
    recording.listPriorSessions = vi.fn(() => Promise.resolve([makePrior('s-old', { schemaVersion: 0 })]));
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    await expandPriorSessions(host);
    const replayBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-replay"]')!;
    expect(replayBtn.disabled).toBe(true);
    panel.dispose();
  });

  it('Replay button is disabled when session ended abnormally with zero elapsed ticks', async () => {
    recording.listPriorSessions = vi.fn(() => Promise.resolve([
      makePrior('s-empty-abnormal', { closedNormally: false, startTick: 0, endTick: 0 }),
    ]));
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    await expandPriorSessions(host);
    const replayBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-replay"]')!;
    expect(replayBtn.disabled).toBe(true);
    expect(replayBtn.title).toContain('session ended abnormally with zero elapsed ticks');
    panel.dispose();
  });

  it('Replay button is enabled when session ended abnormally but has elapsed ticks', async () => {
    recording.listPriorSessions = vi.fn(() => Promise.resolve([
      makePrior('s-partial', { closedNormally: false, startTick: 0, endTick: 50 }),
    ]));
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    await expandPriorSessions(host);
    const replayBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-replay"]')!;
    expect(replayBtn.disabled).toBe(false);
    panel.dispose();
  });

  it('Replay click invokes onReplayPriorSession with the sessionId', async () => {
    recording.listPriorSessions = vi.fn(() => Promise.resolve([makePrior('s1')]));
    const host = mountedHost();
    const panel = makePanel();
    panel.mount(host);
    panel.toggleVisibility();
    await expandPriorSessions(host);
    const replayBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-replay"]')!;
    replayBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(onReplayPriorSession).toHaveBeenCalledWith('s1');
    panel.dispose();
  });

  it('Replay click disables the row buttons during the async load', async () => {
    let resolve: (() => void) | null = null;
    onReplayPriorSession = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    recording.listPriorSessions = vi.fn(() => Promise.resolve([makePrior('s1')]));
    const host = mountedHost();
    const panel = makePanel({ onReplayPriorSession });
    panel.mount(host);
    panel.toggleVisibility();
    await expandPriorSessions(host);
    const replayBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-replay"]')!;
    const exportBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-export"]')!;
    const discardBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-discard"]')!;
    expect(exportBtn.disabled).toBe(false);
    replayBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(replayBtn.disabled).toBe(true);
    expect(exportBtn.disabled).toBe(true);
    expect(discardBtn.disabled).toBe(true);
    resolve!();
    await new Promise((r) => setTimeout(r, 0));
    panel.dispose();
  });

  it('SchemaMismatchError surfaces a schema-mismatch toast', async () => {
    onReplayPriorSession = vi.fn(() => Promise.reject(new SchemaMismatchError('s1', 0, 1)));
    recording.listPriorSessions = vi.fn(() => Promise.resolve([makePrior('s1')]));
    const host = mountedHost();
    const panel = makePanel({ onReplayPriorSession });
    panel.mount(host);
    panel.toggleVisibility();
    await expandPriorSessions(host);
    const replayBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-replay"]')!;
    replayBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(toast.showToast).toHaveBeenCalledWith('schema mismatch: stored=0, current=1');
    panel.dispose();
  });

  it('generic Error surfaces a "replay failed: <message>" toast', async () => {
    onReplayPriorSession = vi.fn(() => Promise.reject(new Error('IDB unavailable')));
    recording.listPriorSessions = vi.fn(() => Promise.resolve([makePrior('s1')]));
    const host = mountedHost();
    const panel = makePanel({ onReplayPriorSession });
    panel.mount(host);
    panel.toggleVisibility();
    await expandPriorSessions(host);
    const replayBtn = host.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-replay"]')!;
    replayBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(toast.showToast).toHaveBeenCalledWith('replay failed: IDB unavailable');
    panel.dispose();
  });
});
