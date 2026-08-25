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
  | 'ram'
  // M5 naval: ships are their own armour class (anti-ship bonuses target it).
  | 'ship'
  // M4: AoE2's `unique unit` class. It was deferred as off-roster when the
  // taxonomy was written and only the Longbowman existed; the Samurai's +10
  // vs unique units now has 19 civilization units to bite on.
  | 'unique-unit'
  // Deferred when this taxonomy was written because nothing targeted it.
  // The Eagle Warrior line does: units.csv gives it +8 (+10 Elite) against
  // Monks, and running down a Monk before it converts is the line's job.
  | 'monk';

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
  'elite-skirmisher': new Set<ArmorClass>(['archer']),
  'eagle-warrior': new Set<ArmorClass>(['infantry']),
  'elite-eagle-warrior': new Set<ArmorClass>(['infantry']),
  'hand-cannoneer': new Set<ArmorClass>(['archer']),
  knight: new Set<ArmorClass>(['cavalry']),
  crossbowman: new Set<ArmorClass>(['archer']),
  pikeman: new Set<ArmorClass>(['infantry', 'spearman']),
  'light-cavalry': new Set<ArmorClass>(['cavalry']),
  camel: new Set<ArmorClass>(['camel']),
  'cavalry-archer': new Set<ArmorClass>(['archer']),
  mangonel: new Set<ArmorClass>(['siege']),
  scorpion: new Set<ArmorClass>(['siege']),
  'battering-ram': new Set<ArmorClass>(['siege', 'ram']),
  monk: new Set<ArmorClass>(['monk']),
  longbowman: new Set<ArmorClass>(['archer']),
  arbalest: new Set<ArmorClass>(['archer']),
  halberdier: new Set<ArmorClass>(['infantry', 'spearman']),
  hussar: new Set<ArmorClass>(['cavalry']),
  'heavy-cavalry-archer': new Set<ArmorClass>(['archer']),
  cavalier: new Set<ArmorClass>(['cavalry']),
  champion: new Set<ArmorClass>(['infantry']),
  'elite-longbowman': new Set<ArmorClass>(['archer']),
  onager: new Set<ArmorClass>(['siege']),
  'siege-onager': new Set<ArmorClass>(['siege']),
  'heavy-scorpion': new Set<ArmorClass>(['siege']),
  'siege-ram': new Set<ArmorClass>(['siege', 'ram']),
  'capped-ram': new Set<ArmorClass>(['siege', 'ram']),
  'bombard-cannon': new Set<ArmorClass>(['siege']),
  trebuchet: new Set<ArmorClass>(['siege']),
  // AoE2 classes the Petard as demolition INFANTRY that also counts as a
  // siege weapon, which is why anti-siege units answer it.
  petard: new Set<ArmorClass>(['infantry', 'siege']),
  'trade-cart': new Set<ArmorClass>([]), // units.csv: no armour classes.
  'trade-cog': new Set<ArmorClass>(['ship']),
  'fishing-ship': new Set<ArmorClass>(['ship']),
  'transport-ship': new Set<ArmorClass>(['ship']),
  'galley': new Set<ArmorClass>(['ship']),
  'war-galley': new Set<ArmorClass>(['ship']),
  'galleon': new Set<ArmorClass>(['ship']),
  'fire-ship': new Set<ArmorClass>(['ship']),
  'fast-fire-ship': new Set<ArmorClass>(['ship']),
  'demolition-ship': new Set<ArmorClass>(['ship']),
  'heavy-demolition-ship': new Set<ArmorClass>(['ship']),
  'cannon-galleon': new Set<ArmorClass>(['ship']),
  'elite-cannon-galleon': new Set<ArmorClass>(['ship']),
  'man-at-arms': new Set<ArmorClass>(['infantry']),
  'long-swordsman': new Set<ArmorClass>(['infantry']),
  'two-handed-swordsman': new Set<ArmorClass>(['infantry']),
  paladin: new Set<ArmorClass>(['cavalry']),
  'heavy-camel': new Set<ArmorClass>(['camel']),
  // M4 unique units. Each carries the class of the line it replaces PLUS
  // `unique-unit`, so anti-UU bonuses reach all of them.
  'jaguar-warrior': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'cataphract': new Set<ArmorClass>(['cavalry', 'unique-unit']),
  'woad-raider': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'chu-ko-nu': new Set<ArmorClass>(['archer', 'unique-unit']),
  'throwing-axeman': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'huskarl': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'tarkan': new Set<ArmorClass>(['cavalry', 'unique-unit']),
  'samurai': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'war-wagon': new Set<ArmorClass>(['archer', 'cavalry', 'unique-unit']),
  'plumed-archer': new Set<ArmorClass>(['archer', 'unique-unit']),
  'mangudai': new Set<ArmorClass>(['archer', 'cavalry', 'unique-unit']),
  'war-elephant': new Set<ArmorClass>(['cavalry', 'unique-unit']),
  'mameluke': new Set<ArmorClass>(['camel', 'unique-unit']),
  'conquistador': new Set<ArmorClass>(['cavalry', 'unique-unit']),
  'teutonic-knight': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'janissary': new Set<ArmorClass>(['archer', 'unique-unit']),
  'berserk': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'turtle-ship': new Set<ArmorClass>(['ship', 'unique-unit']),
  'longboat': new Set<ArmorClass>(['ship', 'unique-unit']),
  // Elites carry exactly their base unit classes.
  'elite-jaguar-warrior': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'elite-cataphract': new Set<ArmorClass>(['cavalry', 'unique-unit']),
  'elite-woad-raider': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'elite-chu-ko-nu': new Set<ArmorClass>(['archer', 'unique-unit']),
  'elite-throwing-axeman': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'elite-huskarl': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'elite-tarkan': new Set<ArmorClass>(['cavalry', 'unique-unit']),
  'elite-samurai': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'elite-war-wagon': new Set<ArmorClass>(['archer', 'cavalry', 'unique-unit']),
  'elite-plumed-archer': new Set<ArmorClass>(['archer', 'unique-unit']),
  'elite-mangudai': new Set<ArmorClass>(['archer', 'cavalry', 'unique-unit']),
  'elite-war-elephant': new Set<ArmorClass>(['cavalry', 'unique-unit']),
  'elite-mameluke': new Set<ArmorClass>(['camel', 'unique-unit']),
  'elite-conquistador': new Set<ArmorClass>(['cavalry', 'unique-unit']),
  'elite-teutonic-knight': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'elite-janissary': new Set<ArmorClass>(['archer', 'unique-unit']),
  'elite-berserk': new Set<ArmorClass>(['infantry', 'unique-unit']),
  'elite-turtle-ship': new Set<ArmorClass>(['ship', 'unique-unit']),
  'elite-longboat': new Set<ArmorClass>(['ship', 'unique-unit']),
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
  'elite-skirmisher': [{ targetClass: 'archer', bonus: 4 }, { targetClass: 'spearman', bonus: 3 }],
  // units.csv: +8 monks, +3 siege at the Castle-Age tier. The Monk bonus is
  // the line's whole point — nothing else on the field runs one down.
  'eagle-warrior': [{ targetClass: 'monk', bonus: 8 }, { targetClass: 'siege', bonus: 3 }],
  'elite-eagle-warrior': [{ targetClass: 'monk', bonus: 10 }, { targetClass: 'siege', bonus: 5 }],
  // units.csv: +10 infantry (+1 spearman, folded into the infantry line
  // it is the answer to), +2 rams.
  'hand-cannoneer': [{ targetClass: 'infantry', bonus: 10 }, { targetClass: 'siege', bonus: 2 }],
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
  'siege-onager': [{ targetClass: 'siege', bonus: 12 }],
  scorpion: [{ targetClass: 'ram', bonus: 1 }],
  'heavy-scorpion': [{ targetClass: 'ram', bonus: 2 }],
  'battering-ram': [{ targetClass: 'siege', bonus: 40 }],
  'siege-ram': [{ targetClass: 'siege', bonus: 65 }],
  'capped-ram': [{ targetClass: 'siege', bonus: 50 }],
  // Bombard Cannon's CSV attack_bonus is ambiguous free-text ("+40
  // siege/camels;+20 siege;+40 stone defense"). We take the clear anti-siege
  // value; the grouped anti-camel reading, the extra "+20 siege" fragment, and
  // the off-roster stone-defense bonus are DEFERRED (real AoE2 bombards are not
  // a notable anti-camel counter). Its +200 vs buildings is in BUILDING_ATTACK_BONUS.
  'bombard-cannon': [{ targetClass: 'siege', bonus: 40 }],
  // M4 unique units, from units.csv `attack_bonus`. Off-roster target
  // classes in that column (eagles, buildings, castles, stone defense,
  // walls) stay deferred with the rest of them.
  'jaguar-warrior': [{ targetClass: 'infantry', bonus: 10 }],
  'cataphract': [{ targetClass: 'infantry', bonus: 9 }],
  'chu-ko-nu': [{ targetClass: 'spearman', bonus: 2 }],
  'huskarl': [{ targetClass: 'archer', bonus: 6 }],
  'samurai': [{ targetClass: 'unique-unit', bonus: 10 }],
  'plumed-archer': [{ targetClass: 'infantry', bonus: 1 }, { targetClass: 'spearman', bonus: 2 }],
  'mangudai': [{ targetClass: 'spearman', bonus: 1 }, { targetClass: 'siege', bonus: 3 }],
  'mameluke': [{ targetClass: 'cavalry', bonus: 9 }],
  'conquistador': [{ targetClass: 'ram', bonus: 4 }],
  'janissary': [{ targetClass: 'ram', bonus: 2 }],
  'longboat': [{ targetClass: 'ship', bonus: 9 }, { targetClass: 'ram', bonus: 4 }],
  // Elite rows from the same CSV column; off-roster classes stay deferred.
  'elite-jaguar-warrior': [{ targetClass: 'infantry', bonus: 10 }],
  'elite-cataphract': [{ targetClass: 'infantry', bonus: 12 }],
  'elite-chu-ko-nu': [{ targetClass: 'spearman', bonus: 2 }],
  'elite-samurai': [{ targetClass: 'unique-unit', bonus: 12 }],
  'elite-plumed-archer': [{ targetClass: 'infantry', bonus: 2 }, { targetClass: 'spearman', bonus: 2 }],
  'elite-mangudai': [{ targetClass: 'spearman', bonus: 1 }, { targetClass: 'siege', bonus: 5 }],
  'elite-mameluke': [{ targetClass: 'cavalry', bonus: 12 }],
  'elite-conquistador': [{ targetClass: 'ram', bonus: 6 }],
  'elite-janissary': [{ targetClass: 'ram', bonus: 3 }],
  'elite-longboat': [{ targetClass: 'ship', bonus: 11 }, { targetClass: 'ram', bonus: 4 }],
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
