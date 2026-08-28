// Contract tests for the AI villager rebalancer's v0.3.159 rules: the
// no-inversion guard (moving one villager must never FLIP the served/starved
// ordering — that ping-pong froze stone at 50 for 12k ticks on the
// feudal-stone fixture once §6.3 cadences made cycles 26-32 ticks long), and
// the donor pick weighting carried loads by the §6.3 cadence rather than the
// old 4-tick prototype cycle.
import { describe, expect, it } from 'vitest';

import { createAiDecisionOps } from '../../src/game/simulation/bridge/aiDecisionOps';
import type { GathererComponent } from '../../src/game/simulation/types';

interface FakeVillager {
  unit: { owner: number; unitType: string };
  gatherer: GathererComponent;
}

function gatherer(desired: string, over?: Partial<GathererComponent>): GathererComponent {
  return {
    desiredResource: desired,
    task: 'gathering',
    targetResourceId: 7,
    carriedAmount: 0,
    carriedResource: null,
    gatherProgressTicks: 0,
    hasExplicitGatherOrder: false,
    ...over,
  } as unknown as GathererComponent;
}

function harness(villagers: FakeVillager[]) {
  const world = {
    query: () => villagers.map((_, index) => index),
    getComponent: (id: number, kind: string) =>
      kind === 'unit' ? villagers[id]!.unit : kind === 'gatherer' ? villagers[id]!.gatherer : null,
  };
  return createAiDecisionOps({
    world: world as never,
    findBuildPlacementNear: () => null,
    aiWatchTowerForwardStep: 3,
  });
}

const vill = (desired: string, over?: Partial<GathererComponent>): FakeVillager => ({
  unit: { owner: 2, unitType: 'villager' },
  gatherer: gatherer(desired, over),
});

describe('AI villager rebalance — §6.3-era contracts', () => {
  it('refuses a move that would invert the ordering (the ping-pong case)', () => {
    // food 2/3 = 0.67 vs stone 1/2 = 0.5: stone is worse, but donating the
    // food villager flips it (food 1/3 = 0.33 < stone 2/2 = 1.0) — as even
    // as whole villagers allow, so the rebalancer must hold still.
    const villagers = [vill('food'), vill('food'), vill('stone')];
    harness(villagers).villagerRebalance(2, { food: 3, stone: 2 });
    expect(villagers.map((v) => v.gatherer.desiredResource)).toEqual(['food', 'food', 'stone']);
  });

  it('still donates a genuine surplus to a starved kind', () => {
    const villagers = [vill('food'), vill('food'), vill('food')];
    harness(villagers).villagerRebalance(2, { food: 1, stone: 1 });
    const stoneCount = villagers.filter((v) => v.gatherer.desiredResource === 'stone').length;
    expect(stoneCount).toBe(1);
  });

  it('donates the villager with the least sunk work at §6.3 carried-load weights', () => {
    // Carrying 7 food is ~7×28 ticks of sunk cadence work; 31 raw progress
    // ticks is less. The old ×4 weight priced the carry at 28 and donated
    // the full villager — the exact waste the donor pick exists to avoid.
    const villagers = [
      vill('food', { carriedAmount: 7, gatherProgressTicks: 0 }),
      vill('food', { carriedAmount: 0, gatherProgressTicks: 31 }),
      vill('food'),
    ];
    harness(villagers).villagerRebalance(2, { food: 1, stone: 1 });
    expect(villagers[0]!.gatherer.desiredResource).toBe('food');
    const donor = villagers.findIndex((v) => v.gatherer.desiredResource === 'stone');
    // Villager 2 (no sunk work at all) is the cheapest donor; villager 1
    // (31 ticks) must outrank villager 0's carried load (196 tick-equivalents).
    expect(donor).toBe(2);
  });
});
