// CONTENT PIPELINE — RESEARCH. Every row of `RESEARCH_COSTS` is bought through
// the real `queue.research` command by a seat that can afford anything.
//
// WHY THIS EXISTS, AND WHAT IT REPLACES. The self-play coverage lab used to
// carry named technologies on a floor, and a name on that floor asserted that
// some producer happened to be idle at a tick when some purse happened to cover
// that entry. `runProductionPhase` buys the FIRST option it can pay for, so the
// two most expensive entries on a list are bought only out of a surplus the AI
// cannot spend on anything else: on `a30af4fa` owner 2 bought `onager-upgrade`
// (800 food, 500 wood) and `heavy-scorpion-upgrade` (1,000 food, 1,100 wood)
// while holding 7 gold — upgrades to an Onager and a Heavy Scorpion it could
// never train. Improve the AI's gold and it stops buying them, and the floor
// went red because the game got BETTER. This file is the half of that gate that
// no match trajectory can move: price-free reachability of the content itself.
//
// WHAT IT ASSERTS, per technology, on a live world:
//   offered   — it appears in `getAgentBuildingOptions(owner)` at a real,
//               completed building of the seat's, which is the same surface the
//               HUD research menu and the agent snapshot read.
//   accepted  — `queueResearch` (the `queue.research` command) returns true and
//               the dispatcher does not reject it.
//   charged   — the STOCKPILE loses exactly the declared cost, read out of the
//               world before and after the dispatching step. For a civilization
//               with no research modifier the declared cost IS the raw
//               `RESEARCH_COSTS` row; where a modifier applies, it is
//               `effectiveResearchCost`, and the run prints which rows were
//               never priced at the raw table row by any seat.
//   completed — the technology lands in `getResearchedTechnologies(owner)`.
//   in effect — and it is gone from that building's offer list afterwards, so
//               the menu the player reads agrees with the set the sim holds.
// Then: every row of the table was driven by SOME seat. A row nothing offers
// fails here by name.
//
// HOW THE CIVILIZATIONS ARE WALKED. A civilization's tech tree holes are real
// content (`civTechTree.ts`), so no single seat can reach the whole table: a
// Britons seat stops at 81 of 143 from the Imperial Age and 84 climbing from
// the Dark Age — they have no Bloodlines, no Crop Rotation, no Thumb Ring, no
// Hussar, no Paladin, no Camels, no Siege Ram, no Siege Onager, no Stone Shaft
// Mining, no Bombard Tower, no Redemption. So the sweep
// walks `CIVILIZATION_NAMES` in order, each seat standing on the technologies
// already bought (setup, never the entry under test) so only the rows still
// missing are offered, and stops as soon as the table is covered. That is also
// why a NEW civilization or a NEW unique technology needs no edit here.
//
// BOUND — what a green run does NOT prove. It says nothing about whether an AI
// or a player ever WANTS any of this, nothing about research EFFECTS beyond the
// researched set and the menu (the per-technology effect tests own that), and
// nothing about any age other than the one each row is driven in. It reads one
// scenario's buildings (`building-showcase-fixture`, which stands one completed
// building of every type) plus one dark-age seat for the three age-ups, so a
// technology hosted at a building that fixture lacks would fail here by name
// rather than pass unseen. It does not check research TIME. And it prices
// `spies` only against its FLOOR: Spies is the one row whose cost is a query
// (200 gold per living enemy villager, halved by Atheism), and the showcase's
// second seat holds no villagers, so what this seat pays is the floor and the
// per-villager slope is `spiesRules.ts`'s own tests to prove.
//
// COST: 31,343 ticks, 51 s measured 2026-09-10 on a 32-core machine with the
// training, building and self-play gates running beside it. The TICKS are exact
// and deterministic; the SECONDS are not a budget — a second run of the same
// tree moved its two neighbours by up to 1.5x on pool contention alone. It is
// its own file so it runs beside the other pipelines rather than after them.

import { describe, expect, it } from 'vitest';

import { effectiveResearchCost } from '../../src/game/simulation/civBonusEffects';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { RESEARCH_COSTS, RESEARCH_TIME_TICKS } from '../../src/game/simulation/researchTables';
import type { PlayerResources, ResearchableTechnologyType } from '../../src/game/simulation/types';
import {
  type Bridge,
  expectSpend,
  normalizeCost,
  purseOf,
  selectCompletedBuilding,
  spentBetween,
  standSeat,
  stepUntil,
} from './contentPipeline.helpers';

const SHOWCASE = 'building-showcase-fixture';
const ALL_TECHNOLOGIES = Object.keys(RESEARCH_COSTS) as ResearchableTechnologyType[];
const LONGEST_RESEARCH = Math.max(...Object.values(RESEARCH_TIME_TICKS));

interface Bought {
  civilization: string;
  buildingType: string;
  spent: Partial<PlayerResources>;
  atRawTableRow: boolean;
}

const bought = new Map<ResearchableTechnologyType, Bought>();

/** Drive everything this seat offers that nothing has bought yet. Each research
 *  building runs its own chain: as soon as one finishes, the next rung at THAT
 *  building is dispatched, so the seat's cost is its longest chain rather than
 *  the sum of every round's slowest entry. Returns the ticks it burned. */
function sweep(bridge: Bridge, civilization: string, maxDispatches: number): number {
  const inFlight = new Map<string, ResearchableTechnologyType>();
  let retired: ResearchableTechnologyType[] = [];
  let ticks = 0;
  let dispatches = 0;

  for (;;) {
    const options = bridge.getAgentBuildingOptions(1);
    // Takes effect: what completed last pass is gone from the offer list, so
    // the menu the player reads agrees with the set the simulation holds.
    const offeredNow = new Set(
      options.byBuildingType.flatMap((entry) => entry.research.map((option) => option.tech)),
    );
    for (const tech of retired) {
      expect(offeredNow.has(tech), `${tech} (${civilization}) completed but is still offered for research`).toBe(false);
    }
    retired = [];

    for (const entry of options.byBuildingType) {
      if (inFlight.has(entry.buildingType)) continue;
      const next = entry.research.find((option) => !bought.has(option.tech));
      if (!next || dispatches >= maxDispatches) continue;
      const tech = next.tech;
      const label = `${tech} at a ${civilization} ${entry.buildingType}`;
      expect(selectCompletedBuilding(bridge, entry.buildingType), `${label}: no completed building to select`).toBe(true);
      const age = bridge.getEconomyState().ages[1]!;
      const before = purseOf(bridge);
      const accepted = bridge.queueResearch(tech);
      bridge.step(100);
      ticks += 1;
      dispatches += 1;
      expect(accepted, `${label}: queue.research was refused although the building offered it`).toBe(true);
      const rejection = bridge.consumeCommandRejection();
      expect(rejection, `${label}: the dispatcher rejected the command — ${String(rejection)}`).toBeNull();

      const declared = effectiveResearchCost(civilization, age, tech);
      const spent = spentBetween(before, purseOf(bridge));
      if (tech === 'spies') {
        // Spies is priced by a QUERY rather than by the table: 200 gold per
        // living enemy villager, halved by Atheism, and the table row is the
        // FLOOR. Assert the floor was charged and nothing else was touched.
        expect(spent.gold ?? 0, `${label}: charged below the Spies floor`).toBeGreaterThanOrEqual(RESEARCH_COSTS.spies.gold ?? 0);
        expect(
          { food: spent.food ?? 0, wood: spent.wood ?? 0, stone: spent.stone ?? 0 },
          `${label}: Spies is a gold price and nothing else`,
        ).toEqual({ food: 0, wood: 0, stone: 0 });
      } else {
        expectSpend(label, spent, declared);
      }
      bought.set(tech, {
        civilization,
        buildingType: entry.buildingType,
        spent,
        atRawTableRow:
          JSON.stringify(normalizeCost(declared))
          === JSON.stringify(normalizeCost(RESEARCH_COSTS[tech])),
      });
      inFlight.set(entry.buildingType, tech);
    }

    if (inFlight.size === 0) break;

    const anyDone = (): boolean => {
      const researched = new Set(bridge.getResearchedTechnologies(1));
      for (const tech of inFlight.values()) if (researched.has(tech)) return true;
      return false;
    };
    const waited = stepUntil(bridge, anyDone, LONGEST_RESEARCH + 200, 10);
    ticks += waited ?? LONGEST_RESEARCH + 200;
    const researched = new Set(bridge.getResearchedTechnologies(1));
    for (const [buildingType, tech] of [...inFlight]) {
      if (!researched.has(tech)) continue;
      inFlight.delete(buildingType);
      retired.push(tech);
    }
    expect(
      retired.length,
      `nothing completed at ${civilization}'s ${[...inFlight.keys()].join('/')} inside `
      + `${String(LONGEST_RESEARCH + 200)} ticks — in flight: ${[...inFlight.values()].join(' ')}`,
    ).toBeGreaterThan(0);
  }
  return ticks;
}

describe('content pipeline — research', () => {
  it('offers, accepts, charges and completes every RESEARCH_COSTS row through queue.research', () => {
    const started = Date.now();
    let ticks = 0;

    // The three age-ups are the only rows a seat already in the Imperial Age
    // cannot buy, so one seat starts in the Dark Age standing in the showcase's
    // completed buildings and climbs. It sweeps everything else it can reach on
    // the way up, which is most of the table.
    ticks += sweep(standSeat({ scenarioSeed: SHOWCASE, civilization: 'Britons', researched: [], age: 'dark-age' }), 'Britons', 400);
    const ageSeatCovered = bought.size;
    for (const ageTech of ['feudal-age', 'castle-age', 'imperial-age'] as const) {
      expect(bought.has(ageTech), `${ageTech} was never bought — the dark-age seat never climbed`).toBe(true);
    }

    const perCivilization: string[] = [];
    for (const civilization of CIVILIZATION_NAMES) {
      if (bought.size >= ALL_TECHNOLOGIES.length) break;
      const before = bought.size;
      ticks += sweep(
        standSeat({ scenarioSeed: SHOWCASE, civilization, researched: [...bought.keys()], age: 'imperial-age' }),
        civilization,
        400,
      );
      if (bought.size > before) perCivilization.push(`${civilization}+${String(bought.size - before)}`);
    }

    const missing = ALL_TECHNOLOGIES.filter((tech) => !bought.has(tech));
    const neverRaw = [...bought].filter(([, entry]) => !entry.atRawTableRow).map(([tech]) => tech);
    console.log(
      `PIPELINE research: ${String(bought.size)}/${String(ALL_TECHNOLOGIES.length)} rows bought in `
      + `${String(ticks)} ticks / ${((Date.now() - started) / 1000).toFixed(1)} s; `
      + `dark-age seat covered ${String(ageSeatCovered)}; then ${perCivilization.join(' ')}`,
    );
    console.log(
      `PIPELINE research: rows only ever priced through a civilization modifier `
      + `(never charged the raw RESEARCH_COSTS row by any seat): ${neverRaw.join(' ') || 'none'}`,
    );

    expect(
      missing,
      `these RESEARCH_COSTS rows were never offered by any civilization's real research menu: ${missing.join(', ')}. `
      + 'They are unreachable content, not a coverage shortfall — find the building or the tech-tree entry that lost them.',
    ).toEqual([]);
  }, 600_000);
});
