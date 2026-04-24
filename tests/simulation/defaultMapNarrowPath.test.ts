import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function humanVillagers(bridge: Bridge): Array<{ id: number; x: number; y: number }> {
  return bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
    .map((unit) => ({ id: unit.id, x: unit.x, y: unit.y }));
}

function positionOf(bridge: Bridge, unitId: number): { x: number; y: number } | null {
  const unit = bridge.getEconomyState().units.find((candidate) => candidate.id === unitId);
  return unit ? { x: unit.x, y: unit.y } : null;
}

describe('default map narrow path movement', () => {
  // Regression for the procedural-map bug reported on 2026-04-24: the
  // cluster-around-a-ring resource placer could wrap all the way around
  // the TC and meet the adjacent cluster, walling the starting villagers
  // into a pocket they could never exit. Each of these cases orders a
  // starting villager to a coarse cell near each cardinal edge of the
  // near-base area; a stuck villager here means the fix to
  // `applyStandardPlayerOpeningProcedural` regressed.

  const cardinalTargets: Array<{ name: string; target: { x: number; y: number } }> = [
    { name: 'west', target: { x: 2, y: 8 } },
    { name: 'north', target: { x: 8, y: 2 } },
    { name: 'south', target: { x: 8, y: 14 } },
    { name: 'east beyond TC', target: { x: 14, y: 8 } },
  ];

  for (const { name, target } of cardinalTargets) {
    it(`each starting villager reaches the ${name} exit target (${target.x},${target.y})`, () => {
      const bridge = createSimulationBridge(DEFAULT_SEED);
      const villagers = humanVillagers(bridge);
      expect(villagers).toHaveLength(3);

      // Select + issue move for each villager in sequence, then tick the
      // whole bridge and check each one arrives. Issuing commands to all
      // three at once mirrors the user's box-select + right-click flow.
      for (const villager of villagers) {
        expect(bridge.selectEntityAtCell(villager.x, villager.y)).toBe(true);
        expect(bridge.issueMoveCommand(target.x, target.y)).toBe(true);
      }

      const reachedAll = stepBridgeUntil(
        bridge,
        () =>
          villagers.every((villager) => {
            const position = positionOf(bridge, villager.id);
            return position !== null
              && Math.abs(position.x - target.x) + Math.abs(position.y - target.y) <= 3;
          }),
        { maxSteps: 600 },
      );

      const finalPositions = villagers.map((villager) => positionOf(bridge, villager.id));
      expect(
        reachedAll,
        `villagers stuck on ${name} exit. final=${JSON.stringify(finalPositions)}`,
      ).toBe(true);
    });
  }
});
