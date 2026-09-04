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

    // ONE pass, with the sustained-mining window placed BEFORE the crossing
    // and proven to sit inside a LIVE match.
    //
    // It used to start AT the crossing and run 3,000 ticks. That stopped
    // working the moment the AI could field an army: owner 2 now conquers
    // owner 1 at tick 6,561 instead of 11,442, so a window opening at the
    // crossing (tick 6,096) spent 2,535 of its 3,000 ticks measuring a
    // FINISHED match, and reported 10 mined against a bar of 30. Nothing was
    // wrong with the economy — the game was over. This file already warned
    // about exactly that ("a finished match reads exactly like a deadlocked
    // economy") and still carried the liveness check AFTER the mining
    // assertion, where it could never fire. It runs first now.
    const MINING_FROM = 2_000;
    const MINING_TO = 5_000;
    let peakStone = 0;
    let crossedAt = -1;
    let endedAt = -1;
    let minedInWindow = 0;
    let previous = stoneOf(bridge, 2);
    for (let tick = 1; tick <= 11_000; tick += 1) {
      run(bridge, 1);
      const current = stoneOf(bridge, 2);
      if (tick > MINING_FROM && tick <= MINING_TO && current > previous) {
        minedInWindow += current - previous;
      }
      previous = current;
      peakStone = Math.max(peakStone, current);
      if (crossedAt < 0 && peakStone >= watchTower) crossedAt = tick;
      if (bridge.getMatchState().outcome !== 'running') {
        endedAt = tick;
        break;
      }
    }

    // LIVENESS FIRST: everything below is meaningless if the match was over.
    expect(
      endedAt < 0 || endedAt > MINING_TO,
      `the match ended at tick ${String(endedAt)}, inside the mining window that `
      + `ends at ${String(MINING_TO)} — move the window earlier, do not widen it`,
    ).toBe(true);

    // A match that ends BEFORE the crossing must say so in those words. The
    // crossing assertion below reports "stone never reached 125" for both
    // causes, and the margin here is thin — the crossing is tick 6,096 and the
    // match ends at 6,561, seven percent apart — so without this the next
    // change that speeds the AI up reports a match-length result as an economic
    // failure, which is the exact misdiagnosis this file exists to avoid.
    expect(
      endedAt < 0 || crossedAt > 0,
      `the match ended at tick ${String(endedAt)} before stone ever reached `
      + `${String(watchTower)} (peak ${String(peakStone)}) — that is a match-length `
      + 'problem, not an economy one: move the measurement earlier',
    ).toBe(true);

    // Stone reaches the cheapest thing Feudal stone is for, while the match is
    // still being played. Measured at v0.3.199: the crossing is tick 6,096.
    expect(crossedAt, `stone never reached ${String(watchTower)} — peak ${String(peakStone)}`)
      .toBeGreaterThan(0);

    // Sustained across the measured window, not a single early trip. Measured
    // as MINING (the sum of positive stockpile deltas), because the balance
    // itself drops every time the AI buys the next stone thing — which is stone
    // doing its job, not mining stopping. ~70 in this window at v0.3.199,
    // against a bar of 30 (three deposits).
    //
    // BOUND, stated because the window moved and the claim shrank with it.
    // This measures ticks 2,000-5,000 ONLY, ending 1,096 ticks BEFORE the AI
    // first holds 125 stone, so it cannot see mining that stops after that.
    // It was moved because the match now ends at 6,561 and the old window,
    // anchored at the crossing, spent 2,535 of its 3,000 ticks measuring a
    // FINISHED game — a worse failure than a narrower claim.
    //
    // RED-CHECKED at 20 against this bar of 30, under the Feudal stone weight
    // set to 0 (the defect at the top of this file). Worth recording what does
    // NOT redden it: setting the CASTLE weight to 0 changes mining not at all,
    // because `villagerRebalance` never treats a zero-target kind as a donor,
    // so villagers already on stone stay there. A mid-game reweight is
    // therefore not a defect this window misses — it is not a defect that
    // manifests. What this window genuinely cannot see is churn from another
    // cause after tick 5,000: villagers dying, or the idle-gatherer fallback
    // rewriting their desire when a node stops being assignable.
    expect(minedInWindow).toBeGreaterThanOrEqual(30);
  }, 120_000);
});
