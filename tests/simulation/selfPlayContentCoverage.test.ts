// Self-play CONTENT COVERAGE: what an all-AI match the AI cannot end actually
// exercises, measured per PRODUCER and recorded as a two-way snapshot
// (spec §15.8).
//
// WHY A LAB. On a match that resolves, a winner's variety measures the match's
// LENGTH, not the AI: under v0.3.205 the boot map ends by conquest at tick
// 39,812 and the winner shows 9 building types where the side that lost the
// longer match before it showed 14. So this gate turns the AI's attack and
// ferry phases off (`disableAiAttacks`), disables the Wonder and Relic
// victories (`victory: 'conquest-only'`) so nothing can end the match, gives
// every seat the high starting-resource preset and the hard decision
// interval, and plays the boot map to its 45,000-tick horizon with both
// economies intact.
//
// WHY THIS CONFIGURATION — A HISTORICAL COMPARISON, NOT A CURRENT READING.
// Three configurations were measured against each other ON THE 2026-09-05 TREE,
// and this one reached the most content. Standard resources, standard AI,
// attacks on: 11 building types, 6 unit types, no Imperial Age. Attacks off: 13
// and 13, no Imperial Age. Attacks off with high resources and a hard AI: 15
// buildings, 18 units and 31 technologies, both seats in the Imperial Age
// (owner 2 at tick 24,500, owner 1 at 42,500). NONE OF THOSE NUMBERS DESCRIBES
// THIS TREE. The 2026-09-06 AI fixes took the winning row to 15, 17 and 28 with
// Imperial reached at ticks 15,500 and 30,250, and the 2026-09-10 AI
// site-placement and farm-walkability lanes took it to 15, 17 and 29. The two
// losing rows have not been re-measured since 2026-09-05. Those numbers stay
// because the COMPARISON is what justifies the configuration: re-measuring one
// row of a three-way A/B on a later tree would make the arms differ by more
// than the variable under test.
//
// WHY THE NAMED-TECHNOLOGY FLOOR IS GONE (2026-09-10). This gate used to carry
// three floors of NAMES — buildings, units, technologies that a match had to
// exercise. The technology floor was green for the wrong reason and went red
// when the game improved, and the mechanism is the AI's, not the content's.
// `runProductionPhase` walks a producer's option list and buys the FIRST entry
// it can pay for, so a named technology asserts that a particular purse existed
// at a tick that producer happened to be idle. The two most expensive entries
// on a list are therefore bought only out of a surplus the AI cannot spend on
// anything else. On `a30af4fa` owner 2 bought `onager-upgrade` (800 food, 500
// wood — itself mispriced: technologies.csv and DE ask 500 gold, corrected
// 2026-09-23) and `heavy-scorpion-upgrade` (1,000 food, 1,100 wood) while holding 7
// gold — upgrades to an Onager and a Heavy Scorpion it could never train, since
// both units are priced in gold it did not have. Give the AI gold and it spends
// it on units instead, those two never get bought, and the floor goes red while
// coverage goes UP. That is not a coverage claim; it is a reading of how broke
// the AI was. The register's 2026-09-10 entry carries the whole reconstruction.
//
// WHAT REPLACED IT, and why each half is not the thing that broke:
//   PER PRODUCER, NOT PER NAME. Every building type in the expectation's
//   `researchProducers` must research at least one technology from ITS OWN
//   hosted list, and every type in `trainProducers` must field at least one
//   unit from its own. `capped-ram-upgrade` at the Siege Workshop satisfies
//   that exactly as `onager-upgrade` would, so the claim survives the AI
//   choosing differently while still failing the moment a producer goes quiet.
//   A TWO-WAY SNAPSHOT. The exact censused sets live in
//   `selfPlayContentCensus.expected.json` and ANY change fails, printing both
//   directions. A gain costs the same attention as a loss, so the commit that
//   updates the file has to say which way the AI moved — which is what would
//   have shown the 2026-09-10 result as one trade ("gained conscription,
//   plate-mail-armor and plate-barding; lost onager-upgrade and
//   heavy-scorpion-upgrade") instead of as a bare failure.
// A LEGITIMATE loss is still edited into the expectation with its reason in the
// commit; the gate exists to make a move visible, not to forbid one.
//
// WHAT THE PRICE-FREE HALF IS. Whether a technology, unit or building can be
// BOUGHT at all is not measured here and never was. `contentPipelineResearch`,
// `contentPipelineTraining` and `contentPipelineBuildings` drive every row of
// `RESEARCH_COSTS`, `TRAINING_COSTS` and `AUTHORITATIVE_BUILDING_FOOTPRINTS`
// through the real command path with a purse nothing can exhaust. That is where
// `onager-upgrade` and `heavy-scorpion-upgrade` live now, and no match
// trajectory can move it.
//
// THE GAP IS PRINTED, not asserted: the difference between this census and the
// game's own content tables is the standing to-do for feature completeness
// (§16.3), and reading it is the point of running this.
//
// BOUND — what a green run does NOT prove. One seed, one horizon, one
// configuration; the simulation is deterministic, so the snapshot is exact on
// this tree and says nothing about any other. It says nothing about what the AI
// does under attack — `aiReachesCastleAge.test.ts` scores that. The census
// counts units the owner HOLDS at a 250-tick sample, not units it trained, so a
// scenario-seeded starting unit counts toward its producer; and it counts a
// building type ONCE, so a second Barracks is invisible. `researchProducers`
// asks for one technology, not for a good one. Several completed buildings
// research nothing at all in this match — on 2026-09-10 the Market, Mill,
// Lumber Camp, Mining Camp and Monastery for one or both seats — and the
// expectation records that silence rather than asserting it away; the register's
// 2026-09-03 hoarding entry is the open defect underneath it.
//
// THE BUILDER'S WALK (work 152 M1d), judged on the same match: of every
// villager a seat sends to a building it places, and of every villager it sends
// to crew a standing site, none it could have sent instead had a shorter walk
// to the site, nor the same walk and a lower id. A resource's last gatherer is
// one it could have sent only when no other villager could go. This is the
// crews' case: the lobby-default matches of `aiEconomySelfPlay.test.ts` make no
// crew order, and this match crews Castles, Markets, Houses and farms and takes
// up sites whose builder was lost. `builderWalkProbe.ts` records each order at
// the instant the seat decides and measures the walks with its own search over
// the path search's grid, never the game's flood; it reads only, and the census
// below is the same with it and without.
//   main's rule put back (the first in entity order sent), 2026-11-11   197 of 225 orders, 51 of its 58 crew orders, past a villager the rule would send; 5,321 cells in all, 144 at the most   RED
//   the crew phase asks without the site                                 the crew orders                                                                                              RED
// Bound: this match, so the building types and layouts this AI reaches on this
// seed; a refused placement is not judged (nothing is built).
//
// COST: 194 s alone on a 32-core machine when that was measured on 2026-09-05;
// 398 s on 2026-09-10 with the three content-pipeline gates running beside it,
// which is contention rather than a regression — and it is the file the whole
// four-gate run waits on, since the pipelines finish in 30-59 s. Still the
// heaviest of the three self-play gates.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import {
  RESEARCHES_BY_BUILDING,
  TRAINABLE_UNITS_BY_BUILDING,
} from '../../src/game/simulation/buildingProductionTables';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { TRAINABLE_UNIT_TYPES } from '../../src/game/simulation/trainingCosts';
import type { BuildingType } from '../../src/game/simulation/types';
import { betterBuilders, describeOrder, observeBuilderOrders, type BuilderOrder } from './builderWalkProbe';

const HORIZON_TICKS = 45000;
const SAMPLE_INTERVAL = 250;
const OWNERS = [1, 2] as const;
const EXPECTATION_PATH = 'tests/simulation/selfPlayContentCensus.expected.json';
/** Orders the lab must show before the builder's walk is judged on it, so the
 *  case cannot pass on an empty record (207 measured with work 152 M1d: 164
 *  placements and 43 crew orders; 225 with main's rule, 167 and 58). */
const BUILDER_ORDERS_FLOOR = { placements: 100, crews: 20 };

interface OwnerCensus {
  buildings: string[];
  units: string[];
  technologies: string[];
  /** Completed building types where at least one HOSTED technology was researched. */
  researchProducers: string[];
  /** Completed building types where at least one HOSTED unit type was held. */
  trainProducers: string[];
}

interface Census {
  ages: Record<string, string>;
  byOwner: Record<string, OwnerCensus>;
  buildings: string[];
  units: string[];
  technologies: string[];
}

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();

interface PlayedLab { census: Census; lastTick: number; outcome: string; builderOrders: BuilderOrder[] }

/** The lab is played once, whichever case asks first. */
let played: PlayedLab | null = null;
function labOf(seed: string): PlayedLab {
  played ??= playCoverageLab(seed);
  return played;
}

function playCoverageLab(seed: string): PlayedLab {
  const bridge = createSimulationBridge(seed, {
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
    disableAiAttacks: true,
    // Wonder and Relic victories off as well: monks and a Wonder are both
    // within the lab's reach, and either would end the match legitimately
    // and read here as a regression (a critic's finding, 2026-09-05).
    victory: 'conquest-only',
    resourcePreset: 'high',
    difficulty: 'hard',
    // Nothing here draws, and the per-tick render projection was 16% of this
    // match's CPU (2026-09-25); it never writes the world, so the census is
    // the same (renderProjectionOnRead.test.ts).
    renderProjection: 'on-read',
  });
  // Reads only: the match plays as it does unobserved (builderWalkProbe.ts).
  const builderOrders = observeBuilderOrders(bridge);
  const buildingsByOwner = new Map<number, Set<string>>(OWNERS.map((o) => [o, new Set<string>()]));
  const unitsByOwner = new Map<number, Set<string>>(OWNERS.map((o) => [o, new Set<string>()]));
  let lastTick = 0;
  for (let tick = 1; tick <= HORIZON_TICKS; tick += 1) {
    bridge.step(100);
    lastTick = tick;
    if (bridge.getMatchState().outcome !== 'running') break;
    if (tick % SAMPLE_INTERVAL !== 0) continue;
    const state = bridge.getEconomyState();
    for (const building of state.buildings) {
      if (building.isComplete) buildingsByOwner.get(building.owner)?.add(building.buildingType);
    }
    for (const unit of state.units) unitsByOwner.get(unit.owner)?.add(unit.unitType);
  }

  const byOwner: Record<string, OwnerCensus> = {};
  const ages: Record<string, string> = {};
  for (const owner of OWNERS) {
    const buildings = buildingsByOwner.get(owner) ?? new Set<string>();
    const units = unitsByOwner.get(owner) ?? new Set<string>();
    const technologies = new Set<string>(bridge.getResearchedTechnologies(owner));
    const researchProducers: string[] = [];
    const trainProducers: string[] = [];
    for (const buildingType of [...buildings].sort()) {
      const hostedTech = RESEARCHES_BY_BUILDING.get(buildingType as BuildingType) ?? [];
      if (hostedTech.some((tech) => technologies.has(tech))) researchProducers.push(buildingType);
      const hostedUnits = TRAINABLE_UNITS_BY_BUILDING.get(buildingType as BuildingType) ?? [];
      if (hostedUnits.some((unit) => units.has(unit))) trainProducers.push(buildingType);
    }
    byOwner[String(owner)] = {
      buildings: sorted(buildings),
      units: sorted(units),
      technologies: sorted(technologies),
      researchProducers,
      trainProducers,
    };
    ages[String(owner)] = bridge.getEconomyState().ages[owner] ?? 'none';
  }
  const census: Census = {
    ages,
    byOwner,
    buildings: sorted(OWNERS.flatMap((o) => byOwner[String(o)]!.buildings)),
    units: sorted(OWNERS.flatMap((o) => byOwner[String(o)]!.units)),
    technologies: sorted(OWNERS.flatMap((o) => byOwner[String(o)]!.technologies)),
  };
  return { census, lastTick, outcome: bridge.getMatchState().outcome, builderOrders };
}

function gap(universe: readonly string[], exercised: readonly string[]): string[] {
  const seen = new Set(exercised);
  return universe.filter((name) => !seen.has(name)).sort();
}

/** Both directions, named — a gain reads as loudly as a loss. */
function twoWayDiff(what: string, expected: readonly string[], actual: readonly string[]): string {
  const gained = actual.filter((name) => !expected.includes(name));
  const lost = expected.filter((name) => !actual.includes(name));
  if (gained.length === 0 && lost.length === 0) return '';
  return `${what}: gained [${gained.join(' ') || '—'}] lost [${lost.join(' ') || '—'}]`;
}

describe('self-play content coverage — the no-attack lab (spec §15.8)', () => {
  it('makes every recorded producer produce, and censuses the match against a two-way snapshot', () => {
    const expected = JSON.parse(readFileSync(EXPECTATION_PATH, 'utf-8')) as Census;
    const { census, lastTick, outcome } = labOf('aoe2-prototype');

    const buildingUniverse = Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS);
    const unitUniverse = [...TRAINABLE_UNIT_TYPES];
    const technologyUniverse = Object.keys(RESEARCH_COSTS);
    console.log(
      `COVERAGE aoe2-prototype lab: censused to ${String(lastTick)} (${outcome}); `
      + `ages ${JSON.stringify(census.ages)}; `
      + `${String(census.buildings.length)}/${String(buildingUniverse.length)} building types, `
      + `${String(census.units.length)}/${String(unitUniverse.length)} unit types, `
      + `${String(census.technologies.length)}/${String(technologyUniverse.length)} technologies`,
    );
    console.log(`COVERAGE gap — buildings never built: ${gap(buildingUniverse, census.buildings).join(' ')}`);
    console.log(`COVERAGE gap — units never trained: ${gap(unitUniverse, census.units).join(' ')}`);
    console.log(`COVERAGE gap — technologies never researched: ${gap(technologyUniverse, census.technologies).join(' ')}`);
    for (const owner of OWNERS) {
      const seat = census.byOwner[String(owner)]!;
      console.log(
        `COVERAGE owner ${String(owner)}: researches at [${seat.researchProducers.join(' ')}], `
        + `fields units from [${seat.trainProducers.join(' ')}], `
        + `silent completed buildings [${seat.buildings.filter((b) => !seat.researchProducers.includes(b) && !seat.trainProducers.includes(b)).join(' ')}]`,
      );
    }

    // The lab's premise, asserted rather than assumed: nothing ended the match,
    // and both seats reached the age where the tree is widest.
    expect(outcome, 'the lab match resolved — attacks and the Wonder and Relic victories are off here, so something else ended it').toBe('running');
    for (const owner of OWNERS) {
      expect(census.ages[String(owner)], `owner ${String(owner)} did not reach the Imperial Age in the lab`).toBe('imperial-age');
    }

    // PER PRODUCER: a building the expectation records as producing must
    // produce something of ITS OWN, whatever the AI's purse happened to allow.
    for (const owner of OWNERS) {
      const seat = census.byOwner[String(owner)]!;
      const want = expected.byOwner[String(owner)]!;
      for (const buildingType of want.researchProducers) {
        const hosted = RESEARCHES_BY_BUILDING.get(buildingType as BuildingType) ?? [];
        const got = hosted.filter((tech) => seat.technologies.includes(tech));
        expect(
          got.length,
          `owner ${String(owner)}'s ${buildingType} researched nothing it hosts. `
          + `It hosts ${String(hosted.length)} technologies and the seat researched none of them. `
          + 'This is a producer going quiet, not one technology going missing — any of its own list would do.',
        ).toBeGreaterThan(0);
      }
      for (const buildingType of want.trainProducers) {
        const hosted = TRAINABLE_UNITS_BY_BUILDING.get(buildingType as BuildingType) ?? [];
        const got = hosted.filter((unit) => seat.units.includes(unit));
        expect(
          got.length,
          `owner ${String(owner)}'s ${buildingType} fielded no unit it trains. `
          + `It trains ${String(hosted.length)} unit types and the seat held none of them. `
          + 'Any of its own list would do.',
        ).toBeGreaterThan(0);
      }
    }

    // TWO-WAY SNAPSHOT: any change at all, in either direction, by name.
    const diffs: string[] = [];
    for (const key of ['buildings', 'units', 'technologies'] as const) {
      const line = twoWayDiff(key, expected[key], census[key]);
      if (line) diffs.push(line);
    }
    for (const owner of OWNERS) {
      const want = expected.byOwner[String(owner)]!;
      const got = census.byOwner[String(owner)]!;
      for (const key of ['buildings', 'units', 'technologies', 'researchProducers', 'trainProducers'] as const) {
        const line = twoWayDiff(`owner ${String(owner)} ${key}`, want[key], got[key]);
        if (line) diffs.push(line);
      }
    }
    expect(
      diffs,
      `the lab censused a DIFFERENT match than ${EXPECTATION_PATH} records:\n  ${diffs.join('\n  ')}\n`
      + 'A gain is as much a change as a loss. Re-record the file in the same commit as the change that moved it, '
      + 'and say in the commit message which way the AI moved and why.',
    ).toEqual([]);
  }, 1_800_000);

  it('sends every site it places or crews the available villager with the shortest walk', () => {
    const { builderOrders, lastTick } = labOf('aoe2-prototype');
    expect(lastTick, 'the lab stopped before its horizon').toBe(HORIZON_TICKS);
    // A walk is judged only where something is built: a placement the game refuses is listed, not judged.
    const placed = builderOrders.filter((order) => order.kind === 'placement' && order.refusal === null);
    const crews = builderOrders.filter((order) => order.kind === 'crew');
    const byKind = new Map<string, number>();
    for (const order of builderOrders) {
      const kind = `${order.kind} ${order.buildingType}${order.refusal === null ? '' : ' (refused)'}`;
      byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
    }
    console.log(`BUILDERS aoe2-prototype lab: ${[...byKind].sort().map(([kind, count]) => `${kind} ${String(count)}`).join(', ')}`);
    expect(placed.length, 'placements seen: the record is not reading the match').toBeGreaterThanOrEqual(BUILDER_ORDERS_FLOOR.placements);
    expect(crews.length, 'crew orders seen: the crews\' case needs them').toBeGreaterThanOrEqual(BUILDER_ORDERS_FLOOR.crews);
    expect(builderOrders.filter((order) => !order.builderAvailable).map(describeOrder), 'a builder that was not available').toEqual([]);
    expect(
      builderOrders.filter((order) => betterBuilders(order).length > 0).map(describeOrder),
      'a builder sent past a villager with a shorter walk',
    ).toEqual([]);
  }, 1_800_000);
});
