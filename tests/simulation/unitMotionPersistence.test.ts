import { describe, expect, it } from 'vitest';

import {
  playerResourcesCodec,
  populationCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type {
  PlayerResources,
  PopulationState,
  UnitTransformComponent,
} from '../../src/game/simulation/types';
import { maxFineStepPerTick, stepBridgeUntil } from './createSimulationBridge.helpers';
import { worldStateOf } from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;
type EconomyUnit = ReturnType<Bridge['getEconomyState']>['units'][number];

function createOverflowFixture(): {
  bridge: Bridge;
  scout: EconomyUnit;
  occupants: EconomyUnit[];
} {
  const seeded = createSimulationBridge('unit-sharing-fixture', {
    disableAiForOwners: new Set([2]),
  });
  const richSave = structuredClone(seeded.saveGame());
  const state = worldStateOf(richSave);
  const resources = state[playerResourcesCodec.slot] as Array<[number, PlayerResources]>;
  const playerResources = resources.find(([owner]) => owner === 1)?.[1];
  const populations = state[populationCodec.slot] as Array<[number, PopulationState]>;
  const playerPopulation = populations.find(([owner]) => owner === 1)?.[1];
  if (!playerResources || !playerPopulation) {
    throw new Error('expected player-one economy state');
  }
  playerResources.food = 10_000;
  playerPopulation.cap = 200;
  playerPopulation.rawSupply = 200;

  const bridge = createSimulationBridge('ignored', { savedGame: richSave });
  const scout = bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
  const townCenter = bridge
    .getEconomyState()
    .buildings.find((building) => building.owner === 1 && building.buildingType === 'town-center');
  if (!scout || !townCenter) {
    throw new Error('expected scout and town center');
  }

  expect(bridge.selectEntityById(townCenter.id)).toBe(true);
  while (
    bridge.getEconomyState().units.filter(
      (unit) => unit.owner === 1 && unit.id > scout.id,
    ).length < 16
  ) {
    const unitCount = bridge.getEconomyState().units.filter((unit) => unit.owner === 1).length;
    expect(bridge.queueTrainUnit('villager')).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.filter((unit) => unit.owner === 1).length > unitCount,
      { maxSteps: 1_000 },
    )).toBe(true);
  }

  const occupants = bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === 1 && unit.id > scout.id)
    .slice(0, 16);
  expect(occupants).toHaveLength(16);
  for (const unit of occupants) {
    bridge.clearSelection();
    expect(bridge.selectEntityById(unit.id)).toBe(true);
    expect(bridge.issueMoveCommand(20, 10)).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some(
        (candidate) => candidate.id === unit.id
          && candidate.x === 20
          && candidate.y === 10
          && candidate.task === 'idle',
      ),
      { maxSteps: 1_000 },
    )).toBe(true);
  }

  // Bypass eager group allocation intentionally to exercise lazy arrival
  // overflow. Every parked occupant has a higher id, so id-order alone would
  // promote this scout before restoring its saved peers.
  expect(bridge.world.submitWithResult('unit.move', {
    unitId: scout.id,
    target: { x: 20, y: 10 },
  }).accepted).toBe(true);
  expect(stepBridgeUntil(
    bridge,
    () => bridge.getEconomyState().units.some(
      (unit) => unit.id === scout.id
        && unit.x === 20
        && unit.y === 10
        && unit.task === 'moving',
    ),
    { maxSteps: 1_000 },
  )).toBe(true);
  expect(
    bridge.world.getComponent<UnitTransformComponent>(scout.id, 'unitTransform')
      ?.occupancySlotOverflow,
  ).toBe(true);
  return { bridge, scout, occupants };
}

describe('unit motion persistence', () => {
  it('keeps an authoritative overflow unit overflowed across save/load', () => {
    const { bridge, scout } = createOverflowFixture();
    const before = bridge.world.getComponent<UnitTransformComponent>(scout.id, 'unitTransform');
    const loaded = createSimulationBridge('ignored', {
      savedGame: structuredClone(bridge.saveGame()),
    });
    expect(loaded.world.getComponent(scout.id, 'unitTransform')).toEqual(before);

    bridge.step(100);
    loaded.step(100);
    expect(loaded.world.getComponent(scout.id, 'unitTransform'))
      .toEqual(bridge.world.getComponent(scout.id, 'unitTransform'));
    expect(loaded.getEconomyState().units.find((unit) => unit.id === scout.id)?.task)
      .toBe(bridge.getEconomyState().units.find((unit) => unit.id === scout.id)?.task);
  }, 30_000);

  it('restores overflow before smoothly claiming a slot freed before save', () => {
    const { bridge, scout, occupants } = createOverflowFixture();
    bridge.world.runMaintenance(() => {
      bridge.world.destroyEntity(occupants[0]!.id);
    });
    const before = bridge.world.getComponent<UnitTransformComponent>(scout.id, 'unitTransform');
    expect(before?.occupancySlotOverflow).toBe(true);

    const loaded = createSimulationBridge('ignored', {
      savedGame: structuredClone(bridge.saveGame()),
    });
    expect(loaded.world.getComponent(scout.id, 'unitTransform')).toEqual(before);

    let rebound: UnitTransformComponent | undefined;
    let previous = before;
    for (let tick = 0; tick < 10; tick += 1) {
      bridge.step(100);
      loaded.step(100);
      const uninterrupted = bridge.world.getComponent<UnitTransformComponent>(
        scout.id,
        'unitTransform',
      );
      const restored = loaded.world.getComponent<UnitTransformComponent>(
        scout.id,
        'unitTransform',
      );
      const uninterruptedTask = bridge
        .getEconomyState()
        .units.find((unit) => unit.id === scout.id)?.task;
      const restoredTask = loaded
        .getEconomyState()
        .units.find((unit) => unit.id === scout.id)?.task;
      expect(restored).toEqual(uninterrupted);
      expect(restoredTask).toBe(uninterruptedTask);
      if (previous && restored) {
        expect(Math.hypot(
          restored.fineX - previous.fineX,
          restored.fineY - previous.fineY,
        )).toBeLessThanOrEqual(maxFineStepPerTick('scout'));
      }
      previous = restored;
      if (restoredTask === 'idle') {
        rebound = restored;
        break;
      }
    }
    expect(rebound?.occupancySlotOverflow).toBeUndefined();
    expect(Number.isFinite(rebound?.occupancySlotX)).toBe(true);
    expect(Number.isFinite(rebound?.occupancySlotY)).toBe(true);
  }, 30_000);
});
