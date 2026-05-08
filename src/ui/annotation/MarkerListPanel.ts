// Spec 2 (annotation-ui v0.1.5) AO-11: MarkerListPanel — bottom-right
// HTML overlay listing the current session's markers + a collapsible
// Prior Sessions section. Per DESIGN §7:
//
//   Current Session rows: [tick] [severity icon] [text snippet] [author badge]
//     - sorted tick desc
//     - polled from RecordingService.markers() every 1s when visible
//     - on row click:
//         pause game, pan camera + select first valid entity ref
//         (filtered through world.isCurrent — stale-ref filter per DESIGN §7).
//         Cell fallback if no valid entity. Toast "marker target no longer
//         exists" if all stale and no cell.
//
//   Prior Sessions (collapsed by default):
//     - lazily loaded via RecordingService.listPriorSessions()
//     - per-row Export / Discard buttons
//     - schema-mismatched sessions: disabled Export + tooltip
//     - closedNormally:false: warning icon + tooltip

import type { EntityRef, Marker, Position, World } from 'civ-engine';

import type { RecordingService } from '../../game/recording/RecordingService';
import type { PauseControl } from '../../game/control/PauseControl';
import type { PriorSessionDescriptor } from '../../game/recording/IndexedDBMirror';
import { SchemaMismatchError } from '../../game/recording/IndexedDBMirrorErrors';
import { escapeHtml } from '../utils/escapeHtml';

export type MarkerListPanelMode = 'live' | 'replay';

export interface MarkerListPanelReplayAdapter {
  mode(): MarkerListPanelMode;
  bundle(): { markers: readonly Marker[] } | null;
  jumpToMarker(markerId: string): void;
  onModeChange(listener: (mode: MarkerListPanelMode) => void): () => void;
}

const POLL_INTERVAL_MS = 1000;
const TEXT_SNIPPET_MAX_LEN = 60;

const SEVERITY_ICONS: Record<string, string> = {
  info: 'i',
  warning: '!',
  bug: 'B',
  blocker: 'X',
};

// Set lookup avoids prototype-chain pollution (`SEVERITY_ICONS['constructor']`
// returns the inherited Object constructor, which is truthy and would bypass
// the intended fallback). Iter-2 review finding.
const ALLOWED_SEVERITIES: ReadonlySet<string> = new Set(Object.keys(SEVERITY_ICONS));

export interface MarkerListPanelConfig {
  readonly recording: RecordingService;
  readonly pauseControl: PauseControl;
  readonly toast: { showToast(text: string): void };
  readonly bridge: {
    panCameraTo(target: EntityRef | Position): void;
    select(refs: readonly EntityRef[]): void;
  };
  // Permissive World typing — only reads world.isCurrent etc., doesn't
  // submit commands. Allows tests to pass bare `new World()`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly worldRef: () => World<any, any, any>;
  /** When true (default), uses setInterval polling. Tests pass false
   *  and call refresh() manually for deterministic assertions. */
  readonly autoRefresh?: boolean;
  /** Slice 1 (v0.1.8): when present and `mode() === 'replay'`, the panel
   *  reads markers from the replay bundle, hides the Prior Sessions
   *  section, and routes row clicks through `jumpToMarker`. The adapter
   *  is optional so tests and pre-Slice-1 callers stay unchanged. */
  readonly replay?: MarkerListPanelReplayAdapter;
  /** Slice 3 (v0.1.10): when present, each Prior Sessions row gains a
   *  "Replay" button alongside Export / Discard. Click invokes this
   *  callback with the row's sessionId. The panel disables the row's
   *  three buttons during the async call and re-enables them on resolve
   *  or reject. Optional so live-mode tests stay unchanged. */
  readonly onReplayPriorSession?: (sessionId: string) => Promise<void>;
}

export interface MarkerListPanel {
  /** Mount the panel DOM into `host`. */
  mount(host: HTMLElement): void;
  /** Show / hide. Polling is gated on visibility. */
  toggleVisibility(): void;
  isVisible(): boolean;
  /** Re-read markers + (if expanded) prior sessions and re-render. */
  refresh(): Promise<void>;
  dispose(): void;
}

export function createMarkerListPanel(config: MarkerListPanelConfig): MarkerListPanel {
  const { recording, pauseControl, toast, bridge, worldRef, replay, onReplayPriorSession } = config;
  const autoRefresh = config.autoRefresh ?? true;
  const currentMode = (): MarkerListPanelMode => replay?.mode() ?? 'live';

  let mounted: HTMLElement | null = null;
  let panelEl: HTMLDivElement | null = null;
  let currentSessionListEl: HTMLDivElement | null = null;
  let priorSessionsToggle: HTMLButtonElement | null = null;
  let priorSessionsListEl: HTMLDivElement | null = null;
  let priorSessionsContainerEl: HTMLDivElement | null = null;
  let visible = false;
  let priorSessionsExpanded = false;
  let priorSessionsCache: readonly PriorSessionDescriptor[] | null = null;
  let pollHandle: ReturnType<typeof setInterval> | null = null;
  let unsubscribeModeChange: (() => void) | null = null;

  const buildDom = (): HTMLDivElement => {
    const root = document.createElement('div');
    root.className = 'marker-list-panel marker-list-panel--hidden';
    root.dataset.testid = 'marker-list-panel';
    root.innerHTML = `
      <h2 class="marker-list-panel__title">Markers</h2>
      <div class="marker-list-panel__current" data-testid="marker-list-current"></div>
      <div class="marker-list-panel__prior">
        <button type="button" class="marker-list-panel__prior-toggle" data-testid="marker-list-prior-toggle">
          Prior Sessions <span data-testid="marker-list-prior-chevron">▸</span>
        </button>
        <div class="marker-list-panel__prior-list" data-testid="marker-list-prior" hidden></div>
      </div>
    `;
    return root;
  };

  const truncateText = (text: string | undefined): string => {
    if (!text) return '(no text)';
    return text.length <= TEXT_SNIPPET_MAX_LEN
      ? text
      : `${text.slice(0, TEXT_SNIPPET_MAX_LEN - 1)}…`;
  };

  const collectMarkersForCurrentMode = (): readonly Marker[] => {
    if (currentMode() === 'replay') {
      const bundle = replay?.bundle();
      if (!bundle) return [];
      return [...bundle.markers].sort((left, right) => right.tick - left.tick);
    }
    return recording.markers();
  };

  const renderCurrentSession = (): void => {
    if (!currentSessionListEl) return;
    const markers = collectMarkersForCurrentMode();
    if (markers.length === 0) {
      currentSessionListEl.innerHTML =
        '<div class="marker-list-panel__empty" data-testid="marker-list-current-empty">No markers yet.</div>';
      return;
    }
    currentSessionListEl.innerHTML = markers
      .map((m, i) => {
        const author =
          m.data && typeof m.data === 'object' && 'author' in (m.data as Record<string, unknown>)
            ? String((m.data as { author: unknown }).author)
            : 'unknown';
        const severityRaw =
          m.data && typeof m.data === 'object' && 'severity' in (m.data as Record<string, unknown>)
            ? String((m.data as { severity: unknown }).severity)
            : 'info';
        const severity = ALLOWED_SEVERITIES.has(severityRaw) ? severityRaw : 'info';
        const icon = SEVERITY_ICONS[severity];
        const tickValue = Number.isFinite(m.tick) ? Math.trunc(m.tick).toString() : '0';
        return `
          <div class="marker-list-panel__row" data-testid="marker-list-current-row" data-marker-index="${i}" data-marker-id="${escapeHtml(m.id)}">
            <span class="marker-list-panel__tick">${escapeHtml(tickValue)}</span>
            <span class="marker-list-panel__sev marker-list-panel__sev--${escapeHtml(severity)}">${icon}</span>
            <span class="marker-list-panel__text">${escapeHtml(truncateText(m.text))}</span>
            <span class="marker-list-panel__author">${escapeHtml(author)}</span>
          </div>
        `;
      })
      .join('');
  };

  const applyPriorSectionVisibility = (): void => {
    if (!priorSessionsContainerEl) return;
    priorSessionsContainerEl.hidden = currentMode() === 'replay';
  };

  const renderPriorSessions = (): void => {
    if (!priorSessionsListEl) return;
    priorSessionsListEl.hidden = !priorSessionsExpanded;
    if (!priorSessionsExpanded || priorSessionsCache === null) return;
    if (priorSessionsCache.length === 0) {
      priorSessionsListEl.innerHTML =
        '<div class="marker-list-panel__empty" data-testid="marker-list-prior-empty">No prior sessions.</div>';
      return;
    }
    priorSessionsListEl.innerHTML = priorSessionsCache
      .map((s) => {
        const sidPrefix = s.sessionId.slice(0, 8);
        const tickRange = `${s.startTick}-${s.endTick}`;
        const warn = s.closedNormally
          ? ''
          : '<span class="marker-list-panel__warn" title="session ended abnormally — likely browser refresh or crash">⚠</span>';
        const exportDisabled = s.schemaVersion !== getCurrentSchemaVersion();
        const exportTitle = exportDisabled
          ? `schema version ${s.schemaVersion} differs from current; export disabled`
          : 'Download bundle JSON';
        // Slice 3: Replay button is gated on the schema-version check
        // (same as Export) AND on the empty-session check (closedNormally
        // is false AND there are zero elapsed ticks → no payloads to
        // replay forward). Sessions that ran for at least one tick are
        // allowed even when closedNormally is false because the controller
        // can replay up to the last good tick. Hidden entirely when no
        // `onReplayPriorSession` callback is wired so pre-Slice-3 callers
        // stay unchanged.
        const replayEmptyAbnormal = !s.closedNormally && s.endTick === s.startTick;
        const replayDisabled = exportDisabled || replayEmptyAbnormal;
        const replayTitle = exportDisabled
          ? `schema version ${s.schemaVersion} differs from current; replay disabled`
          : replayEmptyAbnormal
            ? 'session ended abnormally with zero elapsed ticks; nothing to replay'
            : 'Open this session in replay mode';
        const replayHtml = onReplayPriorSession
          ? `<button type="button" data-testid="marker-list-prior-replay" data-session-id="${escapeHtml(s.sessionId)}" ${replayDisabled ? 'disabled' : ''} title="${escapeHtml(replayTitle)}">Replay</button>`
          : '';
        return `
          <div class="marker-list-panel__prior-row" data-testid="marker-list-prior-row" data-session-id="${escapeHtml(s.sessionId)}">
            <span class="marker-list-panel__prior-when">${escapeHtml(s.recordedAt)}</span>
            <span class="marker-list-panel__prior-id">${escapeHtml(sidPrefix)}</span>
            <span class="marker-list-panel__prior-ticks">${tickRange}</span>
            <span class="marker-list-panel__prior-markers">${s.markerCount} markers</span>
            ${warn}
            <button type="button" data-testid="marker-list-prior-export" data-session-id="${escapeHtml(s.sessionId)}" ${exportDisabled ? 'disabled' : ''} title="${escapeHtml(exportTitle)}">Export</button>
            ${replayHtml}
            <button type="button" data-testid="marker-list-prior-discard" data-session-id="${escapeHtml(s.sessionId)}">Discard</button>
          </div>
        `;
      })
      .join('');
  };

  const handleCurrentRowClick = async (e: Event): Promise<void> => {
    if (!(e.target instanceof HTMLElement)) return;
    const row = e.target.closest<HTMLElement>('[data-testid="marker-list-current-row"]');
    if (!row) return;
    const idx = Number(row.dataset.markerIndex ?? '-1');
    if (idx < 0) return;
    if (currentMode() === 'replay') {
      const markerId = row.dataset.markerId;
      if (markerId && replay) replay.jumpToMarker(markerId);
      return;
    }
    const markers = recording.markers();
    const marker = markers[idx];
    if (!marker) return;

    pauseControl.pause();

    // Stale-ref filter per DESIGN §7: filter EntityRefs through
    // world.isCurrent before passing to bridge.select; if all stale,
    // fall back to first cell; if no cells, toast and leave selection.
    const world = worldRef();
    const validEntityRefs: EntityRef[] = [];
    if (marker.refs?.entities) {
      for (const ref of marker.refs.entities) {
        if (world.isCurrent(ref)) validEntityRefs.push(ref);
      }
    }
    if (validEntityRefs.length > 0) {
      bridge.panCameraTo(validEntityRefs[0]);
      bridge.select(validEntityRefs);
      return;
    }
    const firstCell = marker.refs?.cells?.[0];
    if (firstCell) {
      bridge.panCameraTo(firstCell);
      return;
    }
    toast.showToast('marker target no longer exists in this world');
  };

  const handlePriorActionClick = async (e: Event): Promise<void> => {
    if (!(e.target instanceof HTMLElement)) return;
    const target = e.target;
    const sessionId = target.dataset.sessionId;
    if (!sessionId) return;

    if (target.dataset.testid === 'marker-list-prior-export') {
      try {
        const blob = await recording.exportPriorSession(sessionId);
        triggerDownload(blob, `aoe2-session-${sessionId.slice(0, 8)}.json`);
      } catch (err) {
        if (err instanceof SchemaMismatchError) {
          toast.showToast(
            `schema mismatch: stored=${err.storedVersion}, current=${err.expectedVersion}`,
          );
        } else {
          toast.showToast(
            `export failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      return;
    }

    if (target.dataset.testid === 'marker-list-prior-replay' && onReplayPriorSession) {
      const buttonEl = target as HTMLButtonElement;
      if (buttonEl.disabled) return;
      const row = buttonEl.closest<HTMLElement>('[data-testid="marker-list-prior-row"]');
      const rowButtons = row ? row.querySelectorAll<HTMLButtonElement>('button') : null;
      // Disable every button in the row while the async load runs so
      // double-clicks / interleaved Export + Discard cannot race.
      rowButtons?.forEach((btn) => { btn.disabled = true; });
      try {
        await onReplayPriorSession(sessionId);
      } catch (err) {
        if (err instanceof SchemaMismatchError) {
          toast.showToast(`schema mismatch: stored=${err.storedVersion}, current=${err.expectedVersion}`);
        } else {
          toast.showToast(`replay failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      } finally {
        // Re-render the prior list so the disabled state is canonical
        // (the freshly rendered DOM has the schema-mismatch gate applied
        // exactly once).
        renderPriorSessions();
      }
      return;
    }

    if (target.dataset.testid === 'marker-list-prior-discard') {
      // Confirm via window.confirm (test stubs return true to proceed).
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (!window.confirm(`Discard session ${sessionId.slice(0, 8)}?`)) return;
      }
      try {
        await recording.discardPriorSession(sessionId);
        priorSessionsCache = await recording.listPriorSessions();
        renderPriorSessions();
      } catch (err) {
        toast.showToast(
          `discard failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  };

  const handlePriorToggle = async (): Promise<void> => {
    priorSessionsExpanded = !priorSessionsExpanded;
    if (priorSessionsExpanded && priorSessionsCache === null) {
      try {
        priorSessionsCache = await recording.listPriorSessions();
      } catch (err) {
        toast.showToast(`could not list prior sessions: ${err instanceof Error ? err.message : String(err)}`);
        priorSessionsCache = [];
      }
    }
    renderPriorSessions();
    const chevronEl = panelEl?.querySelector<HTMLElement>('[data-testid="marker-list-prior-chevron"]');
    if (chevronEl) chevronEl.textContent = priorSessionsExpanded ? '▾' : '▸';
  };

  const startPolling = (): void => {
    if (!autoRefresh || pollHandle !== null) return;
    pollHandle = setInterval(() => renderCurrentSession(), POLL_INTERVAL_MS);
  };

  const stopPolling = (): void => {
    if (pollHandle !== null) {
      clearInterval(pollHandle);
      pollHandle = null;
    }
  };

  return {
    mount(host: HTMLElement): void {
      if (mounted) return;
      mounted = host;
      panelEl = buildDom();
      currentSessionListEl = panelEl.querySelector<HTMLDivElement>('[data-testid="marker-list-current"]');
      priorSessionsToggle = panelEl.querySelector<HTMLButtonElement>('[data-testid="marker-list-prior-toggle"]');
      priorSessionsListEl = panelEl.querySelector<HTMLDivElement>('[data-testid="marker-list-prior"]');
      priorSessionsContainerEl = panelEl.querySelector<HTMLDivElement>('.marker-list-panel__prior');
      host.appendChild(panelEl);

      currentSessionListEl?.addEventListener('click', handleCurrentRowClick);
      priorSessionsListEl?.addEventListener('click', handlePriorActionClick);
      priorSessionsToggle?.addEventListener('click', handlePriorToggle);

      applyPriorSectionVisibility();
      if (replay) {
        unsubscribeModeChange = replay.onModeChange(() => {
          applyPriorSectionVisibility();
          if (visible) renderCurrentSession();
        });
      }
    },

    toggleVisibility(): void {
      if (!panelEl) return;
      visible = !visible;
      if (visible) {
        panelEl.classList.remove('marker-list-panel--hidden');
        renderCurrentSession();
        startPolling();
      } else {
        panelEl.classList.add('marker-list-panel--hidden');
        stopPolling();
      }
    },

    isVisible(): boolean {
      return visible;
    },

    async refresh(): Promise<void> {
      renderCurrentSession();
      if (priorSessionsExpanded) {
        try {
          priorSessionsCache = await recording.listPriorSessions();
          renderPriorSessions();
        } catch {
          /* best-effort */
        }
      }
    },

    dispose(): void {
      stopPolling();
      currentSessionListEl?.removeEventListener('click', handleCurrentRowClick);
      priorSessionsListEl?.removeEventListener('click', handlePriorActionClick);
      priorSessionsToggle?.removeEventListener('click', handlePriorToggle);
      unsubscribeModeChange?.();
      unsubscribeModeChange = null;
      if (panelEl && mounted) {
        try { mounted.removeChild(panelEl); } catch { /* best-effort */ }
      }
      mounted = null;
      panelEl = null;
      priorSessionsContainerEl = null;
    },
  };
}

const triggerDownload = (blob: Blob, filename: string): void => {
  if (typeof window === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revokeObjectURL slightly to give the browser time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const getCurrentSchemaVersion = (): number => {
  // civ-engine's SESSION_BUNDLE_SCHEMA_VERSION is the source of truth, but
  // to avoid a circular import (annotation UI → civ-engine constant), we
  // mirror the value here. The PriorSessionDescriptor.schemaVersion comes
  // from the persisted IDB row; comparison is for UI rendering only and
  // doesn't affect actual bundle validation.
  return 1;
};
