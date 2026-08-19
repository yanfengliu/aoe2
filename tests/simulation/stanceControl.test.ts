import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function enemyTarget(bridge: Bridge) {
  return bridge.getEconomyState().units
    .find((unit) => unit.owner === 2 && unit.unitType === 'spearman');
}

describe('setting a stance', () => {
  it('is rejected when nothing is selected', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    bridge.clearSelection();
    expect(bridge.setSelectionStance('stand-ground')).toBe(false);
  });

  it('is accepted for an owned unit', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.setSelectionStance('no-attack')).toBe(true);
  });

  it('survives a save and load', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    expect(bridge.setSelectionStance('no-attack')).toBe(true);
    bridge.step(100);

    const restored = createSimulationBridge('aoe2-prototype', {
      savedGame: structuredClone(bridge.saveGame()),
    });
    // A stance that did not persist would silently revert a unit the player
    // told to hold fire back into hunting.
    const slot = restored.world.getState('aoe2.unitStances') as Array<[number, string]>;
    expect(slot.some(([, stance]) => stance === 'no-attack')).toBe(true);
  });
});

describe('stance changes what a unit does', () => {
  it('stops a unit engaging at all under no-attack', () => {
    // auto-aggro-idle-militia-in-vision-fixture parks an idle militia with an
    // enemy inside its line of sight; by default it engages immediately.
    const engaged = (stance: 'aggressive' | 'no-attack') => {
      const bridge = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');
      expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
      if (stance === 'no-attack') expect(bridge.setSelectionStance('no-attack')).toBe(true);
      bridge.clearSelection();
      const target = enemyTarget(bridge);
      expect(target).toBeDefined();
      const startingHp = bridge.getEntityHealth(target!.id)?.currentHp ?? 0;
      return stepBridgeUntil(
        bridge,
        () => (bridge.getEntityHealth(target!.id)?.currentHp ?? 0) < startingHp,
        { maxSteps: 200 },
      );
    };

    // Default (aggressive) militia engages...
    expect(engaged('aggressive')).toBe(true);
    // ...and the same militia told to hold fire never does.
    expect(engaged('no-attack')).toBe(false);
  }, 90_000);
});
