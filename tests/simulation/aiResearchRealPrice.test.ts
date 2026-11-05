// The computer prices a technology at what the click would really take (work
// 141, closing the research half of work 125's card in plan 106).
//
// Spies costs 200 gold per living enemy villager. The AI's research loop read
// it off the base table (200 gold), so any seat holding 200 gold and unable to
// pay for the entries before it on its Castle's list asked for Spies on every
// decision, was refused every time, and stopped there: the loop takes the
// first entry it can pay for and goes no further. Measured in the coverage lab
// (selfPlayContentCoverage.test.ts) on the work 141 M1 tree: owner 1's Castle
// stood idle for 678 of 678 samples from its completion to the 45,000-tick
// horizon, holding up to 2,321 gold, and researched nothing.
//
// `ai-spies-price-fixture`: owner 2 is an Imperial-Age Frankish AI with a
// complete Castle and exactly 300 gold, owner 1 has ten villagers, so Spies
// really costs 2,000, and the map holds no resource, so nothing else can be
// paid for. Bound: one technology (the only one whose price is a query), one
// producer, one seat; the recorded command stream is what is read.

import { MemorySink, SessionRecorder } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('the computer prices its research as the click does (work 141)', () => {
  it('never asks for Spies it cannot pay for at the real price', () => {
    const bridge = createSimulationBridge('ai-spies-price-fixture');
    const start = bridge.getEconomyState();
    // The fixture is what this case needs: the price really is 2,000 and the
    // seat really holds 300, in the age and with the building Spies needs.
    expect(start.units.filter((u) => u.owner === 1 && u.unitType === 'villager')).toHaveLength(10);
    expect(start.ages[2]).toBe('imperial-age');
    expect(start.playerResources[2]?.gold).toBe(300);
    expect(start.buildings.some((b) => b.owner === 2 && b.buildingType === 'castle' && b.isComplete)).toBe(true);

    const sink = new MemorySink({ allowSidecar: true });
    const recorder = new SessionRecorder({
      world: bridge.world,
      sink,
      snapshotInterval: null,
      terminalSnapshot: false,
      sourceKind: 'session',
      sourceLabel: 'ai-spies-price',
    });
    recorder.connect();
    // Ten of the Standard AI's decisions.
    for (let tick = 0; tick < 300; tick += 1) bridge.step(100);
    recorder.disconnect();

    const research = recorder.toBundle().commands.filter((command) => command.type === 'queue.research');
    const spies = research.filter((command) => (command.data as { technologyType?: string }).technologyType === 'spies');
    expect(spies, `queue.research commands: ${JSON.stringify(research.map((c) => (c.data as { technologyType?: string }).technologyType))}`)
      .toHaveLength(0);
    expect(bridge.getEconomyState().playerResources[2]?.gold).toBe(300);
  }, 60_000);
});
