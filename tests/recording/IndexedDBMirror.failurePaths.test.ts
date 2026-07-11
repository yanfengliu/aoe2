// Full-review iter-2 (Codex H3): the flush requeue must be a SINGLE idempotent
// path. An unhandled IDB request error fires tx.onerror AND tx.onabort (double
// requeue), and a synchronous throw from db.transaction()/applyPendingWrites()
// fired neither handler (silent batch drop). These cover both — separate file
// so tests/recording/IndexedDBMirror.test.ts stays under the 500-LOC cap.

import 'fake-indexeddb/auto';
import { describe, expect, it, afterEach, vi } from 'vitest';
import type { SessionMetadata, SessionTickEntry, WorldSnapshot } from 'civ-engine';

import { IndexedDBMirror } from '../../src/game/recording/IndexedDBMirror';

let dbCounter = 0;
const uniqueDbName = (): string => `aoe2-fail-${++dbCounter}-${Date.now()}`;
const mirrors: IndexedDBMirror[] = [];
const newMirror = (): IndexedDBMirror => {
  const m = new IndexedDBMirror({ databaseName: uniqueDbName(), flushDebounceMs: 0 });
  mirrors.push(m);
  return m;
};

const stubMetadata = (sessionId: string): SessionMetadata =>
  ({
    schemaVersion: 1,
    sessionId,
    recordedAt: new Date().toISOString(),
    engineVersion: '0.8.11',
    nodeVersion: 'test',
    sourceKind: 'session',
    startTick: 0,
    endTick: 0,
    persistedEndTick: 0,
    durationTicks: 0,
  }) as SessionMetadata;

const stubSnapshot = (): WorldSnapshot =>
  ({
    version: 5,
    config: { gridWidth: 4, gridHeight: 4, tps: 30, positionKey: 'position' },
    components: [],
    tick: 0,
    resources: [],
    state: {},
    rngState: 'test-rng',
  }) as unknown as WorldSnapshot;

const stubTick = (tick: number): SessionTickEntry =>
  ({ tick, events: [], metrics: { durationMs: { total: 0 } } }) as unknown as SessionTickEntry;

afterEach(async () => {
  while (mirrors.length > 0) {
    try {
      await mirrors.pop()!.close();
    } catch {
      /* best effort */
    }
  }
});

describe('IndexedDBMirror — flush failure is a single idempotent path (H3 iter-2)', () => {
  it('requeues once when both tx.onerror and tx.onabort fire', async () => {
    const mirror = newMirror();
    await mirror.open();
    mirror.recordMeta('s1', stubMetadata('s1'), stubSnapshot());
    mirror.recordTick('s1', stubTick(0));

    const requeueSpy = vi.spyOn(mirror as unknown as { _requeuePending: () => void }, '_requeuePending');
    const db = (mirror as unknown as { _db: IDBDatabase })._db;
    let capturedTx: IDBTransaction | null = null;
    const realTransaction = db.transaction.bind(db);
    (db as unknown as { transaction: IDBDatabase['transaction'] }).transaction = ((
      ...args: Parameters<IDBDatabase['transaction']>
    ) => {
      const tx = realTransaction(...args);
      capturedTx = tx;
      return tx;
    }) as IDBDatabase['transaction'];

    const flush = mirror.flushAll();
    // Simulate an unhandled request error: onerror then, as the tx aborts, onabort.
    capturedTx!.onerror?.(new Event('error'));
    capturedTx!.onabort?.(new Event('abort'));
    await expect(flush).rejects.toBeDefined();

    expect(requeueSpy).toHaveBeenCalledTimes(1);
  });

  it('does not drop the batch when the transaction throws synchronously', async () => {
    const mirror = newMirror();
    await mirror.open();
    mirror.recordMeta('s1', stubMetadata('s1'), stubSnapshot());
    mirror.recordTick('s1', stubTick(0));
    mirror.recordTick('s1', stubTick(1));

    const db = (mirror as unknown as { _db: IDBDatabase })._db;
    const realTransaction = db.transaction.bind(db);
    (db as unknown as { transaction: unknown }).transaction = () => {
      throw new Error('synchronous transaction failure');
    };

    await expect(mirror.flushAll()).rejects.toThrow('synchronous transaction failure');

    // The batch must have been requeued — a later (working) flush persists it.
    (db as unknown as { transaction: IDBDatabase['transaction'] }).transaction =
      realTransaction as IDBDatabase['transaction'];
    await mirror.flushAll();
    const bundle = await mirror.reconstructBundle('s1');
    expect(bundle.ticks.map((t) => t.tick)).toEqual([0, 1]);
  });
});

describe('IndexedDBMirror — listSessions repairs a crash-recovered endTick (H4 iter-2)', () => {
  it('reports the true endTick for an unclosed session with recorded ticks', async () => {
    const mirror = newMirror();
    mirror.recordMeta('s1', stubMetadata('s1'), stubSnapshot());
    mirror.recordTick('s1', stubTick(0));
    mirror.recordTick('s1', stubTick(7));
    await mirror.flushAll();
    // No markClosed() -> a crash; session_meta.endTick stays frozen at 0.

    const sessions = await mirror.listSessions();
    const s1 = sessions.find((s) => s.sessionId === 's1')!;
    expect(s1.closedNormally).toBe(false);
    // Repaired from the persisted ticks (was 0), so the marker panel's Replay
    // gate `!closedNormally && endTick === startTick` no longer blocks it.
    expect(s1.endTick).toBe(7);
    expect(s1.endTick === s1.startTick).toBe(false);
  });
});
