// Train and research cost + time gate (2026-09-23): every price and every
// training or research time the game charges, against design/stats/units.csv
// and technologies.csv, row by row.
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
// The CSV is the authority, and since 2026-09-23 its cost and time columns are
// Definitive Edition's, re-sourced from the aoe2techtree dataset (generated from
// the DE game files) at the revision pinned in each CSV's header. Where a CSV
// row disagrees with DE and the evidence is in hand, DE wins (spec §1): the row
// is re-sourced, never charged differently from what the file says. The gate
// landed with 13 named exceptions for fields the game had already moved to DE;
// the re-source dissolved every one (each went red as DISSOLVED, as designed),
// and the mechanism went with them: git history has it, with its mutation
// proofs, if a deliberate difference from the file is ever needed again.
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
//  - It checks the game against the CSV, never against DE directly: the CSV is
//    DE only as of its pinned revision, and a later DE patch moves nothing
//    here until the file is re-sourced. Rows DE has no price for keep their
//    earlier values, and the CSV's header names them.
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

type Resource = 'food' | 'wood' | 'gold' | 'stone';
type Cost = Partial<Record<Resource, number>>;
const RESOURCE: Record<string, Resource> = { Food: 'food', Wood: 'wood', Gold: 'gold', Stone: 'stone' };
/** The one non-resource key a priced row carries: Spies is 200 gold PER enemy villager. */
const PER_ENEMY_VILLAGER = 'Enemy Villager';

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
  for (const line of readFileSync(file, 'utf-8').split(/\r?\n/).filter((row) => !row.trimStart().startsWith('#')).slice(1)) {
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

  it('charges every technology what technologies.csv says', () => {
    const problems: string[] = [];
    for (const row of technologyRows) {
      const id = technologyId(row);
      if (!id) continue; // named by the accounting case above
      const expected = csvCost(row);
      const actual = researchCost(id) as Cost;
      if (show(actual) !== show(expected)) {
        problems.push(`${row.name} (${id}): charges ${show(actual)}, technologies.csv says ${show(expected)}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('researches every technology in the technologies.csv time', () => {
    const problems: string[] = [];
    for (const row of technologyRows) {
      const id = technologyId(row);
      if (!id) continue; // named by the accounting case above
      const seconds = row.buildTime!;
      const actual = researchTimeTicks(id);
      if (actual !== Math.round(seconds * TPS)) {
        problems.push(`${row.name} (${id}): ${String(actual)} ticks (${String(actual / TPS)} s), technologies.csv says ${String(seconds)} s`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('charges every unit what units.csv says', () => {
    const problems: string[] = [];
    for (const row of unitRows) {
      const id = unitId(row);
      if (!id) continue; // named by the accounting case above
      const expected = csvCost(row);
      const actual = trainingCost(id) as Cost;
      if (show(actual) !== show(expected)) {
        problems.push(`${row.name} (${id}): charges ${show(actual)}, units.csv says ${show(expected)}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('trains every unit in the units.csv time', () => {
    const problems: string[] = [];
    for (const row of unitRows) {
      const id = unitId(row);
      if (!id) continue; // named by the accounting case above
      const seconds = row.buildTime!;
      const actual = trainingTimeTicks(id);
      if (actual !== Math.round(seconds * TPS)) {
        problems.push(`${row.name} (${id}): ${String(actual)} ticks (${String(actual / TPS)} s), units.csv says ${String(seconds)} s`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('prices Spies per enemy villager, at the gold its CSV row names', () => {
    const spies = bundle.technologies.find((row) => row.id === 'spies')!;
    expect(spies.cost[PER_ENEMY_VILLAGER], 'the Spies row no longer prices per enemy villager').toBe(1);
    expect(SPIES_GOLD_PER_ENEMY_VILLAGER).toBe(spies.cost.Gold);
  });
});
