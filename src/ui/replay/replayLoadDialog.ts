// Slice 5 (replay-load-and-e2e v0.1.12): unifies the three replay-load
// sources (current live session, IDB prior session, file import) under
// one HUD-mounted modal. Uses a native <dialog> element with showModal()
// so the browser provides focus trap, Escape dismissal, and backdrop
// for free.
//
// The dialog default-selects the source most likely to be useful given
// the current state: live session if the recorder has a payload, else
// prior session if any persisted, else file import.

import type { ReplayBundle, ReplayController } from '../../game/replay/ReplayController';
import type { RecordingService } from '../../game/recording/RecordingService';
import type { PriorSessionDescriptor } from '../../game/recording/IndexedDBMirror';
import { SchemaMismatchError } from '../../game/recording/IndexedDBMirrorErrors';
import { loadCurrentSessionAsReplay } from '../../game/replay/loadCurrentSession';
import { loadPriorSessionAsReplay } from '../../game/replay/loadPriorSession';
import { parseSessionBundleFile } from '../../game/replay/parseSessionBundleFile';
import { escapeHtml } from '../utils/escapeHtml';

export type ReplayLoadSource = 'live' | 'prior' | 'file';

export interface ReplayLoadDialogConfig {
  readonly host: HTMLElement;
  readonly replayController: Pick<ReplayController, 'enterReplay' | 'mode'>;
  readonly recording: Pick<
    RecordingService,
    'bundle' | 'listPriorSessions' | 'loadPriorSessionBundle'
  >;
  readonly toast: { showToast(text: string): void };
}

export interface ReplayLoadDialogHandle {
  open(): Promise<void>;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

const TEMPLATE = `
  <div class="replay-load-dialog" data-testid="replay-load-dialog">
    <h2 class="replay-load-dialog__title">Open replay</h2>
    <div class="replay-load-dialog__tabs" role="tablist">
      <button type="button" data-testid="replay-load-tab-live" data-source="live" role="tab">Live session</button>
      <button type="button" data-testid="replay-load-tab-prior" data-source="prior" role="tab">Prior session</button>
      <button type="button" data-testid="replay-load-tab-file" data-source="file" role="tab">From file</button>
    </div>
    <div class="replay-load-dialog__panels">
      <div class="replay-load-dialog__panel" data-source="live" data-testid="replay-load-panel-live">
        <p class="replay-load-dialog__hint" data-testid="replay-load-live-hint">Replay the in-progress live session.</p>
        <button type="button" class="replay-load-dialog__primary" data-testid="replay-load-live-confirm">Start replay</button>
      </div>
      <div class="replay-load-dialog__panel" data-source="prior" data-testid="replay-load-panel-prior" hidden>
        <p class="replay-load-dialog__hint" data-testid="replay-load-prior-hint">Replay a session persisted from a previous run.</p>
        <div class="replay-load-dialog__prior-list" data-testid="replay-load-prior-list"></div>
      </div>
      <div class="replay-load-dialog__panel" data-source="file" data-testid="replay-load-panel-file" hidden>
        <p class="replay-load-dialog__hint" data-testid="replay-load-file-hint">Open an exported session bundle (.json file).</p>
        <input type="file" accept="application/json,.json" data-testid="replay-load-file-input" />
      </div>
    </div>
    <div class="replay-load-dialog__footer">
      <button type="button" class="replay-load-dialog__cancel" data-testid="replay-load-cancel">Cancel</button>
    </div>
  </div>
`;

export function createReplayLoadDialog(config: ReplayLoadDialogConfig): ReplayLoadDialogHandle {
  const { host, replayController, recording, toast } = config;

  const dialogEl = document.createElement('dialog');
  dialogEl.className = 'replay-load-dialog__root';
  dialogEl.dataset.testid = 'replay-load-dialog-root';
  dialogEl.innerHTML = TEMPLATE;
  host.appendChild(dialogEl);

  const tabButtons = Array.from(
    dialogEl.querySelectorAll<HTMLButtonElement>('[role="tab"][data-source]'),
  );
  const panels = Array.from(
    dialogEl.querySelectorAll<HTMLElement>('.replay-load-dialog__panel[data-source]'),
  );
  const liveConfirmBtn = dialogEl.querySelector<HTMLButtonElement>('[data-testid="replay-load-live-confirm"]')!;
  const liveHintEl = dialogEl.querySelector<HTMLElement>('[data-testid="replay-load-live-hint"]')!;
  const priorListEl = dialogEl.querySelector<HTMLElement>('[data-testid="replay-load-prior-list"]')!;
  const fileInput = dialogEl.querySelector<HTMLInputElement>('[data-testid="replay-load-file-input"]')!;
  const cancelBtn = dialogEl.querySelector<HTMLButtonElement>('[data-testid="replay-load-cancel"]')!;

  let priorSessionsCache: readonly PriorSessionDescriptor[] | null = null;
  let liveBundleHasPayloads = false;
  // Reentrancy guard: rapid clicks on the HUD button can fire multiple
  // `open()` calls; each awaits `listPriorSessions()` then calls
  // `showModal()`. A second `showModal()` on an already-open native
  // dialog throws InvalidStateError. The guard short-circuits the
  // second call and any concurrent calls.
  let opening = false;
  // Generation token: incremented every time the dialog closes (either
  // programmatically via `close()` or via Escape / form cancel). Async
  // handlers capture the generation at entry; if it has changed by the
  // time their await resolves, the user has dismissed the dialog and
  // we must NOT proceed with `enterReplay`. Closes the cancel-during-
  // await race for prior-row click + file-read paths.
  let generation = 0;
  dialogEl.addEventListener('close', () => { generation += 1; });

  const setActiveSource = (source: ReplayLoadSource): void => {
    for (const tab of tabButtons) {
      tab.dataset.active = tab.dataset.source === source ? 'true' : 'false';
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.source !== source;
    }
  };

  const renderPriorList = (): void => {
    if (priorSessionsCache === null || priorSessionsCache.length === 0) {
      priorListEl.innerHTML =
        '<div class="replay-load-dialog__empty" data-testid="replay-load-prior-empty">No prior sessions persisted yet.</div>';
      return;
    }
    priorListEl.innerHTML = priorSessionsCache
      .map((s) => `
        <button type="button" class="replay-load-dialog__prior-row" data-testid="replay-load-prior-row" data-session-id="${escapeHtml(s.sessionId)}">
          <span class="replay-load-dialog__prior-when">${escapeHtml(s.recordedAt)}</span>
          <span class="replay-load-dialog__prior-id">${escapeHtml(s.sessionId.slice(0, 8))}</span>
          <span class="replay-load-dialog__prior-ticks">${s.startTick}-${s.endTick}</span>
          <span class="replay-load-dialog__prior-markers">${s.markerCount} markers</span>
        </button>
      `)
      .join('');
  };

  const refreshLiveAvailability = (): void => {
    const bundle = recording.bundle();
    liveBundleHasPayloads = bundle != null && bundle.commands.length > 0;
    liveConfirmBtn.disabled = !liveBundleHasPayloads;
    liveHintEl.textContent = liveBundleHasPayloads
      ? 'Replay the in-progress live session.'
      : 'Live session has no recorded commands yet — start a match before replaying.';
  };

  const handleLiveConfirm = (): void => {
    const result = loadCurrentSessionAsReplay({ replayController, recording });
    if (result.status === 'no-bundle') {
      toast.showToast('No live recording yet — start a match before replaying.');
      return;
    }
    if (result.status === 'no-payloads') {
      toast.showToast('Live session has no replay payloads yet.');
      return;
    }
    if (result.status === 'error') {
      toast.showToast(`Replay failed: ${result.error?.message ?? 'unknown error'}`);
      return;
    }
    api.close();
  };

  const handlePriorRowClick = async (e: Event): Promise<void> => {
    if (!(e.target instanceof HTMLElement)) return;
    const row = e.target.closest<HTMLElement>('[data-testid="replay-load-prior-row"]');
    if (!row) return;
    const sessionId = row.dataset.sessionId;
    if (!sessionId) return;
    const myGen = generation;
    try {
      const result = await loadPriorSessionAsReplay(
        { replayController, recording },
        sessionId,
        { isCancelled: () => myGen !== generation },
      );
      if (result.status === 'cancelled') return;
      if (result.status === 'no-payloads') {
        toast.showToast('Replay failed: session has no recorded commands; nothing to replay forward');
        return;
      }
      if (result.status === 'error') {
        toast.showToast(`Replay failed: ${result.error?.message ?? 'unknown error'}`);
        return;
      }
      api.close();
    } catch (err) {
      // Bail silently if the user dismissed the dialog mid-await; the
      // SchemaMismatchError / generic error toasts only make sense for
      // the still-open dialog.
      if (myGen !== generation) return;
      if (err instanceof SchemaMismatchError) {
        toast.showToast(`schema mismatch: stored=${err.storedVersion}, current=${err.expectedVersion}`);
      } else {
        toast.showToast(`Replay failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  const handleFileChange = async (): Promise<void> => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const myGen = generation;
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      // Two cancel-checks: this one silences the "Could not read file"
      // toast when the user already cancelled mid-read; the post-try
      // check below silences the parse + enterReplay path on a
      // successful read. Both are needed because the post-await branch
      // is the dialog's only chance to bail before mutation.
      if (myGen !== generation) return;
      toast.showToast(`Could not read file: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (myGen !== generation) return;
    const result = parseSessionBundleFile(text);
    if (!result.ok) {
      toast.showToast(`Invalid bundle file: ${result.reason}`);
      return;
    }
    try {
      replayController.enterReplay(result.bundle as unknown as ReplayBundle);
      api.close();
    } catch (err) {
      toast.showToast(`Replay failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleTabClick = async (e: Event): Promise<void> => {
    if (!(e.target instanceof HTMLElement)) return;
    // Use closest() so a future child element inside a tab button (icon,
    // label span, etc.) doesn't break the source lookup.
    const tabEl = e.target.closest<HTMLElement>('[data-source]');
    if (!tabEl) return;
    const source = tabEl.dataset.source as ReplayLoadSource | undefined;
    if (!source) return;
    setActiveSource(source);
    if (source === 'live') {
      // Re-read bundle availability whenever the user switches TO the
      // live tab so the disabled state + hint text reflect any payloads
      // that have arrived since the dialog opened.
      refreshLiveAvailability();
    }
    if (source === 'prior' && priorSessionsCache === null) {
      const myGen = generation;
      let fetched: readonly PriorSessionDescriptor[];
      try {
        fetched = await recording.listPriorSessions();
      } catch (err) {
        if (myGen !== generation) return;
        toast.showToast(`Could not list prior sessions: ${err instanceof Error ? err.message : String(err)}`);
        priorSessionsCache = [];
        renderPriorList();
        return;
      }
      // A close-and-reopen sequence may have invalidated the cache while
      // we awaited; in that case the fresh fetch in `open()` is
      // authoritative and we must not stale-write here.
      if (myGen !== generation) return;
      priorSessionsCache = fetched;
      renderPriorList();
    }
  };

  const handleCancel = (): void => api.close();

  for (const tab of tabButtons) tab.addEventListener('click', handleTabClick);
  liveConfirmBtn.addEventListener('click', handleLiveConfirm);
  priorListEl.addEventListener('click', handlePriorRowClick);
  fileInput.addEventListener('change', handleFileChange);
  cancelBtn.addEventListener('click', handleCancel);

  const api: ReplayLoadDialogHandle = {
    async open(): Promise<void> {
      if (replayController.mode === 'replay') return;
      if (opening || dialogEl.open) return;
      opening = true;
      const myGen = generation;
      try {
        // Always invalidate the prior-session cache on open so we pick
        // up newly-persisted sessions from the live recorder (e.g.,
        // sessions written between two opens, or a stack rebuild after
        // save/load that changes the recorder identity).
        priorSessionsCache = null;
        refreshLiveAvailability();
        const initial: ReplayLoadSource = liveBundleHasPayloads ? 'live' : 'prior';
        setActiveSource(initial);
        if (initial === 'prior') {
          try {
            const fetched = await recording.listPriorSessions();
            // Dialog disposed or reopened while we were awaiting — skip
            // the show + cache write so the detached dialog stays inert
            // and the next open()'s fresh fetch wins.
            if (myGen !== generation) return;
            priorSessionsCache = fetched;
          } catch (err) {
            if (myGen !== generation) return;
            toast.showToast(`Could not list prior sessions: ${err instanceof Error ? err.message : String(err)}`);
            priorSessionsCache = [];
          }
          renderPriorList();
        }
        if (dialogEl.open) return;
        if (typeof dialogEl.showModal === 'function') {
          dialogEl.showModal();
        } else {
          dialogEl.setAttribute('open', '');
        }
      } finally {
        opening = false;
      }
    },
    close(): void {
      if (typeof dialogEl.close === 'function') {
        dialogEl.close();
      } else {
        dialogEl.removeAttribute('open');
      }
    },
    isOpen(): boolean {
      return dialogEl.open;
    },
    dispose(): void {
      // Bump generation so any in-flight async handlers (prior-row IDB
      // fetch, file-read, tab-click listPriorSessions) see a stale
      // capture and bail before reaching `enterReplay` or DOM writes
      // on the now-detached dialog.
      generation += 1;
      for (const tab of tabButtons) tab.removeEventListener('click', handleTabClick);
      liveConfirmBtn.removeEventListener('click', handleLiveConfirm);
      priorListEl.removeEventListener('click', handlePriorRowClick);
      fileInput.removeEventListener('change', handleFileChange);
      cancelBtn.removeEventListener('click', handleCancel);
      try { host.removeChild(dialogEl); } catch { /* best-effort */ }
    },
  };
  return api;
}
