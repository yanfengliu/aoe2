// Connection ownership, overlapping lifecycle calls and snapshot configuration.
// Uses real fake-indexeddb connections and real engine recorders; no browser.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { World } from 'civ-engine';

import { createRecordingService, type RecordingService } from '../../src/game/recording/RecordingService';
import { IndexedDBMirror } from '../../src/game/recording/IndexedDBMirror';

const services: RecordingService[] = [];
const databases: IDBDatabase[] = [];
let databaseCounter = 0;

function service(options: Partial<Parameters<typeof createRecordingService>[0]> = {}) {
  const world = options.world ?? new World({ gridWidth: 4, gridHeight: 4, tps: 30, positionKey: 'position' });
  const recording = createRecordingService({
    world,
    databaseName: `recording-lifecycle-${Date.now()}-${++databaseCounter}`,
    ...options,
  });
  services.push(recording);
  return { recording, world };
}

function watchConnections(): void {
  const open = indexedDB.open.bind(indexedDB);
  vi.spyOn(indexedDB, 'open').mockImplementation((...args) => {
    const request = open(...args);
    request.addEventListener('success', () => {
      databases.push(request.result);
      vi.spyOn(request.result, 'close');
    });
    return request;
  });
}

beforeEach(watchConnections);

afterEach(async () => {
  for (const recording of services.splice(0)) await recording.stop();
  for (const database of databases.splice(0)) database.close();
  vi.restoreAllMocks();
});

describe('RecordingService lifecycle ownership', () => {
  it.each(['list', 'load', 'export', 'discard'] as const)('waits for a lazy prior-session %s open before stop closes its connection', async (operation) => {
    const { recording } = service();
    await recording.start();
    const priorId = recording.bundle()!.metadata.sessionId;
    await recording.stop();
    let entered!: () => void;
    let release!: () => void;
    const opening = new Promise<void>((resolve) => { entered = resolve; });
    const open = vi.mocked(indexedDB.open).getMockImplementation()!;
    vi.mocked(indexedDB.open).mockImplementationOnce((...args) => {
      const request = open(...args);
      request.addEventListener('success', (event) => {
        event.stopImmediatePropagation();
        const success = request.onsuccess!;
        release = () => success.call(request, event);
        entered();
      });
      return request;
    });
    const reading = operation === 'list' ? recording.listPriorSessions()
      : operation === 'load' ? recording.loadPriorSessionBundle(priorId)
        : operation === 'export' ? recording.exportPriorSession(priorId)
          : recording.discardPriorSession(priorId);
    await opening;
    let stopped = false;
    const stopping = recording.stop().then(() => { stopped = true; });
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(stopped).toBe(false);
    } finally {
      release();
      await Promise.all([reading, stopping]);
    }
    expect(stopped).toBe(true);
    expect(databases[1]!.close).toHaveBeenCalledTimes(1);
    const reopened = await recording.listPriorSessions();
    expect(reopened.map((prior) => prior.sessionId)).toEqual(operation === 'discard' ? [] : [priorId]);
  });

  it('finalizes and closes the connection, then lazily reads and exports prior sessions', async () => {
    const { recording, world } = service();
    await recording.start();
    const sessionId = recording.bundle()!.metadata.sessionId;
    recording.addMarker({ kind: 'annotation', text: 'keep this recording' });
    world.step();
    world.step();
    await recording.stop();
    expect(recording.isRecording()).toBe(false);
    expect(databases[0]!.close).toHaveBeenCalledTimes(1);

    const prior = await recording.listPriorSessions();
    expect(databases).toHaveLength(2);
    expect(prior).toHaveLength(1);
    expect(prior[0]).toMatchObject({ sessionId, closedNormally: true, endTick: 2 });
    const bundle = await recording.loadPriorSessionBundle(sessionId);
    expect(bundle.markers[0]!.text).toBe('keep this recording');
    const exported = JSON.parse(await (await recording.exportPriorSession(sessionId)).text());
    expect(exported.metadata.endTick).toBe(2);
    expect(exported.markers[0].text).toBe('keep this recording');
    await recording.stop();
    expect(databases[1]!.close).toHaveBeenCalledTimes(1);
  });

  it('closes after a finalization error without hiding the persistence error', async () => {
    const { recording } = service();
    const error = new Error('cannot finalize this recording');
    const errors: Error[] = [];
    recording.onPersistenceError((received) => errors.push(received));
    await recording.start();
    vi.spyOn(IndexedDBMirror.prototype, 'markClosed').mockRejectedValueOnce(error);
    await recording.stop();
    expect(errors).toContain(error);
    expect(recording.isRecording()).toBe(false);
    expect(databases[0]!.close).toHaveBeenCalledTimes(1);
    expect((await recording.listPriorSessions())[0]!.closedNormally).toBe(false);
  });

  it.each(['registration', 'snapshot'] as const)('releases a failed %s connection and can start a fresh session', async (failure) => {
    const { recording, world } = service();
    vi.spyOn(world, failure === 'registration' ? 'getRegistrationManifest' : 'serialize')
      .mockImplementationOnce(() => { throw new Error(`${failure} unavailable`); });
    await expect(recording.start()).rejects.toThrow(`${failure} unavailable`);
    expect(recording.isRecording()).toBe(false);
    expect(recording.bundle()).toBeNull();
    expect(databases[0]!.close).toHaveBeenCalledTimes(1);
    await recording.start();
    expect(recording.isRecording()).toBe(true);
    recording.addMarker({ kind: 'annotation', text: 'recovered' });
    await recording.stop();
    expect(databases[1]!.close).toHaveBeenCalledTimes(1);
    expect((await recording.listPriorSessions()).some((prior) => prior.closedNormally && prior.markerCount === 1)).toBe(true);
  });

  it('starts a fresh memory and persisted session after stopping the same service', async () => {
    const { recording } = service();
    await recording.start();
    const firstId = recording.bundle()!.metadata.sessionId;
    recording.addMarker({ kind: 'annotation', text: 'first' });
    await recording.stop();
    await recording.start();
    const secondId = recording.bundle()!.metadata.sessionId;
    expect(secondId).not.toBe(firstId);
    expect(recording.markers()).toEqual([]);
    recording.addMarker({ kind: 'annotation', text: 'second' });
    await recording.stop();
    const prior = await recording.listPriorSessions();
    expect(prior.map((entry) => entry.sessionId).sort()).toEqual([firstId, secondId].sort());
    expect((await recording.loadPriorSessionBundle(firstId)).markers[0]!.text).toBe('first');
    expect((await recording.loadPriorSessionBundle(secondId)).markers[0]!.text).toBe('second');
  });

  it('coalesces starts made before the database has opened', async () => {
    const { recording } = service();
    await Promise.all([recording.start(), recording.start()]);
    expect(recording.isRecording()).toBe(true);
    recording.addMarker({ kind: 'annotation', text: 'one recorder' });
    expect(recording.markers()).toHaveLength(1);
  });

  it('honors stop called while start is opening the database', async () => {
    const { recording } = service();
    await Promise.all([recording.start(), recording.stop()]);
    expect(recording.isRecording()).toBe(false);
    expect(databases[0]!.close).toHaveBeenCalledTimes(1);
  });

  it('waits for an outgoing session to finalize before starting the next', async () => {
    const { recording } = service();
    await recording.start();
    const firstId = recording.bundle()!.metadata.sessionId;
    let entered!: () => void;
    let release!: () => void;
    const enteredFlush = new Promise<void>((resolve) => { entered = resolve; });
    const releaseFlush = new Promise<void>((resolve) => { release = resolve; });
    const original = IndexedDBMirror.prototype.flushAll;
    vi.spyOn(IndexedDBMirror.prototype, 'flushAll').mockImplementationOnce(async function (this: IndexedDBMirror) {
      entered();
      await releaseFlush;
      return original.call(this);
    });
    const stopped = recording.stop();
    await enteredFlush;
    const started = recording.start();
    try {
      expect(recording.isRecording()).toBe(false);
    } finally {
      release();
    }
    await Promise.all([stopped, started]);
    expect(recording.isRecording()).toBe(true);
    expect(recording.bundle()!.metadata.sessionId).not.toBe(firstId);
    recording.addMarker({ kind: 'annotation', text: 'new session stays connected' });
    expect(recording.markers()).toHaveLength(1);
  });
});

describe('RecordingService snapshot interval', () => {
  it.each([null, undefined, 250] as const)('preserves interval %s while recording', async (snapshotInterval) => {
    const { recording, world } = service({ inMemoryOnly: true, snapshotInterval });
    await recording.start();
    for (let tick = 0; tick < 1_001; tick += 1) world.step();
    expect(recording.bundle()!.metadata.endTick).toBe(1_001);
    expect(recording.bundle()!.snapshots.map((entry) => entry.tick))
      .toEqual(snapshotInterval === null ? [] : snapshotInterval === undefined ? [1_000] : [250, 500, 750, 1_000]);
  });
});
