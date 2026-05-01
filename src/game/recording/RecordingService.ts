// Spec 2 (annotation-ui v0.1.5) AO-8: RecordingService — the live-world
// recording surface for aoe2. Wraps civ-engine's SessionRecorder over
// a sync MemorySink (with allowSidecar: true so oversize PNGs route to
// sidecar storage), tees writes into IndexedDBMirror for async crash-
// recovery persistence, and exposes manual export with sidecar
// re-embedding per DESIGN §5.
//
// Per ADR 1: IDB persistence is a write-only mirror. start() ALWAYS
// begins a fresh session — never extends a prior session. Prior
// sessions remain queryable + exportable via listPriorSessions() and
// exportPriorSession(id) for inspection / refresh recovery.
//
// Per ADR 3: this service is for the LIVE human-driven world only.
// Agents driving aoe2 use civ-engine's runAgentPlaytest, which owns
// its own SessionRecorder.

import {
  MemorySink,
  SessionRecorder,
  type AttachmentDescriptor,
  type CommandExecutionResult,
  type Marker,
  type NewMarker,
  type RecordedCommand,
  type SessionBundle,
  type SessionMetadata,
  type SessionSink,
  type SessionSnapshotEntry,
  type SessionTickEntry,
  type TickFailure,
  type World,
  type WorldSnapshot,
} from 'civ-engine';

import type { AoeMarkerData } from '../annotations/markerSchema';
import { IndexedDBMirror, type PriorSessionDescriptor } from './IndexedDBMirror';
import { SessionNotFoundError } from './IndexedDBMirrorErrors';

export type PersistenceErrorListener = (err: Error) => void;

export interface RecordingServiceConfig {
  // Permissive `World` typing — RecordingService only reads world.serialize()
  // / world.tick / observers. It doesn't submit or validate commands so it
  // doesn't need the typed GameCommands surface. Tests construct bare
  // `new World()` and pass it through; production passes `GameWorld`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly world: World<any, any, any>;
  /** Session label for bundle metadata. Default: 'aoe2-session-<ISO date>'. */
  readonly sourceLabel?: string;
  /** Forwarded to SessionRecorder. Default 1000. Null disables periodic snapshots. */
  readonly snapshotInterval?: number | null;
  /** Skip IndexedDB mirror entirely (e.g., in tests). Default false. */
  readonly inMemoryOnly?: boolean;
  /** Override the IDB database name (tests use this for isolation). */
  readonly databaseName?: string;
}

// SessionSource interface (read-side) — forwarded methods.
import type { SessionSource } from 'civ-engine';

/** A SessionSink+SessionSource that delegates to MemorySink (sync,
 *  hot-path) AND tees each write into the IndexedDBMirror (async,
 *  debounced batch). The recorder reads from the mirror via the
 *  delegated SessionSource methods. */
class TeeSink implements SessionSink, SessionSource {
  private _metadata: SessionMetadata | null = null;
  private _initialSnapshotWritten = false;

  constructor(
    private readonly memory: MemorySink,
    private readonly mirror: IndexedDBMirror | null,
  ) {}

  // SessionSink
  open(metadata: SessionMetadata): void {
    this.memory.open(metadata);
    this._metadata = metadata;
    // We can't recordMeta yet because IDBMirror.recordMeta requires the
    // initial snapshot. The recorder writes the initial snapshot via
    // writeSnapshot at tick === metadata.startTick immediately after
    // open(), so we capture it there.
  }

  writeTick(entry: SessionTickEntry): void {
    this.memory.writeTick(entry);
    if (this.mirror !== null && this._metadata !== null) {
      this.mirror.recordTick(this._metadata.sessionId, entry);
    }
  }

  writeCommand(command: RecordedCommand): void {
    this.memory.writeCommand(command);
    if (this.mirror !== null && this._metadata !== null) {
      this.mirror.recordCommand(this._metadata.sessionId, command);
    }
  }

  writeCommandExecution(execution: CommandExecutionResult): void {
    this.memory.writeCommandExecution(execution);
    if (this.mirror !== null && this._metadata !== null) {
      this.mirror.recordExecution(this._metadata.sessionId, execution);
    }
  }

  writeTickFailure(failure: TickFailure): void {
    this.memory.writeTickFailure(failure);
    if (this.mirror !== null && this._metadata !== null) {
      this.mirror.recordFailure(this._metadata.sessionId, failure);
    }
  }

  writeSnapshot(entry: SessionSnapshotEntry): void {
    this.memory.writeSnapshot(entry);
    if (this.mirror !== null && this._metadata !== null) {
      // First writeSnapshot is the initial snapshot (recorder writes it
      // at tick === metadata.startTick immediately after open()).
      // Use this snapshot to populate the IDB session_meta row.
      if (!this._initialSnapshotWritten) {
        this._initialSnapshotWritten = true;
        this.mirror.recordMeta(this._metadata.sessionId, this._metadata, entry.snapshot);
      } else {
        this.mirror.recordSnapshot(this._metadata.sessionId, entry);
      }
    }
  }

  writeMarker(marker: Marker): void {
    this.memory.writeMarker(marker);
    if (this.mirror !== null && this._metadata !== null) {
      this.mirror.recordMarker(this._metadata.sessionId, marker);
    }
  }

  writeAttachment(descriptor: AttachmentDescriptor, data: Uint8Array): AttachmentDescriptor {
    const finalDescriptor = this.memory.writeAttachment(descriptor, data);
    if (this.mirror !== null && this._metadata !== null) {
      // Persist bytes only when descriptor is sidecar-stored (otherwise
      // dataUrl carries them in the descriptor itself).
      const isSidecar = 'sidecar' in finalDescriptor.ref;
      this.mirror.recordAttachment(
        this._metadata.sessionId,
        finalDescriptor,
        isSidecar ? data : null,
      );
    }
    return finalDescriptor;
  }

  close(): void {
    this.memory.close();
    // RecordingService.stop() awaits markClosed separately; close() stays sync.
  }

  // SessionSource — forwarded.
  get metadata(): SessionMetadata {
    return this.memory.metadata;
  }
  readSnapshot(tick: number): WorldSnapshot {
    return this.memory.readSnapshot(tick);
  }
  readSidecar(id: string): Uint8Array {
    return this.memory.readSidecar(id);
  }
  ticks(): IterableIterator<SessionTickEntry> {
    return this.memory.ticks();
  }
  commands(): IterableIterator<RecordedCommand> {
    return this.memory.commands();
  }
  executions(): IterableIterator<CommandExecutionResult> {
    return this.memory.executions();
  }
  failures(): IterableIterator<TickFailure> {
    return this.memory.failures();
  }
  markers(): IterableIterator<Marker> {
    return this.memory.markers();
  }
  attachments(): IterableIterator<AttachmentDescriptor> {
    return this.memory.attachments();
  }
  toBundle(): SessionBundle {
    return this.memory.toBundle();
  }
}

export interface RecordingService {
  start(): Promise<void>;
  isRecording(): boolean;
  stop(): Promise<void>;
  addMarker(input: Omit<NewMarker, 'data'> & { data?: AoeMarkerData }): string;
  attachScreenshot(pngBytes: Uint8Array): string;
  bundle(): SessionBundle | null;
  markers(): readonly Marker[];
  exportBundle(): Promise<Blob>;
  listPriorSessions(): Promise<readonly PriorSessionDescriptor[]>;
  exportPriorSession(sessionId: string): Promise<Blob>;
  discardPriorSession(sessionId: string): Promise<void>;
  onPersistenceError(listener: PersistenceErrorListener): () => void;
}

export function createRecordingService(config: RecordingServiceConfig): RecordingService {
  const memorySink = new MemorySink({ allowSidecar: true });
  const persistenceListeners = new Set<PersistenceErrorListener>();
  const emitPersistenceError = (err: Error): void => {
    for (const listener of persistenceListeners) {
      try { listener(err); } catch { /* listener error swallowed */ }
    }
  };

  const mirror: IndexedDBMirror | null = config.inMemoryOnly
    ? null
    : new IndexedDBMirror({
        databaseName: config.databaseName,
        onPersistenceError: emitPersistenceError,
      });

  const teeSink = new TeeSink(memorySink, mirror);

  let recorder: SessionRecorder | null = null;
  let started = false;
  let sessionId: string | null = null;

  return {
    async start(): Promise<void> {
      if (started) return;
      // Open the IDB connection BEFORE constructing the recorder so any
      // open failures surface as start() rejections rather than
      // mid-session toasts. inMemoryOnly skips this entirely.
      if (mirror !== null) {
        try {
          await mirror.open();
        } catch (err) {
          // Allow the recording service to continue without persistence
          // (Safari private mode etc.). Emit the error to listeners and
          // proceed with MemorySink only.
          emitPersistenceError(err instanceof Error ? err : new Error(String(err)));
        }
      }
      recorder = new SessionRecorder({
        world: config.world,
        sink: teeSink,
        sourceKind: 'session',
        sourceLabel: config.sourceLabel ?? `aoe2-session-${new Date().toISOString()}`,
        snapshotInterval: config.snapshotInterval ?? 1000,
      });
      recorder.connect();
      if (recorder.lastError) {
        const err = recorder.lastError;
        try { recorder.disconnect(); } catch { /* best effort */ }
        recorder = null;
        throw err;
      }
      sessionId = recorder.sessionId;
      started = true;
    },

    isRecording(): boolean {
      return started && recorder !== null;
    },

    async stop(): Promise<void> {
      if (!started) return;
      started = false;
      // Capture finalized metadata BEFORE disconnect — toBundle is still
      // safe pre-disconnect, and disconnect may write a terminal snapshot.
      let finalMetadata: SessionMetadata | null = null;
      if (recorder !== null) {
        try {
          finalMetadata = (recorder.toBundle() as SessionBundle).metadata;
        } catch { /* best-effort */ }
        try { recorder.disconnect(); } catch { /* best effort */ }
        // After disconnect, toBundle reflects the terminal snapshot too.
        // Refresh metadata so endTick covers the disconnect-time tick.
        try {
          finalMetadata = (recorder.toBundle() as SessionBundle).metadata;
        } catch { /* best-effort */ }
      }
      if (mirror !== null && sessionId !== null && !mirror.isDisabled()) {
        try {
          await mirror.flushAll();
          // impl-1 fix (Codex MAJOR): write the finalized metadata
          // back to IDB so listSessions / exportPriorSession see the
          // real endTick / durationTicks instead of the stuck-at-start
          // values written at recordMeta time.
          if (finalMetadata !== null) {
            await mirror.updateMeta(sessionId, finalMetadata);
          }
          await mirror.markClosed(sessionId);
        } catch (err) {
          // Best-effort: log + emit but don't throw. The session_meta
          // row stays at closed: false (will surface as "session ended
          // abnormally" in MarkerListPanel's prior-sessions section).
          emitPersistenceError(err instanceof Error ? err : new Error(String(err)));
        }
      }
      recorder = null;
      sessionId = null;
    },

    addMarker(input): string {
      if (!recorder) throw new Error('RecordingService.addMarker: not started');
      return recorder.addMarker(input as NewMarker);
    },

    attachScreenshot(pngBytes: Uint8Array): string {
      if (!recorder) throw new Error('RecordingService.attachScreenshot: not started');
      return recorder.attach({ mime: 'image/png', data: pngBytes });
    },

    bundle(): SessionBundle | null {
      if (!recorder) return null;
      return recorder.toBundle() as SessionBundle;
    },

    markers(): readonly Marker[] {
      if (!recorder) return [];
      // Per DESIGN §5: tick-desc order. memorySink.markers() returns an
      // IterableIterator over push-order; collect + sort here so the
      // MarkerListPanel consumer doesn't have to.
      const all: Marker[] = [];
      for (const m of memorySink.markers()) all.push(m);
      return all.sort((a, b) => b.tick - a.tick);
    },

    async exportBundle(): Promise<Blob> {
      if (!recorder) throw new Error('RecordingService.exportBundle: not started');
      const bundle = recorder.toBundle() as SessionBundle;
      return reembedBundle(bundle, (id) => memorySink.readSidecar(id));
    },

    async listPriorSessions(): Promise<readonly PriorSessionDescriptor[]> {
      if (mirror === null) return [];
      const all = await mirror.listSessions();
      return all.filter((s) => s.sessionId !== sessionId);
    },

    async exportPriorSession(priorId: string): Promise<Blob> {
      if (mirror === null) {
        throw new SessionNotFoundError(priorId);
      }
      const bundle = await mirror.reconstructBundle(priorId);
      return reembedBundle(bundle, async (id) => {
        const bytes = await mirror.readAttachmentBytes(priorId, id);
        if (bytes === null) {
          throw new Error(`exportPriorSession: attachment ${id} bytes not found in IDB`);
        }
        return bytes;
      });
    },

    async discardPriorSession(priorId: string): Promise<void> {
      if (mirror === null) throw new SessionNotFoundError(priorId);
      if (priorId === sessionId) {
        throw new Error(
          'RecordingService.discardPriorSession: cannot discard the current session; call stop() first',
        );
      }
      await mirror.discard(priorId);
    },

    onPersistenceError(listener: PersistenceErrorListener): () => void {
      persistenceListeners.add(listener);
      return () => {
        persistenceListeners.delete(listener);
      };
    },
  };
}

// Per DESIGN §5: re-embedding procedure converts sidecar-stored
// attachments to dataUrl-embedded ones so the exported JSON Blob is
// self-contained.
async function reembedBundle(
  bundle: SessionBundle,
  readBytes: (id: string) => Uint8Array | Promise<Uint8Array>,
): Promise<Blob> {
  const rewritten = { ...bundle, attachments: [...bundle.attachments] };
  for (let i = 0; i < rewritten.attachments.length; i += 1) {
    const desc = rewritten.attachments[i];
    if ('dataUrl' in desc.ref) continue;
    if ('sidecar' in desc.ref) {
      const bytes = await readBytes(desc.id);
      const b64 = bytesToBase64(bytes);
      rewritten.attachments[i] = {
        id: desc.id,
        mime: desc.mime,
        sizeBytes: desc.sizeBytes,
        ref: { dataUrl: `data:${desc.mime};base64,${b64}` },
      };
    }
  }
  const json = JSON.stringify(rewritten);
  return new Blob([json], { type: 'application/json' });
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  // Node fallback for vitest tests in node env.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Buffer } = require('node:buffer') as { Buffer: typeof globalThis.Buffer };
  return Buffer.from(bytes).toString('base64');
}
