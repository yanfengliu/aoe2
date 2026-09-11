import { afterEach, describe, expect, it } from 'vitest';

import { AI_SURPLUS_TRADE } from '../../src/game/simulation/aiMarketPlanning';
import { MARKET_TRANSACTION_AMOUNT } from '../../src/game/simulation/bridge/bridgeConstants';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import type { EconomyResourceKind, PlayerResources } from '../../src/game/simulation/types';

// GATE for the register's 2026-09-03 entry, "the AI hoards the resource it
// cannot spend and starves on the one that gates every unit".
//
// TWO PROPERTIES, read off ONE played match, because the fix has two failure
// modes facing opposite ways and a gate on either alone is satisfied by the
// other. (1) No seat ends WEDGED — sitting on a pile it cannot spend while
// starved of what its units are priced in. (2) No seat ends having STARVED ITS
// OWN BUILD PLAN to feed its unit queue, which is what the first version of the
// fix did: it unwedged both seats of the coverage lab and paid for it with owner
// 1's Monastery, its Siege Workshop and five of its technologies, gaining
// nothing in either direction. Each has its own mutation case below, because a
// gate that cannot be made to go red is a gate that measures nothing.
//
// THE FIRST PROPERTY, not one match's numbers. An owner must not sit on a large idle
// pile of one resource while under a single tradeable batch of another. That
// pair of conditions is the defect's whole class: the register measured the
// starved resource as gold on `fortress`, wood on `coastal` owner 1 and food on
// `coastal` owner 2, so a gate that named one of them would pass on the other
// two. Naming neither, and asking only that the two conditions never hold
// together, covers all of them.
//
// WHERE THE TWO THRESHOLDS COME FROM — the game's own mechanism, not a
// trajectory. STARVED is `MARKET_TRANSACTION_AMOUNT` (100), the batch the
// Market trades in: below one batch, a resource cannot be sold at all. HOARD is
// eight of those batches (800): an owner holding that much of one resource has
// at minimum eight conversions available to it and, if it is simultaneously
// under one batch of another, has made none of them. Neither number is read off
// a match, so neither goes stale when the AI improves.
//
// Both thresholds clear the measured baseline by a wide margin. On `b929d07d`
// the coverage lab at 45,000 ticks ended:
//     owner 1   food  731  wood   10  gold    23  stone 1093   (max 1093, min 10)
//     owner 2   food   58  wood   18  gold  4681  stone  315   (max 4681, min 18)
// Both violate on both counts.
//
// WHY LOPSIDEDNESS AND NOT "CANNOT AFFORD ITS MIX". The register's sentence is
// "unaffordable for its age's unit mix", and the literal form of that would have
// to ask `pickUnitMix` and `getTrainOptions` — the AI's own wish list and the
// AI's own age gating — which is a check built from the same symbol as the thing
// it checks. Lopsidedness is the same claim in the game's terms: a seat under one
// Market batch of a resource cannot buy anything priced in it, whatever the mix
// happens to name that day. It is STRICTER than the register's wording in one
// direction — an owner holding 900 food and 0 stone reads as wedged even though
// nothing it trains costs stone — and a gate erring strict is the safe side.
//
// BOUND — what a green run does NOT prove. ONE fixture, ONE horizon (12,000
// ticks), ONE age, attacks off, no civilization bonuses in play, and no
// resources on the map, so nothing here says anything about a seat that can
// still gather its way out, or about whether the army it ends up with is any
// GOOD — only that the seat is no longer wedged. It says nothing about the boot
// map: `selfPlayContentCoverage.test.ts` is where a real match's census lives.
// And it cannot see a seat that is lopsided in the MIDDLE of a match and lucky
// at the end, because it reads the final state.
//
// TWO MORE BOUNDS ON THE SECOND PROPERTY. It asks for ONE building and ONE
// technology, so the SIZE of the trade between plan and queue is the census
// gate's question rather than this one's. And it does not separate the shipped
// rule's two halves: on this fixture `planFirst` is what moves it, while
// `researchFirst` only changes how many technologies a seat ends with (5 to 8 on
// owner 2), and that half is measured by the lab census alone.
//
// THE AGE IS THE LOUDEST PART OF THAT BOUND. The rule under test runs in the
// IMPERIAL AGE ONLY, so this fixture is Imperial and this gate proves nothing
// about the Dark, Feudal or Castle ages. The register's defect was measured in
// all of them — `coastal` owner 2 banked 3,388 wood in the DARK age — and that
// half is deliberately still open, because the same rule run early spends the
// gold the AI is saving to age up. `marketActionForUnaffordableWant` carries the
// measurement, and `aiSurplusTradePlanning.test.ts` pins the ages that decline.
//
// THE VACUOUS PASS IS SEALED. A fixture that never reached the state under test
// reports "did not run" as "passed", so this asserts that the run RAN (the
// engine never halted, both seats are Imperial with a completed Market) and —
// the load-bearing one — that the fixture STARTS IN VIOLATION of the very
// property it then requires. If a future change to the fixture, the scenario
// loader or the resource presets makes the opening state healthy, this gate
// says so instead of going quietly green.

const RESOURCES: readonly EconomyResourceKind[] = ['food', 'wood', 'gold', 'stone'];
const STARVED = MARKET_TRANSACTION_AMOUNT;
const HOARD = 8 * MARKET_TRANSACTION_AMOUNT;
const HORIZON_TICKS = 12_000;

interface Lopsided { max: number; maxOf: string; min: number; minOf: string }

function lopsidedness(resources: PlayerResources): Lopsided {
  let max = -1; let maxOf = '';
  let min = Number.POSITIVE_INFINITY; let minOf = '';
  for (const kind of RESOURCES) {
    const value = resources[kind] ?? 0;
    if (value > max) { max = value; maxOf = kind; }
    if (value < min) { min = value; minOf = kind; }
  }
  return { max, maxOf, min, minOf };
}

const isWedged = (l: Lopsided): boolean => l.max >= HOARD && l.min < STARVED;
const describeState = (owner: number, l: Lopsided): string =>
  `owner ${String(owner)}: ${String(l.max)} ${l.maxOf} banked while holding `
  + `${String(l.min)} ${l.minOf} (hoard floor ${String(HOARD)}, starved ceiling ${String(STARVED)})`;

/** Run the fixture to the horizon and hand back each seat's opening and closing
 *  stockpile, plus the facts that prove the run reached the state under test. */
function playIdleSurplusFixture(): {
  opening: Map<number, PlayerResources>;
  closing: Map<number, PlayerResources>;
  ages: Map<number, string>;
  markets: Map<number, boolean>;
  armies: Map<number, string[]>;
  /** Completed building types at tick 0 and at the horizon. */
  openingBuildings: Map<number, string[]>;
  closingBuildings: Map<number, string[]>;
  technologies: Map<number, string[]>;
  halted: boolean;
} {
  const bridge = createSimulationBridge('ai-idle-surplus-fixture', {
    // Both seats AI, and no attacks: this fixture is about an economy, and a
    // conquest would end the match before the question is answered.
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
    disableAiAttacks: true,
    victory: 'conquest-only',
  });
  const owners = [1, 2];
  const snapshot = (): Map<number, PlayerResources> => {
    const state = bridge.getEconomyState();
    return new Map(owners.map((o) => [o, { ...(state.playerResources[o] ?? { food: 0, wood: 0, gold: 0, stone: 0 }) }]));
  };
  const completedBuildings = (): Map<number, string[]> => {
    const now = bridge.getEconomyState();
    return new Map(owners.map((o) => [
      o,
      [...new Set(now.buildings.filter((b) => b.owner === o && b.isComplete).map((b) => b.buildingType))].sort(),
    ]));
  };
  const opening = snapshot();
  const openingBuildings = completedBuildings();
  for (let tick = 0; tick < HORIZON_TICKS; tick += 1) bridge.step(100);
  const state = bridge.getEconomyState();
  return {
    opening,
    openingBuildings,
    closingBuildings: completedBuildings(),
    technologies: new Map(owners.map((o) => [o, [...bridge.getResearchedTechnologies(o)].sort()])),
    closing: snapshot(),
    ages: new Map(owners.map((o) => [o, state.ages[o] ?? 'none'])),
    markets: new Map(owners.map((o) => [
      o,
      state.buildings.some((b) => b.owner === o && b.buildingType === 'market' && b.isComplete),
    ])),
    armies: new Map(owners.map((o) => [
      o,
      state.units.filter((u) => u.owner === o && u.unitType !== 'villager').map((u) => u.unitType).sort(),
    ])),
    halted: Boolean(bridge.getHudState().engineHalted),
  };
}

/** The SHIPPED values, snapshotted at import rather than written out here, so
 *  that flipping a production default — which is how the mutation cases below
 *  are proved — reaches the assertions as the defect it is, instead of tripping
 *  the guard over a hard-coded copy. */
const SHIPPED_KNOBS: Record<string, unknown> = { ...AI_SURPLUS_TRADE };

/** The shipped-default run, played ONCE and read by the two properties below —
 *  they are two questions about the same match, and playing it twice would only
 *  double a 50-second fixture. Refuses to memoise a run taken under mutated
 *  knobs, which is the way a shared fixture silently starts measuring the wrong
 *  arm. */
let sharedRun: ReturnType<typeof playIdleSurplusFixture> | null = null;
function defaultKnobRun(): ReturnType<typeof playIdleSurplusFixture> {
  const live = AI_SURPLUS_TRADE as unknown as Record<string, unknown>;
  for (const [knob, value] of Object.entries(SHIPPED_KNOBS)) {
    if (live[knob] !== value) {
      throw new Error(`the shared run was asked for with ${knob} mutated; it would measure the wrong arm`);
    }
  }
  return (sharedRun ??= playIdleSurplusFixture());
}

describe('an AI does not sit on what it cannot spend (register 2026-09-03)', () => {
  afterEach(() => {
    Object.assign(AI_SURPLUS_TRADE, SHIPPED_KNOBS);
  });

  it('converts an idle surplus at the Market instead of staying wedged', () => {
    const run = defaultKnobRun();
    // Printed, not asserted: what the seats actually ended holding and fielding.
    // The assertion below is a property; this is the reading behind it, and it
    // is the line to quote when the expectation moves.
    for (const owner of [1, 2]) {
      const open = run.opening.get(owner)!;
      const close = run.closing.get(owner)!;
      console.log(
        `IDLE-SURPLUS owner ${String(owner)}: `
        + `${RESOURCES.map((r) => `${r} ${String(open[r] ?? 0)}->${String(close[r] ?? 0)}`).join(' ')} `
        + `| army [${run.armies.get(owner)!.join(' ') || 'empty'}]`,
      );
    }

    // The run RAN. A halted engine returns instantly from every later step and
    // leaves the stockpile exactly as it started, which reads identically to an
    // AI that refused to trade — `aiUnitLineTraining.test.ts` was fooled by
    // precisely that during development.
    expect(run.halted, 'the engine halted; every assertion below is vacuous').toBe(false);
    for (const owner of [1, 2]) {
      expect(run.ages.get(owner), `owner ${String(owner)} is not in the age under test`)
        .toBe('imperial-age');
      expect(run.markets.get(owner), `owner ${String(owner)} has no completed Market to trade at`)
        .toBe(true);
    }

    // The fixture STARTS in violation — otherwise this gate would pass by
    // testing nothing.
    for (const owner of [1, 2]) {
      const opened = lopsidedness(run.opening.get(owner)!);
      expect(isWedged(opened), `the fixture did not start wedged — ${describeState(owner, opened)}`)
        .toBe(true);
    }

    // …and does not end in it.
    for (const owner of [1, 2]) {
      const closed = lopsidedness(run.closing.get(owner)!);
      expect(
        isWedged(closed),
        `still hoarding at the horizon — ${describeState(owner, closed)}; `
        + `army [${run.armies.get(owner)!.join(' ') || 'empty'}]`,
      ).toBe(false);
    }
  }, 300_000);

  // THE MUTATION, kept as a test so the gate above can never quietly stop
  // measuring anything. Turning the rule off must put the defect back: if this
  // one goes green, the gate above is passing for some other reason and its
  // green means nothing. Run red for the FIRST case and green for this one on
  // the unfixed tree; both green after.
  it('and the defect is still reachable with the rule turned off', () => {
    AI_SURPLUS_TRADE.enabled = false;
    const run = playIdleSurplusFixture();
    expect(run.halted).toBe(false);
    const wedged = [1, 2].filter((owner) => isWedged(lopsidedness(run.closing.get(owner)!)));
    expect(
      wedged.length,
      'with surplus trading disabled NEITHER seat stayed wedged, so the gate above '
      + 'is not measuring the surplus trade at all: '
      + [1, 2].map((o) => describeState(o, lopsidedness(run.closing.get(o)!))).join('; '),
    ).toBeGreaterThan(0);
  }, 300_000);

  // THE RELATION, not a content floor: a seat that spent on soldiers must also
  // have spent on the plan behind them — it owns the building that upgrades its
  // army, and it bought at least one upgrade. Neither half is a claim that a
  // particular technology was reachable; the census in
  // `selfPlayContentCoverage.test.ts` is where named content lives.
  //
  // WHY THE BLACKSMITH. It is what the fixture MEASURED as the discriminator:
  // played to the horizon under five knob settings it stands on both seats in
  // both plan-aimed arms and on NEITHER seat in either queue-aimed arm — where
  // owner 1 ended with 8 building types and 13 soldiers and owner 2 with 7 and
  // 24. It is also the honest thing to name: every unit these seats train is
  // upgraded there, so a seat fielding an army without one is the defect stated
  // in the game's own terms rather than in the AI's.
  it('and does not starve its own build plan to feed its unit queue', () => {
    const run = defaultKnobRun();
    for (const owner of [1, 2]) {
      console.log(
        `IDLE-SURPLUS owner ${String(owner)} PLAN: buildings `
        + `[${run.openingBuildings.get(owner)!.join(' ')}] -> [${run.closingBuildings.get(owner)!.join(' ')}]`
        + ` | technologies [${run.technologies.get(owner)!.join(' ') || 'none'}]`,
      );
    }
    expect(run.halted, 'the engine halted; every assertion below is vacuous').toBe(false);

    // The fixture STARTS without either, so neither can be inherited from the
    // scenario rather than earned in the match.
    for (const owner of [1, 2]) {
      expect(
        run.openingBuildings.get(owner),
        `owner ${String(owner)} was handed a Blacksmith by the fixture, so the assertion below proves nothing`,
      ).not.toContain('blacksmith');
    }

    for (const owner of [1, 2]) {
      const army = run.armies.get(owner)!.filter((unit) => unit !== 'trade-cart');
      if (army.length === 0) continue; // no queue, so no queue to starve the plan
      expect(
        run.closingBuildings.get(owner),
        `owner ${String(owner)} fielded ${String(army.length)} soldiers [${army.join(' ')}] and never `
        + `built the Blacksmith that upgrades them — its queue ate its build plan. `
        + `It ended with [${run.closingBuildings.get(owner)!.join(' ')}]`,
      ).toContain('blacksmith');
      expect(
        run.technologies.get(owner)!.length,
        `owner ${String(owner)} fielded ${String(army.length)} soldiers and researched nothing at all`,
      ).toBeGreaterThan(0);
    }
  }, 300_000);

  // ITS MUTATION. Aiming the trade at the unit queue instead of at the plan is
  // exactly the version that was measured and rejected, so it must put the
  // defect back. If this goes green the property above is passing for some
  // other reason.
  it('and the plan still starves when the trade aims at the queue instead', () => {
    // `enabled` is set explicitly rather than inherited, so this case measures
    // the plan-first axis ALONE. Without that line, proving the gate above by
    // flipping `enabled` off would also take this one red, on a seat that never
    // fielded an army to starve its plan with — two reds, one of them noise.
    AI_SURPLUS_TRADE.enabled = true;
    AI_SURPLUS_TRADE.planFirst = false;
    const run = playIdleSurplusFixture();
    expect(run.halted).toBe(false);
    const starved = [1, 2].filter((owner) => {
      const army = run.armies.get(owner)!.filter((unit) => unit !== 'trade-cart');
      return army.length > 0 && !run.closingBuildings.get(owner)!.includes('blacksmith');
    });
    expect(
      starved.length,
      'with the trade aimed at the unit queue NEITHER seat starved its build plan, so the '
      + 'property above is not measuring the plan-first aim at all: '
      + [1, 2].map((o) => `owner ${String(o)} [${run.closingBuildings.get(o)!.join(' ')}] `
        + `army ${String(run.armies.get(o)!.length)}`).join('; '),
    ).toBeGreaterThan(0);
  }, 300_000);
});
