import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function ownedMilitia(bridge: Bridge) {
  return bridge.getEconomyState().units
    .find((unit) => unit.owner === 1 && unit.unitType === 'militia');
}

function enemySpearman(bridge: Bridge) {
  return bridge.getEconomyState().units
    .find((unit) => unit.owner === 2 && unit.unitType === 'spearman');
}

describe('issuing an attack-move', () => {
  it('is rejected with nothing selected', () => {
    const bridge = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');
    bridge.clearSelection();
    expect(bridge.issueAttackMoveCommand(20, 20)).toBe(false);
  });

  it('is accepted for an owned unit and records an attack-move order', () => {
    const bridge = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.issueAttackMoveCommand(20, 20)).toBe(true);
    bridge.step(100);

    const commands = bridge.world.getState('aoe2.unitCommands') as Array<
      [number, { type: string; target: { x: number; y: number } }]
    >;
    const militia = ownedMilitia(bridge);
    const order = commands.find(([id]) => id === militia?.id)?.[1];
    expect(order?.type).toBe('attack-move');
  });
});

describe('an attack-move engages on the way', () => {
  it('fights an enemy it passes even when the unit is told to hold fire', () => {
    // The point of attack-move: it overrides the standing stance for the
    // duration of the order. A No Attack unit still fights while executing one.
    const bridge = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.setSelectionStance('no-attack')).toBe(true);

    const target = enemySpearman(bridge);
    expect(target).toBeDefined();
    const startingHp = bridge.getEntityHealth(target!.id)?.currentHp ?? 0;
    expect(startingHp).toBeGreaterThan(0);

    // Walk PAST the enemy, not onto it.
    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.issueAttackMoveCommand(24, 8)).toBe(true);
    bridge.clearSelection();

    expect(stepBridgeUntil(
      bridge,
      () => (bridge.getEntityHealth(target!.id)?.currentHp ?? 0) < startingHp,
      { maxSteps: 400 },
    )).toBe(true);
  }, 90_000);

  it('plain move does NOT engage when the unit is holding fire', () => {
    // The control case: the same walk under the same stance, ordered as an
    // ordinary move, must leave the enemy alone. Without this, the test above
    // would pass even if attack-move did nothing special.
    const bridge = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.setSelectionStance('no-attack')).toBe(true);

    const target = enemySpearman(bridge);
    expect(target).toBeDefined();
    const startingHp = bridge.getEntityHealth(target!.id)?.currentHp ?? 0;

    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.issueMoveCommand(24, 8)).toBe(true);
    bridge.clearSelection();

    for (let step = 0; step < 400; step += 1) {
      bridge.step(100);
      expect(bridge.getEntityHealth(target!.id)?.currentHp ?? 0).toBe(startingHp);
    }
  }, 90_000);
});
