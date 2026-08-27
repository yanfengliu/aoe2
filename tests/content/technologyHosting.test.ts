// Technology hosting gate (v0.3.133): every technologies.csv row's Building
// column must match the building our research tables host it at. Born from
// the absence-claim audit that found Guard Tower/Keep parked at the Watch
// Tower, Siege Engineers at the Siege Workshop, Sappers at the Blacksmith
// (which also had its scope wrong), and Chemistry at the Blacksmith — each
// under a claim the roster had outlived. This differential makes the whole
// class impossible: a hosting that drifts from the CSV fails here by name.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { RESEARCHES_BY_BUILDING } from '../../src/game/simulation/buildingProductionTables';

const slug = (value: string) => value.trim().toLowerCase().replace(/ /g, '-');

// CSV name → our tech id, where they differ by more than the slug.
const SLUG_ALIASES: Record<string, string> = {
  'plate-barding-armor': 'plate-barding',
  'cannon-galleon': 'cannon-galleon-unlock',
  'bombard-tower': 'bombard-tower-unlock',
};

// CSV rows deliberately unimplemented, each with its reason.
const INTENTIONALLY_ABSENT = new Set<string>([
  // Treason exists only in AoE2's Regicide mode, which this game does not play.
  'treason',
]);

describe('technologies.csv hosting differential', () => {
  const hostOf = new Map<string, string>();
  for (const [building, techs] of RESEARCHES_BY_BUILDING) {
    for (const tech of techs) hostOf.set(tech, building);
  }

  const rows = readFileSync('design/stats/technologies.csv', 'utf-8')
    .split('\n')
    .slice(1)
    .map((line) => line.split(','))
    .filter((cols) => cols.length >= 4 && cols[0]!.trim() && cols[3]!.trim());

  it('hosts every CSV technology at the CSV building', () => {
    const problems: string[] = [];
    for (const cols of rows) {
      const csvName = slug(cols[0]!);
      const csvBuilding = slug(cols[3]!);
      if (INTENTIONALLY_ABSENT.has(csvName)) continue;
      const ourId = SLUG_ALIASES[csvName] ?? csvName;
      const host = hostOf.get(ourId) ?? hostOf.get(`${ourId}-upgrade`);
      if (!host) {
        problems.push(`${csvName}: not hosted anywhere (csv says ${csvBuilding})`);
        continue;
      }
      if (host !== csvBuilding) {
        problems.push(`${csvName}: hosted at ${host}, csv says ${csvBuilding}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('the alias and absence lists stay honest (no dead entries)', () => {
    const csvNames = new Set(rows.map((cols) => slug(cols[0]!)));
    for (const alias of Object.keys(SLUG_ALIASES)) {
      expect(csvNames.has(alias), `alias for absent CSV row: ${alias}`).toBe(true);
    }
    for (const absent of INTENTIONALLY_ABSENT) {
      expect(csvNames.has(absent), `absence entry for absent CSV row: ${absent}`).toBe(true);
    }
  });
});
