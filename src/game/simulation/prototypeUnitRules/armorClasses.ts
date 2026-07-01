// Slice 2b-ii: the AoE2-accurate armor-CLASS bonus-damage model (spec §10.1 /
// §10.3). Replaces Slice 2b-i's first-match predicate ladder with a declarative
// armor-class taxonomy + cross-class SUMMATION, and adopts the CSV bonus VALUES
// (design/stats/units.csv `attack_bonus`). A unit BELONGS to a set of armor
// classes (`UNIT_ARMOR_CLASSES`); an attacker's bonuses (`UNIT_ATTACK_BONUSES`)
// are SUMMED over every class the target belongs to — matching AoE2, where e.g.
// a pikeman's +cavalry and a hypothetical +infantry would both apply to a unit
// that is in both classes.
//
// Divergences from Slice 2b-i (deliberate, AoE2-accurate — see the devlog):
// - Spear line now hits ALL cavalry at the CSV flat value (spearman +15 /
//   pikeman +22 / halberdier +32), retiring the ad-hoc light/heavy split, with
//   a SEPARATE `camel` class (+7/+11/+16) since AoE2 camels are not `cavalry`.
// - Skirmisher +4→+3 (CSV), and gains +3 vs the `spearman` class.
// - Foot/cavalry archers gain their CSV +vs-spearman (crossbow/arbalest +3,
//   cavalry-archer/HCA/longbow +2) — previously absent.
// - Camel +9→+10 (base) / heavy-camel +9→+18 (CSV), each +camel too.
// - Mangonel's fabricated +10 vs infantry is REMOVED: AoE2 mangonel
//   anti-infantry is BLAST/splash (spec §10.7), deferred to M2; mangonel keeps
//   its +12 siege.
//
// Deferred out of this slice (documented): the scout line's +vs-monk bonus and
// the `monk` armor class (it entangles the conversion fixtures — a scout that
// out-damages a converting monk is a separate auto-aggro/convert-priority
// concern); off-roster classes (eagle, war-elephant, ship, conquistador,
// unique-unit, stone-defense, wall); and the tiny +1-3 vs-building bonuses of
// non-siege units (spearman/villager/infantry).

import type { UnitType } from '../types';

export type ArmorClass =
  | 'cavalry'
  | 'camel'
  | 'infantry'
  | 'spearman'
  | 'archer'
  | 'siege'
  | 'ram';

type BonusEntry = { targetClass: ArmorClass; bonus: number };

/** Which armor classes each unit BELONGS to (for being targeted by bonuses).
 *  Exhaustive over UnitType so a new unit forces a decision here. */
export const UNIT_ARMOR_CLASSES = {
  villager: new Set<ArmorClass>(),
  scout: new Set<ArmorClass>(['cavalry']),
  militia: new Set<ArmorClass>(['infantry']),
  spearman: new Set<ArmorClass>(['infantry', 'spearman']),
  archer: new Set<ArmorClass>(['archer']),
  skirmisher: new Set<ArmorClass>(['archer']),
  knight: new Set<ArmorClass>(['cavalry']),
  crossbowman: new Set<ArmorClass>(['archer']),
  pikeman: new Set<ArmorClass>(['infantry', 'spearman']),
  'light-cavalry': new Set<ArmorClass>(['cavalry']),
  camel: new Set<ArmorClass>(['camel']),
  'cavalry-archer': new Set<ArmorClass>(['archer']),
  mangonel: new Set<ArmorClass>(['siege']),
  scorpion: new Set<ArmorClass>(['siege']),
  'battering-ram': new Set<ArmorClass>(['siege', 'ram']),
  monk: new Set<ArmorClass>(), // `monk` armor class deferred (see header)
  longbowman: new Set<ArmorClass>(['archer']),
  arbalest: new Set<ArmorClass>(['archer']),
  halberdier: new Set<ArmorClass>(['infantry', 'spearman']),
  hussar: new Set<ArmorClass>(['cavalry']),
  'heavy-cavalry-archer': new Set<ArmorClass>(['archer']),
  cavalier: new Set<ArmorClass>(['cavalry']),
  champion: new Set<ArmorClass>(['infantry']),
  'elite-longbowman': new Set<ArmorClass>(['archer']),
  onager: new Set<ArmorClass>(['siege']),
  'heavy-scorpion': new Set<ArmorClass>(['siege']),
  'siege-ram': new Set<ArmorClass>(['siege', 'ram']),
  'bombard-cannon': new Set<ArmorClass>(['siege']),
  trebuchet: new Set<ArmorClass>(['siege']),
  'man-at-arms': new Set<ArmorClass>(['infantry']),
  'long-swordsman': new Set<ArmorClass>(['infantry']),
  'two-handed-swordsman': new Set<ArmorClass>(['infantry']),
  paladin: new Set<ArmorClass>(['cavalry']),
  'heavy-camel': new Set<ArmorClass>(['camel']),
} satisfies Record<UnitType, ReadonlySet<ArmorClass>>;

/** Attacker → the class bonuses it applies, SUMMED over the target's classes.
 *  Values transcribed from design/stats/units.csv `attack_bonus` (roster-
 *  relevant target classes only). Absent attackers deal no class bonus. */
export const UNIT_ATTACK_BONUSES: Partial<Record<UnitType, ReadonlyArray<BonusEntry>>> = {
  // Spear line: flat vs ALL cavalry + separate vs camel.
  spearman: [{ targetClass: 'cavalry', bonus: 15 }, { targetClass: 'camel', bonus: 7 }],
  pikeman: [{ targetClass: 'cavalry', bonus: 22 }, { targetClass: 'camel', bonus: 11 }],
  halberdier: [{ targetClass: 'cavalry', bonus: 32 }, { targetClass: 'camel', bonus: 16 }],
  // Camels: anti-cavalry + anti-camel.
  camel: [{ targetClass: 'cavalry', bonus: 10 }, { targetClass: 'camel', bonus: 5 }],
  'heavy-camel': [{ targetClass: 'cavalry', bonus: 18 }, { targetClass: 'camel', bonus: 9 }],
  // Skirmishers: anti-archer + anti-spearman.
  skirmisher: [{ targetClass: 'archer', bonus: 3 }, { targetClass: 'spearman', bonus: 3 }],
  // Archer line: anti-spearman.
  crossbowman: [{ targetClass: 'spearman', bonus: 3 }],
  arbalest: [{ targetClass: 'spearman', bonus: 3 }],
  'cavalry-archer': [{ targetClass: 'spearman', bonus: 2 }],
  'heavy-cavalry-archer': [{ targetClass: 'spearman', bonus: 2 }],
  longbowman: [{ targetClass: 'spearman', bonus: 2 }],
  'elite-longbowman': [{ targetClass: 'spearman', bonus: 2 }],
  // (Scout-line anti-monk deferred — see header.)
  // Siege: anti-siege / anti-ram (mangonel's anti-infantry is BLAST, deferred).
  mangonel: [{ targetClass: 'siege', bonus: 12 }],
  onager: [{ targetClass: 'siege', bonus: 12 }],
  scorpion: [{ targetClass: 'ram', bonus: 1 }],
  'heavy-scorpion': [{ targetClass: 'ram', bonus: 2 }],
  'battering-ram': [{ targetClass: 'siege', bonus: 40 }],
  'siege-ram': [{ targetClass: 'siege', bonus: 65 }],
  // Bombard Cannon's CSV attack_bonus is ambiguous free-text ("+40
  // siege/camels;+20 siege;+40 stone defense"). We take the clear anti-siege
  // value; the grouped anti-camel reading, the extra "+20 siege" fragment, and
  // the off-roster stone-defense bonus are DEFERRED (real AoE2 bombards are not
  // a notable anti-camel counter). Its +200 vs buildings is in BUILDING_ATTACK_BONUS.
  'bombard-cannon': [{ targetClass: 'siege', bonus: 40 }],
};

/** Sum of the attacker's class bonuses over every armor class the target is in
 *  (AoE2 cross-class summation, spec §10.1). */
export function armorClassBonus(attackerType: UnitType, targetType: UnitType): number {
  const bonuses = UNIT_ATTACK_BONUSES[attackerType];
  if (!bonuses) return 0;
  const targetClasses = UNIT_ARMOR_CLASSES[targetType];
  let total = 0;
  for (const { targetClass, bonus } of bonuses) {
    if (targetClasses.has(targetClass)) total += bonus;
  }
  return total;
}
