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
// The two Town Center idle bars are REGRESSION FLOORS, not detection: no
// defect above turns them red in this window (the latch needs food at 60% of
// an age's cost before the villager cap, which this window never reaches), and
// the old code idled 6.7-12.8 s in all, 2.7 s at most, inside both bars.
//
// Bound: one map (the boot map), the lobby's defaults (Standard difficulty,
// Standard resources, population 200), the first 9,000 ticks (15 game
// minutes), and the two seat arrangements a player meets: the human seat idle,
// and both seats played by the AI. The villager floor is the Dark Age target
// (10), so it says nothing yet about how far the economy grows later.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED, HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { villagerCapForAge } from '../../src/game/simulation/ai';
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
/** Ten villagers by 5:00, the Dark Age target. Seven more than the three a
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
const TOTAL_IDLE_WHILE_ABLE_TICKS = 300;

function playMatch(allAi: boolean): { seats: Map<number, AiEconomySummary>; ticks: number } {
  const bridge = createSimulationBridge(DEFAULT_SEED, allAi ? { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) } : {});
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
  return { seats, ticks: bridge.world.tick - start };
}

function describeSeat(owner: number, summary: AiEconomySummary): string {
  const time = (tick: number) => `${Math.floor(tick / 600)}:${String(Math.floor(tick / 10) % 60).padStart(2, '0')}`;
  const runsOf = (list: AiEconomySummary['housed']) => list.slice(0, 3).map((r) => `${time(r.from)}+${r.ticks / 10}s`).join(', ') || 'never';
  return `owner ${owner}: housed ${runsOf(summary.housed)} (with 25 wood ${runsOf(summary.housedWithWood)}); `
    + `villagers by 5:00 ${summary.peakVillagersBy(VILLAGER_FLOOR.tick)} (at 5:00 ${summary.villagersAt(VILLAGER_FLOOR.tick)}); `
    + `Town Center idle while able ${summary.idleWhileAbleTicks / 10}s (longest ${(summary.idleWhileAble[0]?.ticks ?? 0) / 10}s at ${summary.idleWhileAble[0] ? time(summary.idleWhileAble[0].from) : '-'}); `
    + `houses ${summary.houses.map((h) => `${time(h.placed)}->${h.complete === null ? 'never' : time(h.complete)}`).join(' ')}`;
}

describe('the computer\'s economy at the lobby defaults (work 141)', () => {
  for (const allAi of [false, true]) {
    it(`builds Houses before it is housed and keeps its Town Center training — ${allAi ? 'both seats AI' : 'human seat idle'}`, () => {
      const { seats, ticks } = playMatch(allAi);
      // The whole window, or the bars below measured a shorter match.
      expect(ticks, 'the match ended before the window did').toBe(WINDOW_TICKS);
      for (const [owner, summary] of seats) {
        const message = describeSeat(owner, summary);
        expect.soft(summary.housed[0]?.ticks ?? 0, message).toBeLessThanOrEqual(LONGEST_HOUSED_TICKS);
        expect.soft(summary.peakVillagersBy(VILLAGER_FLOOR.tick), message).toBeGreaterThanOrEqual(VILLAGER_FLOOR.villagers);
        expect.soft(summary.idleWhileAble[0]?.ticks ?? 0, message).toBeLessThanOrEqual(LONGEST_IDLE_WHILE_ABLE_TICKS);
        expect.soft(summary.idleWhileAbleTicks, message).toBeLessThanOrEqual(TOTAL_IDLE_WHILE_ABLE_TICKS);
      }
    }, 150_000);
  }
});
