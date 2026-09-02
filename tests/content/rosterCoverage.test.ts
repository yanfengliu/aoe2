// Progress against the WHOLE game, derived rather than remembered.
//
// `design/roadmap.md` carries the only measure of how much of Age of Empires
// II this project actually contains, and on 2026-09-02 its line was last
// derived at v0.3.70 — 116 versions stale, still claiming "naval 0" after the
// docks, ships, transports, fish traps and elite naval upgrades had all
// shipped. A number nobody can re-derive cheaply is a number that goes stale,
// so this test derives every figure from the CSVs and the runtime rosters and
// FAILS when the roadmap disagrees. Update the doc from the failure message.
//
// Four traps this encodes, each of which produced a wrong count before:
//  - `BuildingType` is a type ALIAS (`'town-center' | BuildableBuildingType`),
//    not a literal union, so nothing can be scraped out of `types.ts`. The
//    rosters here are runtime tables carrying `satisfies Record<…>` clauses,
//    which the compiler keeps exhaustive.
//  - Technologies named for what they UNLOCK or UPGRADE take a `-unlock` or
//    `-upgrade` slug ("Cannon Galleon" -> `cannon-galleon-unlock`), so a naive
//    slug diff reports implemented technologies as missing.
//  - `structures.csv` repeats each structure once per age — 60 rows, 28
//    names — so a row count is not a building count.
//  - Civilization bonuses are keyed by name in `CIV_BONUSES`
//    (`civBonusTable.ts`), NOT in `civBonusEffects.ts`, which derives from it.
//
// And it refuses to REPORT on an implausible parse, because a coverage number
// computed from a broken read is worse than no number at all.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { buildContentBundle } from '../../scripts/content-lib.mjs';
import { ALL_UNIT_TYPES } from '../../src/input/unitTypeMap';
import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import { CIV_BONUSES } from '../../src/game/simulation/civBonusTable';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';

const slug = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

interface Bundle {
  units: Array<{ name: string; sourceKind: string }>;
  technologies: Array<{ name: string }>;
  structures: Array<{ name: string }>;
  civilizations: unknown[];
}

// Structure rows that are UPGRADES of a building rather than buildings: they
// ship as technologies, and counting them as missing buildings overstated the
// remaining work by a factor of two when this was last derived by hand.
const STRUCTURE_UPGRADE_ROWS = new Set(['Fortified Wall', 'Guard Tower', 'Keep']);

// units.csv names the Scout "Scout Cavalry" (twice — a trainable row and a
// starting-unit row); the roster calls it `scout`.
const UNIT_NAME_ALIAS: Record<string, string> = { 'scout-cavalry': 'scout' };

describe('roster coverage against the full game', () => {
  const bundle = buildContentBundle() as unknown as Bundle;
  const unitRoster = new Set(Object.keys(ALL_UNIT_TYPES));
  const buildingRoster = new Set(Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS));
  const techRoster = new Set(Object.keys(RESEARCH_COSTS));

  it('reads its sources plausibly', () => {
    // Every assertion below is vacuous on a bad read, so the read is checked
    // first and in both directions — a roster that came back empty and a CSV
    // that came back short are the two ways this goes quietly wrong.
    expect(bundle.units.length).toBeGreaterThanOrEqual(100);
    expect(bundle.technologies.length).toBeGreaterThanOrEqual(130);
    expect(new Set(bundle.structures.map((row) => row.name)).size).toBeGreaterThanOrEqual(25);
    expect(bundle.civilizations.length).toBe(30);
    expect(unitRoster.size).toBeGreaterThanOrEqual(50);
    expect(buildingRoster.size).toBeGreaterThanOrEqual(20);
    expect(techRoster.size).toBeGreaterThanOrEqual(100);
    expect(CIVILIZATION_NAMES.length).toBe(30);
    expect(CIV_BONUSES.length).toBeGreaterThan(0);
  });

  it('matches the coverage line in design/roadmap.md', () => {
    const csvUnits = bundle.units.filter((unit) => unit.sourceKind === 'trainable'
      || unit.sourceKind === 'starting-unit');
    const unitSlug = (name: string): string => UNIT_NAME_ALIAS[slug(name)] ?? slug(name);
    const unitsIn = csvUnits.filter((unit) => unitRoster.has(unitSlug(unit.name)));
    // The REVERSE direction, because "93 of 95 covered" is compatible with a
    // roster entry matching two CSV rows while another matches none. Roster
    // entries with no CSV row are content the CSVs do not describe.
    const csvUnitSlugs = new Set(csvUnits.map((unit) => unitSlug(unit.name)));
    const rosterWithoutCsv = [...unitRoster].filter((entry) => !csvUnitSlugs.has(entry));
    // DISTINCT slugs, not rows: units.csv repeats a name (Scout Cavalry has a
    // trainable row and a starting-unit row), and counting rows inflates the
    // denominator exactly as counting structures.csv's per-age rows would.
    const unitsCovered = [...csvUnitSlugs].filter((entry) => unitRoster.has(entry)).length;

    const techIn = bundle.technologies.filter((tech) => {
      const base = slug(tech.name);
      return techRoster.has(base)
        || techRoster.has(`${base}-upgrade`)
        || techRoster.has(`${base}-unlock`)
        // "Plate Barding Armor" ships as `plate-barding`.
        || techRoster.has(base.replace(/-armor$/, ''));
    });

    const structureNames = [...new Set(bundle.structures.map((row) => row.name))]
      .filter((name) => !STRUCTURE_UPGRADE_ROWS.has(name));
    const structuresIn = structureNames.filter((name) => buildingRoster.has(
      // structures.csv calls the stone gate "Gate".
      name === 'Gate' ? 'stone-gate' : slug(name),
    ));

    const civsWithBonuses = new Set(CIV_BONUSES.map((entry) => entry.civilization));

    void unitsIn;
    const derived = `units ${String(unitsCovered)}/${String(csvUnitSlugs.size)}, `
      + `technologies ${String(techIn.length)}/${String(bundle.technologies.length)}, `
      + `buildings ${String(structuresIn.length)}/${String(structureNames.length)}, `
      + `${String(civsWithBonuses.size)} of ${String(CIVILIZATION_NAMES.length)} civilizations with active bonuses`;

    const roadmap = readFileSync('design/roadmap.md', 'utf-8');
    expect(
      roadmap.includes(derived),
      `design/roadmap.md does not carry the derived coverage line. Put this in it, verbatim:\n\n  ${derived}\n\n`
        + `Units NOT in the game (${String(csvUnits.length - unitsIn.length)}): `
        + `${csvUnits.filter((u) => !unitRoster.has(unitSlug(u.name))).map((u) => u.name).join(', ')}\n`
        + `Roster units with NO units.csv row (${String(rosterWithoutCsv.length)}): `
        + `${rosterWithoutCsv.join(', ')}\n`
        + `Technologies NOT in the game (${String(bundle.technologies.length - techIn.length)}): `
        + `${bundle.technologies.filter((t) => !techIn.includes(t)).map((t) => t.name).join(', ')}\n`
        + `Buildings NOT in the game (${String(structureNames.length - structuresIn.length)}): `
        + `${structureNames.filter((n) => !structuresIn.includes(n)).join(', ')}\n`
        + `Civilizations WITHOUT bonuses: `
        + `${CIVILIZATION_NAMES.filter((c) => !civsWithBonuses.has(c)).join(', ')}`,
    ).toBe(true);
  });
});
