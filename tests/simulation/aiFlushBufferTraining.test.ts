// The computer's soldiers leave the build order's cheap claims their wood, as
// DE's ranged flush does (work 147 M2; the rule is `aiFlushBuffers.ts`, spec
// §13.2 "DE's flush buffers").
//
// Before it, every idle producer trained the first unit the purse allowed at
// every decision, so a seat short of farms spent the wood a farm needed on
// Spearmen and Archers, and its Castle Age Siege Workshop waited while the
// army took the 200 (plan 147, M1's measurement: on 83 of 93 waits of a minute
// or more the army spent the building's price meanwhile).
//
// Bound: one seat of the Standard AI, one decision and the tick its handlers
// charge on, on a map with nothing to gather (`fixtures/aiFlushBuffers.ts`);
// the queues and the stockpile are what is read. The farm buffer holds here for
// its first reason (a level army of five, not ahead of the enemy's age) and its
// second (few villagers on food); its third, and every threshold, are the
// rule's own cases (`aiFlushBuffers.test.ts`).

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Bridge = ReturnType<typeof createSimulationBridge>;

/** One decision of the seat and the tick its purchases are charged on (decisions come every 30 ticks); `queued` is
 *  the units a producer trains (the technologies it researches beside them cost no wood here). */
function playOneDecision(seed: string): { bridge: Bridge; queued: (type: string) => string[]; foundations: string[]; wood: number } {
  const bridge = createSimulationBridge(seed);
  for (let tick = 0; tick < 10; tick += 1) bridge.step(100);
  const end = bridge.getEconomyState();
  const queued = (type: string) => end.buildings
    .filter((b) => b.owner === 2 && b.buildingType === type)
    .flatMap((b) => b.queue.filter((entry) => entry.kind === 'unit').map((entry) => entry.unitType ?? '?'));
  const foundations = end.buildings.filter((b) => b.owner === 2 && !b.isComplete).map((b) => b.buildingType);
  return { bridge, queued, foundations, wood: end.playerResources[2]?.wood ?? 0 };
}

describe("the computer's soldiers leave a farm's wood while its farms are short (work 147 M2)", () => {
  it('trains no Spearman, Archer or Skirmisher under 85 wood with its farms short and few on food', () => {
    const start = createSimulationBridge('ai-flush-farm-buffer-fixture').getEconomyState();
    expect(start.playerResources[2]?.wood).toBe(50);
    expect(start.buildings.filter((b) => b.owner === 2 && b.buildingType === 'farm')).toHaveLength(0);
    const { queued, foundations, wood } = playOneDecision('ai-flush-farm-buffer-fixture');
    const diagnostic = `Barracks ${JSON.stringify(queued('barracks'))} Range ${JSON.stringify(queued('archery-range'))} `
      + `Stable ${JSON.stringify(queued('stable'))}; wood ${wood}; foundations ${JSON.stringify(foundations)}`;
    expect(queued('barracks'), diagnostic).toEqual([]);
    expect(queued('archery-range'), diagnostic).toEqual([]);
    // The army loop ran: the Scout needs no wood and is not held.
    expect(queued('stable'), diagnostic).toEqual(['scout']);
    expect(wood, diagnostic).toBe(50);
  }, 60_000);

  it('trains them once its farms, complete or only placed, reach its farm target', () => {
    for (const seed of ['ai-flush-farms-standing-fixture', 'ai-flush-farm-foundations-fixture']) {
      const { queued, wood } = playOneDecision(seed);
      expect(queued('barracks'), `${seed}: wood ${wood}`).toEqual(['spearman']);
    }
  }, 60_000);

  it('holds them for a level army of five while the seat is not ahead of the enemy, and not once it is', () => {
    // Seven farms of a target of 8 and every farm idle, so only the army's reason can hold.
    const start = createSimulationBridge('ai-flush-level-army-fixture').getEconomyState();
    expect(start.buildings.filter((b) => b.owner === 2 && b.buildingType === 'farm')).toHaveLength(7);
    expect(start.units.filter((u) => u.owner === 2 && u.unitType === 'spearman')).toHaveLength(5);
    const level = playOneDecision('ai-flush-level-army-fixture');
    expect(level.queued('barracks'), `level: wood ${level.wood}`).toEqual([]);
    expect(level.queued('archery-range'), `level: wood ${level.wood}`).toEqual([]);
    const ahead = playOneDecision('ai-flush-ahead-of-age-fixture');
    expect(ahead.queued('barracks'), `ahead: wood ${ahead.wood}`).toEqual(['spearman']);
  }, 60_000);
});

describe("the computer's soldiers leave the Siege Workshop its wood in the Castle Age (work 147 M2)", () => {
  it('trains no Pikeman or Crossbowman under 225 wood while no Siege Workshop is placed', () => {
    const { queued, foundations, wood } = playOneDecision('ai-flush-siege-workshop-fixture');
    const diagnostic = `Barracks ${JSON.stringify(queued('barracks'))} Range ${JSON.stringify(queued('archery-range'))} `
      + `Stable ${JSON.stringify(queued('stable'))}; wood ${wood}; foundations ${JSON.stringify(foundations)}`;
    expect(foundations, diagnostic).toEqual([]);
    expect(queued('barracks'), diagnostic).toEqual([]);
    expect(queued('archery-range'), diagnostic).toEqual([]);
    expect(queued('stable'), diagnostic).toEqual(['knight']);
    expect(wood, diagnostic).toBe(150);
  }, 60_000);

  it('trains them once a Siege Workshop is placed, complete or not', () => {
    for (const seed of ['ai-flush-siege-workshop-standing-fixture', 'ai-flush-siege-workshop-foundation-fixture']) {
      const { queued, wood } = playOneDecision(seed);
      const diagnostic = `${seed}: Barracks ${JSON.stringify(queued('barracks'))} Range ${JSON.stringify(queued('archery-range'))}; wood ${wood}`;
      expect(queued('barracks'), diagnostic).toEqual(['spearman']);
      expect(queued('archery-range'), diagnostic).toEqual(['archer']);
    }
  }, 60_000);
});
