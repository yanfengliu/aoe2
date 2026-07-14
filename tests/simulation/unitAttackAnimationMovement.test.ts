import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('unit attack animation movement cancellation', () => {
  it('publishes one smooth handoff tick, then removes the old strike', () => {
    const bridge = createSimulationBridge('boar-hunt-fixture');
    const boar = bridge.getRenderState().entities.find((entity) => entity.entityType === 'boar');
    expect(boar).toBeDefined();
    expect(bridge.selectUnitsInBox(12, 7, 14, 9)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(boar!.id)).toBe(true);

    let attackerId: number | null = null;
    let attackTick: number | null = null;
    for (let step = 0; step < 100 && attackerId === null; step += 1) {
      bridge.step(100);
      const state = bridge.getRenderState();
      const attacker = state.entities.find((entity) => (
        entity.owner === 1 && entity.attackAnimation?.tick === state.tick
      ));
      if (attacker) {
        attackerId = attacker.id;
        attackTick = state.tick;
      }
    }

    expect(attackerId, 'villager never landed a hit').not.toBeNull();
    bridge.clearSelection();
    expect(bridge.selectEntityById(attackerId!)).toBe(true);
    expect(bridge.issueMoveCommand(0, 0)).toBe(true);
    bridge.step(100);

    const handoff = bridge.getRenderState().entities.find((entity) => entity.id === attackerId);
    expect(handoff?.attackAnimation?.cancelTick).toBe(attackTick! + 1);

    bridge.step(100);
    const settled = bridge.getRenderState().entities.find((entity) => entity.id === attackerId);
    expect(settled?.attackAnimation).toBeUndefined();
  });
});
