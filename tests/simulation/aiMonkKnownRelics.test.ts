// The computer's Monks fetch the relics its seat knows of (work 128; defect
// register 2026-10-15; spec §13.3).
//
// The defect: the AI sent a Monk only for a relic in sight at that moment
// (`findNearestVisibleNeutralRelic`), so a relic the seat had found and then
// lost sight of was never sought. On the castle self-play configuration owner 2
// saw the relic at (36,10) at tick 1,000 and its Monks went for it only when
// one happened to come within sight of it, 26,000 ticks later. The rule now:
// a relic on ground the seat has explored, its own exploration or a shared
// one, is known. One the seat has never seen is not: no Definitive Edition
// source gives the computer more than that, and its AI was previewed as one
// that has to scout (monkAiSearchHelpers.ts carries the source and the rule).
//
// The fixture (fixtures/monkRelics.ts) puts owner 1 under the AI. Its Monk
// stands beside relic C and stores it first. A lookout villager stands beside
// relic A when the match is seeded, so A is explored ground, and the test
// deletes the lookout with the Delete key before the first tick, so the seat
// never sees A again. Relic B lies on ground the seat never sees. A third case
// gives the seat a Missionary, which cannot carry a relic, and a wounded
// Militia: the computer must send the Missionary to heal, never for a relic.
//
// BOUND: one map of open grass, one seat, the standard AI's decision interval.
// What the seat knows is read where a relic lies now, not where the seat last
// saw it (monkAiSearchHelpers.ts states that bound); nothing here moves a
// relic on explored ground out of the seat's sight.

import { describe, expect, it } from 'vitest';

import {
  monkCarriedRelicCodec,
  relicsInMonasteryCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  AI_MISSIONARY_KNOWN_RELIC_SEED,
  AI_MONK_KNOWN_RELIC_SEED,
  KNOWN_EXPLORED_RELIC_CELL,
  KNOWN_LOOKOUT_CELL,
  KNOWN_NEAR_RELIC_CELL,
  KNOWN_UNSEEN_RELIC_CELL,
  WOUNDED_MILITIA_CELL,
} from '../../src/game/simulation/fixtures/monkRelics';
import { stepBridgeUntil } from './createSimulationBridge.helpers';
import { exploredCellsInState, saveState } from './vietnameseRevealHelpers';

type Bridge = ReturnType<typeof createSimulationBridge>;
type Cell = { x: number; y: number };

const SEAT = 1;
const key = (cell: Cell): string => `${cell.x},${cell.y}`;

/** Boots the fixture with owner 1 under the AI and deletes its lookout before
 *  the first tick. Returns the relics' ids by the cell each starts on. */
function boot(seed: string): { bridge: Bridge; relicAt: Map<string, number> } {
  const bridge = createSimulationBridge(seed, {
    forceAiForOwners: new Set([SEAT]),
    renderProjection: 'on-read',
  });
  const economy = bridge.getEconomyState();
  const relicAt = new Map(economy.resources
    .filter((resource) => resource.resourceType === 'relic')
    .map((relic) => [key(relic), relic.id] as const));
  const lookout = economy.units.find((unit) => unit.owner === SEAT && key(unit) === key(KNOWN_LOOKOUT_CELL));
  if (!lookout || relicAt.size !== 3) throw new Error('The fixture lost its lookout or one of its three relics.');
  expect(bridge.selectUnitsByIds([lookout.id])).toBe(true);
  expect(bridge.deleteSelectedEntity()).toBe(true);
  return { bridge, relicAt };
}

function relicOnMap(bridge: Bridge, id: number) {
  return bridge.getEconomyState().resources.find((resource) => resource.id === id) ?? null;
}

/** Relics stored in the seat's Monasteries, read from the world state. */
function storedBySeat(bridge: Bridge): number {
  const stored = relicsInMonasteryCodec.deserialize(
    bridge.world.getState(relicsInMonasteryCodec.slot) as Array<[number, number]> | undefined,
  );
  const monasteries = new Set(bridge.getEconomyState().buildings
    .filter((building) => building.owner === SEAT && building.buildingType === 'monastery')
    .map((building) => building.id));
  let total = 0;
  for (const [monasteryId, count] of stored) if (monasteries.has(monasteryId)) total += count;
  return total;
}

function isCarried(bridge: Bridge, relicId: number): boolean {
  const carried = monkCarriedRelicCodec.deserialize(
    bridge.world.getState(monkCarriedRelicCodec.slot) as Array<[number, number]> | undefined,
  );
  return [...carried.values()].includes(relicId);
}

/** Steps until relic A is stored, asserting the knowledge state on the way. */
function untilExploredRelicStored(bridge: Bridge, relicAt: Map<string, number>): void {
  bridge.step(100);
  // The premise, read from the world: A is explored ground the seat no longer
  // sees, and B has never been explored.
  const explored = exploredCellsInState(saveState(bridge.saveGame()), SEAT);
  expect(explored.has(key(KNOWN_EXPLORED_RELIC_CELL)), 'the lookout never explored relic A').toBe(true);
  expect(bridge.isCellVisibleForOwner(SEAT, KNOWN_EXPLORED_RELIC_CELL.x, KNOWN_EXPLORED_RELIC_CELL.y)).toBe(false);
  expect(explored.has(key(KNOWN_UNSEEN_RELIC_CELL)), 'the seat has explored relic B').toBe(false);

  const relicA = relicAt.get(key(KNOWN_EXPLORED_RELIC_CELL))!;
  const relicC = relicAt.get(key(KNOWN_NEAR_RELIC_CELL))!;
  expect(
    stepBridgeUntil(bridge, () => relicOnMap(bridge, relicA) === null, { maxSteps: 3_000 }),
    'the computer never fetched relic A, which its seat explored and no longer sees',
  ).toBe(true);
  expect(relicOnMap(bridge, relicC), 'relic C, beside the Monk, was never stored').toBeNull();
  expect(storedBySeat(bridge)).toBe(2);
}

describe('the computer\'s Monks fetch the relics its seat knows of (work 128)', () => {
  it('fetches a relic its seat explored but no longer sees, and stores it in its Monastery', () => {
    const { bridge, relicAt } = boot(AI_MONK_KNOWN_RELIC_SEED);
    untilExploredRelicStored(bridge, relicAt);
  });

  it('does not go for a relic its seat has never seen', () => {
    const { bridge, relicAt } = boot(AI_MONK_KNOWN_RELIC_SEED);
    untilExploredRelicStored(bridge, relicAt);
    // With A and C stored, B is the one relic left on the map. The seat has
    // never seen it, so its Monk stays home: 1,500 ticks is time for a Monk to
    // walk there and halfway back.
    const relicB = relicAt.get(key(KNOWN_UNSEEN_RELIC_CELL))!;
    for (let tick = 0; tick < 1_500; tick += 1) bridge.step(100);
    expect(relicOnMap(bridge, relicB), 'relic B left the map').toMatchObject(KNOWN_UNSEEN_RELIC_CELL);
    expect(isCarried(bridge, relicB), 'a Monk of the seat went for relic B, which the seat has never seen').toBe(false);
    expect(storedBySeat(bridge)).toBe(2);
  });

  it('sends a Missionary, which cannot carry a relic, to heal rather than for a relic', () => {
    const { bridge } = boot(AI_MISSIONARY_KNOWN_RELIC_SEED);
    const militia = bridge.getEconomyState().units
      .find((unit) => unit.owner === SEAT && unit.unitType === 'militia' && key(unit) === key(WOUNDED_MILITIA_CELL));
    if (!militia) throw new Error('The fixture lost its wounded Militia.');
    // The AI heals a military unit below 70% of its hit points; the Militia
    // starts at 10 of 40, and a Missionary beside it heals one every 10 ticks.
    const healed = stepBridgeUntil(bridge, () => {
      const health = bridge.getEntityHealth(militia.id);
      return health !== null && health.currentHp >= 0.7 * health.maxHp;
    }, { maxSteps: 600 });
    expect(healed, 'the Missionary never healed the wounded Militia beside it').toBe(true);
  });
});
