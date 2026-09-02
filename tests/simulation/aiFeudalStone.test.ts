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

    // §6.3 pacing retune (v0.3.159): stone is 1/28 ticks. §12.4.2 walk clock
    // (v0.3.160): the 125-crossing moved to ~tick 8,300. The Feudal wood
    // weight went 4 to 6 with the age-prerequisite reserve (2026-08-30), which
    // takes stone's share of a fixed villager cap from 1/13 to 1/15 — 13%
    // fewer stone villagers, which slows the observed per-tick rate by 22% —
    // and moved the crossing to tick 9,500. Measured
    // over 20,000 ticks on this fixture: peak stone 220, so the AI still banks
    // what this test is about and only takes longer to get there. Horizon is
    // 22 x 500-tick blocks, which keeps ~1,500 ticks of margin past the
    // measured crossing. The assertion tracks the running PEAK, not the
    // closing balance: the AI SPENDS banked stone on
    // exactly the things this test exists to make affordable (measured: 130
    // banked at tick 5,000 became 60 by 6,000 — a ~100-stone purchase), and
    // a stockpile assertion would fail on that success.
    // (Calibrated on this fixture: steady ~10 stone/500 ticks.)
    let peakStone = 0;
    for (let block = 0; block < 22; block += 1) {
      run(bridge, 500);
      peakStone = Math.max(peakStone, stoneOf(bridge, 2));
    }

    // 125 is the Watch Tower's stone half, straight from structures.csv: the
    // cheapest thing Feudal stone is for, and the floor for this to have been
    // worth doing at all.
    const watchTower = constructionCost('watch-tower').stone ?? 0;
    expect(watchTower).toBe(125);
    expect(peakStone).toBeGreaterThanOrEqual(watchTower);

    // Sustained, not a single early trip: the stone villagers stay on stone
    // rather than being churned onto other resources and never returning.
    // Measured as MINING (the sum of positive stockpile deltas), because the
    // balance itself keeps dropping every time the AI buys the next stone
    // thing — which is stone doing its job, not mining stopping.
    let minedInWindow = 0;
    let previous = stoneOf(bridge, 2);
    for (let block = 0; block < 30; block += 1) {
      run(bridge, 100);
      const current = stoneOf(bridge, 2);
      if (current > previous) minedInWindow += current - previous;
      previous = current;
    }
    // At DE pacing a steady miner lands a 10-stone deposit every ~75-90s
    // (gathering a carry is 280 ticks; the camp walk is the rest — the old
    // "a miner banks ~50 per 150s" figure was teleport-clock math). Three
    // deposits inside 300s proves a miner is STAYING on stone; churn shows
    // up as one orphaned deposit or none.
    //
    // DO NOT WIDEN THIS WINDOW to chase a bigger number. It was tried on
    // 2026-09-02 and ran off the end of the GAME: this fixture's match is
    // decided at tick 15,000 — `getMatchState()` returns conquest, owner 1
    // wiped out, scores 1:70 2:1492 — and a finished match stops, so every
    // resource goes static and every villager stands still. That looks
    // exactly like an economy deadlock and was briefly filed as one (see the
    // retraction in the defect register). The window ends at 14,000 because
    // that is where this fixture still has a game to measure.
    expect(minedInWindow).toBeGreaterThanOrEqual(30);
    // 10,500 DE-paced ticks: ~19s alone, more under suite parallelism.
  }, 120_000);
});
