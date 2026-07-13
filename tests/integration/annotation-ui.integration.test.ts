// @vitest-environment jsdom
//
// AO-12.5: Vitest integration suite covering DESIGN §11 cross-component
// scenarios. Constructs RecordingService + IndexedDBMirror + AnnotationForm
// + AnnotationController + MarkerListPanel directly (not through createApp,
// which depends on the browser renderer).
//
// Scenarios:
//   1. Full write flow — Alt+M → form → submit → marker in bundle.
//   2. Persistence flow / refresh recovery — write markers, close + reopen
//      RecordingService against same IDB, listPriorSessions returns the
//      prior session, exportPriorSession produces a valid JSON Blob.
//   3. Schema migration drop — write a session at v0, second instance
//      should reject reconstructBundle with SchemaMismatchError.
//   4. Stale-ref click — write marker referencing entity X, force X to be
//      stale, MarkerListPanel.onRowClick filters and falls back to cell /
//      toast.

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { World, type EntityRef, type WorldConfig } from 'civ-engine';

import { createRecordingService } from '../../src/game/recording/RecordingService';
import { SchemaMismatchError } from '../../src/game/recording/IndexedDBMirrorErrors';
import { createPauseControl } from '../../src/game/control/PauseControl';
import { createAnnotationForm } from '../../src/ui/annotation/AnnotationForm';
import { createAnnotationController } from '../../src/game/recording/AnnotationController';
import { createMarkerListPanel } from '../../src/ui/annotation/MarkerListPanel';
import { STORE_NAMES } from '../../src/game/recording/IndexedDBMirror';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';

const mkConfig = (): WorldConfig => ({
  gridWidth: 10,
  gridHeight: 10,
  tps: 30,
  positionKey: 'position',
});

let dbCounter = 0;
const uniqueDbName = (): string => `aoe2-int-${++dbCounter}-${Date.now()}-${Math.random()}`;

const stubBridge = (overrides: Partial<{
  setPaused: (p: boolean) => void;
  getSelectedEntityRefs: () => readonly EntityRef[];
  panCameraTo: (target: { id: number; generation: number } | { x: number; y: number }) => void;
  select: (refs: readonly EntityRef[]) => void;
}> = {}): SimulationBridge => {
  return {
    setPaused: overrides.setPaused ?? (() => {}),
    getSelectedEntityRefs: overrides.getSelectedEntityRefs ?? (() => []),
    panCameraTo: overrides.panCameraTo ?? (() => {}),
    select: overrides.select ?? (() => {}),
  } as unknown as SimulationBridge;
};

const services: Array<{ stop: () => Promise<void> }> = [];
afterEach(async () => {
  while (services.length > 0) {
    const s = services.pop()!;
    try { await s.stop(); } catch { /* best-effort */ }
  }
});

describe('Integration: full write flow (Alt+M → form → submit → bundle)', () => {
  it('end-to-end marker emission via AnnotationController + form', async () => {
    const dbName = uniqueDbName();
    const world = new World(mkConfig());
    const recording = createRecordingService({ world, databaseName: dbName, inMemoryOnly: true });
    services.push(recording);
    await recording.start();

    const pauseControl = createPauseControl(() => stubBridge());
    const form = createAnnotationForm();
    const host = document.createElement('div');
    document.body.appendChild(host);
    form.mount(host);

    const toast = { showToast: vi.fn() };
    const controller = createAnnotationController({
      recording,
      pauseControl,
      form,
      worldRef: () => world,
      selection: { getSelectedEntityRefs: () => [] },
      captureDataUrlRef: () => null,
      toast,
    });

    // Simulate Alt+M:
    controller.onHotkey();
    expect(form.isOpen()).toBe(true);
    expect(pauseControl.isPaused()).toBe(true);

    // Fill form fields:
    const textArea = host.querySelector<HTMLTextAreaElement>('[data-testid="annotation-form-text"]')!;
    textArea.value = 'integration: pathfinding stuck';
    const bug = host.querySelector<HTMLInputElement>('[data-testid="annotation-form-severity-bug"]')!;
    bug.checked = true;
    const category = host.querySelector<HTMLSelectElement>('[data-testid="annotation-form-category"]')!;
    category.value = 'pathfinding';

    // Submit:
    const formEl = host.querySelector<HTMLFormElement>('form')!;
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(form.isOpen()).toBe(false);
    expect(pauseControl.isPaused()).toBe(false);

    const bundle = recording.bundle()!;
    expect(bundle.markers.length).toBe(1);
    const marker = bundle.markers[0];
    expect(marker.text).toBe('integration: pathfinding stuck');
    expect(marker.kind).toBe('annotation');
    expect(marker.data).toEqual({ author: 'human', severity: 'bug', category: 'pathfinding' });

    controller.dispose();
    form.dispose();
  });

  it('marker.refs.entities populated when selection has entities (refs captured at hotkey time)', async () => {
    const world = new World(mkConfig());
    // Seed an entity so selection has something current.
    const entityId = world.createEntity();
    const ref = world.getEntityRef(entityId)!;

    const recording = createRecordingService({ world, databaseName: uniqueDbName(), inMemoryOnly: true });
    services.push(recording);
    await recording.start();

    let selectedRefs: readonly EntityRef[] = [ref];
    const pauseControl = createPauseControl(() => stubBridge());
    const form = createAnnotationForm();
    const host = document.createElement('div');
    document.body.appendChild(host);
    form.mount(host);
    const toast = { showToast: vi.fn() };
    const controller = createAnnotationController({
      recording,
      pauseControl,
      form,
      worldRef: () => world,
      selection: { getSelectedEntityRefs: () => selectedRefs },
      captureDataUrlRef: () => null,
      toast,
    });

    // Alt+M captures current selection refs.
    controller.onHotkey();

    // Simulate selection-change between hotkey and submit (e.g., AI picked
    // a different unit during the form delay). The marker should still
    // reference the original selection, NOT the new one (FR-1 fix).
    selectedRefs = [];

    const textArea = host.querySelector<HTMLTextAreaElement>('[data-testid="annotation-form-text"]')!;
    textArea.value = 'unit selected at hotkey time';
    const formEl = host.querySelector<HTMLFormElement>('form')!;
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const bundle = recording.bundle()!;
    expect(bundle.markers.length).toBe(1);
    expect(bundle.markers[0].refs?.entities).toEqual([ref]);

    controller.dispose();
    form.dispose();
  });
});

describe('Integration: persistence + refresh recovery', () => {
  it('write markers in session A; reopen as session B; A is in listPriorSessions and exportable', async () => {
    const dbName = uniqueDbName();
    const worldA = new World(mkConfig());
    const recordingA = createRecordingService({ world: worldA, databaseName: dbName });
    services.push(recordingA);
    await recordingA.start();
    recordingA.addMarker({ kind: 'annotation', text: 'A1', data: { author: 'human' } });
    recordingA.addMarker({ kind: 'annotation', text: 'A2', data: { author: 'human' } });
    const sidA = recordingA.bundle()!.metadata.sessionId;
    await recordingA.stop();

    // "Refresh" — new world, new RecordingService over same IDB.
    const worldB = new World(mkConfig());
    const recordingB = createRecordingService({ world: worldB, databaseName: dbName });
    services.push(recordingB);
    await recordingB.start();
    const sidB = recordingB.bundle()!.metadata.sessionId;
    expect(sidB).not.toBe(sidA); // fresh session per ADR 1

    const prior = await recordingB.listPriorSessions();
    expect(prior.length).toBe(1);
    expect(prior[0].sessionId).toBe(sidA);
    expect(prior[0].closedNormally).toBe(true);

    const blob = await recordingB.exportPriorSession(sidA);
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.markers.length).toBe(2);
    expect(parsed.markers.map((m: { text: string }) => m.text).sort()).toEqual(['A1', 'A2']);
  });
});

describe('Integration: schema migration', () => {
  it('reconstructBundle on a stored v0 session throws SchemaMismatchError', async () => {
    const dbName = uniqueDbName();
    const world = new World(mkConfig());
    const recording = createRecordingService({ world, databaseName: dbName });
    services.push(recording);
    await recording.start();

    // Inject a fake old-schema-version session via the underlying IDB
    // connection (the mirror exposes `_db` for testing).
    const mirror = (recording as unknown as { _mirror?: unknown })._mirror as
      | { _db: IDBDatabase; open: () => Promise<void> }
      | undefined;
    // RecordingService doesn't expose the mirror directly. Instead, write
    // through a parallel raw IDB connection (the same DB name). After
    // injection, listPriorSessions on the recording service should surface
    // the bad session, and exportPriorSession should reject.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.meta, 'readwrite');
      tx.objectStore(STORE_NAMES.meta).put({
        sessionId: 'fake-old-schema',
        schemaVersion: 0, // mismatched
        metadata: {
          schemaVersion: 0,
          sessionId: 'fake-old-schema',
          recordedAt: new Date().toISOString(),
          engineVersion: '0.5.0',
          nodeVersion: 'test',
          sourceKind: 'session',
          startTick: 0,
          endTick: 0,
          durationTicks: 0,
        },
        initialSnapshot: { version: 5 } as unknown,
        createdAt: new Date().toISOString(),
        closed: true,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    await expect(recording.exportPriorSession('fake-old-schema')).rejects.toBeInstanceOf(
      SchemaMismatchError,
    );

    expect(mirror).toBeUndefined(); // confirm we used the parallel-conn path
  });
});

describe('Integration: stale-ref click in MarkerListPanel', () => {
  it('marker referencing destroyed-and-respawned entity falls back to cell or toast', async () => {
    const world = new World(mkConfig());
    const recording = createRecordingService({ world, databaseName: uniqueDbName(), inMemoryOnly: true });
    services.push(recording);
    await recording.start();

    const e1 = world.createEntity();
    const refStale = world.getEntityRef(e1)!;
    // Add a marker referencing entity 1 with a cell fallback at (3, 4).
    recording.addMarker({
      kind: 'annotation',
      text: 'pathfinding glitch',
      refs: { entities: [refStale], cells: [{ x: 3, y: 4 }] },
      data: { author: 'human' },
    });

    // Destroy + recreate to bump the generation.
    world.destroyEntity(e1);
    world.createEntity();

    expect(world.isCurrent(refStale)).toBe(false);

    const pauseControl = createPauseControl(() => stubBridge());
    const toast = { showToast: vi.fn() };
    const panCameraTo = vi.fn();
    const select = vi.fn();
    const bridge = stubBridge({ panCameraTo, select });

    const panel = createMarkerListPanel({
      recording,
      pauseControl,
      toast,
      bridge: bridge as unknown as { panCameraTo: (target: { id: number; generation: number } | { x: number; y: number }) => void; select: (refs: readonly EntityRef[]) => void },
      worldRef: () => world,
      autoRefresh: false,
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    panel.mount(host);
    panel.toggleVisibility();

    const row = host.querySelector<HTMLElement>('[data-testid="marker-list-current-row"]')!;
    row.click();

    expect(select).not.toHaveBeenCalled();
    expect(panCameraTo).toHaveBeenCalledWith({ x: 3, y: 4 });

    panel.dispose();
  });

  it('marker with all-stale entity refs and no cell falls back to toast', async () => {
    const world = new World(mkConfig());
    const recording = createRecordingService({ world, databaseName: uniqueDbName(), inMemoryOnly: true });
    services.push(recording);
    await recording.start();

    const e1 = world.createEntity();
    const refStale = world.getEntityRef(e1)!;
    recording.addMarker({
      kind: 'annotation',
      text: 'orphan marker',
      refs: { entities: [refStale] }, // no cells fallback
      data: { author: 'human' },
    });
    world.destroyEntity(e1);
    world.createEntity();

    const pauseControl = createPauseControl(() => stubBridge());
    const toast = { showToast: vi.fn() };
    const bridge = stubBridge();

    const panel = createMarkerListPanel({
      recording,
      pauseControl,
      toast,
      bridge: bridge as unknown as { panCameraTo: (target: { id: number; generation: number } | { x: number; y: number }) => void; select: (refs: readonly EntityRef[]) => void },
      worldRef: () => world,
      autoRefresh: false,
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    panel.mount(host);
    panel.toggleVisibility();

    const row = host.querySelector<HTMLElement>('[data-testid="marker-list-current-row"]')!;
    row.click();

    expect(toast.showToast).toHaveBeenCalledWith('marker target no longer exists in this world');

    panel.dispose();
  });
});
