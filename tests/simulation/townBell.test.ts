// The town bell (spec §9.3, v0.3.115): AoE2's alarm — ring it on the Town
// Center and every villager runs for the nearest shelter with room; sound
// Back to Work and they pour back out. Both are building.action commands, so
// replays reproduce them; military garrisons are untouched by Back to Work.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

function humanTc(bridge: ReturnType<typeof createSimulationBridge>) {
  const tc = bridge.getEconomyState().buildings.find(
    (b) => b.owner === 1 && b.buildingType === 'town-center',
  );
  if (!tc) throw new Error('no human town center');
  return tc;
}

function garrisonedCount(bridge: ReturnType<typeof createSimulationBridge>, buildingId: number) {
  const rows = bridge.world.getState('aoe2.garrisonedByBuilding') as
    | ReadonlyArray<[number, number[]]>
    | undefined;
  return new Map(rows ?? []).get(buildingId)?.length ?? 0;
}

describe('the town bell', () => {
  it('shelters every villager, and Back to Work releases them', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const tc = humanTc(bridge);
    const villagerCount = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && u.unitType === 'villager').length;
    expect(villagerCount).toBeGreaterThanOrEqual(3);

    expect(bridge.selectEntityById(tc.id)).toBe(true);
    expect(bridge.issueAction('ring-town-bell')).toBe(true);
    const sheltered = stepBridgeUntil(
      bridge,
      () => garrisonedCount(bridge, tc.id) >= villagerCount,
      { maxSteps: 1500 },
    );
    expect(sheltered, 'the villagers never made it into the town center').toBe(true);

    expect(bridge.selectEntityById(tc.id)).toBe(true);
    expect(bridge.issueAction('back-to-work')).toBe(true);
    bridge.step(100);
    expect(garrisonedCount(bridge, tc.id)).toBe(0);
    expect(
      bridge.getEconomyState().units.filter((u) => u.owner === 1 && u.unitType === 'villager').length,
    ).toBe(villagerCount);
  });

  it('offers the bell on an own town center', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const tc = humanTc(bridge);
    expect(bridge.selectEntityById(tc.id)).toBe(true);
    const options = bridge.getSelectionState().actionOptions;
    expect(options).toContain('ring-town-bell');
  });
});
