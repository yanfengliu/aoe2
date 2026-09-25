// The per-tick source sync's bookkeeping for buildings (2026-09-24,
// buildingVisionSources.ts and layeredVisibilityMap.ts). A building's sources
// live in its owner's building layer, an even-sized one as four sources, and
// three things must never leave one behind: an entity id the engine recycles
// within a tick, an owner change a save caught before it reached a sync, and a
// save from before the layers existed, which kept building sources in the
// owner's own layer. The layer itself exists for one reason, measured in the
// last case: a unit's move must not re-stamp its owner's buildings.
//
// BOUND: a fake world of one or two entities and the engine's own map; the
// real game path is tests/simulation/buildingVision.test.ts.

import { describe, expect, it, vi } from 'vitest';

import type { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { trackedVisibilitySourcesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { buildingSightKey, LayeredVisibilityMap } from '../../src/game/simulation/bridge/layeredVisibilityMap';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { VisibilityCell } from '../../src/game/simulation/bridge/visibilityCell';
import {
  syncVisibilitySources,
  type VisibilitySourceFingerprint,
} from '../../src/game/simulation/bridge/visibilitySourceSync';

function fakeWorld(components: Map<string, unknown>): GameWorld {
  return {
    query: () => {
      const ids = new Set<number>();
      for (const key of components.keys()) {
        const [id, kind] = key.split(':');
        if (kind === 'visionSource' && components.has(`${id!}:position`)) ids.add(Number(id));
      }
      return [...ids];
    },
    getComponent: (id: number, kind: string) => components.get(`${String(id)}:${kind}`),
  } as unknown as GameWorld;
}

function accessorOver(tracked: Map<number, number>): BridgeStateAccessor {
  return {
    get: (codec: { slot: string }) => (codec.slot === trackedVisibilitySourcesCodec.slot ? tracked : undefined),
    markDirty: vi.fn(),
  } as unknown as BridgeStateAccessor;
}

const house = (owner: number) => new Map<string, unknown>([
  ['7:position', { x: 10, y: 10 }],
  ['7:building', { owner, buildingType: 'house' }],
  ['7:visionSource', { playerId: owner, radius: 2 }],
]);
const keysOf = (map: LayeredVisibilityMap, holder: number | string) => map.getSources(holder).map(([key]) => key);

describe('syncVisibilitySources', () => {
  it('drops a recycled id’s building sources when a unit takes the id in the same tick', () => {
    const components = house(1);
    const tracked = new Map<number, number>();
    const visibility = new LayeredVisibilityMap(40, 40);
    const fingerprints = new Map<number, VisibilitySourceFingerprint>();
    const world = fakeWorld(components);

    syncVisibilitySources(world, visibility, accessorOver(tracked), fingerprints, new VisibilityCell(visibility));
    // A House is four sources on its four central cells, in the building layer.
    expect(keysOf(visibility, buildingSightKey(1))).toEqual([7, '7:1', '7:2', '7:3']);
    expect(keysOf(visibility, 1)).toEqual([]);

    // Same tick: the House is gone and a unit of owner 1 has id 7, far away.
    components.delete('7:building');
    components.set('7:position', { x: 30, y: 30 });
    components.set('7:visionSource', { playerId: 1, radius: 4 });
    syncVisibilitySources(world, visibility, accessorOver(tracked), fingerprints, new VisibilityCell(visibility));

    expect(keysOf(visibility, buildingSightKey(1))).toEqual([]);
    expect(visibility.getSources(1)).toEqual([[7, { x: 30, y: 30, radius: 4 }]]);
    expect(visibility.isVisible(1, 10, 10)).toBe(false);
  });

  it('drops a recycled id’s extra sources when a smaller building of the same owner takes the id', () => {
    // The same layer before and after, so only the count says three must go.
    const components = house(1);
    const tracked = new Map<number, number>();
    const visibility = new LayeredVisibilityMap(40, 40);
    const fingerprints = new Map<number, VisibilitySourceFingerprint>();
    const world = fakeWorld(components);
    syncVisibilitySources(world, visibility, accessorOver(tracked), fingerprints, new VisibilityCell(visibility));
    expect(keysOf(visibility, buildingSightKey(1))).toEqual([7, '7:1', '7:2', '7:3']);

    // Same tick: the House is gone and owner 1's Watch Tower has id 7, far away.
    components.set('7:position', { x: 30, y: 30 });
    components.set('7:building', { owner: 1, buildingType: 'watch-tower' });
    components.set('7:visionSource', { playerId: 1, radius: 10 });
    syncVisibilitySources(world, visibility, accessorOver(tracked), fingerprints, new VisibilityCell(visibility));

    expect(visibility.getSources(buildingSightKey(1)).map(([key, { x, y }]) => [key, x, y])).toEqual([[7, 30, 30]]);
    // (11,11) was one of the House's central cells, 26.9 from the tower.
    expect(visibility.isVisible(1, 11, 11)).toBe(false);
  });

  it('after a load, takes every source off an owner the building lost before the save was synced', () => {
    // A conversion flips the owner in place. If a save lands between that flip
    // and the next sync, the saved map still holds the House's four sources
    // under its old owner, and a loaded game starts with no fingerprints to
    // say so. The tracked owner the save carried is what names them.
    const components = house(1);
    const tracked = new Map<number, number>();
    const world = fakeWorld(components);
    const saved = new LayeredVisibilityMap(40, 40);
    syncVisibilitySources(world, saved, accessorOver(tracked), new Map(), new VisibilityCell(saved));
    // The conversion, with no sync after it, then the save and the load.
    (components.get('7:visionSource') as { playerId: number }).playerId = 2;
    const loaded = LayeredVisibilityMap.fromState(saved.getState());
    const loadedTracked = new Map(tracked);
    expect(loadedTracked.get(7), 'the premise: the save carried the old owner').toBe(1);

    syncVisibilitySources(world, loaded, accessorOver(loadedTracked), new Map(), new VisibilityCell(loaded));

    expect({
      oldOwner: keysOf(loaded, buildingSightKey(1)),
      newOwner: keysOf(loaded, buildingSightKey(2)),
    }).toEqual({ oldOwner: [], newOwner: [7, '7:1', '7:2', '7:3'] });
  });

  it('moves a building out of its owner’s own layer when an older save kept it there', () => {
    // Before the layers, a building's one source sat under its owner's id.
    const older = new LayeredVisibilityMap(40, 40);
    older.setSource(1, 7, { x: 10, y: 10, radius: 7 });
    const loaded = LayeredVisibilityMap.fromState(older.getState());
    const components = house(1);
    syncVisibilitySources(fakeWorld(components), loaded, accessorOver(new Map([[7, 1]])), new Map(), new VisibilityCell(loaded));
    expect({
      ownLayer: keysOf(loaded, 1),
      buildingLayer: keysOf(loaded, buildingSightKey(1)),
    }).toEqual({ ownLayer: [], buildingLayer: [7, '7:1', '7:2', '7:3'] });
    // And the old circle's far cells are gone with it: (16,10) was 6 from (10,10).
    expect(loaded.isVisible(1, 16, 10)).toBe(false);
  });

  it('re-stamps only the unit layer when a unit moves, never its owner’s buildings', () => {
    const components = house(1);
    components.set('8:position', { x: 20, y: 20 });
    components.set('8:visionSource', { playerId: 1, radius: 4 });
    const visibility = new LayeredVisibilityMap(40, 40);
    const tracked = new Map<number, number>();
    const fingerprints = new Map<number, VisibilitySourceFingerprint>();
    const world = fakeWorld(components);
    syncVisibilitySources(world, visibility, accessorOver(tracked), fingerprints, new VisibilityCell(visibility));
    // Both layers answer for owner 1: the House's cells and the unit's.
    expect([visibility.isVisible(1, 10, 10), visibility.isVisible(1, 20, 20)]).toEqual([true, true]);

    visibility.resetMetrics();
    components.set('8:position', { x: 21, y: 20 });
    syncVisibilitySources(world, visibility, accessorOver(tracked), fingerprints, new VisibilityCell(visibility));
    const metrics = visibility.getMetrics();
    // One recompute, of the unit layer: a radius-4 circle is 49 cells here.
    expect({ recomputes: metrics.recomputes, computedCells: metrics.computedCells }).toEqual({ recomputes: 1, computedCells: 49 });
    expect([visibility.isVisible(1, 10, 10), visibility.isVisible(1, 25, 20)]).toEqual([true, true]);
  });
});
