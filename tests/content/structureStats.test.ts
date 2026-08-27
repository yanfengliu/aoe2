// Structure-stat gate (v0.3.137): structures.csv hit points and garrison
// capacities against the building tables — the fourth and final content
// differential. Conventions encoded: the CSV row holds the IMPERIAL value
// (our per-age ladder's top step), and the Guard Tower / Keep rows are
// UPGRADE rows checked against the Masonry-seam multiplier chain over the
// Watch Tower rather than against buildings of their own.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  buildingGarrisonCapacity,
  buildingMaxHpForAge,
} from '../../src/game/simulation/prototypeBuildingRules';

const NAME_ALIAS: Record<string, string> = {
  'watch tower': 'watch-tower', 'town center': 'town-center', 'lumber camp': 'lumber-camp',
  'mining camp': 'mining-camp', 'siege workshop': 'siege-workshop', 'archery range': 'archery-range',
  'palisade wall': 'palisade-wall', 'stone wall': 'stone-wall', 'palisade gate': 'palisade-gate',
  'bombard tower': 'bombard-tower', 'fish trap': 'fish-trap',
};
// Upgrade rows: HP = watch-tower's Imperial value through the tech multipliers
// (buildingTechEffects' guard-tower/keep halves), garrison = the tower's own.
const TOWER_UPGRADE_ROWS: Record<string, number> = {
  'guard-tower': 1500 / 1020,
  keep: (1500 / 1020) * (2250 / 1500),
};
const slug = (value: string) => value.trim().toLowerCase().replace(/ /g, '-');

describe('structures.csv differential', () => {
  const rows = readFileSync('design/stats/structures.csv', 'utf-8').split('\n').slice(1);
  const seen = new Map<string, string[]>();
  for (const line of rows) {
    const cols = line.split(',');
    if (cols.length < 8) continue;
    const raw = cols[0]!.trim().toLowerCase();
    if (!raw) continue;
    seen.set(slug(NAME_ALIAS[raw] ?? raw), cols);
  }

  it('matches hit points and garrison capacity for every structure', () => {
    const problems: string[] = [];
    for (const [name, cols] of seen) {
      const csvHp = Number(cols[5]!.trim());
      if (TOWER_UPGRADE_ROWS[name]) {
        const chained = Math.round(
          buildingMaxHpForAge('watch-tower', 'imperial-age') * TOWER_UPGRADE_ROWS[name]!,
        );
        if (Number.isFinite(csvHp) && chained !== csvHp) {
          problems.push(`${name}: upgrade chain ${String(chained)} vs csv ${String(csvHp)}`);
        }
        const garrisonMatch = /Garrison (\d+)/i.exec(cols[11] ?? '');
        if (garrisonMatch && buildingGarrisonCapacity('watch-tower') !== Number(garrisonMatch[1])) {
          problems.push(`${name}: tower garrison ${String(buildingGarrisonCapacity('watch-tower'))} vs csv ${garrisonMatch[1]!}`);
        }
        continue;
      }
      let ourHp: number | undefined;
      try {
        ourHp = buildingMaxHpForAge(name as never, 'imperial-age');
      } catch {
        continue; // not a roster building
      }
      if (ourHp === undefined) continue;
      if (Number.isFinite(csvHp) && csvHp !== ourHp) {
        problems.push(`${name}: hp ${String(ourHp)} vs csv ${String(csvHp)}`);
      }
      const garrisonMatch = /Garrison (\d+)/i.exec(cols[11] ?? '');
      if (garrisonMatch) {
        const ours = buildingGarrisonCapacity(name as never);
        if (Number(garrisonMatch[1]) !== ours) {
          problems.push(`${name}: garrison ${String(ours)} vs csv ${garrisonMatch[1]!}`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
    expect(seen.size).toBeGreaterThanOrEqual(25);
  });
});
