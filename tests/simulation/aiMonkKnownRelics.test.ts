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
// A Monk is sent only for a known relic it can walk to within reach of: the
// first version of the rule sent it for the nearest, so a relic in a lake kept
// every Monk of the seat off healing and off every other relic for the rest of
// the match (review round 0, SF2).
//
// The fixtures (fixtures/monkRelics.ts) put a seat under the AI. In the first,
// its Monk stands beside relic C and stores it first. A lookout villager stands
// beside relic A when the match is seeded, so A is explored ground, and the
// test deletes the lookout with the Delete key before the first tick, so the
// seat never sees A again. Relic B lies on ground the seat never sees. Another
// gives the seat a Missionary, which cannot carry a relic, and a wounded
// Militia: the computer must send the Missionary to heal, never for a relic.
// Two set the nearest known relic in a lake, out of every Monk's reach: the
// Monk must fetch the farther one, or heal when there is none. The last makes
// the player the computer's ally: the player's lookout explores relic A and is
// deleted, so only the ally's exploration knows of A.
//
// BOUND: one map of open grass, a lake in two fixtures, the standard AI's
// decision interval. What the seat knows is read where a relic lies now, not
// where the seat last saw it (monkAiSearchHelpers.ts states that bound);
// nothing here moves a relic on explored ground out of the seat's sight.
// Whether a Monk can reach a relic is the planner's answer at the moment of
// the decision (findUnitRangePlan, as the crew phase asks it).

import { describe, expect, it } from 'vitest';

import {
  monkCarriedRelicCodec,
  relicsInMonasteryCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  AI_MISSIONARY_KNOWN_RELIC_SEED,
  AI_MONK_ALLY_SIGHT_RELIC_SEED,
  AI_MONK_KNOWN_RELIC_SEED,
  AI_MONK_UNREACHABLE_RELIC_HEAL_SEED,
  AI_MONK_UNREACHABLE_RELIC_SEED,
  ALLY_LOOKOUT_CELL,
  ALLY_SIGHT_AI_SEAT,
  FAR_RELIC_CELL,
  KNOWN_EXPLORED_RELIC_CELL,
  KNOWN_LOOKOUT_CELL,
  KNOWN_NEAR_RELIC_CELL,
  KNOWN_UNSEEN_RELIC_CELL,
  LAKE_LOOKOUT_CELL,
  LAKE_RELIC_CELL,
  ROUTE_MONK_CELL,
  WOUNDED_MILITIA_CELL,
} from '../../src/game/simulation/fixtures/monkRelics';
import { stepBridgeUntil } from './createSimulationBridge.helpers';
import { exploredCellsInState, saveState } from './vietnameseRevealHelpers';

type Bridge = ReturnType<typeof createSimulationBridge>;
type Cell = { x: number; y: number };

/** The seat under the AI in every fixture but the ally one; also the player's. */
const SEAT = 1;
const key = (cell: Cell): string => `${cell.x},${cell.y}`;
const manhattan = (a: Cell, b: Cell): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Boots the fixture with `seat` under the AI and deletes the player's lookout
 *  at `lookoutCell` with the Delete key before the first tick. Returns the
 *  relics' ids by the cell each starts on. */
function boot(
  seed: string,
  lookoutCell: Cell,
  relicCount: number,
  seat = SEAT,
): { bridge: Bridge; relicAt: Map<string, number> } {
  const bridge = createSimulationBridge(seed, {
    forceAiForOwners: new Set([seat]),
    renderProjection: 'on-read',
  });
  const economy = bridge.getEconomyState();
  const relicAt = new Map(economy.resources
    .filter((resource) => resource.resourceType === 'relic')
    .map((relic) => [key(relic), relic.id] as const));
  const lookout = economy.units.find((unit) => unit.owner === SEAT && key(unit) === key(lookoutCell));
  if (!lookout || relicAt.size !== relicCount) {
    throw new Error(`The fixture ${seed} lost its lookout or holds ${relicAt.size} relics, not ${relicCount}.`);
  }
  expect(bridge.selectUnitsByIds([lookout.id])).toBe(true);
  expect(bridge.deleteSelectedEntity()).toBe(true);
  return { bridge, relicAt };
}

function relicOnMap(bridge: Bridge, id: number) {
  return bridge.getEconomyState().resources.find((resource) => resource.id === id) ?? null;
}

/** Relics stored in `owner`'s Monasteries, read from the world state. */
function storedBy(bridge: Bridge, owner = SEAT): number {
  const stored = relicsInMonasteryCodec.deserialize(
    bridge.world.getState(relicsInMonasteryCodec.slot) as Array<[number, number]> | undefined,
  );
  const monasteries = new Set(bridge.getEconomyState().buildings
    .filter((building) => building.owner === owner && building.buildingType === 'monastery')
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

/** Whether `owner` has explored `cell`, read from a save of the world. */
function explored(bridge: Bridge, owner: number, cell: Cell): boolean {
  return exploredCellsInState(saveState(bridge.saveGame()), owner).has(key(cell));
}

/** Steps until relic A is stored, asserting the knowledge state on the way. */
function untilExploredRelicStored(bridge: Bridge, relicAt: Map<string, number>): void {
  bridge.step(100);
  // The premise, read from the world: A is explored ground the seat no longer
  // sees, and B has never been explored.
  expect(explored(bridge, SEAT, KNOWN_EXPLORED_RELIC_CELL), 'the lookout never explored relic A').toBe(true);
  expect(bridge.isCellVisibleForOwner(SEAT, KNOWN_EXPLORED_RELIC_CELL.x, KNOWN_EXPLORED_RELIC_CELL.y)).toBe(false);
  expect(explored(bridge, SEAT, KNOWN_UNSEEN_RELIC_CELL), 'the seat has explored relic B').toBe(false);

  const relicA = relicAt.get(key(KNOWN_EXPLORED_RELIC_CELL))!;
  const relicC = relicAt.get(key(KNOWN_NEAR_RELIC_CELL))!;
  expect(
    stepBridgeUntil(bridge, () => relicOnMap(bridge, relicA) === null, { maxSteps: 3_000 }),
    'the computer never fetched relic A, which its seat explored and no longer sees',
  ).toBe(true);
  expect(relicOnMap(bridge, relicC), 'relic C, beside the Monk, was never stored').toBeNull();
  expect(storedBy(bridge)).toBe(2);
}

/** Steps until the seat's wounded Militia is back above the AI's healing line. */
function healedWithin(bridge: Bridge, maxSteps: number): boolean {
  const militia = bridge.getEconomyState().units
    .find((unit) => unit.owner === SEAT && unit.unitType === 'militia' && key(unit) === key(WOUNDED_MILITIA_CELL));
  if (!militia) throw new Error('The fixture lost its wounded Militia.');
  // The AI heals a military unit below 70% of its hit points; the Militia
  // starts at 10 of 40, and a Monk or Missionary beside it heals one every 10 ticks.
  return stepBridgeUntil(bridge, () => {
    const health = bridge.getEntityHealth(militia.id);
    return health !== null && health.currentHp >= 0.7 * health.maxHp;
  }, { maxSteps });
}

describe('the computer\'s Monks fetch the relics its seat knows of (work 128)', () => {
  it('fetches a relic its seat explored but no longer sees, and stores it in its Monastery', () => {
    const { bridge, relicAt } = boot(AI_MONK_KNOWN_RELIC_SEED, KNOWN_LOOKOUT_CELL, 3);
    untilExploredRelicStored(bridge, relicAt);
  });

  it('does not go for a relic its seat has never seen', () => {
    const { bridge, relicAt } = boot(AI_MONK_KNOWN_RELIC_SEED, KNOWN_LOOKOUT_CELL, 3);
    untilExploredRelicStored(bridge, relicAt);
    // With A and C stored, B is the one relic left on the map. The seat has
    // never seen it, so its Monk stays home: 1,500 ticks is time for a Monk to
    // walk there and halfway back.
    const relicB = relicAt.get(key(KNOWN_UNSEEN_RELIC_CELL))!;
    for (let tick = 0; tick < 1_500; tick += 1) bridge.step(100);
    expect(relicOnMap(bridge, relicB), 'relic B left the map').toMatchObject(KNOWN_UNSEEN_RELIC_CELL);
    expect(isCarried(bridge, relicB), 'a Monk of the seat went for relic B, which the seat has never seen').toBe(false);
    expect(storedBy(bridge)).toBe(2);
  });

  it('sends a Missionary, which cannot carry a relic, to heal rather than for a relic', () => {
    const { bridge } = boot(AI_MISSIONARY_KNOWN_RELIC_SEED, KNOWN_LOOKOUT_CELL, 3);
    expect(healedWithin(bridge, 600), 'the Missionary never healed the wounded Militia beside it').toBe(true);
  });

  it('passes over a known relic it cannot reach and fetches the next one', () => {
    const { bridge, relicAt } = boot(AI_MONK_UNREACHABLE_RELIC_SEED, LAKE_LOOKOUT_CELL, 2);
    bridge.step(100);
    // The premise: the seat knows of both relics, and the one in the lake is
    // the nearer to its Monk.
    expect(explored(bridge, SEAT, LAKE_RELIC_CELL), 'the lookout never explored the lake relic').toBe(true);
    expect(explored(bridge, SEAT, FAR_RELIC_CELL), 'the sentry never explored the far relic').toBe(true);
    expect(manhattan(ROUTE_MONK_CELL, LAKE_RELIC_CELL)).toBeLessThan(manhattan(ROUTE_MONK_CELL, FAR_RELIC_CELL));

    const lake = relicAt.get(key(LAKE_RELIC_CELL))!;
    const far = relicAt.get(key(FAR_RELIC_CELL))!;
    expect(
      stepBridgeUntil(bridge, () => relicOnMap(bridge, far) === null, { maxSteps: 3_000 }),
      'the computer never fetched the relic it can reach, past the nearer one in the lake',
    ).toBe(true);
    expect(storedBy(bridge)).toBe(1);
    expect(relicOnMap(bridge, lake)).toMatchObject(LAKE_RELIC_CELL);
  });

  it('heals a wounded soldier when the only relic its seat knows of cannot be reached', () => {
    const { bridge, relicAt } = boot(AI_MONK_UNREACHABLE_RELIC_HEAL_SEED, LAKE_LOOKOUT_CELL, 1);
    bridge.step(100);
    expect(explored(bridge, SEAT, LAKE_RELIC_CELL), 'the lookout never explored the lake relic').toBe(true);
    expect(healedWithin(bridge, 600), 'the Monk never healed the wounded Militia beside it').toBe(true);
    expect(isCarried(bridge, relicAt.get(key(LAKE_RELIC_CELL))!)).toBe(false);
  });

  it('fetches a relic on ground only its ally has explored', () => {
    const { bridge, relicAt } = boot(AI_MONK_ALLY_SIGHT_RELIC_SEED, ALLY_LOOKOUT_CELL, 1, ALLY_SIGHT_AI_SEAT);
    bridge.step(100);
    // The premise: the player, the computer's ally, explored relic A and no
    // longer sees it; the computer's own seat never explored it.
    const { x, y } = KNOWN_EXPLORED_RELIC_CELL;
    expect(explored(bridge, SEAT, KNOWN_EXPLORED_RELIC_CELL), 'the ally\'s lookout never explored relic A').toBe(true);
    expect(explored(bridge, ALLY_SIGHT_AI_SEAT, KNOWN_EXPLORED_RELIC_CELL), 'the computer explored relic A itself').toBe(false);
    expect(bridge.isCellVisibleForOwner(SEAT, x, y) || bridge.isCellVisibleForOwner(ALLY_SIGHT_AI_SEAT, x, y)).toBe(false);

    const relicA = relicAt.get(key(KNOWN_EXPLORED_RELIC_CELL))!;
    expect(
      stepBridgeUntil(bridge, () => relicOnMap(bridge, relicA) === null, { maxSteps: 3_000 }),
      'the computer never fetched relic A, which only its ally explored',
    ).toBe(true);
    expect(storedBy(bridge, ALLY_SIGHT_AI_SEAT)).toBe(1);
  });
});
