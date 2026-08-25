// Shift-queued waypoints (spec §9.3, v0.3.125): Shift+right-click APPENDS a
// move leg instead of replacing the order — AoE2's waypoint chain. The unit
// walks each leg in turn; the chain survives a save; a plain click clears it.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

function unitAt(bridge: ReturnType<typeof createSimulationBridge>, id: number) {
  return bridge.getEconomyState().units.find((u) => u.id === id);
}

describe('shift-queued movement', () => {
  it('records the chain and walks the legs in order', () => {
    const bridge = createSimulationBridge('unit-repair-fixture');
    const villager = bridge.getEconomyState().units.find(
      (u) => u.owner === 1 && u.unitType === 'villager',
    );
    if (!villager) throw new Error('no villager');
    expect(bridge.selectUnitsByIds([villager.id])).toBe(true);

    // First leg points AWAY from the final one (south, then north-east): a
    // replacement bug walks only the last order and never nears the first.
    expect(bridge.issueMoveCommand(12, 18)).toBe(true);
    expect(bridge.issueMoveCommand(20, 8, { queue: true })).toBe(true);
    bridge.step(100);
    // MECHANISM: the standing command carries the queued waypoint.
    const rows = (bridge.world.getState('aoe2.unitCommands') ?? []) as ReadonlyArray<
      [number, { target?: { x: number; y: number }; queuedTargets?: { x: number }[] }]
    >;
    const cmd = new Map(rows).get(villager.id);
    expect(cmd?.target).toEqual({ x: 12, y: 18 });
    expect(cmd?.queuedTargets?.map((t) => t.x)).toEqual([20]);

    let sawFirstLeg = false;
    const arrived = stepBridgeUntil(
      bridge,
      () => {
        const now = unitAt(bridge, villager.id);
        if (!now) return false;
        if (Math.abs(now.x - 12) <= 1 && Math.abs(now.y - 18) <= 1) sawFirstLeg = true;
        return sawFirstLeg && Math.abs(now.x - 20) <= 1 && Math.abs(now.y - 8) <= 1;
      },
      { maxSteps: 4000 },
    );
    expect(arrived, 'the villager never walked first leg then second').toBe(true);
  });

  it('a plain click replaces the whole chain', () => {
    const bridge = createSimulationBridge('unit-repair-fixture');
    const villager = bridge.getEconomyState().units.find(
      (u) => u.owner === 1 && u.unitType === 'villager',
    );
    if (!villager) throw new Error('no villager');
    bridge.selectUnitsByIds([villager.id]);
    bridge.issueMoveCommand(16, 14);
    bridge.issueMoveCommand(20, 10, { queue: true });
    bridge.step(100);
    bridge.issueMoveCommand(14, 12);
    bridge.step(100);
    const rows = (bridge.world.getState('aoe2.unitCommands') ?? []) as ReadonlyArray<
      [number, { target?: { x: number }; queuedTargets?: unknown[] }]
    >;
    const cmd = new Map(rows).get(villager.id);
    expect(cmd?.target?.x).toBe(14);
    expect(cmd?.queuedTargets ?? []).toHaveLength(0);
  });

  it('the chain survives a save', () => {
    const bridge = createSimulationBridge('unit-repair-fixture');
    const villager = bridge.getEconomyState().units.find(
      (u) => u.owner === 1 && u.unitType === 'villager',
    );
    if (!villager) throw new Error('no villager');
    bridge.selectUnitsByIds([villager.id]);
    bridge.issueMoveCommand(16, 14);
    bridge.issueMoveCommand(20, 10, { queue: true });
    bridge.step(100);
    // MECHANISM: the save must carry the queue, not merely the first target.
    const savedRows = (bridge.world.getState('aoe2.unitCommands') ?? []) as ReadonlyArray<
      [number, { queuedTargets?: unknown[] }]
    >;
    expect(new Map(savedRows).get(villager.id)?.queuedTargets).toHaveLength(1);

    const loaded = createSimulationBridge(undefined, { savedGame: bridge.saveGame() });
    const arrived = stepBridgeUntil(
      loaded,
      () => {
        const now = loaded.getEconomyState().units.find((u) => u.id === villager.id);
        return now ? Math.abs(now.x - 20) <= 1 && Math.abs(now.y - 10) <= 1 : false;
      },
      { maxSteps: 3000 },
    );
    expect(arrived, 'the loaded game forgot the queued waypoint').toBe(true);
  });
});
