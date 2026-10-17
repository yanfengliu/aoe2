// Delete refunds a foundation with zero work, at the owner's current price
// (work 126 M2; spec §8.1). AoE2 forum discussion 137076 describes ordinary
// Delete returning foundation resources. Partial refunds are outside
// this milestone: started sites and completed structures keep their behavior.
// BOUND: real placement/Delete commands on one no-AI grass fixture; saved
// civilization/age substitutions model old foundations with no paid receipt.

import { describe, expect, it } from 'vitest';
import { SessionRecorder, SessionReplayer, type SessionBundle } from 'civ-engine';
import {
  playerAgesCodec,
  playerCivilizationsCodec,
  playerResourcesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { GameCommands, GameEvents } from '../../src/game/simulation/bridge/pureHelpers';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import {
  ENEMY_AWAY, ENEMY_SITE, HUMAN_BUILDER, HUMAN_SITE, UNBUILT_FOUNDATIONS_SEED,
} from '../../src/game/simulation/fixtures/unbuiltFoundations';
import type { AgeType, BuildableBuildingType } from '../../src/game/simulation/types';
import { economyBuilding, idsOf, placeFoundationAs, startFoundationAs } from './hiddenUnstartedFoundation.helpers';
import { asSchema2Blob, legacySchema1FromBridge, worldStateOf } from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;
const AWAY = { ...HUMAN_BUILDER };

function boot(civilization = 'Franks', age: AgeType = 'dark-age'): Bridge {
  const initial = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED, {
    civilizationsByOwner: new Map([[1, civilization]]),
    renderProjection: 'on-read',
  });
  const blob = asSchema2Blob(initial.saveGame());
  worldStateOf(blob)[playerAgesCodec.slot] = [[1, age], [2, 'dark-age'], [3, 'dark-age']];
  return createSimulationBridge(UNBUILT_FOUNDATIONS_SEED, { savedGame: blob, renderProjection: 'on-read' });
}

function funds(bridge: Bridge, owner = 1) {
  return { ...bridge.getEconomyState().playerResources[owner]! };
}

function place(bridge: Bridge, type: BuildableBuildingType = 'house'): { site: number; builder: number } {
  const builder = bridge.getEconomyState().units.find((unit) => (
    unit.owner === 1 && unit.x === HUMAN_BUILDER.x && unit.y === HUMAN_BUILDER.y
  ))!.id;
  return { site: placeFoundationAs(bridge, builder, type, HUMAN_SITE, AWAY), builder };
}

function remove(bridge: Bridge, site: number): void {
  expect(bridge.selectEntityById(site)).toBe(true);
  expect(bridge.deleteSelectedEntity()).toBe(true);
  bridge.step(100);
  expect(economyBuilding(bridge, site)).toBeUndefined();
}

describe('Delete refunds only a foundation nobody has started (work 126 M2)', () => {
  it.each([['Franks', 25], ['Malians', 21]] as const)('refunds the current %s House price through the Delete control', (civilization, woodCost) => {
    const bridge = boot(civilization);
    const before = funds(bridge);
    const { site } = place(bridge);
    expect(funds(bridge)).toEqual({ ...before, wood: before.wood - woodCost });
    remove(bridge, site);
    expect(funds(bridge)).toEqual(before);
    const saved = asSchema2Blob(bridge.saveGame());
    const stock = worldStateOf(saved)[playerResourcesCodec.slot] as Array<[number, unknown]>;
    expect(stock.find(([owner]) => owner === 1)?.[1], 'the refund must reach the save').toEqual(before);
  });

  it.each([['feudal-age', 275], ['castle-age', 138]] as const)('loads a receipt-free legacy foundation and uses the current Briton %s price', (age, woodRefund) => {
    const original = boot('Franks', 'castle-age');
    const before = funds(original);
    const { site } = place(original, 'town-center');
    const paid = funds(original);
    expect(paid).toEqual({ ...before, wood: before.wood - 275, stone: before.stone - 100 });
    const blob = asSchema2Blob(original.saveGame());
    worldStateOf(blob)[playerCivilizationsCodec.slot] = [[1, 'Britons'], [2, 'Franks'], [3, 'Franks']];
    worldStateOf(blob)[playerAgesCodec.slot] = [[1, age], [2, 'dark-age'], [3, 'dark-age']];
    const loaded = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED, { savedGame: blob, renderProjection: 'on-read' });
    expect(economyBuilding(loaded, site)?.buildProgressTicks).toBe(0);
    remove(loaded, site);
    expect(funds(loaded)).toEqual({ ...paid, wood: paid.wood + woodRefund, stone: paid.stone + 100 });
  });

  it('adds no refund once the first build progress stands', () => {
    const bridge = boot();
    const { site, builder } = place(bridge);
    startFoundationAs(bridge, builder, site, AWAY);
    expect(economyBuilding(bridge, site)?.buildProgressTicks).toBeGreaterThan(0);
    const before = funds(bridge);
    remove(bridge, site);
    expect(funds(bridge)).toEqual(before);
  });

  it('refunds a foundation loaded from a schema-1 save with no paid-cost field', () => {
    const original = boot('Malians');
    const before = funds(original);
    const { site } = place(original);
    const loaded = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED, {
      savedGame: legacySchema1FromBridge(original), renderProjection: 'on-read',
    });
    remove(loaded, site);
    expect(funds(loaded)).toEqual(before);
  });

  it('re-simulates a recorded Delete and its refund exactly', () => {
    const bridge = boot();
    const before = funds(bridge);
    const { site } = place(bridge);
    const recorder = new SessionRecorder({
      world: bridge.world, snapshotInterval: 1, terminalSnapshot: true,
      sourceKind: 'session', sourceLabel: 'foundation-delete-refund',
    });
    recorder.connect();
    try {
      remove(bridge, site);
      expect(funds(bridge)).toEqual(before);
    } finally {
      recorder.disconnect();
    }
    const bundle = recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>;
    const result = SessionReplayer.fromBundle(bundle, {
      worldFactory: (snapshot) => createReplayWorldOnly(snapshot), skipRegistrationCheck: true,
    }).selfCheck();
    expect(result, JSON.stringify(result.stateDivergences.slice(0, 3))).toMatchObject({ ok: true, skippedSegments: [] });
    expect(result.checkedSegments).toBeGreaterThan(0);
  });

  it('adds no refund for a completed building', () => {
    const bridge = boot();
    const townCenter = bridge.getEconomyState().buildings.find((building) => building.owner === 1 && building.isComplete)!;
    const before = funds(bridge);
    remove(bridge, townCenter.id);
    expect(funds(bridge)).toEqual(before);
  });

  it('refuses an enemy foundation and credits neither seat', () => {
    const bridge = boot();
    const site = placeFoundationAs(bridge, idsOf(bridge, 2, 'villager')[0]!, 'barracks', ENEMY_SITE, ENEMY_AWAY);
    const own = funds(bridge);
    const enemy = funds(bridge, 2);
    expect(bridge.world.submitWithResult('entity.delete', { entityId: site, requestedBy: 1 }).accepted).toBe(false);
    bridge.step(100);
    expect(economyBuilding(bridge, site)).toBeDefined();
    expect(funds(bridge)).toEqual(own);
    expect(funds(bridge, 2)).toEqual(enemy);
  });

  it('rechecks ownership when an accepted Delete executes after the owner changed', () => {
    const bridge = boot();
    const { site } = place(bridge);
    const before = funds(bridge);
    expect(bridge.world.submitWithResult('entity.delete', { entityId: site, requestedBy: 1 }).accepted).toBe(true);
    const building = bridge.world.getComponent<{ owner: number; buildingType: 'house' }>(site, 'building')!;
    bridge.world.runMaintenance(() => bridge.world.setComponent(site, 'building', { ...building, owner: 2 }));
    bridge.step(100);
    expect(economyBuilding(bridge, site)?.owner).toBe(2);
    expect(funds(bridge)).toEqual(before);
  });

  it('refunds only once when two Delete commands were accepted before the first executes', () => {
    const bridge = boot();
    const before = funds(bridge);
    const { site } = place(bridge);
    expect(bridge.selectEntityById(site)).toBe(true);
    expect(bridge.deleteSelectedEntity()).toBe(true);
    expect(bridge.world.submitWithResult('entity.delete', { entityId: site, requestedBy: 1 }).accepted).toBe(true);
    bridge.step(100);
    expect(economyBuilding(bridge, site)).toBeUndefined();
    expect(funds(bridge)).toEqual(before);
    expect(bridge.world.submitWithResult('entity.delete', { entityId: site, requestedBy: 1 }).accepted).toBe(false);
    bridge.step(100);
    expect(funds(bridge)).toEqual(before);
  });
});
