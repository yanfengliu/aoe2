// Spec 2 (annotation-ui v0.1.5) AO-7c: read / restore / list path for
// IndexedDBMirror — reconstructing a SessionBundle and enumerating prior
// sessions from the per-stream stores.

import type {
  CommandExecutionResult,
  Marker,
  RecordedCommand,
  SessionBundle,
  SessionSnapshotEntry,
  SessionTickEntry,
  TickFailure,
} from 'civ-engine';
import { SESSION_BUNDLE_SCHEMA_VERSION } from 'civ-engine';

import {
  IncompleteSessionError,
  SchemaMismatchError,
  SessionNotFoundError,
} from './IndexedDBMirrorErrors';
import {
  _countByPrefix,
  _read,
  _readAll,
  _readAllByPrefix,
} from './IndexedDBMirrorQueries';
import {
  STORE_NAMES,
  type AttachmentRow,
  type PriorSessionDescriptor,
  type SessionMetaRow,
} from './IndexedDBMirrorSchema';

/** AO-7c: list all sessions in IDB with descriptor metadata. */
export async function listSessions(
  db: IDBDatabase,
): Promise<readonly PriorSessionDescriptor[]> {
  const metaRows = await _readAll<SessionMetaRow>(db, STORE_NAMES.meta);
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
    const markerCount = await _countByPrefix(db, STORE_NAMES.markers, row.sessionId);
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
export async function reconstructBundle(
  db: IDBDatabase,
  sessionId: string,
): Promise<SessionBundle> {
  const metaRow = await _read<SessionMetaRow>(db, STORE_NAMES.meta, sessionId);
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
  const ticks = (await _readAllByPrefix<{ sessionId: string; tick: number; entry: SessionTickEntry }>(db, STORE_NAMES.ticks, sessionId))
    .sort((a, b) => a.tick - b.tick)
    .map((r) => r.entry);

  const commands = (await _readAllByPrefix<{ sessionId: string; sequence: number; cmd: RecordedCommand }>(db, STORE_NAMES.commands, sessionId))
    .sort((a, b) => a.sequence - b.sequence)
    .map((r) => r.cmd);

  const executions = (await _readAllByPrefix<{ sessionId: string; sequence: number; exec: CommandExecutionResult }>(db, STORE_NAMES.executions, sessionId))
    .sort((a, b) => a.sequence - b.sequence)
    .map((r) => r.exec);

  const failures = (await _readAllByPrefix<{ sessionId: string; tick: number; failure: TickFailure }>(db, STORE_NAMES.failures, sessionId))
    .sort((a, b) => a.tick - b.tick)
    .map((r) => r.failure);

  const snapshots = (await _readAllByPrefix<{ sessionId: string; tick: number; snapshot: SessionSnapshotEntry }>(db, STORE_NAMES.snapshots, sessionId))
    .sort((a, b) => a.tick - b.tick)
    .map((r) => r.snapshot);

  const markers = (await _readAllByPrefix<{ sessionId: string; markerId: string; marker: Marker }>(db, STORE_NAMES.markers, sessionId))
    .sort((a, b) => {
      if (a.marker.tick !== b.marker.tick) return a.marker.tick - b.marker.tick;
      return a.markerId.localeCompare(b.markerId);
    })
    .map((r) => r.marker);

  const attachmentRows = await _readAllByPrefix<AttachmentRow>(
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

/** AO-7d: read sidecar attachment bytes by id. */
export function readAttachmentBytes(
  db: IDBDatabase,
  sessionId: string,
  attachmentId: string,
): Promise<Uint8Array | null> {
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
        _read<SessionMetaRow>(db, STORE_NAMES.meta, sessionId)
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
