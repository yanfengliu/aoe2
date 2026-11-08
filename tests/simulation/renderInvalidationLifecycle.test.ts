// Contract: classify mutable game views across their full entity/component lifecycle,
// and refresh old/new selections in the same engine message even with no view reads.
// Bound: a small real engine adapter isolates invalidation mechanics; the paired
// game-projector scenarios cover actual health, combat, wildlife and construction.
import { RenderAdapter, World, type EntityRef, type RenderServerMessage } from 'civ-engine';
import { describe, expect, it } from 'vitest';
import { trackRenderInvalidation } from '../../src/game/simulation/bridge/renderInvalidation';
import type { GameCommands, GameComponents, GameEvents, GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { ResourceComponent } from '../../src/game/simulation/types';

type View = { id: number; generation: number; selected: boolean; value: number };
function fixture() {
  const world = new World<GameEvents, GameCommands, GameComponents>({ gridWidth: 12, gridHeight: 12, tps: 10 });
  for (const key of ['unit', 'building', 'resource', 'terrain'] as const) world.registerComponent(key);
  const unit = world.createEntity();
  world.setComponent(unit, 'unit', { unitType: 'villager', owner: 1 });
  const tree = world.createEntity();
  const resource = (resourceType: ResourceComponent['resourceType']): ResourceComponent => ({
    resourceType, amount: 100, maxAmount: 100, owner: null, baseOwner: null,
  });
  world.setComponent(tree, 'resource', resource('tree'));
  const ground = world.createEntity();
  world.setComponent(ground, 'terrain', { kind: 'grass', buildable: true, elevation: 0 });
  const sheep = world.createEntity();
  world.setComponent(sheep, 'resource', resource('sheep'));
  const house = world.createEntity();
  world.setComponent(house, 'building', { buildingType: 'house', owner: 1 });
  const farm = world.createEntity();
  world.setComponent(farm, 'building', { buildingType: 'farm', owner: 1 });
  world.setComponent(farm, 'resource', resource('farm'));
  let selected: EntityRef[] = [];
  let external = false;
  let revision = 0;
  let edit: (world: GameWorld) => void = () => {};
  const calls: number[] = [];
  const views = new Map<number, View>();
  const messages: RenderServerMessage<View>[] = [];
  const adapter = new RenderAdapter({
    world,
    projector: {
      projectEntity: (ref: EntityRef) => {
        calls.push(ref.id);
        return { ...ref, selected: selected.some(item => item.id === ref.id), value: revision };
      },
    },
    send: (message: RenderServerMessage<View>) => {
      messages.push(message);
      if (message.type === 'renderSnapshot') {
        views.clear();
        for (const item of message.data.render.entities) views.set(item.ref.id, item.view);
      } else {
        for (const ref of message.data.render.destroyed) views.delete(ref.id);
        for (const item of [...message.data.render.created, ...message.data.render.updated]) views.set(item.ref.id, item.view);
      }
    },
  });
  trackRenderInvalidation(world, adapter, () => { const changed = external; external = false; return changed; }, () => selected);
  adapter.connect();
  world.registerSystem(w => edit(w));
  const tick = (change: (world: GameWorld) => void = () => {}) => {
    edit = change;
    calls.length = 0;
    world.step();
    edit = () => {};
    const message = messages.at(-1)!;
    if (message.type !== 'renderTick') throw new Error('Expected a real render tick');
    return message.data.render;
  };
  return {
    world, adapter, unit, tree, ground, sheep, house, farm, resource, calls, views, messages, tick,
    change: () => { external = true; revision++; },
    select: (...ids: number[]) => { selected = ids.map(id => world.getEntityRef(id)!); },
  };
}

describe('selected projection lifecycle', () => {
  it('projects mutable units, buildings and wildlife but not untouched trees or ground', () => {
    const f = fixture();
    f.change();
    const first = f.tick();
    expect(first.updated.map(item => item.ref.id)).toEqual([f.unit, f.sheep, f.house, f.farm]);
    expect(f.views.get(f.unit)?.value).toBe(1);
    expect(f.views.get(f.tree)?.value).toBe(0);
    expect(f.views.get(f.ground)?.value).toBe(0);
    f.tick();
    expect(f.calls).toEqual([]);
    f.adapter.disconnect();
  });

  it('publishes both sides of static selection changes and clearing without intermediate reads', () => {
    const f = fixture();
    f.select(f.tree);
    expect(f.tick().updated.map(item => item.ref.id)).toEqual([f.tree]);
    expect(f.views.get(f.tree)?.selected).toBe(true);
    f.select(f.ground);
    expect(f.tick().updated.map(item => item.ref.id)).toEqual([f.tree, f.ground]);
    expect(f.views.get(f.tree)?.selected).toBe(false);
    expect(f.views.get(f.ground)?.selected).toBe(true);
    f.select();
    expect(f.tick().updated.map(item => item.ref.id)).toEqual([f.ground]);
    expect(f.views.get(f.ground)?.selected).toBe(false);
    expect(f.tick().updated).toEqual([]);
    f.adapter.disconnect();
  });

  it('follows resource classification changes and unit overrides in both directions', () => {
    const f = fixture();
    f.tick(world => world.setComponent(f.tree, 'resource', f.resource('sheep')));
    f.change(); f.tick();
    expect(f.calls).toContain(f.tree);
    f.tick(world => world.setComponent(f.tree, 'resource', f.resource('tree')));
    f.change(); f.tick();
    expect(f.calls).not.toContain(f.tree);
    f.tick(world => world.setComponent(f.tree, 'unit', { unitType: 'villager', owner: 1 }));
    f.change(); f.tick();
    expect(f.calls).toContain(f.tree);
    f.tick(world => world.removeComponent(f.tree, 'unit'));
    f.change(); f.tick();
    expect(f.calls).not.toContain(f.tree);
    f.adapter.disconnect();
  });

  it('tracks creation, destruction and recycled generations without stale candidates', () => {
    const f = fixture();
    let born = -1;
    f.tick(world => {
      born = world.createEntity();
      world.setComponent(born, 'unit', { unitType: 'villager', owner: 1 });
    });
    f.change(); f.tick();
    expect(f.calls).toContain(born);
    const generation = f.views.get(born)!.generation;
    f.tick(world => {
      world.destroyEntity(born);
      expect(world.createEntity()).toBe(born);
      world.setComponent(born, 'resource', f.resource('tree'));
    });
    expect(f.views.get(born)?.generation).toBeGreaterThan(generation);
    f.change(); f.tick();
    expect(f.calls).not.toContain(born);
    f.tick(world => world.destroyEntity(born));
    f.change(); f.tick();
    expect(f.views.has(born)).toBe(false);
    expect(f.calls).not.toContain(born);
    f.adapter.disconnect();
  });

  it('keeps same-tick invalidation after the adapter reconnects for an immediate read', () => {
    const f = fixture();
    f.adapter.disconnect();
    f.adapter.connect();
    f.change();
    f.tick();
    expect(f.views.get(f.unit)?.value).toBe(1);
    f.change();
    f.tick();
    expect(f.views.get(f.unit)?.value).toBe(2);
    f.adapter.disconnect();
  });
});
