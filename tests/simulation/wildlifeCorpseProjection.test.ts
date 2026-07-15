// Wildlife death carcass (spec §14.5, user directive 2026-07-14): the
// renderer needs an EXPLICIT life signal for huntables — keying the carcass
// look off `currentHp === null` would overload a health-display convention
// shared by every non-wildlife resource. `wildlifeAlive` rides the projected
// view: true for live wildlife, false for a persisted corpse, absent for
// everything that is not wildlife.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function boarEntity(bridge: Bridge) {
  return bridge
    .getRenderState()
    .entities.find((entity) => entity.kind === 'resource' && entity.entityType === 'boar');
}

describe('wildlife corpse projection (spec §14.5)', () => {
  it('marks live wildlife alive, killed corpses dead, and non-wildlife not at all', () => {
    const bridge = createSimulationBridge('boar-hunt-fixture');
    const liveBoar = boarEntity(bridge);
    expect(liveBoar).toBeDefined();
    expect(liveBoar!.wildlifeAlive).toBe(true);

    const tree = bridge
      .getRenderState()
      .entities.find((entity) => entity.kind === 'resource' && entity.entityType === 'tree');
    if (tree) expect(tree.wildlifeAlive).toBeUndefined();

    expect(bridge.selectUnitsInBox(12, 7, 14, 9)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(liveBoar!.id)).toBe(true);
    const dead = stepBridgeUntil(
      bridge,
      () => {
        const boar = boarEntity(bridge);
        return boar !== undefined && (boar.currentHp ?? 0) <= 0;
      },
      { maxSteps: 400 },
    );
    expect(dead).toBe(true);

    const corpse = boarEntity(bridge);
    expect(corpse).toBeDefined();
    expect(corpse!.wildlifeAlive).toBe(false);
  });
});
