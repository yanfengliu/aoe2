// Denial-table gate (v0.3.138): design/stats/tech-tree.csv is the spec of
// record for per-civilization tech-tree holes. This guards its integrity —
// every id it names must be a REAL technology, unit, or building (a typo'd
// denial silently allows), the runtime's embedded copy must be byte-
// identical to the CSV, and every roster civilization must have a row (a
// civilization with no holes at all does not exist in AoE2).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { EMBEDDED_TABLE, deniedIdsFor } from '../../src/game/simulation/civTechTree';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { UNIT_ARMOR_CLASSES } from '../../src/game/simulation/prototypeUnitRules/armorClasses';
import { constructionCost } from '../../src/game/simulation/prototypeEconomyRules';

// Every buildable id, probed through the cost table (throws on non-buildables).
const BUILDABLE_IDS = [
  'town-center', 'house', 'mill', 'lumber-camp', 'mining-camp', 'farm', 'dock',
  'barracks', 'archery-range', 'stable', 'siege-workshop', 'blacksmith',
  'market', 'monastery', 'university', 'castle', 'watch-tower', 'bombard-tower',
  'outpost', 'palisade-wall', 'palisade-gate', 'stone-wall', 'stone-gate',
  'fish-trap', 'wonder',
].filter((id) => {
  try {
    return constructionCost(id as never) !== undefined;
  } catch {
    return false;
  }
});

describe('the denial table', () => {
  it('matches the CSV byte for byte (minus the CSV header comments)', () => {
    const normalize = (raw: string) => raw
      .replace(/\r/g, '')
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .join('\n')
      .trim();
    const csv = normalize(readFileSync('design/stats/tech-tree.csv', 'utf-8'));
    expect(normalize(EMBEDDED_TABLE)).toBe(csv);
  });

  it('names only real technologies, units, and buildings', () => {
    const valid = new Set<string>([
      ...Object.keys(RESEARCH_COSTS),
      ...Object.keys(UNIT_ARMOR_CLASSES),
      ...BUILDABLE_IDS,
    ]);
    const problems: string[] = [];
    for (const civilization of CIVILIZATION_NAMES) {
      for (const id of deniedIdsFor(civilization)) {
        if (!valid.has(id)) problems.push(`${civilization}: unknown id "${id}"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('covers every roster civilization', () => {
    for (const civilization of CIVILIZATION_NAMES) {
      expect(
        deniedIdsFor(civilization).size,
        `${civilization} has no denial row`,
      ).toBeGreaterThan(0);
    }
  });
});
