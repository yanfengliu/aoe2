// Bound: real command flow on the default, fish and trade fixtures. Counts are
// human-only HUD occupation, never income, villager population or AI policy.
import { describe, expect, it } from 'vitest';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { EconomyResourceKind, GathererComponent, UnitComponent } from '../../src/game/simulation/types';
import { placeBuildingNearTownCenter, selectOwnedBuildingDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;
const EMPTY = { food: 0, wood: 0, gold: 0, stone: 0 };
const NO_AI = { disableAiForOwners: new Set([1, 2]) };
function counts(bridge: Bridge): Record<EconomyResourceKind, number> {
  return (bridge.getHudState() as unknown as { resourceWorkers: Record<EconomyResourceKind, number> }).resourceWorkers;
}
function firstVillager(bridge: Bridge) {
  return bridge.getEconomyState().units.find((unit) => unit.owner === 1 && unit.unitType === 'villager')!;
}
function gather(bridge: Bridge, kind: 'tree' | 'sheep') {
  const node = bridge.getEconomyState().resources.find((resource) => resource.baseOwner === 1 && resource.resourceType === kind)!;
  expect(node, `own ${kind}`).toBeDefined();
  expect(bridge.issueContextCommandAtEntity(node.id)).toBe(true);
  bridge.step(100);
}

describe('resource worker occupation', () => {
  it('publishes occupation changes without modifying previously read unit components', () => {
    const bridge = createSimulationBridge('aoe2-prototype', NO_AI);
    const villager = firstVillager(bridge);
    bridge.selectUnitsByIds([villager.id]);
    const before = bridge.world.getComponent<UnitComponent>(villager.id, 'unit')!;
    gather(bridge, 'tree');
    expect(before.resourceOccupation).toBeNull();
    const assigned = bridge.world.getComponent<UnitComponent>(villager.id, 'unit')!;
    expect(assigned).not.toBe(before);
    expect(assigned.resourceOccupation).toBe('wood');
    expect(bridge.issueMoveCommand(16, 12)).toBe(true);
    bridge.step(100);
    expect(bridge.world.getComponent<UnitComponent>(villager.id, 'unit')).not.toBe(assigned);
    placeBuildingNearTownCenter(bridge, 'house');
    expect(assigned.resourceOccupation).toBe('wood');
    expect(bridge.world.getComponent<UnitComponent>(villager.id, 'unit')?.resourceOccupation).toBeNull();
  });

  it('keeps a lumberjack counted during a plain walk, excluding never-assigned walkers and idle workers', () => {
    const bridge = createSimulationBridge('aoe2-prototype', NO_AI);
    const villager = firstVillager(bridge);
    expect(counts(bridge)).toEqual(EMPTY);
    bridge.selectUnitsByIds([villager.id]);
    expect(bridge.issueMoveCommand(14, 12)).toBe(true);
    bridge.step(100);
    expect(counts(bridge)).toEqual(EMPTY);
    gather(bridge, 'tree');
    expect(counts(bridge)).toEqual({ ...EMPTY, wood: 1 });
    expect(bridge.issueMoveCommand(16, 12)).toBe(true);
    bridge.step(100);
    expect(bridge.getEconomyState().units.find((unit) => unit.id === villager.id)?.task).toBe('moving');
    expect(counts(bridge)).toEqual({ ...EMPTY, wood: 1 });
    expect(stepBridgeUntil(bridge, () => bridge.getEconomyState().units.find((unit) => unit.id === villager.id)?.task === 'idle', { maxSteps: 600 })).toBe(true);
    expect(counts(bridge)).toEqual(EMPTY);
    expect(bridge.issueMoveCommand(14, 12)).toBe(true);
    bridge.step(100);
    expect(counts(bridge)).toEqual({ ...EMPTY, wood: 1 });
  });

  it('follows the final gather assignment despite old cargo and clears occupation for building and garrison', () => {
    const bridge = createSimulationBridge('aoe2-prototype', NO_AI);
    const villager = firstVillager(bridge);
    bridge.selectUnitsByIds([villager.id]);
    gather(bridge, 'tree');
    expect(stepBridgeUntil(bridge, () => (bridge.world.getComponent<GathererComponent>(villager.id, 'gatherer')?.carriedAmount ?? 0) > 0, { maxSteps: 600 })).toBe(true);
    gather(bridge, 'sheep');
    expect(counts(bridge)).toEqual({ ...EMPTY, food: 1 });
    placeBuildingNearTownCenter(bridge, 'house');
    expect(counts(bridge)).toEqual(EMPTY);
    expect(bridge.issueMoveCommand(14, 12)).toBe(true);
    bridge.step(100);
    expect(counts(bridge)).toEqual(EMPTY);
    gather(bridge, 'sheep');
    const town = bridge.getEconomyState().buildings.find((building) => building.owner === 1 && building.buildingType === 'town-center')!;
    expect(bridge.issueContextCommandAtEntity(town.id, { garrison: true })).toBe(true);
    bridge.step(100);
    expect(counts(bridge)).toEqual(EMPTY);
    expect(stepBridgeUntil(bridge, () => !bridge.getEconomyState().units.some((unit) => unit.id === villager.id), { maxSteps: 600 })).toBe(true);
    expect(counts(bridge)).toEqual(EMPTY);
  });

  it('does not count another owner even while their gatherers work', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    for (let tick = 0; tick < 20; tick++) bridge.step(100);
    expect(bridge.getEconomyState().villagers.some((villager) => villager.owner === 2 && villager.task !== 'idle')).toBe(true);
    expect(counts(bridge)).toEqual(EMPTY);
  });

  it('clears remembered gathering work for attack-move before a later plain walk', () => {
    const bridge = createSimulationBridge('aoe2-prototype', NO_AI);
    const villager = firstVillager(bridge);
    bridge.selectUnitsByIds([villager.id]);
    gather(bridge, 'tree');
    expect(bridge.issueAttackMoveCommand(16, 12)).toBe(true);
    bridge.step(100);
    expect(counts(bridge)).toEqual(EMPTY);
    expect(bridge.issueMoveCommand(14, 12)).toBe(true);
    bridge.step(100);
    expect(counts(bridge)).toEqual(EMPTY);
  });

  it('counts active trade carts under gold and fishing ships under food', () => {
    const trade = createSimulationBridge('trade-route-fixture', NO_AI);
    const cart = trade.getEconomyState().units.find((unit) => unit.owner === 1 && unit.unitType === 'trade-cart')!;
    const market = trade.getEconomyState().buildings.find((building) => building.owner === 2 && building.buildingType === 'market')!;
    trade.selectUnitsByIds([cart.id]);
    expect(counts(trade)).toEqual(EMPTY);
    expect(trade.issueContextCommandAtEntity(market.id)).toBe(true);
    trade.step(100);
    expect(counts(trade)).toEqual({ ...EMPTY, gold: 1 });
    expect(trade.issueMoveCommand(cart.x, cart.y)).toBe(true);
    trade.step(100);
    expect(counts(trade)).toEqual(EMPTY);

    const fish = createSimulationBridge('naval-fixture', NO_AI);
    expect(selectOwnedBuildingDirect(fish, 1, 'dock')).toBe(true);
    expect(fish.queueTrainUnit('fishing-ship')).toBe(true);
    expect(stepBridgeUntil(fish, () => fish.getEconomyState().units.some((unit) => unit.owner === 1 && unit.unitType === 'fishing-ship'), { maxSteps: 600 })).toBe(true);
    const ship = fish.getEconomyState().units.find((unit) => unit.owner === 1 && unit.unitType === 'fishing-ship')!;
    const node = fish.getEconomyState().resources.find((resource) => resource.resourceType === 'fish')!;
    fish.selectUnitsByIds([ship.id]);
    expect(fish.issueContextCommand(node.x, node.y)).toBe(true);
    fish.step(100);
    expect(counts(fish)).toEqual({ ...EMPTY, food: 1 });
  });
});
