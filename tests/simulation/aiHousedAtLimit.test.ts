// Full at the population limit is not housed (work 141: review round 0 F1,
// whose test is round 1's R1-1).
//
// A House adds nothing once the population cap has reached the lobby's limit,
// so at the limit the computer builds no House and its build order carries on
// with everything else. Before F1, whenever the population was full the build
// order asked only whether a House was already going up: at the limit it
// placed a House that could add nothing each time the last one finished, and
// held everything else for it. Red proofs (2026-11-04), each with the rest of
// the tree as shipped: reading full as housed while keeping the House rule,
// owner 2 placed nothing; with the pre-F1 wiring back, it placed two Houses.
//
// `ai-planner-fixture` with a population limit of 4: owner 2 is a Dark Age
// Standard AI with a Town Center (5 population), its 4 villagers, 2,000 food
// and wood, 1,500 gold and 500 stone, so it is full at the limit from the
// first tick and can pay for anything on its Dark Age build order. Bound: one
// seat, the Dark Age build order, 10 decisions; the buildings owner 2 holds at
// the end are what is read.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('the computer at the population limit (work 141)', () => {
  it('builds no House and carries on with the rest of its build order', () => {
    const bridge = createSimulationBridge('ai-planner-fixture', { populationCap: 4 });
    const start = bridge.getEconomyState();
    // The fixture is what this case needs: full, at the limit, and rich.
    expect(start.population[2]).toMatchObject({ current: 4, cap: 4 });
    expect(start.ages[2]).toBe('dark-age');
    expect(start.buildings.filter((b) => b.owner === 2).map((b) => b.buildingType)).toEqual(['town-center']);

    // Ten of the Standard AI's decisions.
    for (let tick = 0; tick < 300; tick += 1) bridge.step(100);

    const end = bridge.getEconomyState();
    const placed = end.buildings
      .filter((b) => b.owner === 2 && b.buildingType !== 'town-center')
      .map((b) => b.buildingType);
    const diagnostic = `owner 2 placed: ${JSON.stringify(placed)}; population ${JSON.stringify(end.population[2])}`;
    expect(placed.filter((type) => type === 'house'), diagnostic).toHaveLength(0);
    expect(placed.length, diagnostic).toBeGreaterThan(0);
    expect(end.population[2]?.cap, diagnostic).toBe(4);
  }, 60_000);
});
