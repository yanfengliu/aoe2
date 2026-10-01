// BOUND: all 44 supported trainable ranged attackers, their base accuracy and
// projectile wind-up only. Source fields are pinned DE 185872, not current DE
// forever. This does not check flight speed, burst arrows, contact wind-up,
// armor type, miss landing, or technology/civilization modifiers. Fire-ship
// flames have unused DE accuracy 0; their empty CSV cell means certain aim.
//
// The 2026-09-26 independent review found 19 runtime rows differing from DE.
// Seventeen already matched the stale CSV, so CSV->runtime alone hid them.
// The compact fixture promotes the exact source ID/name/fields; source->CSV
// and CSV->runtime must both agree, and source IDs prevent packed Trebuchet
// statistics from being used for unpacked shots. Whole-tick rounding is the
// precision available at 10 TPS; unchanged source decimals are kept in CSV.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildContentBundle } from '../../scripts/content-lib.mjs';
import { firesProjectile, projectileLaunchDelayTicks, unitAccuracy } from '../../src/game/simulation/projectileRules';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
import type { UnitType } from '../../src/game/simulation/types';

interface SourceRow {
  readonly id: UnitType;
  readonly name: string;
  readonly sourceId: number;
  readonly accuracyPercent: number | null;
  readonly attackDelaySeconds: number;
}
interface CsvRow {
  readonly id: string;
  readonly name: string;
  readonly trainable: boolean;
  readonly attack: number | null;
  readonly range: { readonly max: number | null };
  readonly accuracyPercent: number | null;
  readonly attackDelay: number | null;
}
const fixture = JSON.parse(readFileSync('tests/content/fixtures/deProjectileStats.json', 'utf8')) as {
  readonly source: string;
  readonly dataUrl: string;
  readonly dataSha256: string;
  readonly stringsUrl: string;
  readonly stringsSha256: string;
  readonly units: readonly SourceRow[];
};
const bundle = buildContentBundle() as { units: CsvRow[] };
const csv = bundle.units.filter((row) => row.trainable && (row.range.max ?? 0) > 0 && (row.attack ?? 0) > 0);
const sourceById = new Map(fixture.units.map((row) => [row.id, row]));

describe('supported projectile stats match pinned DE and the CSV', () => {
  it('retains independently pinned raw-source identity (offline metadata bound)', () => {
    // This pins metadata only; it does not fetch or re-hash network bytes in CI.
    expect(fixture).toMatchObject({
      dataUrl: 'https://raw.githubusercontent.com/SiegeEngineers/aoe2techtree/3bb43b14/data/data.json',
      dataSha256: '66a439979afe62f71541cff05280837abfb04e7732e364e2eae2f318862ade6d',
      stringsUrl: 'https://raw.githubusercontent.com/SiegeEngineers/aoe2techtree/3bb43b14/data/locales/en/strings.json',
      stringsSha256: '94f3077c8011ef3e57a2012d9cc7158499257b4c2dc8e5382c77e007249618b3',
    });
  });

  it('compares the entire scoped roster with a valid independent source', () => {
    expect(fixture.source).toContain('3bb43b14');
    expect(fixture.units).toHaveLength(44);
    expect(sourceById.size).toBe(44);
    expect(new Set(csv.map((row) => row.id))).toEqual(new Set(sourceById.keys()));
    expect(new Set((Object.keys(UNIT_MAX_HP) as UnitType[]).filter(firesProjectile))).toEqual(new Set(sourceById.keys()));
    expect(sourceById.get('archer')).toMatchObject({ sourceId: 4, accuracyPercent: 80, attackDelaySeconds: 0.35 });
    expect(sourceById.get('trebuchet')).toMatchObject({ sourceId: 42, accuracyPercent: 15, attackDelaySeconds: 0.88 });
    expect(fixture.units.filter((row) => row.accuracyPercent === null).map((row) => row.id)).toEqual(['fire-ship', 'fast-fire-ship']);
    expect(sourceById.has('definitely-not-a-unit' as UnitType)).toBe(false);
  });

  it('keeps CSV accuracy and attack_delay at the pinned source values', () => {
    const differences: string[] = [];
    for (const row of csv) {
      const source = sourceById.get(row.id as UnitType)!;
      if (row.accuracyPercent !== source.accuracyPercent) differences.push(`${row.name}: CSV accuracy ${String(row.accuracyPercent)} vs DE ${String(source.accuracyPercent)}`);
      if (row.attackDelay !== source.attackDelaySeconds) differences.push(`${row.name}: CSV delay ${String(row.attackDelay)} vs DE ${String(source.attackDelaySeconds)}`);
    }
    expect(differences, differences.join('\n')).toEqual([]);
  });

  it('uses every CSV accuracy and rounded wind-up in runtime projectile rules', () => {
    const differences: string[] = [];
    for (const row of csv) {
      const unit = row.id as UnitType;
      const expectedAccuracy = (row.accuracyPercent ?? 100) / 100;
      const expectedDelay = Math.round((row.attackDelay ?? 0) * TPS);
      if (unitAccuracy(unit) !== expectedAccuracy) differences.push(`${row.name}: accuracy ${String(unitAccuracy(unit))} vs CSV ${String(expectedAccuracy)}`);
      if (projectileLaunchDelayTicks(unit) !== expectedDelay) differences.push(`${row.name}: delay ${String(projectileLaunchDelayTicks(unit))} vs CSV ${String(expectedDelay)} ticks`);
    }
    expect(differences, differences.join('\n')).toEqual([]);
  });
});
