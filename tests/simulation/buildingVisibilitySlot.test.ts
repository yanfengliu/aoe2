// A player's building sight has a world-state slot of its own (2026-09-25).
// The engine fingerprints, validates and diffs every state slot written in a
// tick, and the units' slot is written on nearly every tick, because a unit
// moves, and it fingerprints every slot twice a tick whether written or not.
// While each owner's building layer rode in the units' slot, its sources and
// explored cells were re-validated on every one of those ticks: +0.13 to
// +0.9 ms/tick in `clearStateDirty` alone on one saved world, profiled in both
// arms. So `aoe2.buildingVisibility` is written when a building's sight changes
// (and at start and on a save), holds only what a load cannot rebuild (the
// ground only buildings explored), and a load reads both slots into one map.
//
// BOUND: the raid fixture's lone House, raided down; the slot writer and
// reader themselves are unit-tested in layeredVisibilityMap.test.ts.

import type { VisibilityMapState } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { TIER_3_SLOTS } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { buildingSightKey } from '../../src/game/simulation/bridge/layeredVisibilityMap';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

const slot = (bridge: Bridge, key: string) => bridge.world.getState(key) as unknown as VisibilityMapState | undefined;
const houseOf = (bridge: Bridge) =>
  bridge.getEconomyState().buildings.find((building) => building.owner === 1 && building.buildingType === 'house');

function raidTheHouse(bridge: Bridge): void {
  const house = houseOf(bridge)!;
  for (const raider of bridge.getEconomyState().units.filter((unit) => unit.owner === 2 && unit.unitType === 'militia')) {
    bridge.pendingCommands.push({
      type: 'unit.attack',
      data: { unitId: raider.id, targetEntityId: house.id, targetEntityKind: 'building' },
    });
  }
}

describe('building sight has a world-state slot of its own', () => {
  it('is left as it was on a tick in which only units move', () => {
    const bridge = createSimulationBridge('raid-warning-fixture');
    bridge.step(100);
    const buildings = slot(bridge, TIER_3_SLOTS.buildingVisibility);
    expect(buildings?.players.map(([player]) => player), 'the House’s sight is in the building slot').toContain(buildingSightKey(1));
    expect(slot(bridge, TIER_3_SLOTS.visibility)?.players.some(([player]) => player === buildingSightKey(1))).toBe(false);

    raidTheHouse(bridge);
    const units = slot(bridge, TIER_3_SLOTS.visibility);
    // The raiders walk; the House still stands, so no building's sight changed.
    expect(stepBridgeUntil(bridge, () => slot(bridge, TIER_3_SLOTS.visibility) !== units, { maxSteps: 50 }), 'the premise: a unit moved and its slot was rewritten').toBe(true);
    expect(houseOf(bridge), 'the premise: the House still stands').toBeDefined();
    expect(slot(bridge, TIER_3_SLOTS.buildingVisibility)).toBe(buildings);
  }, 60_000);

  it('is rewritten when a building’s sight changes, and a load brings its explored ground back', () => {
    const bridge = createSimulationBridge('raid-warning-fixture');
    bridge.step(100);
    const house = houseOf(bridge)!;
    const before = slot(bridge, TIER_3_SLOTS.buildingVisibility);
    raidTheHouse(bridge);
    expect(stepBridgeUntil(bridge, () => houseOf(bridge) === undefined, { maxSteps: 6_000 }), 'the raiders never destroyed the House').toBe(true);
    bridge.step(100);
    const after = slot(bridge, TIER_3_SLOTS.buildingVisibility)!;
    expect(after).not.toBe(before);
    const ownerOne = (state: VisibilityMapState) => state.players.find(([player]) => player === buildingSightKey(1))?.[1];
    expect(bridge.isCellVisibleForOwner(1, house.x, house.y), 'the House took its sight with it').toBe(false);
    // Only the House ever saw its own cells: the human has nothing else near it.
    const houseCell = house.y * bridge.getMapSize().width + house.x;
    expect(ownerOne(after)?.explored, 'the premise: the building layer explored the House’s ground').toContain(houseCell);

    const blob = JSON.parse(JSON.stringify(bridge.saveGame())) as ReturnType<Bridge['saveGame']>;
    const loaded = createSimulationBridge('raid-warning-fixture', { savedGame: blob });
    expect(ownerOne(slot(loaded, TIER_3_SLOTS.buildingVisibility)!)?.explored).toContain(houseCell);
    expect(slot(loaded, TIER_3_SLOTS.buildingVisibility)).toEqual(after);
  }, 120_000);
});
