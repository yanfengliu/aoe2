// The render state's entity list is, at every tick of a match, the list the code before work 150 M2b built: every
// view the store holds sorted by layer, row, column and id, those the perspective cannot see now removed, and the
// fog's memories merged in by one stable sort of the whole list. Rank 1 of that work stopped sorting and walking
// the map's cells on every tick; this holds that nothing else about the list moved, on the worlds its count gates
// stand on.
//
// HOW. The old algorithm is kept below as the oracle. It needs what the bridge's own assembly reads (the store,
// the visibility map, the sight owners, the fog's memory), which the bridge keeps to itself, so the module that
// builds the assembly is wrapped to keep the dependencies it is given; nothing else about it is replaced. At each
// tick the bridge's list is compared with the oracle's, view by view: the same object where both hold the store's
// view, and an equal one where each asked the fog for its own copy of a memory.
//
// BOUND. The oracle reads the views out of the same store, so a view the store lost would be missing from both:
// tests/simulation/renderStoreLists.test.ts holds the store's list against the messages it was sent. It sorts them
// from the reverse of the store's order, and requires that no two compare equal, so the store's order cannot leak
// into it.
import { describe, expect, it, vi } from 'vitest';

import { isLiveEntityDrawn } from '../../src/game/simulation/bridge/humanSight';
import { compareProjectedRenderEntities } from '../../src/game/simulation/bridge/pureHelpers';
import type { RenderStateOpsDeps } from '../../src/game/simulation/bridge/renderStateOps';
import { createSimulationBridge, type SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { createDeTinySizedBridge } from '../helpers/deTinySizedWorld';

const capturedDeps: RenderStateOpsDeps[] = [];

vi.mock('../../src/game/simulation/bridge/renderStateOps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/game/simulation/bridge/renderStateOps')>();
  return {
    ...actual,
    createRenderStateOps: (deps: RenderStateOpsDeps) => {
      capturedDeps.push(deps);
      return actual.createRenderStateOps(deps);
    },
  };
});

function legacyCompare(left: ProjectedEntityView, right: ProjectedEntityView): number {
  const layerOrder = ['terrain', 'resource', 'building', 'unit'];
  const layerDelta = layerOrder.indexOf(left.layer) - layerOrder.indexOf(right.layer);
  if (layerDelta !== 0) return layerDelta;
  if (left.y !== right.y) return left.y - right.y;
  if (left.x !== right.x) return left.x - right.x;
  return left.id - right.id;
}

/** The list as `getRenderState` built it before work 150 M2b, from the same dependencies. */
function legacyEntities(deps: RenderStateOpsDeps): ProjectedEntityView[] {
  const sorted = deps.renderStore.getEntities().reverse().sort(legacyCompare);
  for (let index = 1; index < sorted.length; index += 1) {
    if (legacyCompare(sorted[index - 1]!, sorted[index]!) === 0) {
      throw new Error(`two stored views compare equal (ids ${String(sorted[index - 1]!.id)} and ${String(sorted[index]!.id)}): the old order depended on the store's`);
    }
  }
  const sight = deps.getSightOwners();
  const live = sorted.filter((entity) => (
    entity.kind === 'tile'
    || isLiveEntityDrawn(deps.visibility, sight, deps.humanPlayerId, entity, () => (
      entity.kind === 'building' && deps.isFoundationHidden(entity.id)
    ))
  ));
  if (deps.getHumanFogMemorySize() === 0) return live;
  const liveIds = new Set<number>();
  for (const entity of live) liveIds.add(entity.id);
  const memory = deps.getFogMemoryEntities(liveIds);
  if (memory.length === 0) return live;
  const merged = live.slice();
  for (const entity of memory) merged.push(entity);
  merged.sort(compareProjectedRenderEntities);
  return merged;
}

interface Compared { ticks: number; views: number; sameObject: number; remembered: number; ticksWithMemory: number }

function compareOver(bridge: SimulationBridge, deps: RenderStateOpsDeps, ticks: number): Compared {
  const compared: Compared = { ticks: 0, views: 0, sameObject: 0, remembered: 0, ticksWithMemory: 0 };
  for (let tick = 0; tick < ticks; tick += 1) {
    bridge.step(1000 / TPS);
    const actual = bridge.getRenderState().entities;
    const expected = legacyEntities(deps);
    if (actual.length !== expected.length) {
      throw new Error(`tick ${String(bridge.getRenderState().tick)}: the list holds ${String(actual.length)} views, the old algorithm's ${String(expected.length)}`);
    }
    let rememberedThisTick = 0;
    for (let index = 0; index < actual.length; index += 1) {
      const view = actual[index]!;
      if (view === expected[index]) {
        compared.sameObject += 1;
      } else {
        // Only a memory is a copy of its own; anything else must be the store's own view.
        expect(view.isMemory, `tick ${String(bridge.getRenderState().tick)}, index ${String(index)}: a different object that is no memory`).toBe(true);
        expect(view).toEqual(expected[index]);
      }
      if (view.isMemory) rememberedThisTick += 1;
    }
    compared.ticks += 1;
    compared.views += actual.length;
    compared.remembered += rememberedThisTick;
    if (rememberedThisTick > 0) compared.ticksWithMemory += 1;
  }
  return compared;
}

describe('the render state\'s list is the list the old algorithm built', () => {
  it('at every tick of a match on today\'s map', () => {
    const bridge = createSimulationBridge('aoe2-prototype', { forceAiForOwners: new Set([1]) });
    const compared = compareOver(bridge, capturedDeps.at(-1)!, 1_500);
    expect(compared.ticks).toBe(1_500);
    // The merge with the fog's memories was on the path for most of the match, not only the plain list.
    expect(compared.ticksWithMemory).toBeGreaterThan(500);
    expect(compared.sameObject).toBeGreaterThan(1_500 * 2_160);
  }, 240_000);

  it('at every tick of a match on a DE Tiny sized world', () => {
    const bridge = createDeTinySizedBridge();
    const compared = compareOver(bridge, capturedDeps.at(-1)!, 900);
    expect(compared.ticks).toBe(900);
    expect(compared.ticksWithMemory).toBeGreaterThan(200);
    expect(compared.sameObject).toBeGreaterThan(900 * 14_400);
  }, 240_000);

  it('through a selection, which changes the list between ticks', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const deps = capturedDeps.at(-1)!;
    for (let tick = 0; tick < 5; tick += 1) bridge.step(1000 / TPS);
    const before = bridge.getRenderState().entities;
    const villager = before.find((entity) => entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager')!;
    expect(bridge.selectEntityAtCell(Math.floor(villager.x), Math.floor(villager.y))).toBe(true);
    const after = bridge.getRenderState().entities;
    expect(after, 'a new list after the selection').not.toBe(before);
    expect(after.filter((entity) => entity.selected).map((entity) => entity.id)).toContain(villager.id);
    const expected = legacyEntities(deps);
    expect(after).toHaveLength(expected.length);
    after.forEach((view, index) => { expect(view).toBe(expected[index]); });
  }, 60_000);
});
