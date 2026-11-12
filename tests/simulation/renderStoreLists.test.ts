// The render store hands its views out in list order as two halves, the terrain and everything else, and keeps the
// terrain half sorted between ticks instead of sorting every map cell on every tick (work 150 M2b, rank 1). The
// list must be the list it always was: every view the store holds, ordered by layer, row, column and id. These
// cases hold that against the old sort, kept here as the oracle, through every way an entry changes: a snapshot, a
// created, replaced or destroyed entry of either half, an id reused by another generation, the attack-animation
// reconcile, and a terrain-layer view that is not a tile.
//
// BOUND. Hand-built messages, so the store is held to its own contract and not to what a match produces:
// tests/simulation/renderStateMatchesLegacy.test.ts holds the assembled list at every tick of a real match, and
// renderStateCellsStaySorted.test.ts that the cells are not sorted again.
import type { RenderEntity, RenderServerMessage } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { LayeredVisibilityMap } from '../../src/game/simulation/bridge/layeredVisibilityMap';
import { createRenderStateOps } from '../../src/game/simulation/bridge/renderStateOps';
import { knownProjectedEntityLists } from '../../src/game/simulation/projectedEntityLists';
import { RenderStore } from '../../src/game/simulation/renderStore';
import type { ProjectedEntityView, ProjectedFrameView } from '../../src/game/simulation/types';

type Message = RenderServerMessage<ProjectedEntityView, ProjectedFrameView, null>;
type Entry = RenderEntity<ProjectedEntityView>;

const ENTITY_TYPE: Record<ProjectedEntityView['layer'], ProjectedEntityView['entityType']> = {
  terrain: 'grass', resource: 'tree', building: 'house', unit: 'scout',
};

function entry(id: number, layer: ProjectedEntityView['layer'], x: number, y: number, overrides: Partial<ProjectedEntityView> = {}): Entry {
  const view: ProjectedEntityView = {
    id, generation: 0, kind: layer === 'terrain' ? 'tile' : layer, layer, entityType: ENTITY_TYPE[layer],
    owner: null, x, y, elevation: 0, tint: 0x587f4e, size: 1, footprintWidth: 1, footprintHeight: 1,
    visualVariant: 'default', selected: false, currentHp: null, maxHp: null, isMemory: false, ...overrides,
  };
  return { ref: { id: view.id, generation: view.generation ?? 0 }, view };
}

const snapshot = (tick: number, entities: Entry[]): Message => ({ type: 'renderSnapshot', data: { render: { tick, entities, frame: null }, debug: null } });
const diff = (tick: number, changes: { created?: Entry[]; updated?: Entry[]; destroyed?: Array<{ id: number; generation: number }> }): Message => ({
  type: 'renderTick',
  data: { render: { tick, created: changes.created ?? [], updated: changes.updated ?? [], destroyed: changes.destroyed ?? [], frame: null }, debug: null },
});

/** `RenderStore.getEntities` as it was before work 150 M2b: every view, sorted with this comparator. */
function legacyOrder(views: readonly ProjectedEntityView[]): ProjectedEntityView[] {
  return [...views].sort((left, right) => {
    const layerOrder = ['terrain', 'resource', 'building', 'unit'];
    const layerDelta = layerOrder.indexOf(left.layer) - layerOrder.indexOf(right.layer);
    if (layerDelta !== 0) return layerDelta;
    if (left.y !== right.y) return left.y - right.y;
    if (left.x !== right.x) return left.x - right.x;
    return left.id - right.id;
  });
}

/** A 4x3 map's cells out of order, with a few of everything else on it. */
function world(): Entry[] {
  const cells: Entry[] = [];
  for (let y = 2; y >= 0; y -= 1) for (let x = 3; x >= 0; x -= 1) cells.push(entry(100 + y * 4 + x, 'terrain', x, y));
  // Units 30 and 31 share a cell and arrive in the other order, so only the id can put them right.
  return [
    entry(31, 'unit', 2, 1), entry(10, 'resource', 3, 0), ...cells.slice(0, 5), entry(20, 'building', 0, 2),
    entry(30, 'unit', 2, 1), ...cells.slice(5), entry(11, 'resource', 0, 0),
  ];
}

/** The store's list, checked against the old sort over the views the test knows it holds. */
function expectList(store: RenderStore, held: Map<string, Entry>): ProjectedEntityView[] {
  const expected = legacyOrder([...held.values()].map((entity) => entity.view));
  const entities = store.getEntities();
  expect(entities).toHaveLength(expected.length);
  entities.forEach((view, index) => { expect(view, `the view at ${String(index)}`).toBe(expected[index]); });
  const lists = store.getEntityLists();
  expect([...lists.terrain, ...lists.others]).toEqual(entities);
  expect(lists.terrain.every((view) => view.layer === 'terrain')).toBe(true);
  expect(lists.others.some((view) => view.layer === 'terrain')).toBe(false);
  return entities;
}

const keyOf = (entity: Entry): string => `${String(entity.ref.id)}:${String(entity.ref.generation)}`;

describe('the render store\'s list, in two halves', () => {
  it('is the old sort of every view after a snapshot, and says the terrain is tiles only', () => {
    const store = new RenderStore();
    const entities = world();
    store.apply(snapshot(1, entities));
    const list = expectList(store, new Map(entities.map((entity) => [keyOf(entity), entity])));
    expect(list.map((view) => view.id).slice(0, 12)).toEqual([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111]);
    expect(list.map((view) => view.id).slice(12)).toEqual([11, 10, 20, 30, 31]);
    expect(store.getEntityLists().terrainIsTilesOnly).toBe(true);
  });

  it('hands out the same terrain array until a terrain entity changes', () => {
    const store = new RenderStore();
    const entities = world();
    const held = new Map(entities.map((entity) => [keyOf(entity), entity]));
    store.apply(snapshot(1, entities));
    const terrain = store.getEntityLists().terrain;

    // A unit moves, a resource is destroyed, a building is created: none of them is terrain.
    const moved = entry(30, 'unit', 1, 0);
    const built = entry(21, 'building', 3, 2);
    store.apply(diff(2, { updated: [moved], created: [built], destroyed: [{ id: 10, generation: 0 }] }));
    held.set(keyOf(moved), moved);
    held.set(keyOf(built), built);
    held.delete('10:0');
    expectList(store, held);
    expect(store.getEntityLists().terrain, 'the terrain array after a tick that changed no cell').toBe(terrain);

    // A cell is replaced by an equal view: a new object, so the half is a new array holding it.
    const replaced = entry(105, 'terrain', 1, 1);
    store.apply(diff(3, { updated: [replaced] }));
    held.set(keyOf(replaced), replaced);
    expectList(store, held);
    const afterReplace = store.getEntityLists().terrain;
    expect(afterReplace).not.toBe(terrain);
    expect(afterReplace).toContain(replaced.view);
    expect(store.getEntityLists().terrain, 'and the same array again on the next read').toBe(afterReplace);

    // A cell is destroyed, and one is created.
    const created = entry(112, 'terrain', 4, 0);
    store.apply(diff(4, { destroyed: [{ id: 100, generation: 0 }], created: [created] }));
    held.delete('100:0');
    held.set(keyOf(created), created);
    const list = expectList(store, held);
    expect(store.getEntityLists().terrain).not.toBe(afterReplace);
    expect(list.map((view) => view.id).slice(0, 4)).toEqual([101, 102, 103, 112]);
  });

  it('follows an id reused by another generation, in either half', () => {
    const store = new RenderStore();
    const entities = world();
    const held = new Map(entities.map((entity) => [keyOf(entity), entity]));
    store.apply(snapshot(1, entities));
    // Unit 30 dies and its id comes back as a building; then that building dies and the id comes back as a cell.
    const asBuilding = entry(30, 'building', 1, 2, { generation: 1 });
    store.apply(diff(2, { destroyed: [{ id: 30, generation: 0 }], created: [asBuilding] }));
    held.delete('30:0');
    held.set(keyOf(asBuilding), asBuilding);
    expectList(store, held);
    const terrain = store.getEntityLists().terrain;
    const asCell = entry(30, 'terrain', 5, 5, { generation: 2 });
    store.apply(diff(3, { destroyed: [{ id: 30, generation: 1 }], created: [asCell] }));
    held.delete('30:1');
    held.set(keyOf(asCell), asCell);
    expectList(store, held);
    expect(store.getEntityLists().terrain).not.toBe(terrain);
    expect(store.getEntityLists().others.map((view) => view.id)).not.toContain(30);
  });

  it('moves an entry between the halves when its replacement is on another layer', () => {
    const store = new RenderStore();
    const entities = world();
    const held = new Map(entities.map((entity) => [keyOf(entity), entity]));
    store.apply(snapshot(1, entities));
    const cellAsResource = entry(103, 'resource', 3, 0);
    store.apply(diff(2, { updated: [cellAsResource] }));
    held.set(keyOf(cellAsResource), cellAsResource);
    expectList(store, held);
    const resourceAsCell = entry(11, 'terrain', 0, 0);
    store.apply(diff(3, { updated: [resourceAsCell] }));
    held.set(keyOf(resourceAsCell), resourceAsCell);
    expectList(store, held);
  });

  it('keeps the halves in step with the attack-animation reconcile, which replaces entries', () => {
    const store = new RenderStore();
    const entities = world();
    store.apply(snapshot(1, entities));
    const animation = { tick: 1, sourceX: 2, sourceY: 1, targetX: 3, targetY: 1 } as NonNullable<ProjectedEntityView['attackAnimation']>;
    store.reconcileUnitAttackAnimations(new Map([['30:0', animation]]));
    const lists = store.getEntityLists();
    const unit = lists.others.find((view) => view.id === 30);
    expect(unit?.attackAnimation).toEqual(animation);
    expect(store.getEntities().find((view) => view.id === 30)).toBe(unit);
    // The cue ends: the entry is replaced again, without it.
    store.reconcileUnitAttackAnimations(new Map());
    expect(store.getEntityLists().others.find((view) => view.id === 30)?.attackAnimation).toBeUndefined();
    expect(store.getEntities()).toHaveLength(entities.length);
  });

  it('says so when a terrain view is not a tile, and still lists in the old order', () => {
    const store = new RenderStore();
    const entities = world();
    const odd = entry(50, 'terrain', 1, 1, { kind: 'resource' });
    const held = new Map([...entities, odd].map((entity) => [keyOf(entity), entity]));
    store.apply(snapshot(1, [...entities, odd]));
    expectList(store, held);
    expect(store.getEntityLists().terrainIsTilesOnly).toBe(false);
    store.apply(diff(2, { destroyed: [{ id: 50, generation: 0 }] }));
    held.delete('50:0');
    expectList(store, held);
    expect(store.getEntityLists().terrainIsTilesOnly).toBe(true);
  });

  it('lists two entries that tie in the order the store first held them, through a cell becoming a unit', () => {
    // One id held in two generations on one cell: nothing in the list's order tells them apart, so the old sort
    // left them in the order the store's map held them. The engine's adapter removes a generation it replaces, so
    // a match does not send this; the list must not depend on that (review round 0, F1).
    const store = new RenderStore();
    const cell = entry(7, 'terrain', 1, 1);
    const unit = entry(7, 'unit', 1, 1, { generation: 1 });
    const held = new Map([[keyOf(cell), cell], [keyOf(unit), unit]]);
    store.apply(snapshot(1, [cell, unit]));
    expectList(store, held);
    const cellAsUnit = entry(7, 'unit', 1, 1);
    store.apply(diff(2, { updated: [cellAsUnit] }));
    held.set(keyOf(cellAsUnit), cellAsUnit);
    expect(expectList(store, held).map((view) => view.generation)).toEqual([0, 1]);
    // And back: the first is a cell again, then a unit again, and is still listed first.
    const backToCell = entry(7, 'terrain', 1, 1);
    store.apply(diff(3, { updated: [backToCell] }));
    held.set(keyOf(backToCell), backToCell);
    expectList(store, held);
    const unitAgain = entry(7, 'unit', 1, 1);
    const newcomer = entry(8, 'unit', 1, 1);
    store.apply(diff(4, { updated: [unitAgain], created: [newcomer] }));
    held.set(keyOf(unitAgain), unitAgain);
    held.set(keyOf(newcomer), newcomer);
    const ids = expectList(store, held).map((view) => `${String(view.id)}:${String(view.generation)}`);
    expect(ids).toEqual(['7:0', '7:1', '8:0']);
  });

  it('keeps its list through a rewind, a tick lower than the last', () => {
    const store = new RenderStore();
    const entities = world();
    const held = new Map(entities.map((entity) => [keyOf(entity), entity]));
    store.apply(snapshot(9, entities));
    const terrain = store.getEntityLists().terrain;
    const moved = entry(30, 'unit', 0, 0);
    store.apply(diff(4, { updated: [moved] }));
    held.set(keyOf(moved), moved);
    expectList(store, held);
    expect(store.getTick()).toBe(4);
    expect(store.getEntityLists().terrain).toBe(terrain);
  });

  it('starts over on a snapshot', () => {
    const store = new RenderStore();
    store.apply(snapshot(1, world()));
    const terrain = store.getEntityLists().terrain;
    const next = [entry(1, 'terrain', 0, 0), entry(2, 'unit', 0, 0)];
    store.apply(snapshot(2, next));
    expectList(store, new Map(next.map((entity) => [keyOf(entity), entity])));
    expect(store.getEntityLists().terrain).not.toBe(terrain);
    expect(store.getEntityLists().terrain).toHaveLength(1);
    // And on a snapshot that holds no cell at all, which leaves no write to a cell to start the terrain over.
    const cellless = [entry(3, 'unit', 1, 1), entry(4, 'resource', 0, 1)];
    store.apply(snapshot(3, cellless));
    expectList(store, new Map(cellless.map((entity) => [keyOf(entity), entity])));
    expect(store.getEntityLists().terrain).toEqual([]);
  });
});

describe('the render state remembers a list\'s halves only when the terrain half is cells', () => {
  /** The assembly over a real store and a map nobody can see into: cells are listed, nothing else is. */
  function assembly(store: RenderStore): { read(): ProjectedEntityView[] } {
    let version = 0;
    const ops = createRenderStateOps({
      visibility: new LayeredVisibilityMap(8, 8),
      humanPlayerId: 1,
      getSightOwners: () => [1],
      renderStore: store,
      getHumanFogMemorySize: () => 0,
      getFogMemoryEntities: () => [],
      getRecentUnitAttacks: () => [],
      getRenderStoreVersion: () => version,
      isFoundationHidden: () => false,
    });
    return { read: () => { version += 1; return ops.getRenderState().entities; } };
  }

  it('remembers them for a map of cells', () => {
    const store = new RenderStore();
    store.apply(snapshot(1, world()));
    const entities = assembly(store).read();
    expect(entities.map((view) => view.id)).toEqual([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111]);
    const lists = knownProjectedEntityLists(entities);
    expect(lists?.terrain).toBe(store.getEntityLists().terrain);
    expect(lists?.others).toEqual([]);
  });

  it('remembers nothing, and filters the terrain like the rest, while a terrain view is not a tile', () => {
    const store = new RenderStore();
    const odd = entry(50, 'terrain', 1, 1, { kind: 'resource' });
    store.apply(snapshot(1, [...world(), odd]));
    const read = assembly(store);
    const entities = read.read();
    // The odd view is not a tile, so the fog's rule applies to it, and nobody sees its cell.
    expect(entities.map((view) => view.id)).toEqual([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111]);
    expect(knownProjectedEntityLists(entities)).toBeUndefined();
    store.apply(diff(2, { destroyed: [{ id: 50, generation: 0 }] }));
    expect(knownProjectedEntityLists(read.read())).toBeDefined();
  });
});
