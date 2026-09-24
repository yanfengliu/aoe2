// Train and research cost + time gate (2026-09-23): every price and every
// training or research time the game charges, against design/stats/units.csv
// and technologies.csv, row by row, with each deliberate difference named.
//
// Born from the 2026-09-23 blind-spot audit. Nothing compared these columns
// with the stats files, and 38 rows disagreed in 52 places: the Onager upgrade
// charged 500 WOOD where the CSV asks 500 gold, Guard Tower and Keep were
// priced in gold at a fraction of their cost, Paladin researched in 60 s
// against 170, Forging, Padded Archer Armor and Scale Barding Armor charged 50
// gold the CSV never asks for, and the Longbowman cost food instead of wood.
// The price checks that did exist (contentPipelineResearch/Training) take the
// expected price from RESEARCH_COSTS / TRAINING_COSTS — the tables the
// validator charges from — so they prove the wiring and never the number. This
// file reads the CSVs as the spec and the game's own accessors as the thing
// under test.
//
// The CSV wins, with one exception (spec §1, and the owner rule in local-rules
// "Behaviour matches the real Age of Empires II"): where a CSV row disagrees
// with Definitive Edition, DE wins, but only with evidence, and the difference
// is named below. With no DE value to set against it, the CSV wins outright:
// Berserkergang charges the CSV's price, because DE has no Berserkergang
// (Bogsveigar holds its slot). The evidence is the aoe2techtree dataset,
// generated from the DE game files, pinned at DE_SOURCE. Every named exception
// pins BOTH sides — what the CSV says today and what the game charges — so an
// exception is never a hole: the game must charge exactly the recorded DE
// value, and an entry goes red as soon as the CSV row changes under it (STALE)
// or comes to say what the game charges (DISSOLVED), which is how a re-source
// of the CSVs from DE deletes these entries rather than leaving them to rot.
//
// A differential is only as honest as its parser. The rows come from
// scripts/content-lib.mjs, the parser structureCostsAndBuildTimes uses, and a
// second, independent reading of every raw line (a regex over the cost blob
// and the number after it) must agree with it on every price and time before
// any comparison is trusted. A parse that reads zero rows, drops a resource,
// or shifts a column fails there by name instead of passing as "no problems".
//
// BOUND — what a green run does NOT prove.
//  - It compares BASE prices and times, before any civilization bonus,
//    technology discount (Shipwright, Conscription) or team bonus; those
//    layers have their own tests and are not read here.
//  - It does not prove the command path charges these prices; the
//    contentPipeline gates prove the charge equals the table, and this gate
//    proves the table equals the CSV. Neither half alone is the claim.
//  - It checks the game against the CSV, and against DE only through the
//    named exceptions. When this gate landed (2026-09-23), 97 rows on which
//    the game follows the CSV in full still differed from current DE, 117
//    fields in all: the CSVs are mostly Conquerors-era for costs and times.
//    That gap is the register's OPEN 2026-09-23 entry on the stats files,
//    and this file cannot see it.
//  - Six game technologies have no CSV row at all (TECHNOLOGIES_WITHOUT_ROW)
//    and are compared with nothing. Rows that nobody trains
//    (UNIT_ROWS_NOT_TRAINED) are not compared either.
//  - Spies is compared for its per-enemy-villager unit price only; the
//    dynamic total is spiesRules' own test.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildContentBundle } from '../../scripts/content-lib.mjs';
import {
  researchCost,
  researchTimeTicks,
  trainingCost,
  trainingTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { SPIES_GOLD_PER_ENEMY_VILLAGER } from '../../src/game/simulation/spiesRules';
import { TRAINABLE_UNIT_TYPES } from '../../src/game/simulation/trainingCosts';
import type { ResearchableTechnologyType, TrainableUnitType } from '../../src/game/simulation/types';

/** The DE evidence every exception cites, pinned so a later patch cannot move it silently. */
const DE_SOURCE = 'SiegeEngineers/aoe2techtree data/data.json at 3bb43b14 (2026-09-22, DE update 185872)';

type Resource = 'food' | 'wood' | 'gold' | 'stone';
type Cost = Partial<Record<Resource, number>>;
const RESOURCE: Record<string, Resource> = { Food: 'food', Wood: 'wood', Gold: 'gold', Stone: 'stone' };
/** The one non-resource key a priced row carries: Spies is 200 gold PER enemy villager. */
const PER_ENEMY_VILLAGER = 'Enemy Villager';

interface CostException { readonly csv: Cost; readonly game: Cost; readonly why: string }
interface TimeException { readonly csvSeconds: number; readonly gameSeconds: number; readonly why: string }
interface RowExceptions { readonly cost?: CostException; readonly time?: TimeException }

const PENDING = 'Pending the re-source of the stats files from DE, which makes the CSV agree and deletes this entry.';
const CSV_WRONG = 'The CSV row disagrees with DE and the game already charged DE\'s value, so it keeps it.';
const NEITHER = 'Neither the CSV nor the old table was DE\'s value, so the game moved to DE\'s.';

// Keyed by the game's technology id. Every value is DE's, from DE_SOURCE.
const TECHNOLOGY_EXCEPTIONS: Record<string, RowExceptions> = {
  'man-at-arms-upgrade': {
    cost: { csv: { food: 40, gold: 40 }, game: { food: 100, gold: 40 }, why: `${CSV_WRONG} DE: 100 food, 40 gold (${DE_SOURCE}). ${PENDING}` },
  },
  'chain-mail-armor': {
    cost: { csv: { food: 300, gold: 100 }, game: { food: 200, gold: 100 }, why: `${CSV_WRONG} DE: 200 food, 100 gold (${DE_SOURCE}). ${PENDING}` },
  },
  'arbalest-upgrade': {
    cost: { csv: { food: 350, gold: 300 }, game: { food: 450, gold: 350 }, why: `${NEITHER} Old table 300 food, 300 gold; DE: 450 food, 350 gold (${DE_SOURCE}). ${PENDING}` },
  },
  'champion-upgrade': {
    cost: { csv: { food: 750, gold: 350 }, game: { food: 650, gold: 350 }, why: `${NEITHER} Old table 1000 food, 450 gold; DE: 650 food, 350 gold (${DE_SOURCE}). ${PENDING}` },
    time: { csvSeconds: 100, gameSeconds: 70, why: `${NEITHER} Old table 55 s; DE: 70 s (${DE_SOURCE}). ${PENDING}` },
  },
  'two-handed-swordsman-upgrade': {
    time: { csvSeconds: 75, gameSeconds: 45, why: `${NEITHER} Old table 50 s; DE: 45 s (${DE_SOURCE}). ${PENDING}` },
  },
  'iron-casting': {
    time: { csvSeconds: 70, gameSeconds: 75, why: `${NEITHER} Old table 50 s; DE: 75 s (${DE_SOURCE}). ${PENDING}` },
  },
  'cavalier-upgrade': {
    time: { csvSeconds: 100, gameSeconds: 80, why: `${NEITHER} Old table 50 s; DE: 80 s (${DE_SOURCE}). ${PENDING}` },
  },
  'heavy-camel-upgrade': {
    time: { csvSeconds: 125, gameSeconds: 105, why: `${NEITHER} Old table 50 s; DE: 105 s (${DE_SOURCE}). ${PENDING}` },
  },
};

// Keyed by the game's unit id.
const UNIT_EXCEPTIONS: Record<string, RowExceptions> = {
  spearman: {
    cost: { csv: { food: 35, wood: 15 }, game: { food: 35, wood: 25 }, why: `${CSV_WRONG} DE: 35 food, 25 wood (${DE_SOURCE}). ${PENDING}` },
  },
  'heavy-cavalry-archer': {
    time: { csvSeconds: 27, gameSeconds: 30, why: `${NEITHER} Old table 34 s; DE: 30 s (${DE_SOURCE}). ${PENDING}` },
  },
  longbowman: {
    time: { csvSeconds: 19, gameSeconds: 18, why: `${NEITHER} Old table 30 s; DE: 18 s (${DE_SOURCE}). ${PENDING}` },
  },
  'elite-longbowman': {
    time: { csvSeconds: 19, gameSeconds: 18, why: `${NEITHER} Old table 30 s; DE: 18 s (${DE_SOURCE}). ${PENDING}` },
  },
};

// technologies.csv name slug -> game id, where they differ by more than the slug (technologyHosting's list).
const TECHNOLOGY_ALIASES: Record<string, string> = {
  'plate-barding-armor': 'plate-barding',
  'cannon-galleon': 'cannon-galleon-unlock',
  'bombard-tower': 'bombard-tower-unlock',
};
// technologies.csv rows the game deliberately does not implement.
const TECHNOLOGY_ROWS_ABSENT: Record<string, string> = {
  treason: 'Treason exists only in AoE2\'s Regicide mode, which this game does not play.',
};
// Game technologies technologies.csv has no row for: expansion-civilization
// unique technologies (register 2026-09-01, "the content gap is a DATA gap").
const TECHNOLOGIES_WITHOUT_ROW: Record<string, string> = {
  shatagni: 'Hindustani unique technology; no CSV row.',
  'recurve-bow': 'Magyar unique technology; no CSV row.',
  farimba: 'Malian unique technology; no CSV row.',
  kasbah: 'Berber unique technology; no CSV row.',
  sultans: 'Indian unique technology; no CSV row.',
  carrack: 'Portuguese unique technology; no CSV row.',
};
// units.csv name slug -> game id.
const UNIT_ALIASES: Record<string, string> = { 'scout-cavalry': 'scout' };
// units.csv rows nobody trains, by content-lib's id.
const UNIT_ROWS_NOT_TRAINED: Record<string, string> = {
  'eagle-warrior-starting': 'The free Eagle Warrior of a civilization with no Scout; the Castle-Age row is the trainable one.',
  'scout-cavalry-starting': 'The Scout every other civilization starts with; the Feudal row is the trainable one.',
  king: 'Regicide only; the CSV says it cannot be produced.',
  'trebuchet-packed': 'A state of the Trebuchet, not a unit of its own; the unpacked row prices it.',
  'wild-boar': 'Gaia.', deer: 'Gaia.', horse: 'Gaia.', sheep: 'Gaia.', turkey: 'Gaia.', wolf: 'Gaia.', jaguar: 'Gaia.',
};

interface StatRow {
  readonly id: string;
  readonly name: string;
  readonly cost: Record<string, unknown>;
  readonly buildTime: number | null;
  readonly trainable?: boolean;
}
const bundle = buildContentBundle() as { technologies: StatRow[]; units: StatRow[] };

const show = (cost: Cost): string =>
  Object.entries(cost)
    .filter(([, amount]) => amount)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resource, amount]) => `${String(amount)} ${resource}`)
    .join(' + ') || 'nothing';

/** The CSV cost in the game's resource names, less the per-villager marker. */
function csvCost(row: StatRow): Cost {
  const cost: Cost = {};
  for (const [key, amount] of Object.entries(row.cost)) {
    if (key === PER_ENEMY_VILLAGER) continue;
    cost[RESOURCE[key]!] = amount as number;
  }
  return cost;
}

function technologyId(row: StatRow): ResearchableTechnologyType | null {
  const base = TECHNOLOGY_ALIASES[row.id] ?? row.id;
  const plain = Object.hasOwn(RESEARCH_COSTS, base);
  const upgrade = Object.hasOwn(RESEARCH_COSTS, `${base}-upgrade`);
  if (plain && upgrade) throw new Error(`${row.name}: both ${base} and ${base}-upgrade are game technologies, so the row maps to two`);
  if (plain) return base as ResearchableTechnologyType;
  return upgrade ? (`${base}-upgrade` as ResearchableTechnologyType) : null;
}

function unitId(row: StatRow): TrainableUnitType | null {
  const id = UNIT_ALIASES[row.id] ?? row.id;
  return (TRAINABLE_UNIT_TYPES as readonly string[]).includes(id) ? (id as TrainableUnitType) : null;
}

const technologyRows = bundle.technologies.filter((row) => !Object.hasOwn(TECHNOLOGY_ROWS_ABSENT, row.id));
const unitRows = bundle.units.filter((row) => row.trainable);

/**
 * The second parser: each raw line's cost blob and the number after it, read
 * with two regexes and nothing else — no CSV splitting, no quote handling.
 */
function rawReading(file: string): Map<string, { cost: Record<string, number>; seconds: number }> {
  const out = new Map<string, { cost: Record<string, number>; seconds: number }>();
  for (const line of readFileSync(file, 'utf-8').split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const blob = /\{([^{}]*)\}\s*,\s*([\d.]+)/.exec(line);
    if (!blob) continue; // Gaia and starting rows nest braces or carry no price; they are not compared.
    const cost: Record<string, number> = {};
    for (const [, key, amount] of blob[1]!.matchAll(/"([^"]+)"\s*:\s*(\d+)/g)) cost[key!] = Number(amount);
    const name = line.split(',')[0]!.trim();
    out.set(`${name}@${String(out.size)}`, { cost, seconds: Number(blob[2]) });
  }
  return out;
}

describe('units.csv and technologies.csv cost and time differential', () => {
  it('reads both tables plausibly, and a second parser agrees on every price and time', () => {
    expect(technologyRows.length).toBeGreaterThanOrEqual(135);
    expect(unitRows.length).toBeGreaterThanOrEqual(90);
    const problems: string[] = [];
    for (const [file, rows] of [
      ['design/stats/technologies.csv', bundle.technologies],
      ['design/stats/units.csv', bundle.units.filter((row) => row.trainable)],
    ] as const) {
      const raw = [...rawReading(file).entries()];
      for (const row of rows) {
        const keys = Object.keys(row.cost);
        if (keys.length === 0) problems.push(`${file} ${row.name}: parsed no cost at all`);
        for (const key of keys) {
          const amount = row.cost[key];
          const known = Object.hasOwn(RESOURCE, key) || (key === PER_ENEMY_VILLAGER && row.id === 'spies');
          if (!known) problems.push(`${file} ${row.name}: unknown cost key "${key}"`);
          if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
            problems.push(`${file} ${row.name}: ${key} is ${JSON.stringify(amount)}, not a positive whole number`);
          }
        }
        if (!(typeof row.buildTime === 'number' && row.buildTime > 0)) {
          problems.push(`${file} ${row.name}: build_time is ${String(row.buildTime)}`);
        }
        // Both readers, the same row: the n-th raw line with this name.
        const sameName = raw.filter(([key]) => key.startsWith(`${row.name}@`));
        const twin = sameName.find(([, reading]) => JSON.stringify(Object.entries(reading.cost).sort()) === JSON.stringify(Object.entries(row.cost).sort()) && reading.seconds === row.buildTime);
        if (!twin) {
          problems.push(`${file} ${row.name}: content-lib read ${JSON.stringify(row.cost)} ${String(row.buildTime)} s; the raw line reads ${sameName.map(([, r]) => `${JSON.stringify(r.cost)} ${String(r.seconds)} s`).join(' or ') || 'nothing'}`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('accounts for every CSV row and every game entry, in both directions', () => {
    const problems: string[] = [];
    const technologiesSeen = new Map<string, string>();
    for (const row of technologyRows) {
      const id = technologyId(row);
      if (!id) { problems.push(`technologies.csv ${row.name}: no game technology (slug ${row.id})`); continue; }
      if (technologiesSeen.has(id)) problems.push(`${id}: priced by two rows, ${technologiesSeen.get(id)!} and ${row.name}`);
      technologiesSeen.set(id, row.name);
    }
    for (const id of Object.keys(RESEARCH_COSTS)) {
      if (technologiesSeen.has(id) === Object.hasOwn(TECHNOLOGIES_WITHOUT_ROW, id)) {
        problems.push(`${id}: ${technologiesSeen.has(id) ? 'has a CSV row AND is listed as having none' : 'has no CSV row and is not listed in TECHNOLOGIES_WITHOUT_ROW'}`);
      }
    }
    const unitsSeen = new Map<string, string>();
    for (const row of unitRows) {
      const id = unitId(row);
      if (!id) { problems.push(`units.csv ${row.name}: no game unit (slug ${row.id})`); continue; }
      if (unitsSeen.has(id)) problems.push(`${id}: priced by two rows`);
      unitsSeen.set(id, row.name);
    }
    for (const id of TRAINABLE_UNIT_TYPES) {
      if (!unitsSeen.has(id)) problems.push(`${id}: a game unit with no units.csv row`);
    }
    const notTrained = bundle.units.filter((row) => !row.trainable).map((row) => row.id).sort();
    expect(notTrained, 'units.csv rows classed as not trainable').toEqual(Object.keys(UNIT_ROWS_NOT_TRAINED).sort());
    // No dead entries in the name lists.
    const csvTechSlugs = new Set(bundle.technologies.map((row) => row.id));
    for (const slug of [...Object.keys(TECHNOLOGY_ALIASES), ...Object.keys(TECHNOLOGY_ROWS_ABSENT)]) {
      if (!csvTechSlugs.has(slug)) problems.push(`list entry for a technologies.csv row that does not exist: ${slug}`);
    }
    for (const id of Object.keys(TECHNOLOGIES_WITHOUT_ROW)) {
      if (!Object.hasOwn(RESEARCH_COSTS, id)) problems.push(`TECHNOLOGIES_WITHOUT_ROW names ${id}, which is not a game technology`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('charges every technology what technologies.csv says, or its named exception', () => {
    const problems: string[] = [];
    for (const row of technologyRows) {
      const id = technologyId(row);
      if (!id) continue; // named by the accounting case above
      const expected = TECHNOLOGY_EXCEPTIONS[id]?.cost?.game ?? csvCost(row);
      const actual = researchCost(id) as Cost;
      if (show(actual) !== show(expected)) {
        problems.push(`${row.name} (${id}): charges ${show(actual)}, ${TECHNOLOGY_EXCEPTIONS[id]?.cost ? 'its named exception says' : 'technologies.csv says'} ${show(expected)}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('researches every technology in the technologies.csv time, or its named exception', () => {
    const problems: string[] = [];
    for (const row of technologyRows) {
      const id = technologyId(row);
      if (!id) continue; // named by the accounting case above
      const seconds = TECHNOLOGY_EXCEPTIONS[id]?.time?.gameSeconds ?? row.buildTime!;
      const actual = researchTimeTicks(id);
      if (actual !== Math.round(seconds * TPS)) {
        problems.push(`${row.name} (${id}): ${String(actual)} ticks (${String(actual / TPS)} s), ${TECHNOLOGY_EXCEPTIONS[id]?.time ? 'its named exception says' : 'technologies.csv says'} ${String(seconds)} s`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('charges every unit what units.csv says, or its named exception', () => {
    const problems: string[] = [];
    for (const row of unitRows) {
      const id = unitId(row);
      if (!id) continue; // named by the accounting case above
      const expected = UNIT_EXCEPTIONS[id]?.cost?.game ?? csvCost(row);
      const actual = trainingCost(id) as Cost;
      if (show(actual) !== show(expected)) {
        problems.push(`${row.name} (${id}): charges ${show(actual)}, ${UNIT_EXCEPTIONS[id]?.cost ? 'its named exception says' : 'units.csv says'} ${show(expected)}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('trains every unit in the units.csv time, or its named exception', () => {
    const problems: string[] = [];
    for (const row of unitRows) {
      const id = unitId(row);
      if (!id) continue; // named by the accounting case above
      const seconds = UNIT_EXCEPTIONS[id]?.time?.gameSeconds ?? row.buildTime!;
      const actual = trainingTimeTicks(id);
      if (actual !== Math.round(seconds * TPS)) {
        problems.push(`${row.name} (${id}): ${String(actual)} ticks (${String(actual / TPS)} s), ${UNIT_EXCEPTIONS[id]?.time ? 'its named exception says' : 'units.csv says'} ${String(seconds)} s`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('keeps every named exception live and sourced: the CSV still says what it records, and still disagrees', () => {
    const problems: string[] = [];
    const check = (file: string, rows: readonly StatRow[], idOf: (row: StatRow) => string | null, table: Record<string, RowExceptions>) => {
      for (const [id, exceptions] of Object.entries(table)) {
        const row = rows.find((candidate) => idOf(candidate) === id);
        if (!row) { problems.push(`${file}: an exception names ${id}, which no row prices`); continue; }
        if (exceptions.cost) {
          const { csv, game, why } = exceptions.cost;
          const now = show(csvCost(row));
          if (now === show(game)) problems.push(`${id} cost: DISSOLVED — the CSV now says what the game charges (${now}); delete the exception`);
          else if (now !== show(csv)) problems.push(`${id} cost: STALE — the exception records the CSV as ${show(csv)}, the CSV now says ${now}; re-read the row`);
          if (show(csv) === show(game)) problems.push(`${id} cost: MALFORMED — the exception records the same value on both sides`);
          if (!why.includes('3bb43b14')) problems.push(`${id} cost: the reason does not cite the pinned DE source`);
        }
        if (exceptions.time) {
          const { csvSeconds, gameSeconds, why } = exceptions.time;
          if (row.buildTime === gameSeconds) problems.push(`${id} time: DISSOLVED — the CSV now says what the game takes (${String(gameSeconds)} s); delete the exception`);
          else if (row.buildTime !== csvSeconds) problems.push(`${id} time: STALE — the exception records the CSV as ${String(csvSeconds)} s, the CSV now says ${String(row.buildTime)} s; re-read the row`);
          if (csvSeconds === gameSeconds) problems.push(`${id} time: MALFORMED — the exception records the same value on both sides`);
          if (!why.includes('3bb43b14')) problems.push(`${id} time: the reason does not cite the pinned DE source`);
        }
      }
    };
    check('technologies.csv', technologyRows, technologyId, TECHNOLOGY_EXCEPTIONS);
    check('units.csv', unitRows, unitId, UNIT_EXCEPTIONS);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('prices Spies per enemy villager, at the gold its CSV row names', () => {
    const spies = bundle.technologies.find((row) => row.id === 'spies')!;
    expect(spies.cost[PER_ENEMY_VILLAGER], 'the Spies row no longer prices per enemy villager').toBe(1);
    expect(SPIES_GOLD_PER_ENEMY_VILLAGER).toBe(spies.cost.Gold);
  });
});
