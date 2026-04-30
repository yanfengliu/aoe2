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
  IncompleteSessionError,
  SchemaMismatchError,
  SessionNotFoundError,
} from './IndexedDBMirrorErrors';

const DB_NAME_DEFAULT = 'aoe2-sessions';
const DB_VERSION = 1;

// 8 object stores per DESIGN §5. Per-stream stores (vs single-record)
// avoid write amplification: each tick appends one small row instead of
// rewriting the whole bundle.
export const STORE_NAMES = {
  meta: 'session_meta',
  ticks: 'session_ticks',
  commands: 'session_commands',
  executions: 'session_executions',
  failures: 'session_failures',
  snapshots: 'session_snapshots',
  markers: 'session_markers',
  attachments: 'session_attachments',
} as const;

interface SessionMetaRow {
  readonly sessionId: string;
  readonly schemaVersion: number;
  readonly metadata: SessionMetadata;
  readonly initialSnapshot: WorldSnapshot;
  readonly createdAt: string;
  closed: boolean;
}

interface AttachmentRow {
  readonly sessionId: string;
  readonly attachmentId: string;
  readonly descriptor: AttachmentDescriptor;
  readonly bytes: Uint8Array | null;
}

export interface IndexedDBMirrorConfig {
  /** Defaults to 'aoe2-sessions'. Tests pass per-test names for isolation. */
  readonly databaseName?: string;
  /** Subscribed to all IDB write failures (quota exceeded, transaction
   *  abort, schema-version conflicts on open). The HUD wires its toast
   *  here via createApp's RecordingService.onPersistenceError. */
  readonly onPersistenceError?: (err: Error) => void;
  /** Defaults to 100ms. Test code passes 0 + uses fake timers for
   *  deterministic flush testing. */
  readonly flushDebounceMs?: number;
}

export interface PriorSessionDescriptor {
  readonly sessionId: string;
  readonly recordedAt: string;
  readonly startTick: number;
  readonly endTick: number;
  readonly markerCount: number;
  readonly schemaVersion: number;
  readonly closedNormally: boolean;
}

// Pending writes buffered between flushes. Collapsed per-store to keep
// the flush transaction count minimal (one transaction per store with
// pending writes per flush window).
interface PendingWrites {
  metaUpdates: Map<string, SessionMetaRow>;
  ticks: Array<{ sessionId: string; entry: SessionTickEntry }>;
  commands: Array<{ sessionId: string; cmd: RecordedCommand }>;
  executions: Array<{ sessionId: string; exec: CommandExecutionResult; sequence: number }>;
  failures: Array<{ sessionId: string; failure: TickFailure }>;
  snapshots: Array<{ sessionId: string; snapshot: SessionSnapshotEntry }>;
  markers: Array<{ sessionId: string; marker: Marker }>;
  attachments: Array<{ sessionId: string; descriptor: AttachmentDescriptor; bytes: Uint8Array | null }>;
}

const emptyPending = (): PendingWrites => ({
  metaUpdates: new Map(),
  ticks: [],
  commands: [],
  executions: [],
  failures: [],
  snapshots: [],
  markers: [],
  attachments: [],
});

function isEmpty(p: PendingWrites): boolean {
  return (
    p.metaUpdates.size === 0
    && p.ticks.length === 0
    && p.commands.length === 0
    && p.executions.length === 0
    && p.failures.length === 0
    && p.snapshots.length === 0
    && p.markers.length === 0
    && p.attachments.length === 0
  );
}

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
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.meta, 'readwrite');
      const store = tx.objectStore(STORE_NAMES.meta);
      const getReq = store.get(sessionId);
      getReq.onsuccess = () => {
        const row = getReq.result as SessionMetaRow | undefined;
        if (!row) {
          reject(new SessionNotFoundError(sessionId));
          return;
        }
        const updated: SessionMetaRow = { ...row, metadata };
        const putReq = store.put(updated);
        putReq.onerror = () => reject(putReq.error ?? new Error('updateMeta put failed'));
        putReq.onsuccess = () => resolve();
      };
      getReq.onerror = () => reject(getReq.error ?? new Error('updateMeta get failed'));
      tx.onerror = () => {
        const err = tx.error ?? new Error('updateMeta tx failed');
        this._emitError(err);
        reject(err);
      };
    });
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
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.meta, 'readwrite');
      const store = tx.objectStore(STORE_NAMES.meta);
      const getReq = store.get(sessionId);
      getReq.onsuccess = () => {
        const row = getReq.result as SessionMetaRow | undefined;
        if (!row) {
          // No meta yet (e.g., session was never opened) — treat as
          // SessionNotFound so the caller knows.
          reject(new SessionNotFoundError(sessionId));
          return;
        }
        const updated: SessionMetaRow = { ...row, closed: true };
        const putReq = store.put(updated);
        putReq.onerror = () => reject(putReq.error ?? new Error('markClosed put failed'));
        putReq.onsuccess = () => resolve();
      };
      getReq.onerror = () => reject(getReq.error ?? new Error('markClosed get failed'));
      tx.onerror = () => {
        const err = tx.error ?? new Error('markClosed tx failed');
        this._emitError(err);
        reject(err);
      };
    });
  }

  /** AO-7c: list all sessions in IDB with descriptor metadata. Returns
   *  empty array when the mirror is disabled. */
  async listSessions(): Promise<readonly PriorSessionDescriptor[]> {
    if (this._disabled) return [];
    const db = await this._ensureOpen();
    const metaRows = await this._readAll<SessionMetaRow>(db, STORE_NAMES.meta);
    const result: PriorSessionDescriptor[] = [];
    for (const row of metaRows) {
      // impl-1 review fix (Codex MAJOR): use the persisted metadata's
      // endTick directly. RecordingService.stop() finalizes the metadata
      // (writes the final endTick / durationTicks) via updateMeta before
      // markClosed, so by the time a session shows up in listSessions
      // for a SECOND launch, metadata.endTick is correct. For the
      // currently-running session (read mid-flight), endTick reflects
      // whatever the recorder last wrote — caller may see a stale value
      // until stop() finalizes; that's acceptable because mid-flight
      // sessions aren't in the prior-sessions panel anyway (RecordingService
      // filters them out via listPriorSessions).
      const markerCount = await this._countByPrefix(db, STORE_NAMES.markers, row.sessionId);
      result.push({
        sessionId: row.sessionId,
        recordedAt: row.createdAt,
        startTick: row.metadata.startTick,
        endTick: row.metadata.endTick,
        markerCount,
        schemaVersion: row.schemaVersion,
        closedNormally: row.closed,
      });
    }
    // Sort recordedAt desc so most recent surfaces first.
    result.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    return result;
  }

  /** AO-7c: reconstruct a SessionBundle from the per-stream stores.
   *  Throws SessionNotFoundError / SchemaMismatchError / IncompleteSessionError. */
  async reconstructBundle(sessionId: string): Promise<SessionBundle> {
    const db = await this._ensureOpen();
    const metaRow = await this._read<SessionMetaRow>(db, STORE_NAMES.meta, sessionId);
    if (!metaRow) throw new SessionNotFoundError(sessionId);
    if (metaRow.schemaVersion !== SESSION_BUNDLE_SCHEMA_VERSION) {
      throw new SchemaMismatchError(
        sessionId,
        metaRow.schemaVersion,
        SESSION_BUNDLE_SCHEMA_VERSION,
      );
    }
    if (!metaRow.initialSnapshot) {
      throw new IncompleteSessionError(sessionId, 'initial_snapshot_missing');
    }

    // Per DESIGN §5: ticks tick-asc, commands sequence-asc, executions
    // sequence-asc, failures tick-asc, snapshots tick-asc, markers
    // tick-asc-then-markerId-asc.
    const ticks = (await this._readAllByPrefix<{ sessionId: string; tick: number; entry: SessionTickEntry }>(db, STORE_NAMES.ticks, sessionId))
      .sort((a, b) => a.tick - b.tick)
      .map((r) => r.entry);

    const commands = (await this._readAllByPrefix<{ sessionId: string; sequence: number; cmd: RecordedCommand }>(db, STORE_NAMES.commands, sessionId))
      .sort((a, b) => a.sequence - b.sequence)
      .map((r) => r.cmd);

    const executions = (await this._readAllByPrefix<{ sessionId: string; sequence: number; exec: CommandExecutionResult }>(db, STORE_NAMES.executions, sessionId))
      .sort((a, b) => a.sequence - b.sequence)
      .map((r) => r.exec);

    const failures = (await this._readAllByPrefix<{ sessionId: string; tick: number; failure: TickFailure }>(db, STORE_NAMES.failures, sessionId))
      .sort((a, b) => a.tick - b.tick)
      .map((r) => r.failure);

    const snapshots = (await this._readAllByPrefix<{ sessionId: string; tick: number; snapshot: SessionSnapshotEntry }>(db, STORE_NAMES.snapshots, sessionId))
      .sort((a, b) => a.tick - b.tick)
      .map((r) => r.snapshot);

    const markers = (await this._readAllByPrefix<{ sessionId: string; markerId: string; marker: Marker }>(db, STORE_NAMES.markers, sessionId))
      .sort((a, b) => {
        if (a.marker.tick !== b.marker.tick) return a.marker.tick - b.marker.tick;
        return a.markerId.localeCompare(b.markerId);
      })
      .map((r) => r.marker);

    const attachmentRows = await this._readAllByPrefix<AttachmentRow>(
      db,
      STORE_NAMES.attachments,
      sessionId,
    );
    const attachments = attachmentRows.map((r) => r.descriptor);

    // Per-stream readers carry generic <Record<string, unknown>> for
    // commands/executions which is wider than SessionBundle's default
    // <Record<string, never>>. Cast through unknown — the bundle is
    // structurally compatible (we wrote it with a narrower type and
    // are reading it back into the wider one).
    const bundle: SessionBundle = {
      schemaVersion: SESSION_BUNDLE_SCHEMA_VERSION,
      metadata: metaRow.metadata,
      initialSnapshot: metaRow.initialSnapshot,
      ticks: ticks as unknown as SessionBundle['ticks'],
      commands: commands as unknown as SessionBundle['commands'],
      executions: executions as unknown as SessionBundle['executions'],
      failures,
      snapshots,
      markers,
      attachments,
    };
    return bundle;
  }

  /** AO-7d: delete a session's rows from all 8 stores. */
  async discard(sessionId: string): Promise<void> {
    const db = await this._ensureOpen();
    const metaRow = await this._read<SessionMetaRow>(db, STORE_NAMES.meta, sessionId);
    if (!metaRow) throw new SessionNotFoundError(sessionId);
    const stores = Object.values(STORE_NAMES);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        const err = tx.error ?? new Error('discard tx failed');
        this._emitError(err);
        reject(err);
      };
      // session_meta — delete by primary key.
      tx.objectStore(STORE_NAMES.meta).delete(sessionId);
      // Per-stream — open a cursor on the [sessionId, *] range and delete each row.
      for (const storeName of stores.filter((s) => s !== STORE_NAMES.meta)) {
        const store = tx.objectStore(storeName);
        const range = IDBKeyRange.bound([sessionId], [sessionId, '￿']);
        const cursorReq = store.openKeyCursor(range);
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
      }
    });
  }

  /** AO-7d: read sidecar attachment bytes by id. */
  async readAttachmentBytes(
    sessionId: string,
    attachmentId: string,
  ): Promise<Uint8Array | null> {
    const db = await this._ensureOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.attachments, 'readonly');
      const store = tx.objectStore(STORE_NAMES.attachments);
      const req = store.get([sessionId, attachmentId]);
      req.onsuccess = () => {
        const row = req.result as AttachmentRow | undefined;
        if (!row) {
          // Distinguish "session unknown" from "attachment unknown" —
          // caller can choose to handle. We throw on session unknown
          // (consistent with discard / reconstruct) but null on
          // attachment-unknown-within-known-session.
          this._read<SessionMetaRow>(db, STORE_NAMES.meta, sessionId)
            .then((meta) => {
              if (!meta) reject(new SessionNotFoundError(sessionId));
              else resolve(null);
            })
            .catch(reject);
          return;
        }
        resolve(row.bytes);
      };
      req.onerror = () => reject(req.error ?? new Error('readAttachmentBytes failed'));
    });
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
      const stores = Object.values(STORE_NAMES);
      const tx = db.transaction(stores, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        const err = tx.error ?? new Error('flush tx failed');
        this._emitError(err);
        reject(err);
      };
      tx.onabort = () => {
        const err = tx.error ?? new Error('flush tx aborted');
        this._emitError(err);
        reject(err);
      };
      // Apply pending writes.
      for (const row of pending.metaUpdates.values()) {
        tx.objectStore(STORE_NAMES.meta).put(row);
      }
      for (const { sessionId, entry } of pending.ticks) {
        tx.objectStore(STORE_NAMES.ticks).put({ sessionId, tick: entry.tick, entry });
      }
      for (const { sessionId, cmd } of pending.commands) {
        tx.objectStore(STORE_NAMES.commands).put({ sessionId, sequence: cmd.sequence, cmd });
      }
      for (const { sessionId, exec, sequence } of pending.executions) {
        tx.objectStore(STORE_NAMES.executions).put({ sessionId, sequence, exec });
      }
      for (const { sessionId, failure } of pending.failures) {
        tx.objectStore(STORE_NAMES.failures).put({ sessionId, tick: failure.tick, failure });
      }
      for (const { sessionId, snapshot } of pending.snapshots) {
        tx.objectStore(STORE_NAMES.snapshots).put({ sessionId, tick: snapshot.tick, snapshot });
      }
      for (const { sessionId, marker } of pending.markers) {
        tx.objectStore(STORE_NAMES.markers).put({ sessionId, markerId: marker.id, marker });
      }
      for (const { sessionId, descriptor, bytes } of pending.attachments) {
        const row: AttachmentRow = {
          sessionId,
          attachmentId: descriptor.id,
          descriptor,
          bytes,
        };
        tx.objectStore(STORE_NAMES.attachments).put(row);
      }
    });
  }

  private async _ensureOpen(): Promise<IDBDatabase> {
    if (this._db !== null) return this._db;
    await this.open();
    if (this._db === null) {
      throw new Error('IndexedDBMirror.open did not establish a connection');
    }
    return this._db;
  }

  private _read<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error ?? new Error('read failed'));
    });
  }

  private _readAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve((req.result ?? []) as T[]);
      req.onerror = () => reject(req.error ?? new Error('readAll failed'));
    });
  }

  private _readAllByPrefix<T>(
    db: IDBDatabase,
    storeName: string,
    sessionId: string,
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const range = IDBKeyRange.bound([sessionId], [sessionId, '￿']);
      const req = store.getAll(range);
      req.onsuccess = () => resolve((req.result ?? []) as T[]);
      req.onerror = () => reject(req.error ?? new Error('readAllByPrefix failed'));
    });
  }

  private _countByPrefix(
    db: IDBDatabase,
    storeName: string,
    sessionId: string,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const range = IDBKeyRange.bound([sessionId], [sessionId, '￿']);
      const req = store.count(range);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('countByPrefix failed'));
    });
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
