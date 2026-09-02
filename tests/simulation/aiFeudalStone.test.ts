// v0.3.138 tech-tree denials: this suite's default owners were Britons/
// Franks, whose REAL AoE2 holes deny the content under test — it now boots
// Saracens, whose Feudal tree is complete and whose bonus (market rates)
// leaves the AI's economy pacing untouched — the Huns' houseless bonus
// warped this timing-sensitive plan.
// The Feudal-Age AI mined no stone at all: `villagerTargetsForAge('feudal-age')`
// allocated `stone: 0`, so its stockpile stayed at zero for the whole age and
// everything Feudal stone buys was unaffordable — the Watch Tower (125 stone)
// is the AI's only defensive building, an extra Town Center costs 100, and the
// Castle the AI wants the moment it reaches Castle Age costs 650, none of which
// it had banked a single unit toward.
//
// `ai-scouting-response-fixture` hides this by handing the AI 500 stone. This
// fixture starts it at zero, so the only way through is to have mined.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { villagerTargetsForAge } from '../../src/game/simulation/ai';
import { constructionCost } from '../../src/game/simulation/prototypeEconomyRules';

type Bridge = ReturnType<typeof createSimulationBridge>;

function stoneOf(bridge: Bridge, owner: number): number {
  return bridge.getEconomyState().playerResources[owner]?.stone ?? 0;
}

function run(bridge: Bridge, ticks: number): void {
  for (let index = 0; index < ticks; index += 1) {
    bridge.step(100);
  }
}

describe('the Feudal AI mines the stone its own plans need', () => {
  it('puts villagers on stone in Feudal, not only after Castle Age', () => {
    const feudal = villagerTargetsForAge('feudal-age');
    expect(feudal.stone ?? 0).toBeGreaterThan(0);
    // Still an economy that ages up: stone must not outrank the food the
    // 800-food Castle age-up is waiting on.
    expect(feudal.food ?? 0).toBeGreaterThan(feudal.stone ?? 0);
  }, 60_000);

  // One match, sampled twice — the assertions are about the same run, and a
  // Feudal economy takes thousands of ticks to say anything.
  it('banks stone from zero, and keeps banking it', () => {
    const bridge = createSimulationBridge('ai-feudal-stone-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });
    expect(stoneOf(bridge, 2)).toBe(0);

    // Waits on the CONDITION — stone crossing the Watch Tower's 125, the
    // cheapest thing Feudal stone is for — instead of a fixed warm-up. Every
    // fixed warm-up this test has carried went stale with the next pacing
    // change (§6.3 gather retune, the §12.4.2 walk clock, the Feudal wood
    // reweight, DE build times), and the last one, 22 x 500 ticks, ran off the
    // END OF THE MATCH: this fixture resolves by conquest at tick 11,442, and
    // a finished match reads exactly like a deadlocked economy — a mistake
    // this repo filed as a defect and then retracted (see the register,
    // 2026-09-02). Measured at v0.3.190: the crossing is tick 6,139.
    const watchTower = constructionCost('watch-tower').stone ?? 0;
    expect(watchTower).toBe(125);

    let peakStone = 0;
    let crossedAt = -1;
    for (let tick = 1; tick <= 11_000 && crossedAt < 0; tick += 1) {
      run(bridge, 1);
      peakStone = Math.max(peakStone, stoneOf(bridge, 2));
      if (peakStone >= watchTower) crossedAt = tick;
    }
    expect(crossedAt, `stone never reached ${String(watchTower)} — peak ${String(peakStone)}`)
      .toBeGreaterThan(0);

    // Sustained, not a single early trip: the stone villagers stay on stone
    // rather than being churned onto other resources and never returning.
    // Measured as MINING (the sum of positive stockpile deltas), because the
    // balance itself keeps dropping every time the AI buys the next stone
    // thing — which is stone doing its job, not mining stopping. Measured 100
    // in this window at v0.3.190, against a bar of 30 (three deposits).
    let minedInWindow = 0;
    let previous = stoneOf(bridge, 2);
    for (let block = 0; block < 30; block += 1) {
      run(bridge, 100);
      const current = stoneOf(bridge, 2);
      if (current > previous) minedInWindow += current - previous;
      previous = current;
    }
    expect(minedInWindow).toBeGreaterThanOrEqual(30);

    // THE MATCH MUST STILL BE RUNNING. Without this the window can drift past
    // the end of the game and measure a decided match's stillness as a
    // healthy economy's — or, worse, as a deadlock.
    expect(
      bridge.getMatchState().outcome,
      'the window ran past the end of the match; move it earlier, do not widen it',
    ).toBe('running');
  }, 120_000);
});
