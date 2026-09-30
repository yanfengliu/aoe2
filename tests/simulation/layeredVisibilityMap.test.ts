// LayeredVisibilityMap (2026-09-24): each owner's building sources in a second
// engine map, so a unit's move never re-stamps buildings. Its contract: to
// every caller it is ONE VisibilityMap. `getState` is exactly what a single
// engine map holding the same sources would save, in the engine's player
// order, and restores through fromState; a sight question asked with an
// owner's id is answered from both layers. In the world it is two slots
// (2026-09-25): the units' layer whole, and only what a load cannot rebuild of
// the building layer, current as of the call.
//
// BOUND: the operations below, on a 40x40 grid; the game's use of the map is
// tests/simulation/buildingVision.test.ts and visibilitySourceSync.test.ts.

import { VisibilityMap } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { TIER_3_SLOTS } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { buildingSightKey, LayeredVisibilityMap } from '../../src/game/simulation/bridge/layeredVisibilityMap';
import { visibilityStateFromSlots } from '../../src/game/simulation/bridge/visibilitySlots';

type Op =
  | { kind: 'set'; player: number | string; id: number | string; x: number; y: number; radius: number }
  | { kind: 'remove'; player: number | string; id: number | string };

function script(): Op[] {
  // Owners 1, 2 and 10 (10 sorts between 1 and 2 in the engine's text order),
  // units and buildings, moves, removals and an owner's building layer
  // emptied, all interleaved.
  return [
    { kind: 'set', player: 1, id: 101, x: 3, y: 3, radius: 4 },
    { kind: 'set', player: buildingSightKey(1), id: 7, x: 10, y: 10, radius: 2.5 },
    { kind: 'set', player: buildingSightKey(1), id: '7:1', x: 11, y: 10, radius: 2.5 },
    { kind: 'set', player: 2, id: 201, x: 30, y: 30, radius: 5 },
    { kind: 'set', player: buildingSightKey(10), id: 9, x: 20, y: 5, radius: 6 },
    { kind: 'set', player: 10, id: 1001, x: 22, y: 7, radius: 3 },
    { kind: 'set', player: 1, id: 101, x: 4, y: 3, radius: 4 },
    { kind: 'set', player: buildingSightKey(2), id: 8, x: 33, y: 33, radius: 1 },
    { kind: 'remove', player: buildingSightKey(10), id: 9 },
    { kind: 'set', player: 1, id: 101, x: 5, y: 4, radius: 4 },
    { kind: 'remove', player: 2, id: 201 },
  ];
}

function apply(map: VisibilityMap, ops: Op[]): void {
  for (const op of ops) {
    if (op.kind === 'set') map.setSource(op.player, op.id, { x: op.x, y: op.y, radius: op.radius });
    else map.removeSource(op.player, op.id);
    map.update();
  }
}

describe('LayeredVisibilityMap', () => {
  it('saves exactly what one engine map holding the same sources would save, and restores it', () => {
    const plain = new VisibilityMap(40, 40);
    const layered = new LayeredVisibilityMap(40, 40);
    apply(plain, script());
    apply(layered, script());
    expect(layered.getState()).toEqual(plain.getState());
    expect(JSON.stringify(layered.getState())).toBe(JSON.stringify(plain.getState()));
    const restored = LayeredVisibilityMap.fromState(plain.getState());
    expect(restored.getState()).toEqual(plain.getState());
  });

  it('answers an owner’s sight questions from both layers', () => {
    const plain = new VisibilityMap(40, 40);
    const layered = LayeredVisibilityMap.fromState((() => { apply(plain, script()); return plain.getState(); })());
    const problems: string[] = [];
    for (const owner of [1, 2, 10]) {
      const layers = [owner, buildingSightKey(owner)];
      for (let y = 0; y < 40; y += 1) {
        for (let x = 0; x < 40; x += 1) {
          const visible = layers.some((key) => plain.isVisible(key, x, y));
          const explored = layers.some((key) => plain.isExplored(key, x, y));
          if (layered.isVisible(owner, x, y) !== visible) problems.push(`owner ${String(owner)} visible (${String(x)},${String(y)})`);
          if (layered.isExplored(owner, x, y) !== explored) problems.push(`owner ${String(owner)} explored (${String(x)},${String(y)})`);
        }
      }
      const cells = (list: Array<{ x: number; y: number }>) => list.map(({ x, y }) => `${String(x)},${String(y)}`);
      const union = (read: (key: number | string) => Array<{ x: number; y: number }>) =>
        [...new Set(layers.flatMap((key) => cells(read(key))))].sort((a, b) => {
          const [ax, ay] = a.split(',').map(Number);
          const [bx, by] = b.split(',').map(Number);
          return ay! * 40 + ax! - (by! * 40 + bx!);
        });
      expect(cells(layered.getVisibleCells(owner)), `owner ${String(owner)} visible cells`).toEqual(union((key) => plain.getVisibleCells(key)));
      expect(cells(layered.getExploredCells(owner)), `owner ${String(owner)} explored cells`).toEqual(union((key) => plain.getExploredCells(key)));
    }
    expect(problems.slice(0, 8)).toEqual([]);
  });

  it('rebuilds its cached cell lists when a building’s sight changes', () => {
    const map = new LayeredVisibilityMap(40, 40);
    apply(map, script());
    // Read owner 1's cell lists first, so the layer's cached lists exist.
    const has = (cells: Array<{ x: number; y: number }>, x: number, y: number) => cells.some((c) => c.x === x && c.y === y);
    expect([has(map.getVisibleCells(1), 13, 13), has(map.getExploredCells(1), 13, 13)]).toEqual([false, false]);
    map.setSource(buildingSightKey(1), 7, { x: 12, y: 12, radius: 2.5 });
    map.update();
    // (13,13) is 1.4 from the moved source and 3.6 from the one left at (11,10).
    expect([has(map.getVisibleCells(1), 13, 13), has(map.getExploredCells(1), 13, 13)]).toEqual([true, true]);
    // And when the building goes, which removes its sources: seen no longer, explored still.
    map.removeSource(buildingSightKey(1), 7);
    map.removeSource(buildingSightKey(1), '7:1');
    map.update();
    expect([has(map.getVisibleCells(1), 13, 13), has(map.getExploredCells(1), 13, 13)]).toEqual([false, true]);
  });

  it('saves as two slots that load back, once the buildings are placed again, as the same map', () => {
    const map = new LayeredVisibilityMap(40, 40);
    apply(map, script());
    const units = map.getUnitLayerState();
    const buildings = map.getBuildingLayerState();
    expect(units.players.map(([player]) => player)).toEqual([1, 10, 2]);
    // The engine's order compares text code unit by code unit, so "10:" comes before "1:".
    expect(buildings.players.map(([player]) => player)).toEqual([buildingSightKey(10), buildingSightKey(1), buildingSightKey(2)]);
    // The building slot holds only what a load cannot rebuild: no sources, and
    // no cell the owner's units explored too.
    const full = map.getState();
    for (const [key, entry] of buildings.players) {
      const owner = Number(String(key).split(':')[0]);
      const unitExplored = new Set(full.players.find(([player]) => player === owner)?.[1].explored ?? []);
      const layerExplored = full.players.find(([player]) => player === key)![1].explored;
      expect(entry.sources, String(key)).toEqual([]);
      expect(entry.explored, String(key)).toEqual(layerExplored.filter((cell) => !unitExplored.has(cell)));
    }
    expect(buildings.players.find(([key]) => key === buildingSightKey(1))?.[1].explored.length, 'the premise: a cell only a building explored').toBeGreaterThan(0);
    const state = { [TIER_3_SLOTS.visibility]: units, [TIER_3_SLOTS.buildingVisibility]: buildings };
    const loaded = LayeredVisibilityMap.fromState(visibilityStateFromSlots(state, (missing) => new Error(missing)));
    // What the first sync after a load does: every building's sources again.
    for (const [key] of buildings.players) {
      for (const [id, source] of map.getSources(key)) loaded.setSource(key, id, source);
    }
    loaded.update();
    for (const owner of [1, 2, 10]) {
      expect(loaded.getExploredCells(owner), `owner ${String(owner)} explored`).toEqual(map.getExploredCells(owner));
      expect(loaded.getVisibleCells(owner), `owner ${String(owner)} visible`).toEqual(map.getVisibleCells(owner));
    }
    expect(loaded.getBuildingLayerState()).toEqual(buildings);
    // A save from before the building slot has only the units' slot.
    const older = new VisibilityMap(40, 40);
    older.setSource(1, 101, { x: 3, y: 3, radius: 4 });
    const fromOlder = visibilityStateFromSlots({ [TIER_3_SLOTS.visibility]: older.getState() }, (missing) => new Error(missing));
    expect(LayeredVisibilityMap.fromState(fromOlder).getState()).toEqual(older.getState());
    expect(() => visibilityStateFromSlots({}, (missing) => new Error(`no ${missing}`))).toThrow('no aoe2.visibility');
  });

  it('puts a new building’s ground into the building slot once it has been read before', () => {
    const map = new LayeredVisibilityMap(40, 40);
    map.setSource(buildingSightKey(1), 7, { x: 10, y: 10, radius: 1 });
    map.update();
    const slotCells = () => map.getBuildingLayerState().players.find(([key]) => key === buildingSightKey(1))?.[1].explored ?? [];
    expect(slotCells(), 'the premise: the slot is read once, so its cells are cached').not.toContain(30 * 40 + 30);
    map.setSource(buildingSightKey(1), 8, { x: 30, y: 30, radius: 1 });
    map.update();
    expect(slotCells()).toContain(30 * 40 + 30);
  });

  it('clears both of an owner’s layers when asked with the owner’s id', () => {
    const map = new LayeredVisibilityMap(40, 40);
    map.setSource(buildingSightKey(1), 7, { x: 10, y: 10, radius: 2 });
    map.setSource(1, 101, { x: 30, y: 30, radius: 2 });
    map.update();
    expect([map.isVisible(1, 10, 10), map.isVisible(1, 30, 30)], 'the premise').toEqual([true, true]);
    map.clearPlayer(1);
    map.update();
    expect([map.isVisible(1, 10, 10), map.isVisible(1, 30, 30), map.isExplored(1, 10, 10)]).toEqual([false, false, false]);
    expect(map.getBuildingLayerState().players).toEqual([]);
  });

  it('keeps the building slot current: a cell leaves it once a unit of the owner explores it', () => {
    const map = new LayeredVisibilityMap(40, 40);
    map.setSource(buildingSightKey(1), 7, { x: 10, y: 10, radius: 2.5 });
    map.setSource(1, 101, { x: 30, y: 30, radius: 3 });
    map.update();
    const slotCells = () => map.getBuildingLayerState().players.find(([key]) => key === buildingSightKey(1))?.[1].explored ?? [];
    const buildingCell = 10 * 40 + 10;
    expect(slotCells(), 'the premise: only the building has explored its own cell').toContain(buildingCell);
    // A unit walks up to it; no building changes.
    map.setSource(1, 101, { x: 10, y: 11, radius: 3 });
    map.update();
    expect(slotCells()).not.toContain(buildingCell);
  });
});
