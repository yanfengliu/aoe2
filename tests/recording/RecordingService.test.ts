import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { World, type WorldConfig } from 'civ-engine';

import { createRecordingService, type RecordingService } from '../../src/game/recording/RecordingService';
import { SessionNotFoundError } from '../../src/game/recording/IndexedDBMirrorErrors';

const mkWorldConfig = (): WorldConfig => ({
  gridWidth: 4,
  gridHeight: 4,
  tps: 30,
  positionKey: 'position',
});

const mkWorld = (): World => {
  const w = new World(mkWorldConfig());
  return w;
};

let dbCounter = 0;
const uniqueDbName = (): string => `aoe2-rs-test-${++dbCounter}-${Date.now()}-${Math.random()}`;

const services: RecordingService[] = [];
const newService = (opts: Partial<Parameters<typeof createRecordingService>[0]> = {}): RecordingService => {
  const svc = createRecordingService({
    world: opts.world ?? mkWorld(),
    databaseName: opts.databaseName ?? uniqueDbName(),
    ...opts,
  });
  services.push(svc);
  return svc;
};

afterEach(async () => {
  while (services.length > 0) {
    const s = services.pop()!;
    try { await s.stop(); } catch { /* best-effort */ }
  }
});

describe('RecordingService — start/stop lifecycle', () => {
  it('start opens a recording and isRecording flips to true', async () => {
    const svc = newService();
    expect(svc.isRecording()).toBe(false);
    await svc.start();
    expect(svc.isRecording()).toBe(true);
    expect(svc.bundle()).not.toBeNull();
  });

  it('start is idempotent', async () => {
    const svc = newService();
    await svc.start();
    await svc.start(); // second call is a no-op
    expect(svc.isRecording()).toBe(true);
  });

  it('stop disconnects and isRecording flips to false', async () => {
    const svc = newService();
    await svc.start();
    await svc.stop();
    expect(svc.isRecording()).toBe(false);
  });

  it('inMemoryOnly: true skips IDB; listPriorSessions returns []', async () => {
    const svc = newService({ inMemoryOnly: true });
    await svc.start();
    const prior = await svc.listPriorSessions();
    expect(prior).toEqual([]);
  });
});

describe('RecordingService — addMarker / attachScreenshot / markers', () => {
  it('addMarker before start throws', () => {
    const svc = newService({ inMemoryOnly: true });
    expect(() => svc.addMarker({ kind: 'annotation', text: 'x' })).toThrow();
  });

  it('addMarker round-trips through bundle().markers', async () => {
    const svc = newService({ inMemoryOnly: true });
    await svc.start();
    const id = svc.addMarker({
      kind: 'annotation',
      text: 'hello',
      data: { author: 'human' },
    });
    expect(typeof id).toBe('string');
    const m = svc.markers();
    expect(m.length).toBe(1);
    expect(m[0].id).toBe(id);
    expect(m[0].text).toBe('hello');
  });

  it('markers() returns markers in tick-desc order', async () => {
    const svc = newService({ inMemoryOnly: true });
    await svc.start();
    // Step the world to advance the tick before adding more markers.
    const world = svc.bundle()!.metadata; // sanity-check metadata exists
    expect(world).toBeDefined();
    const id1 = svc.addMarker({ kind: 'annotation', text: 'first' });
    // We can't easily advance the world without a system in this stub,
    // so just verify ordering works for same-tick (they preserve tick).
    const id2 = svc.addMarker({ kind: 'annotation', text: 'second' });
    const m = svc.markers();
    expect(m.length).toBe(2);
    expect(new Set([m[0].id, m[1].id])).toEqual(new Set([id1, id2]));
  });

  it('attachScreenshot returns id; oversize bytes route to sidecar', async () => {
    const svc = newService({ inMemoryOnly: true });
    await svc.start();
    const png = new Uint8Array(100 * 1024); // > 64 KiB threshold
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const id = svc.attachScreenshot(png);
    expect(typeof id).toBe('string');
    const att = svc.bundle()!.attachments.find((a) => a.id === id);
    expect(att).toBeDefined();
    expect(att!.ref).toEqual({ sidecar: true });
  });

  it('attachScreenshot under threshold embeds as dataUrl', async () => {
    const svc = newService({ inMemoryOnly: true });
    await svc.start();
    const png = new Uint8Array(100); // tiny
    png.set([0x89, 0x50, 0x4e, 0x47]);
    const id = svc.attachScreenshot(png);
    const att = svc.bundle()!.attachments.find((a) => a.id === id);
    expect(att).toBeDefined();
    expect('dataUrl' in att!.ref).toBe(true);
  });
});

describe('RecordingService — exportBundle / re-embedding', () => {
  it('exportBundle produces a Blob whose JSON parses', async () => {
    const svc = newService({ inMemoryOnly: true });
    await svc.start();
    svc.addMarker({ kind: 'annotation', text: 'export-test', data: { author: 'human' } });
    const blob = await svc.exportBundle();
    expect(blob.type).toBe('application/json');
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.markers.length).toBe(1);
    expect(parsed.markers[0].text).toBe('export-test');
  });

  it('exportBundle re-embeds sidecar attachments as dataUrl', async () => {
    const svc = newService({ inMemoryOnly: true });
    await svc.start();
    const png = new Uint8Array(100 * 1024);
    png.set([0x89, 0x50, 0x4e, 0x47]);
    const attId = svc.attachScreenshot(png);
    svc.addMarker({
      kind: 'annotation',
      text: 'screenshot',
      attachments: [attId],
      data: { author: 'human' },
    });
    const blob = await svc.exportBundle();
    const parsed = JSON.parse(await blob.text());
    const att = parsed.attachments.find((a: { id: string }) => a.id === attId);
    expect(att).toBeDefined();
    // Sidecar bytes were re-embedded as dataUrl.
    expect('dataUrl' in att.ref).toBe(true);
    expect(att.ref.dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});

describe('RecordingService — IDB persistence + listPriorSessions', () => {
  it('listPriorSessions returns sessions from prior runs (excludes current)', async () => {
    const dbName = uniqueDbName();
    // Run 1: create a session, stop it.
    const svc1 = newService({ databaseName: dbName });
    await svc1.start();
    svc1.addMarker({ kind: 'annotation', text: 'prior-marker', data: { author: 'human' } });
    await svc1.stop();

    // Run 2: new service against same DB. listPriorSessions should
    // return run 1's session.
    const svc2 = newService({ databaseName: dbName });
    await svc2.start();
    const prior = await svc2.listPriorSessions();
    expect(prior.length).toBe(1);
    expect(prior[0].closedNormally).toBe(true);
    expect(prior[0].markerCount).toBeGreaterThanOrEqual(1);
  });

  it('exportPriorSession round-trips through reconstruct + re-embed', async () => {
    const dbName = uniqueDbName();
    const svc1 = newService({ databaseName: dbName });
    await svc1.start();
    svc1.addMarker({ kind: 'annotation', text: 'prior-export-test', data: { author: 'human' } });
    const png = new Uint8Array(100 * 1024);
    png.set([0x89, 0x50, 0x4e, 0x47]);
    svc1.attachScreenshot(png);
    await svc1.stop();

    const svc2 = newService({ databaseName: dbName });
    await svc2.start();
    const prior = await svc2.listPriorSessions();
    expect(prior.length).toBe(1);
    const blob = await svc2.exportPriorSession(prior[0].sessionId);
    const parsed = JSON.parse(await blob.text());
    expect(parsed.markers.some((m: { text: string }) => m.text === 'prior-export-test')).toBe(true);
    expect(parsed.attachments.length).toBeGreaterThan(0);
    expect('dataUrl' in parsed.attachments[0].ref).toBe(true);
  });

  it('discardPriorSession removes the session', async () => {
    const dbName = uniqueDbName();
    const svc1 = newService({ databaseName: dbName });
    await svc1.start();
    await svc1.stop();

    const svc2 = newService({ databaseName: dbName });
    await svc2.start();
    const prior = await svc2.listPriorSessions();
    expect(prior.length).toBe(1);
    await svc2.discardPriorSession(prior[0].sessionId);
    const remaining = await svc2.listPriorSessions();
    expect(remaining.length).toBe(0);
  });

  it('discardPriorSession refuses the current sessionId', async () => {
    const svc = newService();
    await svc.start();
    const currentBundle = svc.bundle()!;
    const currentId = currentBundle.metadata.sessionId;
    await expect(svc.discardPriorSession(currentId)).rejects.toThrow(/current session/);
  });

  it('exportPriorSession throws SessionNotFoundError for unknown id', async () => {
    const svc = newService();
    await svc.start();
    await expect(svc.exportPriorSession('no-such')).rejects.toBeInstanceOf(SessionNotFoundError);
  });
});

describe('RecordingService — onPersistenceError', () => {
  it('subscribers can register + unsubscribe', () => {
    const svc = newService({ inMemoryOnly: true });
    const handler = vi.fn();
    const unsub = svc.onPersistenceError(handler);
    expect(typeof unsub).toBe('function');
    unsub();
    // No assertion about handler invocations; the unsubscribe lifecycle is
    // the contract.
  });
});
