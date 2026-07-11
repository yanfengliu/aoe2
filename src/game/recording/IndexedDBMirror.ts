// Spec 2 (annotation-ui v0.1.5) AO-7a-d: write-only mirror over a sync
// MemorySink, persisting to IndexedDB asynchronously. Recording lives
// in the recorder's MemorySink (sync, hot-path); this mirror tees the
// writes into IDB on a 100ms-debounced flush queue.
//
// AO-7a: lifecycle (open / close / 8 stores / recordMeta).
// AO-7b: per-stream record* methods + tee + flush queue + flushAll() hook.
// AO-7c: listSessions + reconstructBundle + typed errors.
// AO-7d: discard + readAttachmentBytes + quota error path.

import type {
  AttachmentDescriptor,
  CommandExecutionResult,
  Marker,
  RecordedCommand,
  SessionBundle,
  SessionMetadata,
  SessionSnapshotEntry,
  SessionTickEntry,
  TickFailure,
  WorldSnapshot,
} from 'civ-engine';
import { SESSION_BUNDLE_SCHEMA_VERSION } from 'civ-engine';

import {
  listSessions as listSessionsFromDb,
  readAttachmentBytes as readAttachmentBytesFromDb,
  reconstructBundle as reconstructBundleFromDb,
} from './IndexedDBMirrorReads';
import {
  DB_NAME_DEFAULT,
  DB_VERSION,
  STORE_NAMES,
  emptyPending,
  isEmpty,
  type IndexedDBMirrorConfig,
  type PendingWrites,
  type PriorSessionDescriptor,
} from './IndexedDBMirrorSchema';
import {
  applyPendingWrites,
  discard as discardFromDb,
  markClosed as markClosedInDb,
  updateMeta as updateMetaInDb,
} from './IndexedDBMirrorWrites';

// Public re-exports: these symbols historically resolve from this module
// path and importers (RecordingService, annotation UI, tests) depend on it.
export { STORE_NAMES };
export type { IndexedDBMirrorConfig, PriorSessionDescriptor };

export class IndexedDBMirror {
  private readonly _databaseName: string;
  private readonly _onPersistenceError?: (err: Error) => void;
  private readonly _flushDebounceMs: number;
  private _db: IDBDatabase | null = null;
  private _opening: Promise<void> | null = null;
  private _pending: PendingWrites = emptyPending();
  private _flushTimer: ReturnType<typeof setTimeout> | null = null;
  private _executionSequence = 0;
  // impl-1 review fix (Codex MAJOR / Claude M2): once open() permanently
  // fails (Safari private mode etc.), DROP all subsequent record* writes
  // instead of letting them accumulate in _pending unbounded. The
  // RecordingService treats a disabled mirror as no-IDB-persistence and
  // continues with MemorySink only.
  private _disabled = false;

  constructor(config: IndexedDBMirrorConfig = {}) {
    this._databaseName = config.databaseName ?? DB_NAME_DEFAULT;
    this._onPersistenceError = config.onPersistenceError;
    this._flushDebounceMs = config.flushDebounceMs ?? 100;
  }

  /** Returns true once a permanent open failure has disabled the mirror.
   *  Subsequent record* writes silently drop and the read APIs throw. */
  isDisabled(): boolean {
    return this._disabled;
  }

  /** Opens (or creates) the IDB database. Idempotent — concurrent calls
   *  return the same in-flight promise. On permanent failure, sets
   *  `_disabled = true` so subsequent record* / list / reconstruct calls
   *  short-circuit instead of accumulating unbounded pending writes. */
  open(): Promise<void> {
    if (this._disabled) {
      return Promise.reject(new Error('IndexedDBMirror is disabled (prior open failure)'));
    }
    if (this._db !== null) return Promise.resolve();
    if (this._opening !== null) return this._opening;
    this._opening = new Promise<void>((resolve, reject) => {
      let req: IDBOpenDBRequest;
      try {
        req = indexedDB.open(this._databaseName, DB_VERSION);
      } catch (e) {
        // FR-1 fix (Codex MAJOR): synchronous open failures must also
        // disable the mirror + drop _pending so subsequent record* calls
        // are no-ops instead of accumulating in memory.
        const err = e instanceof Error ? e : new Error(String(e));
        this._opening = null;
        this._disabled = true;
        this._pending = emptyPending();
        this._emitError(err);
        reject(err);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        // session_meta keyed by sessionId
        if (!db.objectStoreNames.contains(STORE_NAMES.meta)) {
          db.createObjectStore(STORE_NAMES.meta, { keyPath: 'sessionId' });
        }
        // Per-stream stores keyed by [sessionId, secondary]
        const compoundKeyStores = [
          { name: STORE_NAMES.ticks, secondary: 'tick' },
          { name: STORE_NAMES.commands, secondary: 'sequence' },
          { name: STORE_NAMES.executions, secondary: 'sequence' },
          { name: STORE_NAMES.failures, secondary: 'tick' },
          { name: STORE_NAMES.snapshots, secondary: 'tick' },
          { name: STORE_NAMES.markers, secondary: 'markerId' },
          { name: STORE_NAMES.attachments, secondary: 'attachmentId' },
        ];
        for (const { name, secondary } of compoundKeyStores) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: ['sessionId', secondary] });
          }
        }
      };
      req.onsuccess = () => {
        this._db = req.result;
        // Surface async aborts (e.g., other tab forces a version upgrade).
        this._db.onversionchange = () => {
          this.close().catch(() => {/* best effort */});
        };
        this._opening = null;
        resolve();
      };
      req.onerror = () => {
        const err = req.error ?? new Error('IndexedDB open failed');
        this._opening = null;
        this._disabled = true;       // impl-1 fix: permanent disable
        this._pending = emptyPending(); // drop accumulated buffer
        this._emitError(err);
        reject(err);
      };
      req.onblocked = () => {
        const err = new Error('IndexedDB open blocked by another tab');
        this._opening = null;
        this._disabled = true;       // impl-1 fix: permanent disable
        this._pending = emptyPending();
        this._emitError(err);
        reject(err);
      };
    });
    return this._opening;
  }

  /** Drains pending writes (best-effort) and closes the connection. */
  async close(): Promise<void> {
    if (this._flushTimer !== null) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    if (!isEmpty(this._pending)) {
      try {
        await this._flushNow();
      } catch (e) {
        // Best-effort drain — the close itself succeeds; the error is
        // already routed through onPersistenceError by _flushNow.
        void e;
      }
    }
    if (this._db !== null) {
      this._db.close();
      this._db = null;
    }
  }

  /** Writes the session_meta row for a new session. Buffered through
   *  the same flush queue as record*. No-op when the mirror is disabled. */
  recordMeta(
    sessionId: string,
    metadata: SessionMetadata,
    initialSnapshot: WorldSnapshot,
  ): void {
    if (this._disabled) return;
    this._pending.metaUpdates.set(sessionId, {
      sessionId,
      schemaVersion: SESSION_BUNDLE_SCHEMA_VERSION,
      metadata,
      initialSnapshot,
      createdAt: new Date().toISOString(),
      closed: false,
    });
    this._scheduleFlush();
  }

  /** impl-1 review fix (Codex MAJOR): update an existing session_meta row's
   *  metadata field — used by RecordingService.stop() to write the
   *  finalized SessionMetadata (with endTick / durationTicks) back into
   *  IDB before markClosed. Without this, listSessions /
   *  exportPriorSession see stale-at-start metadata.
   *
   *  Intentionally does NOT touch initialSnapshot, schemaVersion,
   *  createdAt, or closed — only the metadata object is replaced. */
  async updateMeta(sessionId: string, metadata: SessionMetadata): Promise<void> {
    if (this._disabled) return;
    const db = await this._ensureOpen();
    return updateMetaInDb(db, sessionId, metadata, (err) => this._emitError(err));
  }

  /** AO-7b: per-stream tick / command / execution / failure / snapshot /
   *  marker / attachment writes. Buffered into _pending and flushed in a
   *  100ms-debounced batch. All record* are no-ops when disabled
   *  (impl-1 review M2 — bound _pending growth on permanent open failure). */
  recordTick(sessionId: string, entry: SessionTickEntry): void {
    if (this._disabled) return;
    this._pending.ticks.push({ sessionId, entry });
    this._scheduleFlush();
  }

  recordCommand(sessionId: string, cmd: RecordedCommand): void {
    if (this._disabled) return;
    this._pending.commands.push({ sessionId, cmd });
    this._scheduleFlush();
  }

  recordExecution(sessionId: string, exec: CommandExecutionResult): void {
    if (this._disabled) return;
    // CommandExecutionResult doesn't carry sequence on its own; the
    // mirror stamps a monotonic sequence so the row is keyed deterministically.
    const sequence = ++this._executionSequence;
    this._pending.executions.push({ sessionId, exec, sequence });
    this._scheduleFlush();
  }

  recordFailure(sessionId: string, failure: TickFailure): void {
    if (this._disabled) return;
    this._pending.failures.push({ sessionId, failure });
    this._scheduleFlush();
  }

  recordSnapshot(sessionId: string, snapshot: SessionSnapshotEntry): void {
    if (this._disabled) return;
    this._pending.snapshots.push({ sessionId, snapshot });
    this._scheduleFlush();
  }

  recordMarker(sessionId: string, marker: Marker): void {
    if (this._disabled) return;
    this._pending.markers.push({ sessionId, marker });
    this._scheduleFlush();
  }

  recordAttachment(
    sessionId: string,
    descriptor: AttachmentDescriptor,
    bytes: Uint8Array | null,
  ): void {
    if (this._disabled) return;
    this._pending.attachments.push({ sessionId, descriptor, bytes });
    this._scheduleFlush();
  }

  /** AO-7b test hook: drain pending writes immediately (skip the
   *  100ms-debounce timer). Tests use this with vi.useFakeTimers() to
   *  keep flush behavior deterministic. */
  flushAll(): Promise<void> {
    if (this._flushTimer !== null) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    return this._flushNow();
  }

  /** AO-7c: mark a session closed (closedNormally: true). Writes the
   *  meta row immediately and awaits the transaction. */
  async markClosed(sessionId: string): Promise<void> {
    const db = await this._ensureOpen();
    return markClosedInDb(db, sessionId, (err) => this._emitError(err));
  }

  /** AO-7c: list all sessions in IDB with descriptor metadata. Returns
   *  empty array when the mirror is disabled. */
  async listSessions(): Promise<readonly PriorSessionDescriptor[]> {
    if (this._disabled) return [];
    const db = await this._ensureOpen();
    return listSessionsFromDb(db);
  }

  /** AO-7c: reconstruct a SessionBundle from the per-stream stores.
   *  Throws SessionNotFoundError / SchemaMismatchError / IncompleteSessionError. */
  async reconstructBundle(sessionId: string): Promise<SessionBundle> {
    const db = await this._ensureOpen();
    return reconstructBundleFromDb(db, sessionId);
  }

  /** AO-7d: delete a session's rows from all 8 stores. */
  async discard(sessionId: string): Promise<void> {
    const db = await this._ensureOpen();
    return discardFromDb(db, sessionId, (err) => this._emitError(err));
  }

  /** AO-7d: read sidecar attachment bytes by id. */
  async readAttachmentBytes(
    sessionId: string,
    attachmentId: string,
  ): Promise<Uint8Array | null> {
    const db = await this._ensureOpen();
    return readAttachmentBytesFromDb(db, sessionId, attachmentId);
  }

  // ---------------- internal helpers ----------------

  private _scheduleFlush(): void {
    if (this._flushTimer !== null) return; // already scheduled
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      void this._flushNow();
    }, this._flushDebounceMs);
  }

  private async _flushNow(): Promise<void> {
    if (isEmpty(this._pending)) return;
    const db = this._db ?? (await this._ensureOpen());
    const pending = this._pending;
    this._pending = emptyPending();
    return new Promise((resolve, reject) => {
      // Full-review iter-2 (Codex H3): a SINGLE idempotent settle path. An
      // unhandled IDB request error fires `tx.onerror` AND then, as the tx
      // aborts, `tx.onabort` — so the old code requeued the batch TWICE
      // (unbounded growth under a persistent quota failure). And a synchronous
      // throw from `db.transaction()` / `applyPendingWrites()` fired neither
      // handler, silently dropping the already-detached batch. The `settled`
      // guard + try/catch cover both: requeue + reject exactly once, on the
      // first failure of any kind.
      let settled = false;
      const fail = (err: Error): void => {
        if (settled) return;
        settled = true;
        this._requeuePending(pending);
        this._emitError(err);
        reject(err);
      };
      try {
        const stores = Object.values(STORE_NAMES);
        const tx = db.transaction(stores, 'readwrite');
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        tx.onerror = () => fail(tx.error ?? new Error('flush tx failed'));
        tx.onabort = () => fail(tx.error ?? new Error('flush tx aborted'));
        applyPendingWrites(tx, pending);
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** Full-review H3: a flush transaction can fail (QuotaExceededError, a
   *  transient abort). `_flushNow` detaches `this._pending` BEFORE the tx, so
   *  without this the whole batch was lost — truncating the recording tail or
   *  leaving a gap that later fails replay's contiguity check. Merge the failed
   *  (older) batch back in FRONT of anything that accumulated during the async
   *  transaction so tick/command order is preserved; newer meta wins on key
   *  conflict. Writes are idempotent keyed puts, so a later retry is safe. The
   *  next `recordTick`/`flushAll` re-attempts the flush. */
  private _requeuePending(failed: PendingWrites): void {
    this._pending.ticks = [...failed.ticks, ...this._pending.ticks];
    this._pending.commands = [...failed.commands, ...this._pending.commands];
    this._pending.executions = [...failed.executions, ...this._pending.executions];
    this._pending.failures = [...failed.failures, ...this._pending.failures];
    this._pending.snapshots = [...failed.snapshots, ...this._pending.snapshots];
    this._pending.markers = [...failed.markers, ...this._pending.markers];
    this._pending.attachments = [...failed.attachments, ...this._pending.attachments];
    this._pending.metaUpdates = new Map([
      ...failed.metaUpdates,
      ...this._pending.metaUpdates,
    ]);
  }

  private async _ensureOpen(): Promise<IDBDatabase> {
    if (this._db !== null) return this._db;
    await this.open();
    if (this._db === null) {
      throw new Error('IndexedDBMirror.open did not establish a connection');
    }
    return this._db;
  }

  private _emitError(err: Error): void {
    if (this._onPersistenceError) {
      try {
        this._onPersistenceError(err);
      } catch {
        // Listener errors are swallowed to avoid cascade failures.
      }
    }
  }
}
