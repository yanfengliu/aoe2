// Teams and the explicit-attack order (v0.3.102): a plain right-click on an
// ALLY's unit or building is a WALK, never friendly fire; Ctrl (forceAttack)
// is the deliberate order that can hit an ally; enemies are attacked either
// way. Owners 1+2 are allied in the fixture, owner 3 is the enemy; all
// three Town Centers stand inside the ordering militia's sight.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function boot(): Bridge {
  return createSimulationBridge('attack-ally-fixture');
}

function townCenterOf(bridge: Bridge, owner: number) {
  return bridge
    .getEconomyState()
    .buildings.find((b) => b.owner === owner && b.buildingType === 'town-center')!;
}

function selectOneMilitia(bridge: Bridge): void {
  const militia = bridge
    .getEconomyState()
    .units.find((u) => u.owner === 1 && u.unitType === 'militia')!;
  expect(bridge.selectEntityAtCell(militia.x, militia.y)).toBe(true);
}

describe('right-clicking an ally', () => {
  it('walks to an allied Town Center instead of attacking it', () => {
    const bridge = boot();
    const allyTc = townCenterOf(bridge, 2);
    const hp0 = bridge.getEntityHealth(allyTc.id)!.currentHp;
    selectOneMilitia(bridge);
    expect(bridge.issueContextCommandAtEntity(allyTc.id)).toBe(true);
    for (let index = 0; index < 500; index += 1) bridge.step(100);
    expect(bridge.getEntityHealth(allyTc.id)!.currentHp).toBe(hp0);
  });

  it('forceAttack is the deliberate order that DOES hit the ally', () => {
    const bridge = boot();
    const allyTc = townCenterOf(bridge, 2);
    const hp0 = bridge.getEntityHealth(allyTc.id)!.currentHp;
    selectOneMilitia(bridge);
    expect(bridge.issueContextCommandAtEntity(allyTc.id, { forceAttack: true })).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEntityHealth(allyTc.id)!.currentHp < hp0,
        { maxSteps: 1400 },
      ),
    ).toBe(true);
  });

  it('a plain right-click on the ENEMY Town Center still attacks', () => {
    const bridge = boot();
    const enemyTc = townCenterOf(bridge, 3);
    const hp0 = bridge.getEntityHealth(enemyTc.id)!.currentHp;
    selectOneMilitia(bridge);
    expect(bridge.issueContextCommandAtEntity(enemyTc.id)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEntityHealth(enemyTc.id)!.currentHp < hp0,
        { maxSteps: 1400 },
      ),
    ).toBe(true);
  });
});
