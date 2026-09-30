// Building line of sight against structures.csv (2026-09-24, defect register:
// "Only seven building types gave their owner any sight"). Until then the
// game's sight table was a hand-kept partial map of seven types, and every
// other building — the House, the Barracks, every camp, the walls — gave its
// owner no sight at all, so a raid on a lone House was drawn to nobody. Three
// of the seven values also disagreed with the CSV (Watch Tower 8, Castle 11,
// Wonder 7 against 10, 10 and 6), and the CSV itself disagreed with Definitive
// Edition on 18 rows; its line_of_sight column is DE's since this change (see
// the file's header).
//
// The CSV is the spec (§1), so this test reads it as the source of truth and
// the runtime table as the thing under test. Parsing goes through
// scripts/content-lib.mjs, because the file repeats each structure once per
// age and carries a comment header; the age rows are checked against each
// other before either is compared with the runtime.
//
// BOUND: this compares the game with the CSV, never with live DE. A later DE
// patch changes nothing here until the column is re-sourced against a newer
// pin. It checks the table, not what a building sees in play:
// tests/simulation/buildingVision.test.ts drives that.

import { describe, expect, it } from 'vitest';

import { buildContentBundle } from '../../scripts/content-lib.mjs';
import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import { buildingVisionRadius } from '../../src/game/simulation/prototypeBuildingRules';
import type { BuildingType } from '../../src/game/simulation/types';

// CSV name -> roster slug. "Gate" is the stone gate; the palisade one has its
// own row. Fortified Wall / Guard Tower / Keep are UPGRADE rows of a building
// that keeps its entity, so they are checked against that building below.
const CSV_TO_SLUG: Record<string, BuildingType> = {
  'Town Center': 'town-center', House: 'house', Mill: 'mill',
  'Lumber Camp': 'lumber-camp', 'Mining Camp': 'mining-camp', Barracks: 'barracks',
  'Watch Tower': 'watch-tower', 'Bombard Tower': 'bombard-tower', Stable: 'stable',
  'Archery Range': 'archery-range', Blacksmith: 'blacksmith', Market: 'market',
  'Siege Workshop': 'siege-workshop', Monastery: 'monastery', University: 'university',
  Castle: 'castle', Wonder: 'wonder', 'Stone Wall': 'stone-wall',
  'Palisade Wall': 'palisade-wall', Gate: 'stone-gate', 'Palisade Gate': 'palisade-gate',
  Farm: 'farm', Dock: 'dock', Outpost: 'outpost', 'Fish Trap': 'fish-trap',
};
// The upgrade rows name the building they upgrade. The game applies no line of
// sight change on those upgrades, so the CSV must give the upgrade the same
// value as its base; a DE patch that changed one would go red here and need
// the upgrade to carry it.
const UPGRADE_OF: Record<string, string> = {
  'Guard Tower': 'Watch Tower',
  Keep: 'Watch Tower',
  'Fortified Wall': 'Stone Wall',
};

interface StructureRow {
  readonly name: string;
  readonly age: string;
  readonly lineOfSight: number | null;
}

describe('structures.csv line of sight differential', () => {
  const structures = (buildContentBundle() as { structures: StructureRow[] }).structures;
  const rowsNamed = (name: string) => structures.filter((row) => row.name === name);

  // Instrument check first: every assertion below is vacuous on a bad parse.
  it('parses a line of sight for every row, and maps every roster building', () => {
    expect(structures.length).toBeGreaterThanOrEqual(55);
    const unread = structures.filter(
      (row) => row.lineOfSight === null || !Number.isFinite(row.lineOfSight),
    );
    expect(unread.map((row) => `${row.name} (${row.age})`)).toEqual([]);
    expect(Object.keys(CSV_TO_SLUG).length + Object.keys(UPGRADE_OF).length).toBe(
      new Set(structures.map((row) => row.name)).size,
    );
    // Every building type the game has is named by exactly one CSV row.
    const roster = Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS).sort();
    expect([...new Set(Object.values(CSV_TO_SLUG))].sort()).toEqual(roster);
  });

  it('gives every building type the CSV line of sight, in every age', () => {
    const problems: string[] = [];
    for (const [csvName, slug] of Object.entries(CSV_TO_SLUG)) {
      const rows = rowsNamed(csvName);
      expect(rows.length, `${csvName}: no CSV row`).toBeGreaterThan(0);
      const distinct = new Set(rows.map((row) => row.lineOfSight));
      if (distinct.size > 1) {
        problems.push(`${csvName}: age rows disagree on line_of_sight — ${[...distinct].join(' vs ')}`);
        continue;
      }
      const expected = rows[0]!.lineOfSight!;
      const actual = buildingVisionRadius(slug);
      if (actual !== expected) {
        problems.push(`${csvName} (${slug}): sees ${String(actual)}, csv says ${String(expected)}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('every building sees every cell beside it', () => {
    // A melee attacker stands on a cell that shares an edge with the
    // footprint, so every such cell's centre must lie within the building's
    // CSV line of sight of the footprint's centre (the rule sight is measured
    // by, spec §12.2). A 1x1 needs 1, a 2x2 1.58, a 3x3 2.24, a 4x4 2.92: a
    // House at sight 1 would see none of the eight cells beside it.
    const problems: string[] = [];
    for (const [csvName, slug] of Object.entries(CSV_TO_SLUG)) {
      // The smaller of the file's value and the game's, so a regression in
      // either one is caught here and not only by the equality above.
      const sight = Math.min(rowsNamed(csvName)[0]!.lineOfSight!, buildingVisionRadius(slug));
      const { width, height } = AUTHORITATIVE_BUILDING_FOOTPRINTS[slug];
      const cx = width / 2;
      const cy = height / 2;
      const beside: Array<[number, number]> = [];
      for (let x = 0; x < width; x += 1) beside.push([x, -1], [x, height]);
      for (let y = 0; y < height; y += 1) beside.push([-1, y], [width, y]);
      const unseen = beside.filter(([x, y]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > sight * sight);
      if (unseen.length > 0) {
        problems.push(`${csvName} (${String(width)}x${String(height)}, sight ${String(sight)}): ${String(unseen.length)} of ${String(beside.length)} cells beside it unseen`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('gives each upgrade row the line of sight of the building it upgrades', () => {
    const problems: string[] = [];
    for (const [upgrade, base] of Object.entries(UPGRADE_OF)) {
      const upgradeRows = rowsNamed(upgrade);
      const baseRows = rowsNamed(base);
      expect(upgradeRows.length, `${upgrade}: no CSV row`).toBeGreaterThan(0);
      for (const row of upgradeRows) {
        if (row.lineOfSight !== baseRows[0]!.lineOfSight) {
          problems.push(`${upgrade} (${row.age}): ${String(row.lineOfSight)} against ${base}'s ${String(baseRows[0]!.lineOfSight)}`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
