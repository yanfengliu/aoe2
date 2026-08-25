import { describe, expect, it } from 'vitest';

import { canCarryRelics, isMonasticUnit } from '../../src/game/simulation/monasticUnits';
import { monkCarriedRelicCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { trainingCost, trainingTimeTicks } from '../../src/game/simulation/prototypeEconomyRules';
import { canTrainAt } from '../../src/game/simulation/prototypeBuildingRules';
import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
import { movementSpeedPercent } from '../../src/game/simulation/movementTechEffects';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

// The Spanish Missionary (units.csv): a monk on horseback — HP 30, speed 1.1,
// 100 gold at the Monastery — that heals, converts and rests like a Monk but
// CANNOT carry relics. The last implementable unit of the roster.

describe('the Missionary — data', () => {
  it('costs what units.csv says and belongs to the monastic line', () => {
    expect(trainingCost('missionary')).toEqual({ gold: 100 });
    expect(trainingTimeTicks('missionary')).toBe(510);
    expect(canTrainAt('monastery', 'missionary')).toBe(true);
    expect(UNIT_MAX_HP.missionary).toBe(30);
    expect(isMonasticUnit('missionary')).toBe(true);
    expect(isMonasticUnit('monk')).toBe(true);
    expect(isMonasticUnit('knight')).toBe(false);
  });

  it('rides: faster than a monk, and faster still with Husbandry', () => {
    const none = new Set<'husbandry'>();
    expect(movementSpeedPercent(none, 'missionary'))
      .toBeGreaterThan(movementSpeedPercent(none, 'monk'));
    expect(movementSpeedPercent(new Set(['husbandry']), 'missionary'))
      .toBeGreaterThan(movementSpeedPercent(none, 'missionary'));
  });

  it('cannot carry relics — the monk can', () => {
    expect(canCarryRelics('monk')).toBe(true);
    expect(canCarryRelics('missionary')).toBe(false);
  });
});

describe('the Missionary in a real match', () => {
  it('is offered at a Spanish Monastery and at nobody else’s', () => {
    const spanish = createSimulationBridge('missionary-fixture');
    expect(selectOwnedBuildingDirect(spanish, 1, 'monastery')).toBe(true);
    expect(spanish.getSelectionState().trainOptions).toContain('missionary');

    const notSpanish = createSimulationBridge('monastery-fixture');
    expect(selectOwnedBuildingDirect(notSpanish, 1, 'monastery')).toBe(true);
    expect(notSpanish.getSelectionState().trainOptions).not.toContain('missionary');
  });

  it('trains, then converts an enemy unit the way a monk does', () => {
    const bridge = createSimulationBridge('missionary-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'monastery')).toBe(true);
    expect(bridge.queueTrainUnit('missionary')).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some((unit) => unit.unitType === 'missionary'),
      { maxSteps: 700 },
    )).toBe(true);

    const missionary = bridge.getEconomyState().units.find(
      (unit) => unit.unitType === 'missionary',
    )!;
    const enemy = bridge.getEconomyState().units.find((unit) => unit.owner === 2)!;
    expect(bridge.selectEntityById(missionary.id)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(enemy.id)).toBe(true);
    // Conversion flips the enemy's owner — the monk suite's own claim, made
    // by the rider this time.
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some(
        (unit) => unit.id === enemy.id && unit.owner === 1,
      ),
      { maxSteps: 3_000 },
    )).toBe(true);
  }, 90_000);

  it('refuses to pick up a relic', () => {
    const bridge = createSimulationBridge('missionary-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'monastery')).toBe(true);
    expect(bridge.queueTrainUnit('missionary')).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some((unit) => unit.unitType === 'missionary'),
      { maxSteps: 700 },
    )).toBe(true);
    const missionary = bridge.getEconomyState().units.find(
      (unit) => unit.unitType === 'missionary',
    )!;
    const relic = bridge.getEconomyState().resources.find(
      (resource) => resource.resourceType === 'relic',
    );
    expect(relic, 'the fixture should ground a relic').toBeDefined();
    const relicHome = { x: relic!.x, y: relic!.y };
    expect(bridge.selectEntityById(missionary.id)).toBe(true);
    bridge.issueContextCommandAtEntity(relic!.id);
    for (let step = 0; step < 600; step += 1) bridge.step(100);
    // A PICKED-UP relic stays alive and rides its carrier, so "still exists"
    // proves nothing. The refusal is: nobody carries it, and it never moved.
    const blob = asSchema2Blob(bridge.saveGame());
    expect(worldStateOf(blob)[monkCarriedRelicCodec.slot] ?? []).toEqual([]);
    const grounded = bridge.getEconomyState().resources.find(
      (resource) => resource.id === relic!.id,
    );
    expect(grounded).toMatchObject(relicHome);
  }, 60_000);
});
