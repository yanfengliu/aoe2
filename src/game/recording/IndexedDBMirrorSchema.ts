// Spec 2 (annotation-ui v0.1.5): schema constants, IDB row shapes, public
// config/descriptor types, and the pending-write buffer helpers backing
// IndexedDBMirror.

import type {
  AttachmentDescriptor,
  CommandExecutionResult,
  Marker,
  RecordedCommand,
  SessionMetadata,
  SessionSnapshotEntry,
  SessionTickEntry,
  TickFailure,
  WorldSnapshot,
} from 'civ-engine';

export const DB_NAME_DEFAULT = 'aoe2-sessions';
export const DB_VERSION = 1;

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

export interface SessionMetaRow {
  readonly sessionId: string;
  readonly schemaVersion: number;
  readonly metadata: SessionMetadata;
  readonly initialSnapshot: WorldSnapshot;
  readonly createdAt: string;
  closed: boolean;
}

export interface AttachmentRow {
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
export interface PendingWrites {
  metaUpdates: Map<string, SessionMetaRow>;
  ticks: Array<{ sessionId: string; entry: SessionTickEntry }>;
  commands: Array<{ sessionId: string; cmd: RecordedCommand }>;
  executions: Array<{ sessionId: string; exec: CommandExecutionResult; sequence: number }>;
  failures: Array<{ sessionId: string; failure: TickFailure }>;
  snapshots: Array<{ sessionId: string; snapshot: SessionSnapshotEntry }>;
  markers: Array<{ sessionId: string; marker: Marker }>;
  attachments: Array<{ sessionId: string; descriptor: AttachmentDescriptor; bytes: Uint8Array | null }>;
}

export const emptyPending = (): PendingWrites => ({
  metaUpdates: new Map(),
  ticks: [],
  commands: [],
  executions: [],
  failures: [],
  snapshots: [],
  markers: [],
  attachments: [],
});

export function isEmpty(p: PendingWrites): boolean {
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
