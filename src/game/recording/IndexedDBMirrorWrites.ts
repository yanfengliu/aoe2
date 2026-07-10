// Spec 2 (annotation-ui v0.1.5) AO-7b/c/d: write / mirror / prune path for
// IndexedDBMirror — applying the buffered flush transaction, meta
// finalization (updateMeta / markClosed), and session deletion (discard).

import type { SessionMetadata } from 'civ-engine';

import { SessionNotFoundError } from './IndexedDBMirrorErrors';
import { _read } from './IndexedDBMirrorQueries';
import {
  STORE_NAMES,
  type AttachmentRow,
  type PendingWrites,
  type SessionMetaRow,
} from './IndexedDBMirrorSchema';

/** Applies one flush window's buffered writes onto an open readwrite
 *  transaction spanning all 8 stores. Synchronous — callers keep the
 *  transaction alive by invoking this inside the tx's executor. */
export function applyPendingWrites(tx: IDBTransaction, pending: PendingWrites): void {
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
}

/** Replaces only the `metadata` field of an existing session_meta row. */
export function updateMeta(
  db: IDBDatabase,
  sessionId: string,
  metadata: SessionMetadata,
  emitError: (err: Error) => void,
): Promise<void> {
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
      emitError(err);
      reject(err);
    };
  });
}

/** AO-7c: mark a session closed (closedNormally: true). Writes the meta
 *  row immediately and awaits the transaction. */
export function markClosed(
  db: IDBDatabase,
  sessionId: string,
  emitError: (err: Error) => void,
): Promise<void> {
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
      emitError(err);
      reject(err);
    };
  });
}

/** AO-7d: delete a session's rows from all 8 stores. */
export async function discard(
  db: IDBDatabase,
  sessionId: string,
  emitError: (err: Error) => void,
): Promise<void> {
  const metaRow = await _read<SessionMetaRow>(db, STORE_NAMES.meta, sessionId);
  if (!metaRow) throw new SessionNotFoundError(sessionId);
  const stores = Object.values(STORE_NAMES);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      const err = tx.error ?? new Error('discard tx failed');
      emitError(err);
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
