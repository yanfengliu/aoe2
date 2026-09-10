// CONTENT PIPELINE — TRAINING. Every row of `TRAINING_COSTS` is bought through
// the real `queue.train` command by a seat that can afford anything.
//
// WHY THIS EXISTS. Same reason as the research half (see
// `contentPipelineResearch.test.ts`): the self-play lab's unit floor named
// units, and a name on that floor asserted that a producer was idle at a tick
// when a particular purse existed. `capped-ram` — 160 wood and 75 gold, and on
// the 2026-09-10 tree the ONLY siege unit either seat ever fielded besides the
// Battering Ram it upgrades from — carried exactly the fragility that took
// `onager-upgrade` and `heavy-scorpion-upgrade` off the technology floor: it is
// bought out of whatever the AI has left, so a change in the AI's gold moves it.
// Whether the unit can be BOUGHT AT ALL is this file's job, and no match
// trajectory can move it.
//
// WHAT IT ASSERTS, per unit type, on a live world: offered in
// `getAgentBuildingOptions` at a real completed producer; `queueTrainUnit`
// accepted and not rejected by the dispatcher; the STOCKPILE loses exactly the
// declared cost (`effectiveTrainingCost`, which is the raw `TRAINING_COSTS` row
// unless a civilization bonus or Shipwright applies — the run prints which rows
// were never charged the raw row); and a NEW unit of that exact type spawns —
// new by entity id, because `naval-imperial-fixture` seeds owner 1 a Galley at
// boot and matching on the type alone would credit the Galley row to a ship the
// Dock never built. Then: every row of the table was fielded by SOME seat.
//
// HOW THE LADDER IS WALKED, without duplicating the chain tables. A train menu
// shows one entry per LINE and it is the newest rung the owner has researched
// (`latestResearchedInChain`). So a seat holding EVERY technology offers only
// the top of each line. Each pass therefore drives what is offered, then drops
// the gating technology of everything already covered — `${unit}-upgrade` where
// the table has one, plus `cannon-galleon-unlock` for the Cannon Galleon — and
// the next pass sees the rung below. That walks every line down to its base
// without this file holding a copy of the chains: a new rung inserted into a
// line is picked up automatically, and a rung whose gate is misnamed fails here
// by name. Civilizations are walked the same way as in the research half,
// because unique units and tech-tree holes are real content.
//
// TWO FIXTURES, because ships need water. Every land producer is read from
// `building-showcase-fixture`, which stands one completed building of every
// type; the Dock is read from `naval-imperial-fixture`, whose dock sits on a
// bay. The showcase's own dock has no water against it, so a ship queued there
// is charged and never spawns — which is why this file does not read it.
//
// BOUND — what a green run does NOT prove. Nothing about unit STATS, combat, or
// whether anything ever wants to train these; the per-unit tests own that. It
// drives each row in ONE age (the fixture's) at ONE civilization, so a row that
// is reachable only in some other age would still pass here. It does not check
// training TIME, rally points, or the production queue's ordering. It says
// nothing about POPULATION pressure: the seat deletes each unit as it lands, so
// a unit that could not be trained for want of houses in a real match is
// invisible here.
//
// COST: 30 s measured 2026-09-10 on a 32-core machine with the research,
// building and self-play gates running beside it; a second run of the same tree
// gave 53 s, so this is an order of magnitude and not a budget. Its own file so
// it runs beside them rather than after them.

import { describe, expect, it } from 'vitest';

import { TRAINABLE_UNITS_BY_BUILDING } from '../../src/game/simulation/buildingProductionTables';
import { effectiveTrainingCost } from '../../src/game/simulation/civBonusEffects';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { TRAINING_COSTS } from '../../src/game/simulation/trainingCosts';
import type {
  BuildingType,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../../src/game/simulation/types';
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
const NAVAL = 'naval-imperial-fixture';
const ALL_UNITS = Object.keys(TRAINING_COSTS) as TrainableUnitType[];
const ALL_TECHNOLOGIES = Object.keys(RESEARCH_COSTS) as ResearchableTechnologyType[];
const TRAIN_TIMEOUT_TICKS = 1500;

/** Which building hosts this unit, from the validator's own superset table. */
const PRODUCER_OF = new Map<TrainableUnitType, BuildingType>();
for (const [buildingType, units] of TRAINABLE_UNITS_BY_BUILDING) {
  for (const unit of units) if (!PRODUCER_OF.has(unit)) PRODUCER_OF.set(unit, buildingType);
}

/** The technology whose presence makes this unit the rung its line resolves to,
 *  derived from the tables rather than from a copy of the chains. */
function gateOf(unit: TrainableUnitType): ResearchableTechnologyType | null {
  const upgrade = `${unit}-upgrade` as ResearchableTechnologyType;
  if (upgrade in RESEARCH_COSTS) return upgrade;
  if (unit === 'cannon-galleon') return 'cannon-galleon-unlock';
  return null;
}

interface Fielded {
  civilization: string;
  buildingType: string;
  atRawTableRow: boolean;
}

const fielded = new Map<TrainableUnitType, Fielded>();

/** Every technology except the gates of units already fielded, so each line
 *  resolves one rung lower than last pass — and except Shipwright, which is the
 *  one technology that CHANGES a training price (-20% ship wood). Leaving it
 *  out is what lets every ship be charged its raw `TRAINING_COSTS` row instead
 *  of a discounted one; it gates no line, so dropping it costs no coverage. */
function seedFor(): ResearchableTechnologyType[] {
  const dropped = new Set<ResearchableTechnologyType>(['shipwright']);
  for (const unit of fielded.keys()) {
    const gate = gateOf(unit);
    if (gate) dropped.add(gate);
  }
  return ALL_TECHNOLOGIES.filter((tech) => !dropped.has(tech));
}

function ownedUnits(bridge: Bridge): Array<{ id: number; unitType: string }> {
  return bridge.getEconomyState().units
    .filter((unit) => unit.owner === 1)
    .map((unit) => ({ id: unit.id, unitType: unit.unitType }));
}

/** Drive every pending unit this seat offers, one per producer at a time,
 *  deleting each as it lands so population never becomes the limit. Returns
 *  how many rows it newly fielded. */
function pass(bridge: Bridge, civilization: string, onlyDock: boolean): number {
  const before = fielded.size;
  // The unit a dispatch is waiting on must be a NEW entity, never one that was
  // already standing: `naval-imperial-fixture` seeds owner 1 a Galley at boot,
  // and matching by unitType alone would credit the Galley row to a ship the
  // Dock never built.
  const inFlight = new Map<string, { unitType: TrainableUnitType; knownIds: Set<number> }>();

  for (;;) {
    const options = bridge.getAgentBuildingOptions(1);
    for (const entry of options.byBuildingType) {
      if (inFlight.has(entry.buildingType)) continue;
      if (onlyDock !== (entry.buildingType === 'dock')) continue;
      const unitType = entry.train.find((candidate) => !fielded.has(candidate));
      if (!unitType) continue;
      const label = `${unitType} at a ${civilization} ${entry.buildingType}`;
      expect(selectCompletedBuilding(bridge, entry.buildingType), `${label}: no completed producer to select`).toBe(true);
      const age = bridge.getEconomyState().ages[1]!;
      const techs = new Set(bridge.getResearchedTechnologies(1));
      const purse = purseOf(bridge);
      const knownIds = new Set(ownedUnits(bridge).map((unit) => unit.id));
      const accepted = bridge.queueTrainUnit(unitType);
      bridge.step(100);
      expect(accepted, `${label}: queue.train was refused although the producer offered it`).toBe(true);
      const rejection = bridge.consumeCommandRejection();
      expect(rejection, `${label}: the dispatcher rejected the command — ${String(rejection)}`).toBeNull();

      const declared = effectiveTrainingCost(civilization, age, unitType, techs);
      expectSpend(label, spentBetween(purse, purseOf(bridge)), declared);
      fielded.set(unitType, {
        civilization,
        buildingType: entry.buildingType,
        atRawTableRow:
          JSON.stringify(normalizeCost(declared))
          === JSON.stringify(normalizeCost(TRAINING_COSTS[unitType])),
      });
      inFlight.set(entry.buildingType, { unitType, knownIds });
    }
    if (inFlight.size === 0) break;

    const freshMatch = (
      units: Array<{ id: number; unitType: string }>,
      waiting: { unitType: TrainableUnitType; knownIds: Set<number> },
    ) => units.find((unit) => unit.unitType === waiting.unitType && !waiting.knownIds.has(unit.id));
    const landed = (): boolean => {
      const units = ownedUnits(bridge);
      for (const waiting of inFlight.values()) if (freshMatch(units, waiting)) return true;
      return false;
    };
    stepUntil(bridge, landed, TRAIN_TIMEOUT_TICKS, 10);
    const present = ownedUnits(bridge);
    let retired = 0;
    for (const [buildingType, waiting] of [...inFlight]) {
      const spawned = freshMatch(present, waiting);
      if (!spawned) continue;
      inFlight.delete(buildingType);
      retired += 1;
      // Delete it through the real `entity.delete` command so the next pass
      // starts from a clean population rather than from a growing army.
      expect(bridge.selectEntityById(spawned.id), `could not select the ${waiting.unitType} that just spawned`).toBe(true);
      bridge.deleteSelectedEntity();
      bridge.step(100);
    }
    expect(
      retired,
      `no NEW unit spawned inside ${String(TRAIN_TIMEOUT_TICKS)} ticks for ${civilization}: `
      + `still in flight ${[...inFlight.entries()].map(([b, w]) => `${w.unitType}@${b}`).join(' ')}`,
    ).toBeGreaterThan(0);
  }
  return fielded.size - before;
}

/** Walk one civilization's ladder down to its base rungs on one fixture. */
function walk(scenarioSeed: string, civilization: string, onlyDock: boolean, populationCap?: number): void {
  for (let step = 0; step < 12; step += 1) {
    const seat = standSeat({
      scenarioSeed, civilization, researched: seedFor(), age: 'imperial-age', populationCap,
    });
    if (pass(seat, civilization, onlyDock) === 0) return;
  }
}

describe('content pipeline — training', () => {
  it('offers, accepts, charges and spawns every TRAINING_COSTS row through queue.train', () => {
    const started = Date.now();
    const perCivilization: string[] = [];
    for (const civilization of CIVILIZATION_NAMES) {
      if (fielded.size >= ALL_UNITS.length) break;
      const before = fielded.size;
      walk(SHOWCASE, civilization, false, 500);
      walk(NAVAL, civilization, true, 500);
      if (fielded.size > before) perCivilization.push(`${civilization}+${String(fielded.size - before)}`);
    }

    const missing = ALL_UNITS.filter((unit) => !fielded.has(unit));
    const neverRaw = [...fielded].filter(([, entry]) => !entry.atRawTableRow).map(([unit]) => unit);
    console.log(
      `PIPELINE training: ${String(fielded.size)}/${String(ALL_UNITS.length)} rows fielded in `
      + `${((Date.now() - started) / 1000).toFixed(1)} s; ${perCivilization.join(' ')}`,
    );
    console.log(
      'PIPELINE training: rows only ever priced through a civilization bonus or Shipwright '
      + `(never charged the raw TRAINING_COSTS row): ${neverRaw.join(' ') || 'none'}`,
    );

    expect(
      missing,
      `these TRAINING_COSTS rows were never offered by any civilization's real train menu: ${missing.join(', ')}. `
      + `Their producers are ${missing.map((unit) => `${unit}→${String(PRODUCER_OF.get(unit))}`).join(', ')}. `
      + 'They are unreachable content, not a coverage shortfall.',
    ).toEqual([]);
  }, 900_000);
});
