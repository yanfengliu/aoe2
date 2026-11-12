// The computer's economy at the lobby's defaults, measured the way a DE player
// would see it (work 141 M1): it builds Houses before it is housed, and its
// Town Center keeps training villagers while it can pay for one.
//
// DE's own AI scripts (resources/_common/ai/Promisory, the 2026-10-06 install)
// start a House when the free population falls under 3 in the Dark Age
// (buildings.per 1584-1596), gather 75% food and 25% wood with no gold below
// 12 villagers in the Dark Age (dawn.per 72-78), and keep a villager in
// training while they are under their villager count (units.per 328-386 and
// 409-415), whatever they are saving for. Spec §13.2 carries the rules.
//
// Measured on 6b5e9871 before this gate (12,000-tick bundles from
// `npm run playtest -- --seed aoe2-prototype --max-ticks 12000 [--all-ai]`,
// read per minute with `aiEconomyTrace.ts`; plan 141 has the table): with the human idle, owner 2 had 2 of 6 villagers on food, its
// Town Center idle 44-60 s a minute from 1:00 to 4:59 for want of food, 6
// villagers from 2:00 to 4:59, and it sat housed for 68 s at 5:59-7:06 because
// it wanted a House only once population reached the cap. Both seats of the
// all-AI match had 6 villagers until 8:00; owner 2 sat housed 66 s holding
// 55-60 wood.
//
// WHAT GOES RED, measured with each defect put back into the fixed tree (and
// the whole file run on 6b5e9871 itself):
//   6b5e9871                    housed 66.8-70.9 s, villagers by 5:00 6-7    RED
//   House only when housed      all-AI housed 54.6 s and 212.6 s             RED
//   soldier ignores villager    villagers by 5:00 6-7                        RED
//   Dark split 4 : 3            green: darkAgeTuning.test.ts and aiPlayer's split case go red
//   zero-target kind skipped    green: aiPlayer's split case goes red (a gold villager)
//   savingForAgeUp on villagers green: aiVillagerReserve.test.ts goes red (3 villagers, no train)
// The two Town Center idle bars were REGRESSION FLOORS, not detection: no
// defect above turned them red in this window (the latch needs food at 60% of
// an age's cost before the villager cap, which this window never reaches), and
// the old code idled 6.7-12.8 s in all, 2.7 s at most, inside both bars.
// Under DE's Dark Age boom (work 144 M2) the Town Center trains through the
// whole window, and measured again with each defect put back (2026-11-06):
//   villager skipped on alternate decisions   owner 2 idle 78.7 s for 23 trained, longest 6.1 s   RED
//   House only when housed                    housed 54.6-212.6 s, 8 villagers by 5:00           RED
//   soldier ignores villager                  villagers by 5:00 6-7, owner 1 housed 34.2 s       RED
//   Town Center holds a second villager back  idle while able 211-790 s, longest 49-739 s        RED
//
// THE BUILDER'S WALK (work 152 M1d), judged on the same two matches: of every
// villager a seat sends to a building it places, none it could have sent
// instead had a shorter walk to the site, nor the same walk and a lower id. A
// resource's last gatherer is one it could have sent only when no other
// villager could go, so one of those sent past another is a breach too.
// `builderWalkProbe.ts` records each order at the instant the seat decides and
// measures the walks with its own search over the path search's grid, never
// the game's flood. Measured on 2026-11-11 with main's rule put back (the
// first villager in entity order): the both-AI match makes 24 placements in
// this window and 20 of them pass over a villager the rule would send, by 266
// cells in all and 49 at the most (a farm whose builder walked 54 cells past
// one standing 5 away); the human-idle match makes 10, and 8 pass one over, by
// 173 cells in all and 46 at the most.
//   the first in entity order sent (main)   20 of 24 placements, both-AI; 8 of 10, human idle     RED
//   a resource's last gatherer taken        this case, and owner 1 housed 94.1 s at 2:31, both-AI  RED
// No seat crews a site in this window (every building here wants one builder
// and none loses it), so the crews' case is the lab's, in
// `selfPlayContentCoverage.test.ts`.
//
// Bound: one map (the boot map), the lobby's defaults (Standard difficulty,
// Standard resources, population 200), the first 9,000 ticks (15 game
// minutes), and the two seat arrangements a player meets: the human seat idle,
// and both seats played by the AI. The villager floor is work 141's Dark Age
// target (10); under DE's boom the seats hold 10-12 by then, so it says
// nothing about how far the boom grows.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED, HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { decisionIntervalTicks, villagerCapForAge } from '../../src/game/simulation/ai';
import { betterBuilders, describeOrder, observeBuilderOrders, type BuilderOrder } from './builderWalkProbe';
import {
  liveWorldSource,
  sampleAiEconomy,
  summarizeAiEconomy,
  type AiEconomySample,
  type AiEconomySummary,
} from '../../src/game/playtest/aiEconomyTrace';

const WINDOW_TICKS = 9_000;
/** A villager costs 50 food and a House 25 wood (design/stats). */
const VILLAGER_FOOD = 50;
const HOUSE_WOOD = 25;
/** DE's House takes 25 s to build. A seat that starts one with two population
 *  still free, as DE's does, has two villagers' training (50 s) to find the
 *  25 wood, walk and build before it can be housed at all, so 30 s housed —
 *  whatever it holds — is a House started too late. The brief's narrower form
 *  (housed while holding the wood) was measured too and is printed: on the old
 *  code its longest run was 18 s, under any bar, because the old AI was broke
 *  for most of each stall it caused by waiting until it was housed. */
const LONGEST_HOUSED_TICKS = 300;
/** Ten villagers by 5:00, work 141's Dark Age target. Seven more than the three a
 *  seat starts with, at DE's 25 s each, is 2:55 of training if the Town Center
 *  never stops; the floor allows two minutes of walking, building and paying on
 *  top of that. It reads the PEAK held by then, because the claim is what the
 *  Town Center produced: in the all-AI match owner 2 reached 10 at 4:00 and
 *  lost one to owner 1's Militia before 5:00 (DE's AI drops a Dark Age rush
 *  for its usual opening at every level below Extreme — Promisory init.per
 *  9611-9621, with diff-fp 0 in const.per's DE blocks — and taking the rush
 *  out is M2's). */
const VILLAGER_FLOOR = { tick: 3_000, villagers: 10 };
/** The Town Center decides every 30 ticks at Standard and keeps two queued, so
 *  a seat that can pay, has room and is under its target should never wait
 *  more than two decisions for its next villager. */
const LONGEST_IDLE_WHILE_ABLE_TICKS = 60;
/** The Standard decision interval, a fixed design constant: the owner's "Keep
 *  current AI" (2026-11-04, spec §13.1) kept the 60/30/15-tick intervals. */
const STANDARD_DECISION_TICKS = 30;
/** IN ALL, AT MOST ONE DECISION PER VILLAGER TRAINED (work 144 M2, the
 *  coordinator's decision of 2026-11-06). This bar was a flat 300 ticks in all,
 *  sized without saying so for work 141's Dark Age cap of 10, which a seat
 *  reached by 4:00 and was never "able" again. Under DE's Dark Age boom (to 29,
 *  units.per 328-376) both-AI owner 2 trains 24 villagers in this window where
 *  it trained 8, and its idle-while-able time is 33.4 s in 19 runs of 0.3-3.0 s
 *  (measured 2026-11-06 with `aiEconomyTrace.ts` on this file's own match).
 *  Every run holds 50-51 food: the food reaches a villager's 50 and the Town
 *  Center waits for the next decision, in a boom that spends its food on
 *  villagers. It is not DE's flush stop (units.per 233-244), which needs 21
 *  villagers and 470-500 food banked, never held in this window. Main's tree
 *  has the same runs at 2:00 (2.9 s), 2:41 (1.0 s) and 3:17 (1.2 s), 5.5 s in
 *  all. Every wait stays under one decision (the longest 3.0 s, main's 2.9 s);
 *  the average is 13.9 ticks a villager against main's 6.9 (the human-idle
 *  seat 10.4 against 6.9, owner 1 3.0 against 5.1). The bar asks what the old
 *  one meant: the Town Center waits at most one decision for each villager it
 *  trains, on average over the window. It reads the interval as the constant
 *  above, never from the AI, so it checks a property of the play rather than
 *  the AI's code agreeing with itself (R19); the pin below fails if the
 *  interval ever moves. */
const IDLE_WHILE_ABLE_TICKS_PER_VILLAGER = STANDARD_DECISION_TICKS;
/** How many accepted placements each match must show before the builder's
 *  walk is judged on it, so the case cannot pass on an empty record. */
const BUILDER_PLACEMENTS_FLOOR = { bothAi: 15, humanIdle: 6 };

interface PlayedMatch { seats: Map<number, AiEconomySummary>; ticks: number; builderOrders: BuilderOrder[] }

/** Each arrangement is played once, whichever case asks first. */
const played = new Map<boolean, PlayedMatch>();
function matchOf(allAi: boolean): PlayedMatch {
  const match = played.get(allAi) ?? playMatch(allAi);
  played.set(allAi, match);
  return match;
}

function playMatch(allAi: boolean): PlayedMatch {
  const bridge = createSimulationBridge(DEFAULT_SEED, allAi ? { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) } : {});
  // Reads only: the match plays as it does unobserved (builderWalkProbe.ts).
  const builderOrders = observeBuilderOrders(bridge);
  const owners = allAi ? [1, 2] : [2];
  const samples = new Map<number, AiEconomySample[]>(owners.map((owner) => [owner, []]));
  const source = liveWorldSource(bridge.world);
  const start = bridge.world.tick;
  while (bridge.world.tick - start < WINDOW_TICKS && bridge.getMatchState().outcome === 'running') {
    bridge.step(100);
    for (const owner of owners) samples.get(owner)!.push(sampleAiEconomy(source, owner, bridge.world.tick - start));
  }
  const seats = new Map(owners.map((owner) => [owner, summarizeAiEconomy(samples.get(owner)!, {
    step: 1,
    hardPopCap: 200,
    villagerFood: VILLAGER_FOOD,
    houseWood: HOUSE_WOOD,
    villagerTarget: (age) => villagerCapForAge(age as Parameters<typeof villagerCapForAge>[0]),
  })]));
  return { seats, ticks: bridge.world.tick - start, builderOrders };
}

function describeSeat(owner: number, summary: AiEconomySummary): string {
  const time = (tick: number) => `${Math.floor(tick / 600)}:${String(Math.floor(tick / 10) % 60).padStart(2, '0')}`;
  const runsOf = (list: AiEconomySummary['housed']) => list.slice(0, 3).map((r) => `${time(r.from)}+${r.ticks / 10}s`).join(', ') || 'never';
  return `owner ${owner}: housed ${runsOf(summary.housed)} (with 25 wood ${runsOf(summary.housedWithWood)}); `
    + `villagers by 5:00 ${summary.peakVillagersBy(VILLAGER_FLOOR.tick)} (at 5:00 ${summary.villagersAt(VILLAGER_FLOOR.tick)}); `
    + `Town Center idle while able ${summary.idleWhileAbleTicks / 10}s for ${summary.villagersTrained} villagers trained `
    + `(longest ${(summary.idleWhileAble[0]?.ticks ?? 0) / 10}s at ${summary.idleWhileAble[0] ? time(summary.idleWhileAble[0].from) : '-'}); `
    + `houses ${summary.houses.map((h) => `${time(h.placed)}->${h.complete === null ? 'never' : time(h.complete)}`).join(' ')}`;
}

describe('the computer\'s economy at the lobby defaults (work 141)', () => {
  it('reads the Standard decision interval as the fixed constant its idle bar is sized by', () => {
    expect(decisionIntervalTicks('standard'), 'the decision interval moved: re-derive the idle bar').toBe(STANDARD_DECISION_TICKS);
  });

  for (const allAi of [false, true]) {
    it(`builds Houses before it is housed and keeps its Town Center training — ${allAi ? 'both seats AI' : 'human seat idle'}`, () => {
      const { seats, ticks } = matchOf(allAi);
      // The whole window, or the bars below measured a shorter match.
      expect(ticks, 'the match ended before the window did').toBe(WINDOW_TICKS);
      for (const [owner, summary] of seats) {
        const message = describeSeat(owner, summary);
        expect.soft(summary.housed[0]?.ticks ?? 0, message).toBeLessThanOrEqual(LONGEST_HOUSED_TICKS);
        expect.soft(summary.peakVillagersBy(VILLAGER_FLOOR.tick), message).toBeGreaterThanOrEqual(VILLAGER_FLOOR.villagers);
        expect.soft(summary.idleWhileAble[0]?.ticks ?? 0, message).toBeLessThanOrEqual(LONGEST_IDLE_WHILE_ABLE_TICKS);
        expect.soft(summary.idleWhileAbleTicks, message)
          .toBeLessThanOrEqual(IDLE_WHILE_ABLE_TICKS_PER_VILLAGER * summary.villagersTrained);
      }
    }, 150_000);

    it(`sends each building it places the available villager with the shortest walk — ${allAi ? 'both seats AI' : 'human seat idle'}`, () => {
      const { builderOrders, ticks } = matchOf(allAi);
      expect(ticks, 'the match ended before the window did').toBe(WINDOW_TICKS);
      // Placements the game accepts: a walk is judged only where something is built.
      const placed = builderOrders.filter((order) => order.kind === 'placement' && order.refusal === null);
      expect(placed.length, 'placements seen in the window: the record is not reading the match')
        .toBeGreaterThanOrEqual(BUILDER_PLACEMENTS_FLOOR[allAi ? 'bothAi' : 'humanIdle']);
      expect(builderOrders.filter((order) => !order.builderAvailable).map(describeOrder), 'a builder that was not available').toEqual([]);
      expect(
        builderOrders.filter((order) => betterBuilders(order).length > 0).map(describeOrder),
        'a builder sent past a villager with a shorter walk',
      ).toEqual([]);
    }, 150_000);
  }
});
