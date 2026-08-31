// What the twelve expansion civilizations are still missing, as a CHECKED list.
//
// All 19 original civilizations have their unique unit and unique technology.
// The 12 added by the expansions — Berbers, Burmese, Ethiopians, Incas,
// Indians, Italians, Khmer, Magyars, Malians, Portuguese, Slavs, Vietnamese —
// arrived with 17 unique units and 22 unique technologies, none implemented.
//
// This exists because the gap was carried in prose and the prose was WRONG: an
// audit recorded it as "~41 unwritten CSV rows", when the CSV is complete for
// all 30 civilizations and the gap is entirely in the code. A list nobody
// checks drifts. It is a LEDGER rather than a bar — the missing set must equal
// what is written here, so closing one forces a visible edit, and nothing can
// silently fall OUT of the implemented set either.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { UNIQUE_TECHNOLOGIES } from '../../src/game/simulation/uniqueTechnologies';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { TRAINABLE_UNITS_BY_BUILDING } from '../../src/game/simulation/buildingProductionTables';

// The AUTHORITATIVE registries, not a text scan. A scan over every
// single-quoted identifier in src reported Howdah and Pavise as implemented —
// they appear only in the voxel visual profiles and humanoid recipes, because
// a howdah is the platform on an elephant and a pavise is a shield. Two render
// PART names that collide with two technology names, and a text scan cannot
// tell the difference. What makes a technology real is a cost the validator
// can charge; what makes a unit real is a building that can train it.
const RESEARCHABLE = new Set<string>(Object.keys(RESEARCH_COSTS));
const TRAINABLE = new Set<string>(
  [...TRAINABLE_UNITS_BY_BUILDING.values()].flatMap((units) => [...units] as string[]),
);

const slug = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The CSV is the authority for WHICH unique units and technologies exist. */
function csvRows(): Array<{ civ: string; units: string[]; techs: string[] }> {
  const text = readFileSync(join(process.cwd(), 'design/stats/civilizations.csv'), 'utf8');
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header!.split(',').map((c) => c.trim());
  const unitAt = cols.indexOf('unique_unit');
  const techAt = cols.indexOf('unique_tech');
  const split = (cell: string | undefined) =>
    (cell ?? '').split(';').map((x) => x.trim()).filter(Boolean);
  return lines.map((line) => {
    const cells = line.split(',');
    return { civ: (cells[0] ?? '').trim(), units: split(cells[unitAt]), techs: split(cells[techAt]) };
  });
}

// The ledger. Closing an entry means deleting its line here.
const MISSING_UNITS: readonly string[] = [
  'Camel Archer', 'Genitour', 'Arambai', 'Shotel Warrior', 'Kamayuk', 'Slinger',
  'Elephant Archer', 'Imperial Camel', 'Genoese Crossbowman', 'Condottiero',
  'Ballista Elephant', 'Magyar Huszar', 'Gbeto', 'Caravel', 'Organ Gun',
  'Boyars', 'Rattan Archer',
];

const MISSING_TECHS: readonly string[] = [
  'Maghrabi Camels', 'Howdah', 'Manipur Cavalry', 'Royal Heirs', 'Torsion Engines',
  'Couriers', 'Andean Sling', 'Sultans', 'Pavise', 'Silk Road', 'Tusk Swords',
  'Double Crossbow', 'Mercenaries', 'Tigui', 'Carrack', 'Arquebus',
  'Orthodoxy', 'Druzhina', 'Chatras', 'Paper Money',
];

describe('the expansion civilizations content ledger', () => {
  const rows = csvRows();

  it('reads a CSV that is COMPLETE — the gap is in the code, not the data', () => {
    expect(rows.length).toBe(30);
    for (const row of rows) {
      expect(row.units.length, `${row.civ} has no unique unit in the CSV`).toBeGreaterThan(0);
      expect(row.techs.length, `${row.civ} has no unique tech in the CSV`).toBeGreaterThan(0);
    }
  });

  it('is missing exactly the unique UNITS named in the ledger', () => {
    const missing = rows.flatMap((r) => r.units).filter((u) => !TRAINABLE.has(slug(u)));
    expect(new Set(missing)).toEqual(new Set(MISSING_UNITS));
  });

  it('is missing exactly the unique TECHNOLOGIES named in the ledger', () => {
    const missing = rows.flatMap((r) => r.techs).filter((t) => !RESEARCHABLE.has(slug(t)));
    expect(new Set(missing)).toEqual(new Set(MISSING_TECHS));
  });

  it('proves the registries answer, so an empty result is a real answer', () => {
    // The measurement behind this ledger was wrong four times before it was
    // right: scoped to one file; then twice because Windows stripped the quotes
    // from a grep pattern so it matched bare word fragments like "olves" out of
    // "Wolves"; then a whole-source text scan that could not tell a technology
    // from a render part. A probe that finds nothing is a claim about the query.
    expect(TRAINABLE.has('jaguar-warrior'), 'known-trainable unit not found').toBe(true);
    expect(RESEARCHABLE.has('el-dorado'), 'known-researchable tech not found').toBe(true);
    expect(RESEARCHABLE.has('definitely-not-a-real-identifier')).toBe(false);
    // And the two that fooled the text scan.
    expect(RESEARCHABLE.has('howdah'), 'Howdah is a render part, not a technology').toBe(false);
    expect(RESEARCHABLE.has('pavise'), 'Pavise is a render part, not a technology').toBe(false);
  });

  it('has closed the expansion technologies it claims to have closed', () => {
    for (const name of ['Shatagni', 'Recurve Bow', 'Farimba', 'Kasbah']) {
      expect(MISSING_TECHS, `${name} is both closed and listed as missing`).not.toContain(name);
      expect(
        UNIQUE_TECHNOLOGIES.some((tech) => tech.name === name),
        `${name} is not in UNIQUE_TECHNOLOGIES`,
      ).toBe(true);
    }
  });
});
