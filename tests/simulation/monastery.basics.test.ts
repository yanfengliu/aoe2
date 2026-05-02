import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function countOwnedUnits(bridge: Bridge, owner: number, unitType: string): number {
  return bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === owner && unit.unitType === unitType).length;
}

function findFirstOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function findUnitById(bridge: Bridge, id: number) {
  return bridge.getEconomyState().units.find((unit) => unit.id === id);
}

function getHealthOfUnitAtCell(bridge: Bridge, x: number, y: number): number | null {
  if (!bridge.selectEntityAtCell(x, y)) {
    return null;
  }
  return bridge.getSelectionState().health?.current ?? null;
}

describe('Slice 5 Monastery + Monks + Relics — basics', () => {
  it('exposes Monastery in a villager placement menu at Castle Age', () => {
    const bridge = createSimulationBridge('monastery-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const buildOptions = bridge.getSelectionState().buildOptions;
    expect(buildOptions).toContain('monastery');
  });

  it('does not offer Monastery while still in Feudal Age', () => {
    const bridge = createSimulationBridge('feudal-blacksmith-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const buildOptions = bridge.getSelectionState().buildOptions;
    expect(buildOptions).not.toContain('monastery');
  });

  it('exposes Monk in the Monastery train menu at Castle Age', () => {
    const bridge = createSimulationBridge('monastery-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'monastery')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toContain('monk');
  });

  it('trains a Monk when the Monastery is selected and the train command is issued', () => {
    const bridge = createSimulationBridge('monastery-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'monastery')).toBe(true);
    expect(bridge.queueTrainUnit('monk')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'monk') === 1,
        { maxSteps: 700 },
      ),
    ).toBe(true);

    const monk = findFirstOwnedUnit(bridge, 1, 'monk');
    expect(monk).toMatchObject({
      unitType: 'monk',
      attackDamage: 0,
    });
  }, 40_000);

  it('heals a friendly wounded unit over ticks when a Monk is ordered to heal it', () => {
    const bridge = createSimulationBridge('monk-heal-fixture');
    const spearmanBefore = findFirstOwnedUnit(bridge, 1, 'spearman');
    expect(spearmanBefore).toBeDefined();
    const spearmanId = spearmanBefore!.id;

    // Wolf auto-aggros on the Spearman; Spearman's default idle state does
    // not fight back. Let the wolf work the Spearman's HP down.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const s = findUnitById(bridge, spearmanId);
          if (!s) return false;
          const hp = getHealthOfUnitAtCell(bridge, s.x, s.y);
          return hp !== null && hp < 35 && hp > 5;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Kill the wolf by ordering the Spearman to attack it. That stops the
    // incoming damage so the heal can catch up.
    const wolf = bridge.getEconomyState().resources.find((r) => r.resourceType === 'wolf');
    expect(wolf).toBeDefined();
    // Resolve the wolf entity id via selectEntityAtCell — economy state does
    // not expose ids.
    expect(bridge.selectEntityAtCell(wolf!.x, wolf!.y)).toBe(true);
    const wolfId = bridge.getSelectionState().selectedEntityId!;

    expect(selectOwnedUnitDirect(bridge, 1, 'spearman')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(wolfId)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().resources.find((r) => r.resourceType === 'wolf') === undefined,
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Move the Spearman back adjacent to the Monk so heal range covers.
    const monk = findFirstOwnedUnit(bridge, 1, 'monk');
    expect(monk).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, 1, 'spearman')).toBe(true);
    expect(bridge.issueMoveCommand(monk!.x + 1, monk!.y)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const s = findUnitById(bridge, spearmanId);
          return (
            s !== undefined
            && Math.abs(s.x - monk!.x) + Math.abs(s.y - monk!.y) <= 2
          );
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Record HP just before the heal order.
    const prehealUnit = findUnitById(bridge, spearmanId);
    expect(prehealUnit).toBeDefined();
    const prehealHp = getHealthOfUnitAtCell(bridge, prehealUnit!.x, prehealUnit!.y);
    expect(prehealHp).not.toBeNull();
    expect(prehealHp).toBeLessThan(45);

    // Issue the Monk heal order.
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(spearmanId)).toBe(true);

    // 300 ticks → up to 30 HP at 1 HP / 10 ticks, capped at 45.
    bridge.step(300 * 100);

    const healed = findUnitById(bridge, spearmanId);
    expect(healed).toBeDefined();
    const healedHp = getHealthOfUnitAtCell(bridge, healed!.x, healed!.y);
    expect(healedHp).not.toBeNull();
    expect(healedHp).toBeGreaterThan(prehealHp!);
    expect(healedHp).toBeLessThanOrEqual(45);
  }, 60_000);

  it('converts an enemy unit when a Monk is ordered to convert it', () => {
    const bridge = createSimulationBridge('monk-convert-fixture');

    const enemyMilitia = findFirstOwnedUnit(bridge, 2, 'militia');
    expect(enemyMilitia).toBeDefined();
    const militiaId = enemyMilitia!.id;

    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(militiaId)).toBe(true);

    // Conversion takes 50 ticks (1 progress per tick). Step more than that
    // with margin to let the flip land.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const militia = findUnitById(bridge, militiaId);
          return militia !== undefined && militia.owner === 1;
        },
        { maxSteps: 80 },
      ),
    ).toBe(true);
  }, 20_000);

});
