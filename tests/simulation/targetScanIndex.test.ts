// The target searches of auto-aggression and tower combat take their
// candidates from a per-pass list of units and buildings
// (src/game/simulation/bridge/targetScanIndex.ts), not from the engine's
// spatial grid, and get exactly the same candidates in the same order.
//
// Why it matters. The engine's grid answers a radius query with EVERY entity
// in the disc — mostly trees and mines on a real map — sorted by id and then
// filtered by component. Auto-aggression asks once per idle unit per tick, and
// every Town Centre, tower and Castle that is not reloading asks once per
// tick, so on the coverage lab's 45,000-tick match those searches were 30.2%
// of all CPU (scripts/profile-selfplay.mjs, 2026-09-25; register entry of
// that date). The list is only fast if it is also RIGHT: a different
// candidate, or the same ones in another order, picks another target and
// plays another match.
//
// What is checked.
// (1) Equivalence: on three real world states — the boot map, and both sides
//     of the garrisoned-defender fixture before and after its armies move —
//     every cell of the map as an origin, nine radii (whole and fractional),
//     both kinds: the list's candidates equal `world.queryInRadius`'s, id for
//     id and in order. Non-vacuous by construction: each state must hold at
//     least 1,000 positioned entities that are neither unit nor building (the
//     trees and mines the list leaves out), and the sweep must meet non-empty
//     answers of both kinds.
// (2) Failures: an origin off the map or between cells, and a radius that is
//     negative or not finite, throw the engine's own error, because the list
//     hands those to the engine.
// (3) Use: over a real match, the two systems' searches never reach the
//     engine's radius query, and the list is built. A search that stopped
//     passing its list would still be CORRECT — (1) would stay green — and
//     only slow, so this case is the one that sees the cost come back.
//
// BOUND. Three states on two maps. A candidate list is a snapshot of
// positions; its correctness also rests on the two passes changing no
// position while it lives, which the systems' own code guarantees (they
// queue intentions and launch projectiles) and which this file does not
// re-prove beyond the historical full-match digests retained with the
// archived performance work and the current bounded interleaved comparison.

import { describe, expect, it } from 'vitest';

import { createTargetScanIndex } from '../../src/game/simulation/bridge/targetScanIndex';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

type Bridge = ReturnType<typeof createSimulationBridge>;
type World = Bridge['world'];

const RADII = [0, 1, 1.5, 3, 4, 5.5, 7, 8, 12];
const KINDS = ['unit', 'building'] as const;

function sweep(world: World): { compared: number; nonEmpty: Record<string, number>; mismatches: string[] } {
  const scan = createTargetScanIndex(world);
  const nonEmpty: Record<string, number> = { unit: 0, building: 0 };
  const mismatches: string[] = [];
  let compared = 0;
  for (let y = 0; y < world.grid.height; y += 1) {
    for (let x = 0; x < world.grid.width; x += 1) {
      for (const radius of RADII) {
        for (const kind of KINDS) {
          const engine = [...world.queryInRadius(x, y, radius, 'position', kind)];
          const ours = [...scan.candidatesInRadius(kind, x, y, radius)];
          compared += 1;
          if (engine.length > 0) nonEmpty[kind] += 1;
          if (engine.length !== ours.length || engine.some((id, i) => id !== ours[i])) {
            if (mismatches.length < 5) {
              mismatches.push(`(${x},${y}) r=${radius} ${kind}: engine [${engine.join(',')}] list [${ours.join(',')}]`);
            }
          }
        }
      }
    }
  }
  return { compared, nonEmpty, mismatches };
}

function scenery(world: World): number {
  let count = 0;
  for (const id of world.query('position')) {
    if (world.getComponent(id, 'unit') === undefined && world.getComponent(id, 'building') === undefined) count += 1;
  }
  return count;
}

function garrisonedDefender(ticks: number): Bridge {
  const bridge = createSimulationBridge('ai-garrisoned-defender-fixture', {
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
  });
  for (let tick = 0; tick < ticks; tick += 1) bridge.step(100);
  return bridge;
}

describe('the target-search candidate list', () => {
  const states: Array<[string, () => Bridge]> = [
    ['the boot map', () => createSimulationBridge('aoe2-prototype', { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) })],
    ['the garrisoned-defender fixture at tick 1', () => garrisonedDefender(1)],
    ['the garrisoned-defender fixture at tick 1,500, armies on the move', () => garrisonedDefender(1500)],
  ];

  for (const [name, open] of states) {
    it(`returns the engine's candidates, id for id and in order, on ${name}`, () => {
      const { world } = open();
      const trees = scenery(world);
      expect(trees, `${name}: the sweep needs scenery for the list to leave out`).toBeGreaterThanOrEqual(1000);
      const { compared, nonEmpty, mismatches } = sweep(world);
      expect(compared).toBe(world.grid.width * world.grid.height * RADII.length * KINDS.length);
      expect(nonEmpty.unit, `${name}: no query met a unit, so nothing was compared`).toBeGreaterThan(100);
      expect(nonEmpty.building, `${name}: no query met a building, so nothing was compared`).toBeGreaterThan(100);
      expect(mismatches, `${name}: the list and the engine disagree`).toEqual([]);
    }, 60_000);
  }

  it('hands an origin off the map or between cells, and a bad radius, to the engine, which throws as it always did', () => {
    const { world } = createSimulationBridge('aoe2-prototype');
    const scan = createTargetScanIndex(world);
    const cases: Array<[number, number, number]> = [
      [-1, 5, 3], [world.grid.width, 5, 3], [5, world.grid.height, 3], [2.5, 5, 3],
      [5, 5, -1], [5, 5, Number.NaN], [5, 5, Number.POSITIVE_INFINITY],
    ];
    for (const [x, y, radius] of cases) {
      let engineError = '';
      try {
        Array.from(world.queryInRadius(x, y, radius, 'position', 'unit'));
      } catch (error) {
        engineError = (error as Error).message;
      }
      expect(engineError, `the engine accepts (${x},${y}) r=${radius}; this case tests nothing`).not.toBe('');
      expect(() => [...scan.candidatesInRadius('unit', x, y, radius)]).toThrow(engineError);
    }
  });

  it('is what auto-aggression and tower combat search, so neither reaches the engine\'s radius query in a real match', () => {
    const bridge = createSimulationBridge('aoe2-prototype', { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) });
    const world = bridge.world;
    const searchers = /autoAggressionSystem|towerCombatSystem/;
    let engineRadiusQueriesFromSearchers = 0;
    let listsBuilt = 0;
    const engineQueryInRadius = world.queryInRadius.bind(world);
    const engineQuery = world.query.bind(world);
    (world as { queryInRadius: World['queryInRadius'] }).queryInRadius = ((...args: Parameters<World['queryInRadius']>) => {
      if (searchers.test(new Error().stack ?? '')) engineRadiusQueriesFromSearchers += 1;
      return engineQueryInRadius(...args);
    }) as World['queryInRadius'];
    (world as { query: World['query'] }).query = ((...args: Parameters<World['query']>) => {
      if ((new Error().stack ?? '').includes('targetScanIndex')) listsBuilt += 1;
      return engineQuery(...args);
    }) as World['query'];
    // 300 ticks of the boot map: every Town Centre searches each tick it is
    // not reloading, and idle scouts and villagers search their sight.
    for (let tick = 0; tick < 300; tick += 1) bridge.step(100);
    expect(listsBuilt, 'no candidate list was built, so the searches this case guards never ran').toBeGreaterThan(300);
    expect(engineRadiusQueriesFromSearchers, 'auto-aggression or tower combat searched the engine\'s spatial grid again').toBe(0);
  });
});
