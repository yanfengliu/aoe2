// Base-stat gate (v0.3.136): every units.csv numeric column — hit points,
// attack, melee/pierce armor, range — must match our stat tables. Born from
// the differential that found the militia line's HP running 5 high across
// three tiers, the Elite Longbowman two range short of its identity, the
// Siege Ram an attack point light, the Scout's hidden Feudal +2 unmodeled,
// and Petard/Trade Cog armor TRANSPOSED between the melee and pierce tables.
// Conventions the model owns are encoded, not excepted silently.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { UNIT_ARMOR_CLASSES } from '../../src/game/simulation/prototypeUnitRules/armorClasses';
import {
  unitMeleeArmor, unitPierceArmor, unitAttackDamage, unitMaxHp, unitAttackRange, unitMinAttackRange,
} from '../../src/game/simulation/prototypeUnitRules';
import { ageScaledUnitAttack } from '../../src/game/simulation/ageScaledHp';

const NAME_ALIAS: Record<string, string> = { 'scout cavalry': 'scout' };
const slug = (value: string) => value.trim().toLowerCase().replace(/ /g, '-');

describe('units.csv base-stat differential', () => {
  const roster = new Set(Object.keys(UNIT_ARMOR_CLASSES));
  const rows = readFileSync('design/stats/units.csv', 'utf-8').split('\n')
    .filter((line) => !line.trimStart().startsWith('#')).slice(1);
  const perUnit = new Map<string, string[]>();
  for (const line of rows) {
    const cols = line.split(',');
    if (cols.length < 17) continue;
    const raw = cols[0]!.trim().toLowerCase();
    const name = slug(NAME_ALIAS[raw] ?? raw);
    if (!roster.has(name as never)) continue;
    perUnit.set(name, cols); // last row per name = the trainable tier
  }

  it('matches hit points, attack, armor, and range for every unit', () => {
    const problems: string[] = [];
    for (const [unit, cols] of perUnit) {
      const u = unit as never;
      const hp = Number(cols[11]!.trim());
      if (Number.isFinite(hp) && unitMaxHp(u) !== hp) {
        problems.push(`${unit}: hp ${String(unitMaxHp(u))} vs csv ${String(hp)}`);
      }
      // Attack: age-conditional units compare their top-age value (the CSV's
      // last row is the from-Feudal tier); everyone else the flat table.
      const attack = Number(cols[13]!.trim());
      const oursAttack = ageScaledUnitAttack(u, 'imperial-age') ?? unitAttackDamage(u);
      if (Number.isFinite(attack) && oursAttack !== attack) {
        problems.push(`${unit}: attack ${String(oursAttack)} vs csv ${String(attack)}`);
      }
      // Armor "melee/pierce": our melee table holds the EFFECTIVE value —
      // base plus any '-N melee' entry from the armor_bonus column (rams).
      const [meleeStr, pierceStr] = cols[14]!.trim().split('/');
      const meleeBonusMatch = /(-?\d+)\s+melee/.exec(cols[16] ?? '');
      const effectiveMelee = Number(meleeStr) + (meleeBonusMatch ? Number(meleeBonusMatch[1]) : 0);
      if (Number.isFinite(effectiveMelee) && unitMeleeArmor(u) !== effectiveMelee) {
        problems.push(`${unit}: melee armor ${String(unitMeleeArmor(u))} vs csv ${String(effectiveMelee)}`);
      }
      const pierce = Number(pierceStr);
      if (Number.isFinite(pierce) && unitPierceArmor(u) !== pierce) {
        problems.push(`${unit}: pierce armor ${String(unitPierceArmor(u))} vs csv ${String(pierce)}`);
      }
      // Range: "a-b" rows use the max; melee rows (csv 0) are 1 in our grid
      // (adjacent-cell reach); fractional ranges floor to the grid.
      const rangeRaw = cols[12]!.trim();
      const csvRange = rangeRaw.includes('-') ? Number(rangeRaw.split('-')[1]) : Number(rangeRaw);
      const expectedRange = csvRange === 0 ? 1 : Math.floor(csvRange);
      if (Number.isFinite(csvRange) && unitAttackRange(u) !== expectedRange) {
        problems.push(`${unit}: range ${String(unitAttackRange(u))} vs csv ${String(csvRange)} (expect ${String(expectedRange)})`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  // The minimum range (defect register, 2026-09-26, "The Siege Onager, the
  // Capped Ram and the Elite Skirmisher were left out of tables that named the
  // rest of their line"): a "min-max" range gives the minimum before the dash,
  // and the check above reads only the maximum. Seven rows' minimums were not
  // in the game — the Skirmisher line's 1, the Scorpion line's 2, the Cannon
  // Galleon line's 3 and the Trebuchet's 4 — so each fired point-blank.
  // Definitive Edition agrees with every one of the eleven rows (SiegeEngineers/
  // aoe2techtree data/data.json at 3bb43b14, DE update 185872, `MinRange`), so
  // there is no DE exception. If one is ever needed, it goes in a list here that
  // names its source and that this test fails on once the game and the CSV
  // agree again, as the price gate's exceptions did until v0.3.228.
  it('matches the minimum range of every "min-max" row, and gives no other unit one', () => {
    const problems: string[] = [];
    for (const [unit, cols] of perUnit) {
      const rangeRaw = cols[12]!.trim();
      const csvMinimum = rangeRaw.includes('-') ? Number(rangeRaw.split('-')[0]) : 0;
      if (unitMinAttackRange(unit as never) !== csvMinimum) {
        problems.push(`${unit}: minimum range ${String(unitMinAttackRange(unit as never))} vs csv "${rangeRaw}" (expect ${String(csvMinimum)})`);
      }
    }
    // A minimum on a unit the CSV has no row for is one nothing above checks.
    for (const unit of roster) {
      if (!perUnit.has(unit) && unitMinAttackRange(unit as never) > 0) {
        problems.push(`${unit}: minimum range ${String(unitMinAttackRange(unit as never))} but units.csv has no row for it`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
    // The instrument: the rows it compares include every minimum the CSV gives.
    const minimumRows = [...perUnit.values()].filter((cols) => cols[12]!.includes('-'));
    expect(minimumRows.length, 'units.csv rows with a "min-max" range').toBeGreaterThanOrEqual(11);
  });
});
