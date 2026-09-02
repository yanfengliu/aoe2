// Structure cost + build-time gate (2026-09-02): the two remaining columns of
// structures.csv that no test read, and the class behind play-opening.spec's
// F1/F3/F4 — a House priced at 30 wood in the CSV while the game charged 25,
// an Outpost at 10 stone against its own cited source's 5, and a Dark Age that
// ran at HALF DE's pace because BUILDING_BUILD_TIME_TICKS was hand-maintained
// (house 120 ticks = 12 s against the CSV's 25 s, Barracks 240 = 24 s vs 50,
// Town Center 300 = 30 s vs 150).
//
// The CSV is the source of truth (spec §1), so this test reads it as the
// spec and the runtime tables as the thing under test. Two traps it encodes:
// structures.csv is CRLF and repeats each structure once per age, so parsing
// goes through scripts/content-lib.mjs (itself gated by content-lib.test.ts)
// rather than a fresh split(','), and the per-age rows are checked against
// each other before either is compared with the runtime.
//
// It also refuses to REPORT on an implausible parse: a differential that
// silently reads zero rows is a green test that checks nothing.

import { describe, expect, it } from 'vitest';

import { buildContentBundle } from '../../scripts/content-lib.mjs';
import { buildingBuildTimeTicks } from '../../src/game/simulation/prototypeBuildingRules';
import { constructionCost } from '../../src/game/simulation/prototypeEconomyRules';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import type { BuildableBuildingType } from '../../src/game/simulation/types';

// CSV name -> roster slug. "Gate" is the stone gate; the palisade one has its
// own row. Fortified Wall / Guard Tower / Keep are UPGRADE rows (no building
// of their own) and are checked by structureStats.test.ts's HP chain instead.
const CSV_TO_SLUG: Record<string, BuildableBuildingType> = {
  'Town Center': 'town-center', House: 'house', Mill: 'mill',
  'Lumber Camp': 'lumber-camp', 'Mining Camp': 'mining-camp', Barracks: 'barracks',
  'Watch Tower': 'watch-tower', 'Bombard Tower': 'bombard-tower', Stable: 'stable',
  'Archery Range': 'archery-range', Blacksmith: 'blacksmith', Market: 'market',
  'Siege Workshop': 'siege-workshop', Monastery: 'monastery', University: 'university',
  Castle: 'castle', Wonder: 'wonder', 'Stone Wall': 'stone-wall',
  'Palisade Wall': 'palisade-wall', Gate: 'stone-gate', 'Palisade Gate': 'palisade-gate',
  Farm: 'farm', Dock: 'dock', Outpost: 'outpost', 'Fish Trap': 'fish-trap',
};
const UPGRADE_ROWS = new Set(['Fortified Wall', 'Guard Tower', 'Keep']);

const RESOURCE_KEYS: Record<string, 'food' | 'wood' | 'gold' | 'stone'> = {
  Food: 'food', Wood: 'wood', Gold: 'gold', Stone: 'stone',
};

// Key ORDER is not part of a cost. Comparing JSON.stringify directly made the
// Wonder row fail on {wood,gold,stone} vs {wood,stone,gold} alone.
const stable = (cost: Record<string, number>): string =>
  Object.entries(cost)
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => `${key}:${String(amount)}`)
    .join(',');

interface StructureRow {
  readonly name: string;
  readonly age: string;
  readonly cost: Record<string, number>;
  readonly buildTime: number | null;
}

describe('structures.csv cost and build-time differential', () => {
  const structures = (buildContentBundle() as { structures: StructureRow[] }).structures;

  // Instrument check first: every assertion below is vacuous on a bad parse.
  it('parses the structure table plausibly', () => {
    expect(structures.length).toBeGreaterThanOrEqual(55);
    expect(new Set(structures.map((row) => row.name)).size).toBeGreaterThanOrEqual(25);
    const unpriced = structures.filter((row) => Object.keys(row.cost).length === 0);
    expect(unpriced.map((row) => row.name)).toEqual([]);
    const untimed = structures.filter((row) => !row.buildTime || row.buildTime <= 0);
    expect(untimed.map((row) => row.name)).toEqual([]);
    expect(Object.keys(CSV_TO_SLUG).length + UPGRADE_ROWS.size).toBe(
      new Set(structures.map((row) => row.name)).size,
    );
  });

  it('prices every structure exactly as the CSV does', () => {
    const problems: string[] = [];
    for (const [csvName, slug] of Object.entries(CSV_TO_SLUG)) {
      const rows = structures.filter((row) => row.name === csvName);
      expect(rows.length, `${csvName}: no CSV row`).toBeGreaterThan(0);

      const distinct = new Set(rows.map((row) => stable(row.cost)));
      if (distinct.size > 1) {
        problems.push(`${csvName}: age rows disagree on cost — ${[...distinct].join(' vs ')}`);
        continue;
      }
      const expected: Record<string, number> = {};
      for (const [key, amount] of Object.entries(rows[0]!.cost)) {
        const resource = RESOURCE_KEYS[key];
        if (!resource) {
          problems.push(`${csvName}: unknown resource "${key}" in cost`);
          continue;
        }
        expected[resource] = amount;
      }
      const actual = constructionCost(slug) as Record<string, number>;
      if (stable(actual) !== stable(expected)) {
        problems.push(`${csvName} (${slug}): charges ${stable(actual)}, csv says ${stable(expected)}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('builds every structure in the CSV build time', () => {
    const problems: string[] = [];
    for (const [csvName, slug] of Object.entries(CSV_TO_SLUG)) {
      const rows = structures.filter((row) => row.name === csvName);
      const distinct = new Set(rows.map((row) => row.buildTime));
      if (distinct.size > 1) {
        problems.push(`${csvName}: age rows disagree on build_time — ${[...distinct].join(' vs ')}`);
        continue;
      }
      const expectedTicks = Math.round(rows[0]!.buildTime! * TPS);
      const actualTicks = buildingBuildTimeTicks(slug);
      if (actualTicks !== expectedTicks) {
        problems.push(
          `${csvName} (${slug}): ${String(actualTicks)} ticks (${String(actualTicks / TPS)} s), csv says ${String(expectedTicks)} (${String(rows[0]!.buildTime!)} s)`,
        );
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
