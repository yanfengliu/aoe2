// Attack-bonus gate (v0.3.134): every units.csv attack_bonus entry must be
// modeled — as an armor-class bonus in UNIT_ATTACK_BONUSES or, for
// '+N buildings', in the building table. Born from the audit that found the
// ENTIRE naval bonus fabric missing (the galley line's +8/+9/+11 vs ships is
// naval combat's identity), plus petard, camels, four eagle rows, and ram
// building values. Deferred token groups and the one documented ambiguity
// are named here, so any future CSV edit or roster growth that drops a
// bonus fails by name.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { UNIT_ARMOR_CLASSES, UNIT_ATTACK_BONUSES } from '../../src/game/simulation/prototypeUnitRules/armorClasses';
import { attackBonusAgainstBuilding } from '../../src/game/simulation/prototypeUnitRules';

const TOKEN_TO_CLASS: Record<string, string | string[]> = {
  eagles: 'eagle', spearmen: 'spearman', siege: 'siege', rams: 'ram', ram: 'ram',
  infantry: 'infantry', cavalry: 'cavalry', monks: 'monk',
  'ships/camels': ['ship', 'camel'], 'camels/ships': ['camel', 'ship'], 'ship/camel': ['ship', 'camel'],
  ships: 'ship', archers: 'archer', 'unique units': 'unique-unit',
  'war elephants': 'war-elephant', 'turtle ships': 'turtle-ship',
  'archers/hand cannoneers': 'archer',
  'archers/hand cannon/skirms/conquistadors': 'archer',
  'against cavalry': 'cavalry', 'against cavalry archers': 'cavalry-archer',
};

// Token groups deliberately not modeled, each with its reason.
const DEFERRED_TOKENS = new Set([
  // Building-KIND bonuses (castle, stone defense, walls & gates): the
  // building table is one number per attacker — spec §10.6 documents it.
  'stone defense', 'castle', 'walls and gates', 'walls & gates',
  // '+N melee' modifiers are attack-type notes, not class bonuses.
  'melee',
  // Bombard Cannon's ambiguous 'siege/camels' grouping — see EXCEPTIONS.
  'siege/camels',
]);

// Documented divergences: unit → class → the value we deliberately model.
const EXCEPTIONS: Record<string, Record<string, number>> = {
  // The CSV row reads "+40 siege/camels;+20 siege" — self-contradictory. We
  // model the stronger +40 anti-siege reading (spec §10.7.1's note) and
  // defer the anti-camel grouping with it.
  'bombard-cannon': { siege: 40 },
};

const NAME_ALIAS: Record<string, string> = { 'scout cavalry': 'scout' };
const slug = (value: string) => value.trim().toLowerCase().replace(/ /g, '-');

describe('units.csv attack-bonus differential', () => {
  const roster = new Set(Object.keys(UNIT_ARMOR_CLASSES));
  const rows = readFileSync('design/stats/units.csv', 'utf-8').split('\n').slice(1);
  const perUnit = new Map<string, string>();
  for (const line of rows) {
    const cols = line.split(',');
    if (cols.length < 16) continue;
    const rawName = cols[0]!.trim().toLowerCase();
    const name = slug(NAME_ALIAS[rawName] ?? rawName);
    if (!roster.has(name as never)) continue;
    perUnit.set(name, cols[15]!.trim()); // last row per name = the modeled tier
  }

  it('models every CSV bonus entry (or names why not)', () => {
    const problems: string[] = [];
    for (const [unit, bonusText] of perUnit) {
      const expected = new Map<string, number>();
      let expectedBuilding = 0;
      for (const part of bonusText.split(';')) {
        const match = /^\+?(\d+)\s+(.*)$/.exec(part.trim());
        if (!match) continue;
        const value = Number(match[1]);
        const token = match[2]!.trim().toLowerCase();
        if (token.includes('buildings')) { expectedBuilding = value; continue; }
        if (DEFERRED_TOKENS.has(token)) continue;
        const mapped = TOKEN_TO_CLASS[token];
        if (!mapped) { problems.push(`${unit}: unmapped token "${token}"`); continue; }
        for (const cls of ([] as string[]).concat(mapped)) {
          expected.set(cls, (expected.get(cls) ?? 0) + value);
        }
      }
      for (const [cls, value] of Object.entries(EXCEPTIONS[unit] ?? {})) {
        expected.set(cls, value);
      }
      const entries = (UNIT_ATTACK_BONUSES as Record<string, ReadonlyArray<{ targetClass: string; bonus: number }>>)[unit] ?? [];
      const ours = new Map<string, number>(entries.map((entry) => [entry.targetClass, entry.bonus]));
      for (const [cls, value] of expected) {
        if ((ours.get(cls) ?? 0) !== value) {
          problems.push(`${unit}: wants +${String(value)} ${cls}, models +${String(ours.get(cls) ?? 0)}`);
        }
      }
      for (const [cls, value] of ours) {
        if (!expected.has(cls)) problems.push(`${unit}: models +${String(value)} ${cls} the CSV row lacks`);
      }
      // Building bonus (only where the CSV value is substantial — small
      // non-siege +1-3s are the documented §10.6 deferral).
      if (expectedBuilding >= 20 && attackBonusAgainstBuilding(unit as never) !== expectedBuilding) {
        problems.push(`${unit}: building bonus ${String(attackBonusAgainstBuilding(unit as never))} vs csv ${String(expectedBuilding)}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
