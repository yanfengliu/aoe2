// The CLASS gate for the 2026-09-02 register entry: over a whole self-play
// match on the boot map, no player loses villagers to the other's static
// defences.
//
// The defect was found at 45,000 ticks by a critic and not by any gate: the
// Castle gate reads ages, building and unit variety and peak army, and none of
// those sees a workforce shot under the enemy Town Centre in the last quarter
// of the match — a peak army set at minute 45 is unmoved by an economy that
// dies at minute 65. So this gate reads the death feed directly: every
// villager death, where it stood, and whether that cell was inside an enemy
// Town Centre's, tower's or Castle's reach. The reach is the building's base
// range plus the most the three arrow technologies add plus the rule's
// one-cell margin — a deliberately WIDE net, because a villager that dies
// anywhere near an enemy static defence was sent there, and a raid on its own
// base happens thirty cells away on this map.
//
// MEASURED, this tree, 2026-09-02 (v0.3.191), the only difference between the
// two runs being that `collectStaticDefences` returns nothing:
//
//   rule OFF: owner 2 loses 50 villagers, 43 of them inside owner 1's reach
//             (owner 1: 25 lost, 0 under)
//   rule ON:  owner 2 loses  7 villagers,  0 of them inside owner 1's reach
//             (owner 1: 27 lost, 0 under)
//
// so this gate goes RED at 43 the moment the rule is taken out, which is the
// red-check it has to survive to count. The progression columns are identical
// across both runs (Feudal 13,750, qualified 22,000, Castle 26,750, 14
// building types, 10 unit types, peak army 11) — which says only that no cost
// is VISIBLE in them, not that the rule is free: they are sampled every 250
// ticks and two builds nine villagers apart produced byte-identical columns.
//
// COST. This is one of the two longest tests in the suite, and it plays the
// same 45,000-tick match as `aiReachesCastleAge.test.ts` — same seed, same
// options, same horizon. Measured on a 32-core machine: 159 s alone, and 229 s
// to 512 s under the full suite depending on what else is running.
// `aiReachesCastleAge` tracks it to within half a second in the same runs
// (228,398 ms against 228,923 ms), which is what "the same match twice" looks
// like. CI runs `npm test` on a smaller box inside a 60-minute job, so the two
// censuses SHOULD share one run rather than playing the match twice; that
// merge is the recorded next step in the register entry and was not taken here
// because it restructures a second gate.
//
// Same horizon and shape as aiReachesCastleAge.test.ts, for the same reason:
// the deaths this gate is named for happen between ticks 38,793 and 39,191, so
// a horizon short of ~40,000 scores the half of the match where the economy
// was still working its own resources and sees nothing.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { distanceFromBuildingFootprint } from '../../src/game/simulation/bridge/pureHelpers';
import { createBuildingCombatState } from '../../src/game/simulation/prototypeBuildingRules';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

const HORIZON_TICKS = 45000;
/** Measured at ZERO on the boot map, both owners (2026-09-02, v0.3.191).
 *  Three is the bar rather than zero so that a villager caught by a tower
 *  going up on a contested woodline — which the rule permits until that
 *  villager's next decision — is not read as the defect returning. Forty-three
 *  is the defect. Satisfy a failure by keeping villagers out of enemy reach,
 *  never by moving this number. */
const DEATHS_UNDER_ENEMY_DEFENCES_BAR = 3;
/** Fletching + Bodkin Arrow + Bracer, assumed researched whether they are or
 *  not, so a death just outside the ACTUAL reach still counts. Deliberately
 *  not wider: the bonuses this misses are civilization- or technology-specific
 *  (Keep +1 on a Watch Tower, Yeomen and Crenellations, Koreans' towers +1 in
 *  Castle and +2 in Imperial — none of them on the boot map's civilizations),
 *  and widening the net to cover the worst of them turns ordinary raid deaths
 *  into false positives: this map already has a villager killed twelve cells
 *  from an enemy Watch Tower while carrying wood home to its OWN base. The
 *  effective-range arithmetic itself is gated by `enemyDefenceRange.test.ts`
 *  (`effectiveStaticDefenceRange`, bonus by bonus) against the same function
 *  `towerCombatSystem` fires with. */
const ARROW_TECH_RANGE_MAX = 3;
const RULE_MARGIN = 1;
/** A gather trip lasts hundreds of ticks; the task is attribution only. */
const TASK_SAMPLE_INTERVAL = 25;

interface VillagerDeath {
  tick: number;
  owner: number;
  x: number;
  y: number;
  task: string;
  nearest: string;
  underDefences: boolean;
}

interface Census {
  deaths: Record<number, VillagerDeath[]>;
  lastTick: number;
  outcome: string;
  /** The match ended with one side wiped off the map — so the endgame this
   *  bar was derived over happened, however early it came. */
  conquest: boolean;
}

function playAndCensus(seed: string): Census {
  const bridge = createSimulationBridge(seed, {
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
  });
  const deaths: Record<number, VillagerDeath[]> = { 1: [], 2: [] };
  const seen = new Set<string>();
  const lastTask = new Map<number, string>();
  let lastTick = 0;
  for (let tick = 1; tick <= HORIZON_TICKS; tick += 1) {
    bridge.step(100);
    lastTick = tick;
    // The feed keeps a death for ten ticks and prunes only when the next one
    // lands, so reading it every tick and de-duplicating sees them all. It is
    // the RAW feed (`state.recentUnitDeaths`), not the per-player fog-filtered
    // copy the renderer gets, so a death nobody witnessed still counts. Its
    // one blind spot is its 64-entry hard cap: more than 64 units dying inside
    // a single `step(100)` drops the earliest, villagers included. Nothing on
    // these maps comes close, and a census that missed deaths would only ever
    // under-report — but a future mass-death scenario would need to know.
    for (const death of bridge.getRecentUnitDeaths()) {
      const key = `${death.id}:${death.tick}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (death.unitType !== 'villager') continue;
      const x = Math.floor(death.x);
      const y = Math.floor(death.y);
      let nearest = 'no enemy static defence';
      let underDefences = false;
      let nearestDistance = Number.POSITIVE_INFINITY;
      // Buildings AS THEY STOOD at the moment of death, not at the end: a
      // tower raised after this villager died must not make its death look
      // like one the rule should have prevented.
      for (const building of bridge.getEconomyState().buildings) {
        // The boot scenario is a 1v1 with no alliances, so "not mine" is
        // "enemy" here; a scenario with teams would have to ask the team map.
        if (building.owner === death.owner || !building.isComplete) continue;
        const combat = createBuildingCombatState(building.buildingType);
        if (combat === null) continue;
        const distance = distanceFromBuildingFootprint(
          building,
          { width: building.footprintWidth, height: building.footprintHeight },
          { x, y },
        );
        // "Covered by ANY of them" and "nearest" are different questions — a
        // Castle two cells further off reaches two cells further than a Town
        // Centre — so the verdict is taken over every defence and only the
        // message keeps the nearest one.
        if (distance <= combat.attackRange + ARROW_TECH_RANGE_MAX + RULE_MARGIN) {
          underDefences = true;
        }
        if (distance >= nearestDistance) continue;
        nearestDistance = distance;
        nearest = `${distance} from owner ${building.owner}'s ${building.buildingType}`;
      }
      deaths[death.owner]?.push({
        tick: death.tick, owner: death.owner, x, y,
        task: lastTask.get(death.id) ?? '?', nearest, underDefences,
      });
    }
    if (bridge.getMatchState().outcome !== 'running') break;
    if (tick % TASK_SAMPLE_INTERVAL !== 0) continue;
    for (const unit of bridge.getEconomyState().units) {
      if (unit.unitType === 'villager') lastTask.set(unit.id, unit.task);
    }
  }
  const outcome = bridge.getMatchState().outcome;
  // Survivors, read from the state rather than from the outcome: a Wonder or
  // Relic victory, a score win or a draw all resolve with both sides standing.
  // Only the two PLAYERS count — a gaia-owned building is not a side, and on
  // a map that has one it would otherwise turn a true conquest into a false
  // red (a critic's finding, 2026-09-05). The boot scenario is a 1v1.
  const players = [1, 2];
  const standing = new Set<number>();
  for (const unit of bridge.getEconomyState().units) {
    if (players.includes(unit.owner)) standing.add(unit.owner);
  }
  for (const building of bridge.getEconomyState().buildings) {
    if (building.owner !== null && players.includes(building.owner)) standing.add(building.owner);
  }
  return { deaths, lastTick, outcome, conquest: outcome !== 'running' && standing.size === 1 };
}

describe('villagers are not sent to die under enemy static defences', () => {
  it('loses no more than a handful of villagers inside enemy Town Centre, tower or Castle reach on the boot map', () => {
    const census = playAndCensus('aoe2-prototype');
    // Printed whatever happens: a census that stops early because the match
    // resolved is scoring a shorter window than the one the bar was derived
    // from, and a reader has to be able to see that.
    console.log(
      `SELFPLAY-DEFENCE aoe2-prototype: censused to tick ${census.lastTick} `
      + `(outcome ${census.outcome}) — `
      + [1, 2].map((o) => {
        const led = census.deaths[o]!;
        return `owner ${o}: ${led.length} villager deaths, `
          + `${led.filter((d) => d.underDefences).length} under enemy defences`;
      }).join('; '),
    );
    // The window this bar was derived from, asserted rather than assumed. The
    // deaths the gate is named for landed at ticks 38,793-39,191 of a match
    // that ran to 45,000, and the census stops when the match resolves. What
    // the bar needs inside the censused window is the ENDGAME — armies at
    // each other's bases. Two things prove it happened: the census ran to the
    // horizon, or the match ended by CONQUEST, one side wiped off the map,
    // which cannot happen without that phase. Re-bound 2026-09-05 (v0.3.205):
    // the deposit-leg fix ends this match by conquest at 39,812, and the old
    // `>= 40,000` read a decided match as an unmeasured one. A match that
    // resolves any other way — Wonder, Relic, score, a draw — still fails
    // here, and so does a bug that resolves it with both sides standing; a
    // bug that deletes a side reads as a conquest, which is what conquest
    // means. Re-derive the bar rather than lowering the horizon.
    // (An earlier draft read `lastTick >= 40_000 || outcome !== 'running'`,
    // which the loop makes true by construction — a tautology an independent
    // critic caught. `conquest` is not: it reads the survivors.)
    expect(
      census.lastTick >= HORIZON_TICKS || census.conquest,
      `the census covered only ${census.lastTick} ticks (outcome ${census.outcome}, `
        + `${census.conquest ? 'by conquest' : 'both sides standing'}) — short of the `
        + 'horizon and not a conquest, so the endgame this bar was measured over may '
        + 'never have happened: re-derive the bar rather than lowering the horizon.',
    ).toBe(true);
    for (const owner of [1, 2]) {
      const ledger = census.deaths[owner]!;
      const underDefences = ledger.filter((death) => death.underDefences);
      const lines = underDefences
        .map((d) => `  t=${d.tick} at ${d.x},${d.y} while ${d.task}, ${d.nearest}`)
        .join('\n');
      expect(
        underDefences.length,
        `owner ${owner} lost ${underDefences.length} villagers under enemy static defences `
          + `(${ledger.length} villager deaths in all, censused to tick ${census.lastTick}) — `
          + `the assignment sent them there:\n${lines}\n`
          + 'Satisfy this by keeping villagers out of enemy defence reach, not by moving the bar.',
      ).toBeLessThanOrEqual(DEATHS_UNDER_ENEMY_DEFENCES_BAR);
    }
  // 30 minutes, not the suite's 30-second default: measured 468-512 s under
  // the full suite on a 32-core machine, and every CI box is slower.
  }, 1_800_000);
});
