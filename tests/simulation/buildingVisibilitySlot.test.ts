// A player's building sight has a world-state slot of its own (2026-09-25).
// The engine fingerprints, validates and diffs every state slot written in a
// tick, and the units' slot is written on nearly every tick, because a unit
// moves, and it fingerprints every slot twice a tick whether written or not.
// While each owner's building layer rode in the units' slot, its sources and
// explored cells were walked on every one of those ticks: about +0.27 ms/tick
// in the engine's two state walks together, on the boot map's tick-30,000
// world profiled in both arms. So `aoe2.buildingVisibility` holds only what a load cannot rebuild,
// the ground only buildings explored, current at every tick and written only
// when that changes, and a load reads both slots into one map.
//
// BOUND: the raid fixture's lone House, raided down; the slot writer and
// reader themselves are unit-tested in layeredVisibilityMap.test.ts.

import type { VisibilityMapState } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { TIER_3_SLOTS } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { buildingSightKey, type LayeredVisibilityMap } from '../../src/game/simulation/bridge/layeredVisibilityMap';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { getReplayWorldContext } from '../../src/game/simulation/replay/replayWorldContext';
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

  it('keeps the ground a destroyed building explored, and a load brings it back', () => {
    const bridge = createSimulationBridge('raid-warning-fixture');
    bridge.step(100);
    const house = houseOf(bridge)!;
    const before = slot(bridge, TIER_3_SLOTS.buildingVisibility);
    raidTheHouse(bridge);
    expect(stepBridgeUntil(bridge, () => houseOf(bridge) === undefined, { maxSteps: 6_000 }), 'the raiders never destroyed the House').toBe(true);
    bridge.step(100);
    const after = slot(bridge, TIER_3_SLOTS.buildingVisibility)!;
    expect(before, 'the premise: the slot was written at the start').toBeDefined();
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

  it('holds what the map holds now, at every tick, in a live world and in one loaded from its save', () => {
    // The slot keeps the cells no unit of the owner explored, and those shrink
    // as units explore. Written only when a building's sight changed, it went
    // stale in the live world while a loaded world computed it fresh: at the
    // boot map's tick 1,000 the live slot held 42 and 77 cells and the loaded
    // one 22 and 17, and they stayed apart until the next building change.
    // Replays compare exactly this state.
    // What the map holds now, asked of the map itself rather than of the
    // slot writer: a replay world built from the live world's own snapshot.
    const current = (bridge: Bridge) => {
      const replay = createReplayWorldOnly(structuredClone(bridge.world.serialize()));
      return (getReplayWorldContext(replay)!.visibility as LayeredVisibilityMap).getBuildingLayerState();
    };
    const options = { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) };
    const live = createSimulationBridge('aoe2-prototype', options);
    for (let tick = 0; tick < 1_000; tick += 1) live.step(100);
    expect(slot(live, TIER_3_SLOTS.buildingVisibility), 'the live slot is current').toEqual(current(live));
    const blob = JSON.parse(JSON.stringify(live.saveGame())) as ReturnType<Bridge['saveGame']>;
    const loaded = createSimulationBridge('aoe2-prototype', { ...options, savedGame: blob });
    expect(slot(loaded, TIER_3_SLOTS.buildingVisibility), 'at the load').toEqual(slot(live, TIER_3_SLOTS.buildingVisibility));
    for (let tick = 0; tick < 50; tick += 1) {
      live.step(100);
      loaded.step(100);
    }
    expect(slot(loaded, TIER_3_SLOTS.buildingVisibility), '50 ticks later').toEqual(slot(live, TIER_3_SLOTS.buildingVisibility));
    expect(slot(live, TIER_3_SLOTS.buildingVisibility), 'and still current').toEqual(current(live));
  }, 120_000);
});
