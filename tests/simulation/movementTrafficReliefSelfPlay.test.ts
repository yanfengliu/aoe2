// GATE: the starvation rule must relieve only a unit that is actually WAITING —
// one that has been attempting to move on every tick — never one that stood
// still by choice and then asked once. Both halves are asserted, because
// "phantom 0" over a run where the rule never fired is the vacuous zero: no
// phantom relief, AND the rule still engages.
//
// Review E1 (docs/threads/current/concurrency-review-2026-09-02/REVIEW.md): the
// v0.3.175 clock was stamped on cell change alone, so it kept running while a
// unit built a Town Centre (~1,500 ticks), sat garrisoned, or stood parked, and
// such a unit was elected over genuinely contested ones on its first ask. The
// reviewer's instrument found 16 phantom consults across 10 units on the boot
// map by 30,000 ticks, and 2,800 genuine starvation consults across 17 units
// there — all after tick 3,000 — so the 20,000-tick census that called the
// boot map "preserved field-for-field" had simply stopped before the rule
// engaged.
//
// THE MEASUREMENT HISTORY IS KEPT IN FULL, because it is why this gate exists
// and it is the record of the premise this file has now had to abandon twice.
// Every figure below came from the same ledger this file still injects through
// the arbiter's `onStarvationRelief` hook.
//
// SELF-PLAY ON `aoe2-prototype` AT 30,000 TICKS (the original form):
//   before the fix (the shipped v0.3.178 arbiter, patched only with this
//   probe — firing whenever the starvation branch decided the election, a
//   starved winner that is itself the lowest id included):
//     relief admissions 245 across 18 units, first at tick 15,284;
//     PHANTOM 5 across 5 units — tick 17,761 unit 2171 "waited" 1,510 ticks
//     with its last attempt 1,511 ticks ago; tick 27,815 unit 2167, 2,353
//     waited / 2,354 since its last attempt; units 2498, 2218 and 2211 at
//     792-1,049. Every phantom was relieved on the very first tick it asked.
//     Measured twice, by two sessions, identically.
//   after the fix (clock restarts when a unit resumes attempting):
//     relief admissions 229 across 10 units, first at tick 22,195;
//     phantom 0 — also measured twice, identically.
//
// "Before" is one number per ARM and per PROBE, so both are named above; the
// second session learned that by failing to reproduce 245 / 5 twice first.
// The E1 rule alone removed from the fixed code (`|| attemptGap > 1` deleted
// from `trafficProgressClock`, E2's snapshot read kept) gives 259 / 18 /
// 15,284 / 6 phantom — the same units plus 2477 at 29,927; the shipped
// arbiter probed only where the winner is NOT the lowest id gives 212 / 15 /
// 17,439 / 3, because that probe cannot see a starved lowest id (33 of the
// 245 were one).
//
// (The reviewer's figures — 2,800 genuine and 16 phantom — counted CONSULTS
// in the starved state; these count ADMISSIONS the rule granted.)
//
// SEED MOVED to `default-seed`, 2026-09-02. The boot map stopped starving at
// all: with DE build times and nearest-first approaches, owner 1 wins the
// self-play match outright (Castle at 29,500, peak army 40) and owner 2 is off
// the map by 30,000, so there are too few units left to contest a passage —
// measured 0 admissions across 0 units at 30,000, and 0 again with the
// nearest-first ordering disabled, which is how it was established that the
// changed MATCH is the cause and not the pathing. A guard that grants zero
// admissions asserts nothing about phantoms either, so both halves moved to
// the seed that still contests: `default-seed` gave 181 admissions across 10
// units, first at tick 18,006, phantom 0.
//
// THE SEED PREMISE IS RETIRED, 2026-09-10. `default-seed` stopped starving
// too. With farms walkable it reads `relief admissions 0 across 0 units (first
// at tick null), phantom 0` at 30,000 ticks — re-measured here with the old
// file's own body before the rewrite, so that figure is this session's and not
// a remembered one — because the jams that fed it were units piling up against
// farm walls. The rest of the sweep is INHERITED and was not re-measured here:
// `black-forest` 12 admissions across 1 unit, `arena` 16 across 1 unit,
// `gold-rush` 0. Moving the seed a third time would have been a third bet on
// luck, and on a single unit. So the contest is GEOMETRY now:
// `traffic-contest-fixture` (src/game/simulation/fixtures/trafficContest.ts)
// is one owner's 24 woodcutters cycling between a Town Centre and a woodline
// with a one-cell gap in a forest wall between them, so every trip crosses the
// gap twice — empty-handed out, carrying back — and the traffic replenishes
// itself for as long as the wood lasts. What the geometry guarantees is that
// the jam is head-on and continuous, which is the only thing an election can
// run on; the seeds guaranteed nothing. Measured here at 4,000 ticks: 52
// admissions across 3 units (2175, 2176, 2177), first at tick 1,837, phantom
// 0, with the human's wood rising 200 -> 720 the whole way, so this is
// starvation and not deadlock. Identical on four runs. Wall time 6.7 s on a
// quiet machine and 24.3 s with two other lanes' suites running, against the
// old file's 226 s; the explicit timeout below is sized for the contended case.
//
// THE SELF-PLAY CASE IS DELETED rather than kept as a report. Its cost — 226
// seconds of a 30,000-tick match — was half the problem, and a report nobody
// fails on is a report nobody reads. What it measured is above, in full.
//
// WHAT A GREEN RUN HERE DOES NOT PROVE (the bound):
//  - ONE geometry: a single one-cell gap in a straight wall, wall thickness 1,
//    on a 60x36 map. A bend, a longer corridor, two gaps, or a gap made of
//    buildings rather than forest terrain are not exercised.
//  - ONE unit type (villager) and ONE owner's crowd. Nothing here says how the
//    rule behaves between owners, or for units of different speeds.
//  - A FIXED window of 4,000 ticks with the first admission at 1,837. Nothing
//    is claimed past it, and a change that delays the first admission past the
//    window fails the engagement half rather than passing quietly.
//  - NOTHING about self-play, about any shipped seed, or about a real match.
//    That claim was what this file used to make and it is exactly what stopped
//    being true, twice.
//  - NOTHING about the clock's own numbers. The 750-tick threshold and its
//    boundary are pinned at unit level by movementTrafficStarvationClock and
//    movementTrafficFairness; the replenished-jam file pins the rule end to
//    end on a synthetic lane. This file is the one that runs it through the
//    real bridge, the real command path and real gatherers.

import { describe, expect, it, vi } from 'vitest';
import type { Position } from 'civ-engine';

import type { TrafficReliefEvent } from '../../src/game/simulation/bridge/movementTrafficOps';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitTransformComponent } from '../../src/game/simulation/types';

interface ReliefLedger {
  admissions: number;
  phantom: number;
  units: Set<number>;
  phantomUnits: Set<number>;
  firstTick: number | null;
  phantomExamples: string[];
}

const ledger: ReliefLedger = {
  admissions: 0,
  phantom: 0,
  units: new Set(),
  phantomUnits: new Set(),
  firstTick: null,
  phantomExamples: [],
};

/** How many ticks since the unit last attempted to move, read at the start of
 *  its consult — before the arbiter stamps anything for this tick. */
const attemptGapAtEntry = new Map<number, { tick: number; gap: number }>();

vi.mock('../../src/game/simulation/bridge/movementTrafficOps', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/game/simulation/bridge/movementTrafficOps')>();
  type Deps = Parameters<typeof mod.createMovementTrafficOps>[0];
  return {
    ...mod,
    createMovementTrafficOps: (deps: Deps) => {
      const ops = mod.createMovementTrafficOps({
        ...deps,
        onStarvationRelief: (event: TrafficReliefEvent) => {
          ledger.admissions += 1;
          ledger.units.add(event.unitId);
          ledger.firstTick ??= event.tick;
          const entry = attemptGapAtEntry.get(event.unitId);
          const gap = entry && entry.tick === event.tick ? entry.gap : Number.POSITIVE_INFINITY;
          if (gap > 1) {
            ledger.phantom += 1;
            ledger.phantomUnits.add(event.unitId);
            if (ledger.phantomExamples.length < 12) {
              ledger.phantomExamples.push(
                `tick ${String(event.tick)} unit ${String(event.unitId)} waited ${String(event.waited)} ticks, last attempt ${String(gap)} ticks ago`,
              );
            }
          }
        },
      });
      return {
        resolveMovementTraffic: (unitId: number, nextStep: Position, activeWorld?: GameWorld) => {
          const world = activeWorld ?? deps.world;
          const transform = world.getComponent<UnitTransformComponent>(unitId, 'unitTransform');
          const gap = transform?.trafficAttemptTick === undefined
            ? Number.POSITIVE_INFINITY
            : world.tick - transform.trafficAttemptTick;
          attemptGapAtEntry.set(unitId, { tick: world.tick, gap });
          return ops.resolveMovementTraffic(unitId, nextStep, activeWorld);
        },
      };
    },
  };
});

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  TRAFFIC_CONTEST_FIRST_TREE,
  TRAFFIC_CONTEST_WEST_OF_WALL,
  trafficContestEastMouth,
} from '../../src/game/simulation/fixtures/trafficContest';

/** The window. First admission lands at 1,837; see the bound above. */
const HORIZON_TICKS = 4_000;
/** From here the parked villagers ask, then stop, then ask again. */
const FLICKER_FIRST_TICK = 1_200;
/** Ticks between one ask and the next: long enough that the next ask arrives
 *  with an attempt gap far greater than 1, which is the phantom's shape. */
const FLICKER_PERIOD = 20;
const SEED = 'traffic-contest-fixture';

type Bridge = ReturnType<typeof createSimulationBridge>;

function ownedVillagers(bridge: Bridge): Array<{ id: number; x: number; y: number }> {
  return bridge.getEconomyState().units
    .filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
    .map((unit) => ({ id: unit.id, x: unit.x, y: unit.y }))
    .sort((left, right) => left.id - right.id);
}

/** Orders through the gap, westward, by the same path a player's click takes. */
function orderThroughGapWest(bridge: Bridge, ids: readonly number[]): void {
  for (const id of ids) {
    expect(bridge.selectEntityById(id)).toBe(true);
    expect(
      bridge.issueMoveCommand(TRAFFIC_CONTEST_WEST_OF_WALL.x, TRAFFIC_CONTEST_WEST_OF_WALL.y),
    ).toBe(true);
  }
}

/** Cancels the order by re-ordering each unit to the cell it already stands in,
 *  so it stops asking without ever having changed cell. */
function recallWhereTheyStand(bridge: Bridge, ids: readonly number[]): void {
  const cells = new Map(ownedVillagers(bridge).map((unit) => [unit.id, unit]));
  for (const id of ids) {
    const at = cells.get(id);
    expect(at, `parked villager ${String(id)} vanished`).toBeDefined();
    if (!at) continue;
    expect(bridge.selectEntityById(id)).toBe(true);
    bridge.issueMoveCommand(at.x, at.y);
  }
}

describe('the starvation rule in a contested passage', () => {
  it('relieves only units that were attempting to move on the previous tick, and still engages', () => {
    // Owner 2's AI is off: nothing but this test's own orders and owner 1's
    // gatherers move anything, so the contest is the geometry and nothing else.
    const bridge = createSimulationBridge(SEED, { disableAiForOwners: new Set([2]) });
    const eastMouth = trafficContestEastMouth();
    const everyone = ownedVillagers(bridge);
    const parked = everyone
      .filter((unit) => unit.x === eastMouth.x && unit.y === eastMouth.y)
      .map((unit) => unit.id);
    const crowd = everyone.filter((unit) => !parked.includes(unit.id)).map((unit) => unit.id);
    expect(parked.length, 'the fixture must park villagers in the east mouth').toBeGreaterThan(0);
    expect(crowd.length, 'the fixture must supply a crowd west of the wall').toBeGreaterThan(8);

    // Seed the parked villagers' clocks: one ask into the gap, then a recall to
    // where they stand. They now hold a starvation record naming their own cell
    // — the exact state a builder leaves behind when its site is finished.
    orderThroughGapWest(bridge, parked);
    bridge.step(100);
    recallWhereTheyStand(bridge, parked);

    // The crowd's single order. Every trip crosses the gap twice, so this one
    // click is what keeps the passage contested for the whole window.
    expect(bridge.selectUnitsByIds([...crowd])).toBe(true);
    expect(
      bridge.issueContextCommand(TRAFFIC_CONTEST_FIRST_TREE.x, TRAFFIC_CONTEST_FIRST_TREE.y),
    ).toBe(true);

    const woodAtStart = bridge.getHudState().playerResources.wood;
    for (let tick = 2; tick <= HORIZON_TICKS; tick += 1) {
      if (tick >= FLICKER_FIRST_TICK) {
        const phase = (tick - FLICKER_FIRST_TICK) % FLICKER_PERIOD;
        if (phase === 0) orderThroughGapWest(bridge, parked);
        else if (phase === 1) recallWhereTheyStand(bridge, parked);
      }
      bridge.step(100);
    }
    const woodGained = bridge.getHudState().playerResources.wood - woodAtStart;

    const summary = `relief admissions ${String(ledger.admissions)} across ${String(ledger.units.size)} units`
      + ` (first at tick ${String(ledger.firstTick)}), phantom ${String(ledger.phantom)}`
      + ` across ${String(ledger.phantomUnits.size)} units, wood +${String(woodGained)}`
      + (ledger.phantomExamples.length > 0 ? `\n  ${ledger.phantomExamples.join('\n  ')}` : '');
    console.log(`RELIEF ${SEED} ${String(HORIZON_TICKS)} ticks: ${summary}`);

    // HALF ONE. A unit that stood still by choice is never elected over one
    // that has been waiting.
    expect(
      ledger.phantom,
      `a unit that was not attempting to move was relieved over units that were — ${summary}`,
    ).toBe(0);
    // HALF TWO, the instrument check. Without this, half one is satisfied by a
    // run in which the rule never fired at all — which is what two shipped
    // seeds each quietly became.
    expect(
      ledger.admissions,
      `the starvation rule never engaged on ${SEED} by ${String(HORIZON_TICKS)} ticks,`
      + ` where it granted 52 admissions across 3 units when measured — ${summary}`,
    ).toBeGreaterThan(0);
    // The traffic really flowed: this is starvation, not a deadlocked map, and
    // a deadlocked map produces the same "phantom 0" as a healthy one.
    expect(
      woodGained,
      `the crowd never delivered any wood in ${String(HORIZON_TICKS)} ticks, so the passage was`
      + ` blocked rather than contested (520 when measured) — ${summary}`,
    ).toBeGreaterThan(100);
  }, 180_000);
});
