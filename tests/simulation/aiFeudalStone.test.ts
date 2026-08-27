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
  });

  // One match, sampled twice — the assertions are about the same run, and a
  // Feudal economy takes thousands of ticks to say anything.
  it('banks stone from zero, and keeps banking it', () => {
    const bridge = createSimulationBridge('ai-feudal-stone-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });
    expect(stoneOf(bridge, 2)).toBe(0);

    run(bridge, 4000);
    const atFourThousand = stoneOf(bridge, 2);

    // 125 is the Watch Tower's stone half, straight from structures.csv: the
    // cheapest thing Feudal stone is for, and the floor for this to have been
    // worth doing at all.
    const watchTower = constructionCost('watch-tower').stone ?? 0;
    expect(watchTower).toBe(125);
    expect(atFourThousand).toBeGreaterThanOrEqual(watchTower);

    // Sustained, not a single early trip: the stone villagers stay on stone
    // rather than being churned onto other resources and never returning.
    run(bridge, 3000);
    expect(stoneOf(bridge, 2)).toBeGreaterThan(atFourThousand);
  });
});
