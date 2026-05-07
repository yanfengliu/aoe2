// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Marker, SessionBundle, SessionMetadata } from 'civ-engine';

import { createReplayLoadDialog } from '../../src/ui/replay/replayLoadDialog';
import type { ReplayController } from '../../src/game/replay/ReplayController';
import type { PriorSessionDescriptor } from '../../src/game/recording/IndexedDBMirror';
import type { RecordingService } from '../../src/game/recording/RecordingService';

// jsdom doesn't implement <dialog> showModal/close natively across all
// versions; polyfill them so the dialog open/close flow can be observed
// in tests without requiring browser-runtime semantics.
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

const validBundle = (overrides: Partial<SessionBundle> = {}): SessionBundle => ({
  schemaVersion: 1,
  metadata: {
    sessionId: 's1',
    startTick: 0,
    endTick: 5,
    sourceKind: 'session',
    sourceLabel: 'test',
    recordedAt: '2026-05-06T00:00:00.000Z',
  } as SessionMetadata,
  commands: [{ submissionTick: 1, sequence: 0, type: 'unit.move' } as unknown as SessionBundle['commands'][number]],
  initialSnapshot: { tick: 0, state: [] } as unknown as SessionBundle['initialSnapshot'],
  ticks: [],
  executions: [],
  failures: [],
  snapshots: [],
  markers: [] as Marker[],
  attachments: [],
  ...overrides,
} as SessionBundle);

const stubPrior = (id: string, overrides: Partial<PriorSessionDescriptor> = {}): PriorSessionDescriptor => ({
  sessionId: id,
  recordedAt: new Date().toISOString(),
  startTick: 0,
  endTick: 100,
  markerCount: 5,
  schemaVersion: 1,
  closedNormally: true,
  ...overrides,
});

type StubRecording = Pick<RecordingService, 'bundle' | 'listPriorSessions' | 'loadPriorSessionBundle'>;

describe('createReplayLoadDialog', () => {
  let host: HTMLElement;
  let toast: { showToast: ReturnType<typeof vi.fn> };
  let recording: StubRecording;
  let mode: ReplayController['mode'];
  let enterReplay: ReturnType<typeof vi.fn>;

  const makeController = (): Pick<ReplayController, 'enterReplay' | 'mode'> => ({
    get mode() { return mode; },
    enterReplay: enterReplay as unknown as ReplayController['enterReplay'],
  });

  beforeEach(() => {
    installDialogPolyfill();
    host = document.createElement('div');
    document.body.appendChild(host);
    toast = { showToast: vi.fn() };
    mode = 'live';
    enterReplay = vi.fn();
    recording = {
      bundle: vi.fn(() => null),
      listPriorSessions: vi.fn(() => Promise.resolve([])),
      loadPriorSessionBundle: vi.fn(() => Promise.reject(new Error('not implemented in stub'))),
    } as StubRecording;
  });

  it('mounts a closed <dialog> on construction', () => {
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    const dialog = host.querySelector<HTMLDialogElement>('[data-testid="replay-load-dialog-root"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.open).toBe(false);
    handle.dispose();
  });

  it('open() shows the dialog with the live tab default-active when bundle has payloads', async () => {
    recording.bundle = vi.fn(() => validBundle());
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    await handle.open();
    expect(handle.isOpen()).toBe(true);
    const liveTab = host.querySelector<HTMLElement>('[data-testid="replay-load-tab-live"]')!;
    expect(liveTab.dataset.active).toBe('true');
    const livePanel = host.querySelector<HTMLElement>('[data-testid="replay-load-panel-live"]')!;
    expect(livePanel.hidden).toBe(false);
    handle.dispose();
  });

  it('open() defaults to prior tab when no live payloads', async () => {
    recording.bundle = vi.fn(() => null);
    recording.listPriorSessions = vi.fn(() => Promise.resolve([stubPrior('s1')]));
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    await handle.open();
    const priorTab = host.querySelector<HTMLElement>('[data-testid="replay-load-tab-prior"]')!;
    expect(priorTab.dataset.active).toBe('true');
    handle.dispose();
  });

  it('open() is a no-op when already in replay mode', async () => {
    mode = 'replay';
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    await handle.open();
    expect(handle.isOpen()).toBe(false);
    handle.dispose();
  });

  it('clicking the live confirm button enters replay and closes the dialog', async () => {
    const bundle = validBundle();
    recording.bundle = vi.fn(() => bundle);
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    await handle.open();
    const liveConfirm = host.querySelector<HTMLButtonElement>('[data-testid="replay-load-live-confirm"]')!;
    liveConfirm.click();
    expect(enterReplay).toHaveBeenCalledTimes(1);
    expect(handle.isOpen()).toBe(false);
    handle.dispose();
  });

  it('switching to prior tab populates the list and clicking a row enters replay', async () => {
    recording.bundle = vi.fn(() => null);
    recording.listPriorSessions = vi.fn(() => Promise.resolve([stubPrior('s1'), stubPrior('s2')]));
    recording.loadPriorSessionBundle = vi.fn(() => Promise.resolve(validBundle()));
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    await handle.open();
    const priorTab = host.querySelector<HTMLButtonElement>('[data-testid="replay-load-tab-prior"]')!;
    priorTab.click();
    await new Promise((r) => setTimeout(r, 5));
    const rows = host.querySelectorAll<HTMLButtonElement>('[data-testid="replay-load-prior-row"]');
    expect(rows.length).toBe(2);
    rows[0].click();
    await new Promise((r) => setTimeout(r, 5));
    expect(enterReplay).toHaveBeenCalledTimes(1);
    expect(handle.isOpen()).toBe(false);
    handle.dispose();
  });

  it('cancel button closes the dialog without entering replay', async () => {
    recording.bundle = vi.fn(() => validBundle());
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    await handle.open();
    const cancel = host.querySelector<HTMLButtonElement>('[data-testid="replay-load-cancel"]')!;
    cancel.click();
    expect(handle.isOpen()).toBe(false);
    expect(enterReplay).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('file tab loads a valid bundle', async () => {
    recording.bundle = vi.fn(() => null);
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    await handle.open();
    const fileTab = host.querySelector<HTMLButtonElement>('[data-testid="replay-load-tab-file"]')!;
    fileTab.click();
    const input = host.querySelector<HTMLInputElement>('[data-testid="replay-load-file-input"]')!;
    const file = new File([JSON.stringify(validBundle())], 'bundle.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', {
      value: { length: 1, item: () => file, 0: file } as unknown as FileList,
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 5));
    expect(enterReplay).toHaveBeenCalledTimes(1);
    expect(handle.isOpen()).toBe(false);
    handle.dispose();
  });

  it('invalid file surfaces a structured toast and keeps dialog open', async () => {
    recording.bundle = vi.fn(() => null);
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    await handle.open();
    const fileTab = host.querySelector<HTMLButtonElement>('[data-testid="replay-load-tab-file"]')!;
    fileTab.click();
    const input = host.querySelector<HTMLInputElement>('[data-testid="replay-load-file-input"]')!;
    const file = new File(['not json'], 'bundle.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', {
      value: { length: 1, item: () => file, 0: file } as unknown as FileList,
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 5));
    expect(enterReplay).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith('Invalid bundle file: invalid JSON');
    expect(handle.isOpen()).toBe(true);
    handle.dispose();
  });

  it('live confirm with no-bundle surfaces a toast', async () => {
    recording.bundle = vi.fn(() => null);
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    await handle.open();
    // Force live tab even though it's not the default
    const liveTab = host.querySelector<HTMLButtonElement>('[data-testid="replay-load-tab-live"]')!;
    liveTab.click();
    const liveConfirm = host.querySelector<HTMLButtonElement>('[data-testid="replay-load-live-confirm"]')!;
    // Directly invoke confirm to bypass the disabled-state guard
    liveConfirm.disabled = false;
    liveConfirm.click();
    expect(enterReplay).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith('No live recording yet — start a match before replaying.');
    handle.dispose();
  });

  it('dispose() removes the dialog from host', () => {
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    expect(host.querySelector('[data-testid="replay-load-dialog-root"]')).not.toBeNull();
    handle.dispose();
    expect(host.querySelector('[data-testid="replay-load-dialog-root"]')).toBeNull();
  });

  it('reopen re-fetches prior sessions (cache invalidated each open)', async () => {
    recording.bundle = vi.fn(() => null);
    let priorList: readonly PriorSessionDescriptor[] = [];
    recording.listPriorSessions = vi.fn(() => Promise.resolve(priorList));
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    await handle.open();
    expect(recording.listPriorSessions).toHaveBeenCalledTimes(1);
    handle.close();
    priorList = [stubPrior('newly-persisted')];
    await handle.open();
    expect(recording.listPriorSessions).toHaveBeenCalledTimes(2);
    const rows = host.querySelectorAll<HTMLElement>('[data-testid="replay-load-prior-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].dataset.sessionId).toBe('newly-persisted');
    handle.dispose();
  });

  it('rapid concurrent open() calls do not throw on showModal', async () => {
    recording.bundle = vi.fn(() => null);
    recording.listPriorSessions = vi.fn(() => Promise.resolve([stubPrior('s1')]));
    const handle = createReplayLoadDialog({ host, replayController: makeController(), recording, toast });
    const p1 = handle.open();
    const p2 = handle.open();
    const p3 = handle.open();
    await Promise.all([p1, p2, p3]);
    expect(handle.isOpen()).toBe(true);
    expect(recording.listPriorSessions).toHaveBeenCalledTimes(1);
    handle.dispose();
  });
});
