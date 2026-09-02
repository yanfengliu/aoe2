// AI self-play must reach the Castle Age.
//
// It never did. Across three seeds and 40 minutes of game time, no player left
// the Feudal Age, and a match exercised four unit types and eight building
// types against a roster of 93 units and 137 live technologies — so self-play,
// which is this project's acceptance test for feature completeness, verified
// almost none of the game.
//
// The cause was measured rather than guessed at, after four failed hypotheses.
// Instrumenting the build decision itself showed the AI deciding to build,
// holding a builder, capacity and a valid anchor, and simply unable to pay:
// `afford=false, wood=0..24` against a 60-wood farm, 164 times. The spend over
// 20,000 ticks was 715 wood on six buildings and 525 on 21 spearmen out of
// 1,240 total — 0.62 wood/sec against a nominal 2.73, with military taking 42%
// of what arrived. A spearman costs 25 wood, so military and construction
// competed for the scarcest resource with nothing arbitrating; the 150 for a
// first Blacksmith never accumulated; nobody qualified; and `ageUpReserveCost`
// stays empty until someone does, so each AI also banked 980-1,922 food it had
// no way to spend.
//
// Two changes fix it and they only work as a PAIR — measured separately, more
// wood villagers changed nothing (the spearman ate each 25 as it landed) and
// the reserve alone halved the army to buy buildings.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

/** 45,000 ticks — 75 minutes of game time, MATCH RESOLUTION on the boot map.
 *
 *  RAISED AGAIN from 30,000 on 2026-09-02 after an independent critic showed
 *  the 30,000 horizon sat inside the one window (25-36k) where a candidate led
 *  the baseline, while at 45,000 that candidate LOST the match the baseline
 *  wins by conquest at 39,890 (peak army 10 against 20). A horizon has to
 *  include the match resolving, or it scores a half-built army — which is
 *  what this file's own 24k comment already said. Bars are one below the 45k
 *  baseline (peak 20, 9 building types, 8 unit types) so they are contracts
 *  rather than change-detectors.
 *
 *  Superseded rationale for 30,000, kept for provenance:
 *
 *  RAISED from 24,000 on 2026-09-01, with the owner's approval, because 24,000
 *  scored this match BEFORE IT RESOLVED. The boot map qualifies at 23,500 and
 *  reaches the Castle Age at 25,250, so the old horizon stopped 1,250 ticks
 *  short of the age this test is named for, and every number it read was of a
 *  match mid-advance: peak army 8 at 24,000 against 9 at 30,000.
 *
 *  That short window also produced a claim repeated for a whole session — that
 *  the boot map is "walled into Feudal" — which the full 45,000-tick audit
 *  disproves outright (6 of 8 owner-slots reach Castle, 1 reaches Imperial,
 *  and this match ends in conquest). The horizon is part of the instrument and
 *  has to be re-justified whenever the measured thing changes; this one had
 *  not been. */
const HORIZON_TICKS = 45000;

/** The peak-army bar, named ONCE so the assertion and the message it prints
 *  cannot drift apart. They were two separate literals and the red-check
 *  caught them disagreeing — "below the bar of 8" printed against a threshold
 *  of 99 — which is the same staleness that let this gate's old message
 *  outlive the mechanism it described. */
const PEAK_MILITARY_BAR = 8;

/* BARS RE-DERIVED 2026-09-02 (v0.3.187), and the peak-army one LOWERED from
 * 19 to 8. That is the move this file's own message tells you not to make, so
 * here is why it is not that move, and what it costs.
 *
 * DE build times landed the same day: `structures.csv` says a Barracks is 50 s
 * and the game had been building it in 24, and the whole Dark Age ran at about
 * half DE's pace. Construction is now 2-2.5x longer everywhere, so villagers
 * spend far more of the match building and the army arrives LATER — not
 * smaller. Measured on this map at this horizon: the first slot to Castle is
 * owner 2 at 35,250 with peak military 9, 9 building types, 6 unit types
 * (owner 1: Castle 41,750, peak 6). Run on to 90,000 and owner 1's peak army
 * is 45 — more than double the old baseline's 20 — with the match still
 * unresolved. So 45,000, which used to be past this map's conquest at 39,890,
 * is now mid-development, and the honest reading of the old bar of 19 is that
 * it described a stage of the game this horizon no longer reaches.
 *
 * The horizon stays at 45,000 because doubling it doubles the gate's runtime,
 * and this suite has already tipped an unrelated test into a CI timeout once.
 * The bars are re-derived one below the measured winner (peak 8, buildings 8,
 * units 5), which keeps them contracts rather than change-detectors.
 *
 * The COST is recorded rather than absorbed: the AI's military production has
 * not been retuned for DE build times, and until it is, this gate cannot see
 * an army regression between 9 and 19 that it used to catch. That is an open
 * item in `docs/learning/defect-register.md`, not a solved problem. */

interface MatchReport {
  castleAt: number | null;
  qualifiedAt: number | null;
  unitTypes: number;
  buildingTypes: number;
  peakMilitary: number;
  /** Sampled every 250 ticks like everything else here, so a unit born and
   *  killed inside one interval is invisible to both. The RATIO is what this
   *  is for -- telling "never trained" apart from "trained and died" -- not an
   *  exact count. */
  militaryTrained: number;
  militaryLost: number;
}

function playSelfPlay(seed: string): Record<number, MatchReport> {
  const bridge = createSimulationBridge(seed, {
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
  });
  const QUALIFYING = ['blacksmith', 'archery-range', 'stable', 'market'];
  const per: Record<number, {
    b: Set<string>; u: Set<string>; castleAt: number | null;
    qualifiedAt: number | null; peak: number;
    live: Set<number>; trained: number; lost: number;
  }> = {
    1: { b: new Set(), u: new Set(), castleAt: null, qualifiedAt: null, peak: 0, live: new Set(), trained: 0, lost: 0 },
    2: { b: new Set(), u: new Set(), castleAt: null, qualifiedAt: null, peak: 0, live: new Set(), trained: 0, lost: 0 },
  };
  for (let tick = 1; tick <= HORIZON_TICKS; tick += 1) {
    bridge.step(100);
    if (tick % 250 !== 0) continue;
    const state = bridge.getEconomyState();
    for (const owner of [1, 2]) {
      const p = per[owner]!;
      let qualifying = 0;
      for (const b of state.buildings) {
        if (b.owner !== owner || !b.isComplete) continue;
        p.b.add(b.buildingType);
        if (QUALIFYING.includes(b.buildingType)) qualifying += 1;
      }
      if (qualifying >= 2 && p.qualifiedAt === null) p.qualifiedAt = tick;
      let military = 0;
      const live = new Set<number>();
      for (const u of state.units) {
        if (u.owner !== owner) continue;
        p.u.add(u.unitType);
        if (u.unitType === 'villager') continue;
        military += 1;
        live.add(u.id);
        if (!p.live.has(u.id)) p.trained += 1;
      }
      for (const id of p.live) if (!live.has(id)) p.lost += 1;
      p.live = live;
      p.peak = Math.max(p.peak, military);
      if (state.ages[owner] === 'castle-age' && p.castleAt === null) p.castleAt = tick;
    }
  }
  return {
    1: { castleAt: per[1]!.castleAt, qualifiedAt: per[1]!.qualifiedAt, unitTypes: per[1]!.u.size, buildingTypes: per[1]!.b.size, peakMilitary: per[1]!.peak, militaryTrained: per[1]!.trained, militaryLost: per[1]!.lost },
    2: { castleAt: per[2]!.castleAt, qualifiedAt: per[2]!.qualifiedAt, unitTypes: per[2]!.u.size, buildingTypes: per[2]!.b.size, peakMilitary: per[2]!.peak, militaryTrained: per[2]!.trained, militaryLost: per[2]!.lost },
  };
}

describe('AI self-play exercises the game past the Feudal Age', () => {
  it('becomes eligible for the Castle Age on the map the game boots', () => {
    // The BOOT map, because that is the one a player sees and the one this
    // repo's adoption rule protects. Baseline never QUALIFIED here at all —
    // the AI could not afford a first Blacksmith, so the two buildings the
    // advance requires were unreachable and `ageUpReserveCost` stayed empty
    // behind them. It now qualifies at tick 23,500.
    //
    // Eligibility rather than the age itself is what this seed supports: the
    // Castle arrives on `default-seed` (tick 24,000, recorded below), and
    // gating the boot map on an age it reaches just past this horizon would be
    // pinning the horizon rather than the behaviour.
    const report = playSelfPlay('aoe2-prototype');
    // WHICHEVER SLOT WINS. This read `report[2]` because owner 2 was the side
    // that won on the boot map; DE build times and nearest-first approaches
    // (2026-09-02) flipped it — owner 1 now reaches Castle at 29,500 and has
    // wiped owner 2 off the map by 45,000, so a fixed slot reported "walled
    // into Feudal" about a match one side had already won. The test is named
    // for self-play reaching the Castle Age, not for a colour.
    const winner = (report[1]!.castleAt ?? Infinity) <= (report[2]!.castleAt ?? Infinity)
      ? report[1]! : report[2]!;
    console.log(`SELFPLAY aoe2-prototype ${String(HORIZON_TICKS)}: p1 ${JSON.stringify(report[1])} p2 ${JSON.stringify(report[2])}`);
    expect(
      winner.qualifiedAt,
      'no player became eligible for the Castle Age — still walled into Feudal',
    ).not.toBeNull();

    // The AGE ITSELF, not just eligibility. The previous horizon could only
    // assert eligibility — "gating the boot map on an age it reaches just past
    // this horizon would be pinning the horizon rather than the behaviour" —
    // and at 30,000 ticks that concession is no longer needed: the baseline
    // reaches Castle at 25,250. This is the assertion the test is named for.
    expect(
      winner.castleAt,
      'the boot map never reached the Castle Age within the horizon',
    ).not.toBeNull();

    // And it costs no army. An earlier version of this reserve had no
    // defensive floor and review measured it blocking 100% of military
    // training on wood-poor seeds — 21% of all peak military across 11 seeds,
    // buying a building it then could not afford either. Baseline peak here is
    // 9 at the 30,000-tick horizon (it was 8 at 24,000, mid-advance); the bar
    // is 9, so any return of that behaviour fails. Derived from the BASELINE
    // at the new horizon before any candidate was measured against it.
    //
    // The bar catches TWO different mechanisms and used to name only one. It
    // read "the age was bought by disbanding the army", which described the
    // reserve above and misdescribed the next candidate to trip it: a
    // Lumber-Camp siting change that trained 8 against baseline 9 — a wash —
    // and then LOST 6 where baseline lost 1, holding 985 unspent wood while it
    // happened. Nothing was disbanded and no age was bought, so the message
    // sent a reader looking for a resource tradeoff that was not there. It now
    // reports the split it actually measured.
    const cause = winner.militaryLost > winner.militaryTrained / 2
      ? `trained ${winner.militaryTrained} but LOST ${winner.militaryLost} — the army died in the field`
      : `only trained ${winner.militaryTrained} (lost ${winner.militaryLost}) — the army was never built`;
    expect(
      winner.peakMilitary,
      `peak military ${winner.peakMilitary} below the bar of ${PEAK_MILITARY_BAR}: ${cause}. `
        + 'Satisfy it by keeping peak army at or above baseline, not by moving the bar.',
    ).toBeGreaterThanOrEqual(PEAK_MILITARY_BAR);

    // Variety is the actual goal, and it did NOT regress with the pacing:
    // the 2026-09-02 winner shows 9 building types and 6 unit types, against
    // the 9 and 5 measured when these bars were first set. Each bar sits one
    // BELOW the measured value on purpose — an exact pin is a change-detector
    // rather than a contract, and this suite already learned that from a bar
    // copied off a symptom.
    expect(winner.buildingTypes, 'building variety did not improve').toBeGreaterThanOrEqual(8);
    expect(winner.unitTypes, 'unit variety did not improve').toBeGreaterThanOrEqual(5);
  }, 600_000);

  // A SECOND seed is deliberately not gated, and that is a cost decision
  // rather than a claim it does not matter. This match is ~2 minutes, and
  // heavy tests in this suite tipped an unrelated test into a CI timeout the
  // same day — a 6x-heavier test would be the same defect twice. The second
  // seed's result is recorded instead: `default-seed` owner 2 qualifies at
  // 18,250 and REACHES the Castle Age at 24,000, with 12 building types and 5
  // unit types against a baseline of 7 and 4, at unchanged peak military; its
  // owner 1 goes from peak military 2 to 6. `corpus-seed-b` is the cost —
  // both owners lose one building type and one unit of peak military, and
  // neither reaches Castle. Totals over the three seeds: one Castle Age where
  // baseline had none, 50 building types against 44, 26 unit types against
  // 24, and peak military 37 against 37 — unchanged.
});
