import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { RALLY_GATHER_TARGETS } from '../../src/game/simulation/fixtures/economyBasics/rallyGatherEligibility';
import type { GathererComponent, ResourceComponent } from '../../src/game/simulation/types';

// Work 131 review IR2: the exact-node rally path bypassed the ordinary gather
// filters. A newly trained villager could harvest an enemy's or ally's Farm,
// or receive a gather order on deep-water fish it could never reach. The rally
// must gather exactly the eligible node, or keep its ordinary movement order.
// Bound: a real Town Center rally and paid training on one open-ground map,
// with allied/enemy/own Farms, a land tree, shore fish and deep-water fish.
// It tests the command and banked output, not renderer hit testing or ships.
type Bridge = ReturnType<typeof createSimulationBridge>;
type Target = keyof typeof RALLY_GATHER_TARGETS;

function trainTo(target: Target) {
  const bridge = createSimulationBridge('rally-gather-eligibility-fixture', { renderProjection: 'on-read' });
  const at = RALLY_GATHER_TARGETS[target];
  const resource = bridge.getEconomyState().resources.find((node) => node.x === at.x && node.y === at.y)!;
  expect(resource, `fixture premise: no resource at ${target}`).toBeDefined();
  const amountBefore = resource.amount;
  expect(bridge.selectEntityAtCell(4, 4)).toBe(true);
  expect(bridge.getSelectionState().selectedEntityType).toBe('town-center');
  expect(bridge.issueContextCommand(at.x, at.y)).toBe(true);
  expect(bridge.queueTrainUnit('villager')).toBe(true);
  let villager: number | undefined;
  for (let tick = 0; tick < 500 && villager === undefined; tick += 1) {
    bridge.step(100);
    villager = bridge.getEconomyState().units.find((unit) => unit.owner === 1 && unit.unitType === 'villager')?.id;
  }
  expect(villager, 'the paid training never produced a villager').toBeDefined();
  const id = villager!;
  const gatherer = () => bridge.world.getComponent<GathererComponent>(id, 'gatherer')!;
  const amount = () => bridge.world.getComponent<ResourceComponent>(resource.id, 'resource')?.amount ?? 0;
  return { bridge, id, at, resource, amountBefore, gatherer, amount };
}

function run(bridge: Bridge, ticks: number): void {
  for (let tick = 0; tick < ticks; tick += 1) bridge.step(100);
}

describe('a trained villager rallies to gather only an eligible resource', () => {
  for (const target of ['enemyFarm', 'alliedFarm', 'deepFish'] as const) {
    it(`${target}: keeps a movement rally and never harvests the forbidden node`, () => {
      const result = trainTo(target);
      expect(result.gatherer().targetResourceId, 'an ineligible rally became a gather order').toBeNull();
      expect(result.gatherer().hasExplicitGatherOrder).toBe(false);
      expect(result.bridge.getDebugSnapshot().unitPaths.find((path) => path.id === result.id)).toMatchObject({
        commandType: 'move', toX: result.at.x, toY: result.at.y,
      });
      run(result.bridge, 1_200);
      expect(result.amount(), 'a rally harvested a node it was not eligible to gather').toBe(result.amountBefore);
      expect(result.gatherer().targetResourceId).toBeNull();
    });
  }

  for (const target of ['ownFarm', 'tree', 'shoreFish'] as const) {
    it(`${target}: gathers the exact eligible rally target and delivers a load`, () => {
      const result = trainTo(target);
      expect(result.gatherer().targetResourceId, 'rally chose another node instead of the requested node').toBe(result.resource.id);
      expect(result.gatherer().hasExplicitGatherOrder).toBe(true);
      const stockpile = () => result.bridge.getEconomyState().playerResources[1]![target === 'tree' ? 'wood' : 'food'];
      const bankedBefore = stockpile();
      run(result.bridge, 1_200);
      expect(result.amount()).toBeLessThan(result.amountBefore);
      expect(stockpile(), 'no gathered load was delivered').toBeGreaterThan(bankedBefore);
    });
  }
});
