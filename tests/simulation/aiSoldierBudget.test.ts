// Soldiers asked for in one decision share one budget with the villager due,
// and the Market sees that budget (work 141: review round 0 F0, round 1 R1-2
// and Codex R1).
//
// The AI decides on one tick and every handler charges on the next, in the
// order asked: soldiers first, then the age-up research, then the villager.
// While a villager is due, a soldier is priced on top of the villager's cost
// and of the soldiers asked for before it (round 0, F0). Before F0 each
// soldier was priced alone, so two that each left a villager's 50 food behind
// left 15 together, and the Town Center's villager was refused. A soldier
// refused this way goes to the Imperial Market as the whole budget its check
// used (round 1): priced bare against the purse, it could look affordable,
// and the Market aimed at it and made no trade.
//
// Bound: one seat, two decisions each, the Feudal and Imperial mixes; the
// queues, the stockpile and the recorded commands are what is read. The
// Market case turns the plan-first aim off, as `aiIdleSurplusTrade.test.ts`
// does: with it on, the Market reaches the unit queue only when the plan is
// empty, which no measured match has, and the fixture would need the whole
// Imperial build order and every technology done to empty it.

import { MemorySink, SessionRecorder } from 'civ-engine';
import { afterEach, describe, expect, it } from 'vitest';

import { AI_SURPLUS_TRADE } from '../../src/game/simulation/aiMarketPlanning';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { trainingCost } from '../../src/game/simulation/prototypeEconomyRules';

const SHIPPED_KNOBS = { ...AI_SURPLUS_TRADE };

type Bridge = ReturnType<typeof createSimulationBridge>;

function expectIdleComplete(bridge: Bridge, types: readonly string[]): void {
  const buildings = bridge.getEconomyState().buildings;
  for (const type of types) {
    const owned = buildings.filter((b) => b.owner === 2 && b.buildingType === type);
    expect(owned.map((b) => [b.isComplete, b.queue.length]), type).toEqual([[true, 0]]);
  }
}

describe('the computer prices the soldiers it asks for together (work 141)', () => {
  afterEach(() => {
    Object.assign(AI_SURPLUS_TRADE, SHIPPED_KNOBS);
  });

  it('leaves the villager due its food when two soldiers would each fit alone', () => {
    const bridge = createSimulationBridge('ai-soldier-budget-fixture');
    const start = bridge.getEconomyState();
    // The fixture is what this case needs.
    expect(start.ages[2]).toBe('feudal-age');
    expect(start.playerResources[2]?.food).toBe(130);
    expect(start.units.filter((u) => u.owner === 2 && u.unitType === 'villager')).toHaveLength(3);
    expect(start.population[2]).toMatchObject({ current: 3, cap: 15 });
    expectIdleComplete(bridge, ['town-center', 'barracks', 'stable']);
    const spearman = trainingCost('spearman').food ?? 0;
    const scout = trainingCost('scout').food ?? 0;
    const villager = trainingCost('villager').food ?? 0;
    expect(spearman + villager).toBeLessThanOrEqual(130);
    expect(scout + villager).toBeLessThanOrEqual(130);
    expect(spearman + scout + villager).toBeGreaterThan(130);

    // Two of the Standard AI's decisions, and the ticks their handlers run on.
    for (let tick = 0; tick < 62; tick += 1) bridge.step(100);

    const end = bridge.getEconomyState();
    const queued = (type: string) => end.buildings
      .filter((b) => b.owner === 2 && b.buildingType === type)
      .flatMap((b) => b.queue.map((entry) => entry.unitType));
    const diagnostic = `queues: TC ${JSON.stringify(queued('town-center'))} Barracks ${JSON.stringify(queued('barracks'))} `
      + `Stable ${JSON.stringify(queued('stable'))}; food ${end.playerResources[2]?.food}`;
    // The Spearman is asked for too, so the case cannot pass with no soldier
    // trained at all (work 141 review round 2, R2-1).
    expect(queued('barracks'), diagnostic).toEqual(['spearman']);
    expect(queued('town-center'), diagnostic).toContain('villager');
    expect(queued('stable'), diagnostic).toHaveLength(0);
  }, 60_000);

  it('aims the Market at a soldier refused for that budget', () => {
    AI_SURPLUS_TRADE.planFirst = false;
    const bridge = createSimulationBridge('ai-market-budget-fixture');
    const start = bridge.getEconomyState();
    // The fixture is what this case needs.
    expect(start.ages[2]).toBe('imperial-age');
    expect(start.playerResources[2]).toMatchObject({ food: 90, wood: 30, gold: 1000 });
    expect(start.units.filter((u) => u.owner === 2 && u.unitType === 'villager')).toHaveLength(3);
    expect(start.population[2]).toMatchObject({ current: 3, cap: 25 });
    expectIdleComplete(bridge, ['town-center', 'market', 'barracks', 'archery-range', 'siege-workshop']);

    const sink = new MemorySink({ allowSidecar: true });
    const recorder = new SessionRecorder({
      world: bridge.world,
      sink,
      snapshotInterval: null,
      terminalSnapshot: false,
      sourceKind: 'session',
      sourceLabel: 'ai-market-budget',
    });
    recorder.connect();
    // Two of the Standard AI's decisions, and the ticks their handlers run on.
    for (let tick = 0; tick < 62; tick += 1) bridge.step(100);
    recorder.disconnect();

    const commands = recorder.toBundle().commands;
    const brief = commands.map((c) => `${c.submissionTick} ${c.type} ${JSON.stringify(c.data)}`);
    // The first decision asked for the Spearman (which takes the wood the
    // villager leaves) and the villager, and researched nothing first.
    const first = commands.find((c) => c.type === 'queue.train');
    const decision = commands.filter((c) => c.submissionTick === first?.submissionTick);
    expect(first?.data, brief.join('\n')).toMatchObject({ unitType: 'spearman' });
    expect(decision.filter((c) => c.type === 'queue.research'), brief.join('\n')).toHaveLength(0);
    // In that same decision the Market buys the wood the refused Archer needs.
    const trades = decision
      .filter((c) => c.type === 'market.action')
      .map((c) => (c.data as { actionType?: string }).actionType);
    expect(trades, brief.join('\n')).toEqual(['buy-wood']);
  }, 60_000);
});
