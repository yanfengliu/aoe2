// The game's render projection follows what changed and equals a whole-world
// projection at every tick (bridge/incrementalRenderProjection.ts, work 150 M2a).
//
// Why it exists. After any change its diff could not see — a hit, a heal, a
// conversion, a sheep claimed, a click on the selection — the game's bridge
// used to project the whole world again, every tree included, and that was
// 68.5% of a late tick on a 120x120 map (plan 150). It now projects only the
// entities such a change can reach. That is only safe if what it keeps equals
// what a whole-world projection would draw, so this compares the two.
//
// What is checked.
// (1) Every tick of five busy matches, and after each click between ticks of
//     a paused one, the game's store holds exactly what civ-engine's own
//     `RenderAdapter` projects from scratch for the same world: a second
//     bridge plays the same match with `renderProjection: 'on-read'`, which
//     projects the whole world through that adapter on every read. Both
//     stores are read through `getRenderState()` first, so both reconcile
//     their attack cues the same way, and compared entity by entity and frame
//     by frame. The worlds are digested too: the projection never writes one.
// (2) The JSON shape. The per-tick path no longer checks it; the reference
//     adapter checks every entity and frame it projects (civ-engine's
//     `assertJsonCompatible`), and every field the projector writes is seen
//     at least once across the matches, so that check covered each one.
// (3) The cost: a tick after an out-of-band change projects no terrain cell,
//     tree, bush or mine that the tick did not write, and the game's bridge never builds a
//     whole-world snapshot after it connects.
//
// BOUND. Five fixtures and one paused opening, a few hundred to 1,000 ticks
// each, at one map size; it proves these matches, not every match. Fog is
// compared as each store holds it, so an entity outside the human's sight is
// compared too. The replay bridge (replay/makeReplayBridge.ts) still
// reconnects civ-engine's adapter and is not covered here.

import { RenderAdapter, stateDigest } from 'civ-engine';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { CreateSimulationBridgeOptions } from '../../src/game/simulation/createSimulationBridgeOptions';
import { IncrementalRenderProjection, canChangeOutOfBand } from '../../src/game/simulation/bridge/incrementalRenderProjection';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { RenderStore } from '../../src/game/simulation/renderStore';
import type { ProjectedEntityView } from '../../src/game/simulation/types';

// Every field `createProjector`'s projectEntity can write (bridge/visibility.ts).
const VIEW_FIELDS = [
  'id', 'generation', 'kind', 'layer', 'entityType', 'owner', 'x', 'y', 'elevation', 'tint', 'size',
  'footprintWidth', 'footprintHeight', 'visualVariant', 'architecture', 'selected', 'currentHp', 'maxHp',
  'attackAnimation', 'wildlifeAlive', 'activeVerb', 'isMemory',
];
const seenFields = new Set<string>();

interface Pair {
  game: SimulationBridge;
  full: SimulationBridge;
  gameStore: RenderStore;
  fullStore: RenderStore;
}

/** The game's bridge and an on-read twin, with the render store each owns. */
function openPair(seed: string, options: CreateSimulationBridgeOptions): Pair {
  const stores: RenderStore[] = [];
  const apply = RenderStore.prototype.apply;
  vi.spyOn(RenderStore.prototype, 'apply').mockImplementation(function record(this: RenderStore, message) {
    if (!stores.includes(this)) stores.push(this);
    apply.call(this, message);
  });
  const game = createSimulationBridge(seed, options);
  const full = createSimulationBridge(seed, { ...options, renderProjection: 'on-read' });
  full.getRenderState();
  expect(stores, 'each bridge should own one render store').toHaveLength(2);
  return { game, full, gameStore: stores[0], fullStore: stores[1] };
}

const describeView = (view: ProjectedEntityView | undefined): string => (view ? JSON.stringify(view) : 'nothing');
// Key order aside, the same JSON: an equality of its own, not the projection's
// comparator, so a comparator that misses a field cannot pass for itself.
const canonical = (value: unknown): string => JSON.stringify(value, (_key, inner: unknown) => (
  inner && typeof inner === 'object' && !Array.isArray(inner)
    ? Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([left], [right]) => (left < right ? -1 : 1)))
    : inner));

/** Reads both bridges, then compares their stores; returns what differs. */
function compare(pair: Pair, when: string): string[] {
  pair.game.getRenderState();
  pair.full.getRenderState();
  const drawn = pair.gameStore.getEntities();
  const fresh = pair.fullStore.getEntities();
  for (const view of fresh) for (const key of Object.keys(view)) seenFields.add(key);
  const problems: string[] = [];
  if (pair.gameStore.getTick() !== pair.fullStore.getTick()) {
    problems.push(`${when}: store tick ${pair.gameStore.getTick()} against ${pair.fullStore.getTick()}`);
  }
  if (JSON.stringify(pair.gameStore.getFrame()) !== JSON.stringify(pair.fullStore.getFrame())) {
    problems.push(`${when}: the frames differ`);
  }
  const length = Math.max(drawn.length, fresh.length);
  for (let i = 0; i < length; i += 1) {
    if (drawn[i] && fresh[i] && canonical(drawn[i]) === canonical(fresh[i])) continue;
    problems.push(`${when}: entity ${i} of ${fresh.length} is ${describeView(drawn[i])}, a whole projection has ${describeView(fresh[i])}`);
    break;
  }
  return problems;
}

/** Steps both bridges `ticks` ticks, comparing after every one. */
function playCompared(pair: Pair, ticks: number): { problems: string[]; changed: Map<string, number> } {
  const problems: string[] = [];
  // Out-of-band changes seen in the game's store, by kind, so each case can
  // show that the source it is about actually fired.
  const changed = new Map<string, number>();
  let previous = new Map(pair.gameStore.getEntities().map((view) => [view.id, view]));
  for (let tick = 0; tick < ticks && problems.length < 5; tick += 1) {
    pair.game.step(100);
    pair.full.step(100);
    problems.push(...compare(pair, `tick ${pair.game.world.tick}`));
    const now = new Map(pair.gameStore.getEntities().map((view) => [view.id, view]));
    for (const [id, view] of now) {
      const before = previous.get(id);
      if (!before || before.generation !== view.generation) continue;
      for (const key of ['currentHp', 'owner', 'visualVariant', 'entityType', 'selected', 'activeVerb', 'wildlifeAlive', 'tint'] as const) {
        if (before[key] !== view[key]) changed.set(key, (changed.get(key) ?? 0) + 1);
      }
      if (view.layer === 'resource' && (before.x !== view.x || before.y !== view.y)) {
        changed.set('wildlife moved', (changed.get('wildlife moved') ?? 0) + 1);
      }
    }
    previous = now;
  }
  expect(stateDigest(pair.full.world.serialize()), 'the projection wrote to the world').toBe(stateDigest(pair.game.world.serialize()));
  return { problems, changed };
}

const allAi = { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the game\'s render projection', () => {
  it('equals a whole projection through a fight: hits, shots, burning buildings and garrisons', () => {
    const { problems, changed } = playCompared(openPair('ai-garrisoned-defender-fixture', allAi), 1000);
    expect(problems).toEqual([]);
    expect(changed.get('currentHp') ?? 0, 'no hit point changed, so the fight never happened').toBeGreaterThan(200);
  }, 120_000);

  it('equals a whole projection through an opening: herding, hunting, building and the computer\'s selections', () => {
    const { problems, changed } = playCompared(openPair('aoe2-prototype', { ...allAi, victory: 'conquest-only' }), 1000);
    expect(problems).toEqual([]);
    expect(changed.get('activeVerb') ?? 0, 'no villager started or stopped work').toBeGreaterThan(10);
    expect(changed.get('visualVariant') ?? 0, 'no construction finished').toBeGreaterThan(0);
  }, 120_000);

  it('equals a whole projection while monks heal and convert', () => {
    const heal = playCompared(openPair('ai-monk-heal-fixture', allAi), 600);
    // monk-convert-fixture: player 1's Monk beside player 2's Militia, told to
    // convert it between ticks, as heresy.test.ts does.
    const pair = openPair('monk-convert-fixture', {});
    const units = pair.game.getEconomyState().units;
    const monk = units.find((unit) => unit.owner === 1 && unit.unitType === 'monk')!;
    const militia = units.find((unit) => unit.owner === 2 && unit.unitType === 'militia')!;
    for (const bridge of [pair.game, pair.full]) {
      expect(bridge.selectEntityById(monk.id)).toBe(true);
      expect(bridge.issueContextCommandAtEntity(militia.id)).toBe(true);
    }
    const ordered = compare(pair, 'the conversion ordered');
    const convert = playCompared(pair, 200);
    expect([...heal.problems, ...ordered, ...convert.problems]).toEqual([]);
    expect(heal.changed.get('currentHp') ?? 0, 'no monk healed').toBeGreaterThan(0);
    expect(convert.changed.get('owner') ?? 0, 'no unit was converted').toBeGreaterThan(0);
  }, 120_000);

  it('equals a whole projection while deer flee and a boar fights its hunters', () => {
    const deer = playCompared(openPair('deer-flee-fixture', allAi), 400);
    const boar = playCompared(openPair('boar-hunt-fixture', allAi), 400);
    expect([...deer.problems, ...boar.problems]).toEqual([]);
    expect(deer.changed.get('wildlife moved') ?? 0, 'no deer fled').toBeGreaterThan(0);
    expect(boar.changed.get('currentHp') ?? 0, 'nobody hit the boar').toBeGreaterThan(0);
  }, 120_000);

  it('equals a whole projection after each click between ticks of a paused match', () => {
    const pair = openPair('aoe2-prototype', {});
    const both = (act: (bridge: SimulationBridge) => unknown) => {
      act(pair.game);
      act(pair.full);
    };
    for (let tick = 0; tick < 40; tick += 1) both((bridge) => bridge.step(100));
    both((bridge) => bridge.setPaused(true));
    const problems = [...compare(pair, 'paused')];
    const villager = pair.game.getEconomyState().units.find((unit) => unit.owner === HUMAN_PLAYER_ID && unit.unitType === 'villager')!;
    const tree = pair.game.getRenderState().entities.find((view) => view.entityType === 'tree')!;
    // An open house site near the villager, found on the game's bridge
    // through the placement preview (read-only), then placed on both.
    const findSite = (): { x: number; y: number } => {
      const ring = Array.from({ length: 121 }, (_, i) => ({ x: Math.round(villager.x) + (i % 11) - 5, y: Math.round(villager.y) + Math.floor(i / 11) - 5 }));
      const site = ring.find((cell) => pair.game.getPlacementPreview(cell.x, cell.y)?.isValid === true);
      expect(site, 'no open site for a house near the villager').toBeDefined();
      return site!;
    };
    let site = { x: -1, y: -1 };
    const steps: Array<[string, (bridge: SimulationBridge) => boolean]> = [
      ['a tree selected', (bridge) => bridge.selectEntityById(tree.id)],
      ['a box selected', (bridge) => bridge.selectUnitsInBox(0, 0, 20, 20)],
      ['a villager selected', (bridge) => bridge.selectEntityById(villager.id)],
      ['a house begun', (bridge) => bridge.beginBuildingPlacement('house')],
      ['a house placed', (bridge) => {
        if (bridge === pair.game) site = findSite();
        return bridge.confirmBuildingPlacement(site.x, site.y);
      }],
      ['the selection cleared', (bridge) => { bridge.clearSelection(); return true; }],
    ];
    for (const [what, act] of steps) {
      expect([act(pair.game), act(pair.full)], `${what} did nothing`).toEqual([true, true]);
      problems.push(...compare(pair, what));
    }
    expect(problems).toEqual([]);
    both((bridge) => bridge.setPaused(false));
    const after = playCompared(pair, 50);
    expect(after.problems).toEqual([]);
    const drawn = pair.game.getRenderState().entities;
    expect(drawn.some((view) => view.entityType === 'house' && view.owner === HUMAN_PLAYER_ID), 'the house placed while paused was never drawn').toBe(true);
  }, 60_000);

  it('lists two entities on one spot in id order however the store came to hold them', () => {
    // A store kept by diffs holds entities in the order they arrived; a
    // whole-world snapshot inserts them in id order. Ties must not tell the two apart.
    const view = (id: number): ProjectedEntityView => ({
      id, generation: 0, kind: 'unit', layer: 'unit', entityType: 'villager', owner: 1, x: 4, y: 4, elevation: 0,
      tint: 0, size: 1, footprintWidth: 1, footprintHeight: 1, visualVariant: 'default', selected: false,
      currentHp: 25, maxHp: 25, isMemory: false,
    } as ProjectedEntityView);
    const kept = new RenderStore();
    kept.apply({ type: 'renderSnapshot', data: { render: { tick: 1, entities: [{ ref: { id: 9, generation: 0 }, view: view(9) }], frame: null }, debug: null } });
    kept.apply({ type: 'renderTick', data: { render: { tick: 2, created: [{ ref: { id: 3, generation: 0 }, view: view(3) }], updated: [], destroyed: [], frame: null }, debug: null } });
    const fresh = new RenderStore();
    fresh.apply({ type: 'renderSnapshot', data: { render: { tick: 2, entities: [3, 9].map((id) => ({ ref: { id, generation: 0 }, view: view(id) })), frame: null }, debug: null } });
    expect(kept.getEntities().map((entity) => entity.id)).toEqual(fresh.getEntities().map((entity) => entity.id));
    expect(fresh.getEntities().map((entity) => entity.id)).toEqual([3, 9]);
  });

  it('checked every field the projector writes for its JSON shape', () => {
    // The reference adapter ran civ-engine's assertJsonCompatible over each of
    // these on every comparison above; a field never seen was never checked.
    expect([...seenFields].sort()).toEqual([...VIEW_FIELDS].sort());
  });

  it('projects no terrain cell, tree, bush or mine a tick did not write, and never rebuilds the whole world', () => {
    const snapshots = vi.spyOn(RenderAdapter.prototype as unknown as { buildSnapshot(): unknown }, 'buildSnapshot');
    const projected = vi.spyOn(IncrementalRenderProjection.prototype as unknown as { projectEntity(ref: { id: number }): unknown }, 'projectEntity');
    // The fight: out-of-band changes on most ticks, over 2,160 terrain cells.
    const game = createSimulationBridge('ai-garrisoned-defender-fixture', allAi);
    let touched = new Set<number>();
    game.world.onDiff((diff) => {
      touched = new Set([...diff.entities.created, ...diff.entities.destroyed]);
      for (const changes of Object.values(diff.components)) {
        for (const [id] of changes.set) touched.add(id);
        for (const id of changes.removed) touched.add(id);
      }
    });
    const unit = game.getEconomyState().units.find((candidate) => candidate.owner === HUMAN_PLAYER_ID)!;
    let outOfBandTicks = 0;
    let statics = 0;
    const strays: string[] = [];
    for (let tick = 0; tick < 600; tick += 1) {
      // A click between ticks every 25 ticks, which the next step projects.
      if (tick % 25 === 0) game.selectEntityById(unit.id);
      if (tick % 25 === 12) game.clearSelection();
      projected.mockClear();
      game.step(100);
      const ids = projected.mock.calls.map(([ref]) => ref.id);
      if (ids.some((id) => !touched.has(id))) outOfBandTicks += 1;
      for (const id of ids) {
        if (touched.has(id) || canChangeOutOfBand(game.world, id)) continue;
        strays.push(`tick ${game.world.tick}: entity ${id}`);
      }
      if (tick === 0) {
        for (const id of game.world.getAliveEntities()) if (!canChangeOutOfBand(game.world, id)) statics += 1;
      }
    }
    expect(statics, 'the fixture has no static entity to leave alone').toBeGreaterThan(2000);
    expect(outOfBandTicks, 'no tick changed anything out of band, so nothing was measured').toBeGreaterThan(100);
    expect(strays.slice(0, 5)).toEqual([]);
    expect(snapshots, 'the game\'s bridge projected the whole world again').not.toHaveBeenCalled();
  }, 60_000);
});
