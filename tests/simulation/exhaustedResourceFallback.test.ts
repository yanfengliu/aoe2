import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

// A 36000-tick AI-versus-AI match froze with 83 idle villagers across both
// players: wood 5 and 12, gold 15 and 4, no trees and no gold left anywhere on
// the map — and four boar standing five cells from the town centres. Assignment
// treated "no node of the kind I want" as "nothing to do", so every villager
// whose resource ran out idled permanently and the game stopped moving.
//
// A real player re-tasks those villagers onto whatever is left. So does this.

type Bridge = ReturnType<typeof createSimulationBridge>;

function villagerTasks(bridge: Bridge, owner: number): Record<string, number> {
  const histogram: Record<string, number> = {};
  for (const villager of bridge.getEconomyState().villagers.filter((v) => v.owner === owner)) {
    const task = villager.task ?? 'none';
    histogram[task] = (histogram[task] ?? 0) + 1;
  }
  return histogram;
}

function runExhaustedBase(steps: number) {
  const bridge = createSimulationBridge('exhausted-resources-fixture', {
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
  });
  // The premise: this map really has nothing but food on it.
  const kinds = new Set(
    (bridge.getEconomyState().resources ?? []).map((resource) => resource.resourceType),
  );
  expect(kinds.has('tree')).toBe(false);
  expect(kinds.has('gold-mine')).toBe(false);
  expect(kinds.has('stone-mine')).toBe(false);

  for (let step = 0; step < steps; step += 1) bridge.step(100);
  const tasks = villagerTasks(bridge, 1);
  return {
    // The END state, not the best moment along the way: these villagers all
    // start on food and work happily until the AI's first rebalance moves them
    // onto gold and stone at around tick 600. A max-over-the-run measurement
    // reads that opening as success and never sees the freeze.
    working: (tasks.gathering ?? 0) + (tasks['to-resource'] ?? 0) + (tasks['to-dropoff'] ?? 0),
    idle: tasks.idle ?? 0,
    bridge,
  };
}

describe('villagers fall back to what is left when their resource runs out', () => {
  // What was measured on 2026-08-24, before the AI could hunt:
  //   t=200  berries being eaten, six villagers on food, all working
  //   t=800  berries GONE; the AI rebalances desires to gold and stone, which
  //          do not exist here, and all six go idle
  //   t=1500 unchanged — the kind-fallback that already exists
  //          (`assignIdleGatherer` walks the other kinds) finds nothing,
  //          because the only food left is a LIVE BOAR, which is not an
  //          auto-gatherable resource
  //   then   a boar tasked the way a player does it accepts the order and
  //          KILLS the lone villager: unit 2161 leaves the roster and the boar
  //          keeps all 340 of its food
  //
  // v0.3.56 sends a PARTY instead, which is AoE2's answer to the same animal.
  it('sends a hunting party at the boar and eats it', () => {
    const { bridge } = runExhaustedBase(14_000); // §6.3 retune (v0.3.159): berries deplete ~6.5x slower, then the party hunts a 340-food boar at 0.41/s
    const eco = bridge.getEconomyState();
    // The boar is eaten: no live boar with food left on the map.
    const boarLeft = (eco.resources ?? []).filter(
      (resource) => resource.resourceType === 'boar' && (resource.amount ?? 0) > 0,
    );
    expect(boarLeft).toEqual([]);
    // And its food arrived. The plateau without hunting was 900 — the berries
    // and nothing else — so anything above that is the carcass.
    expect(eco.playerResources[1]!.food).toBeGreaterThan(900);
    // The party survives: a lone villager dies to a boar, which is the whole
    // reason the party size exists.
    expect(eco.units.filter((u) => u.owner === 1 && u.unitType === 'villager').length)
      .toBeGreaterThanOrEqual(4);
  }, 300_000);
});
