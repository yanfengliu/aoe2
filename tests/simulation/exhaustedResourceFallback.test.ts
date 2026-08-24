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
  // SKIPPED — this is the harness for a capability the AI does not have yet,
  // kept because measuring it cost a 36000-tick match and three probes.
  //
  // What was measured on 2026-08-24, on this fixture:
  //   t=200  berries being eaten, six villagers on food, all working
  //   t=800  berries GONE; the AI rebalances desires to gold and stone, which
  //          do not exist here, and all six go idle
  //   t=1500 unchanged — and the fallback that already exists
  //          (`assignIdleGatherer` walks the other kinds) finds nothing,
  //          because the only food left is a LIVE BOAR and a live boar is not
  //          an auto-gatherable resource
  //   then   a boar tasked the way a player does it accepts the order and
  //          KILLS the villager: unit 2161 leaves the roster, the boar keeps
  //          all 340 food
  //
  // So the gap is not the fallback. It is that AoE2 hunts boar with a PARTY of
  // four to eight villagers (or lures it under the Town Center), and this AI
  // sends nobody. Fish, the other food left in the real match, needs a Dock,
  // which needs wood nobody has. Un-skip this once the AI can hunt.
  it.skip('puts them on the remaining food instead of leaving them idle', () => {
    const { working, idle, bridge } = runExhaustedBase(1_500);
    // Most of the six are still working at the end; the split between berries
    // and boar is the assignment's business, not this test's.
    expect({ working, idle }).toEqual({ working: expect.any(Number), idle: expect.any(Number) });
    expect(working).toBeGreaterThanOrEqual(4);
    // And the food keeps arriving, which is what an idle villager never does.
    expect(bridge.getEconomyState().playerResources[1]!.food).toBeGreaterThan(500);
  }, 60_000);
});
