// Parthian Tactics' ATTACK half, DERIVED (pure) from an owner's researched-tech
// set at the damage site — the Sappers pattern (sappersTechEffects), for the
// same reason: the bonus depends on the TARGET's armor class, which only the
// damage site knows, so it cannot be baked into the attacker's combat state.
// The technology's ARMOR half (+1 melee / +2 pierce) is per-unit state instead
// and rides the ordinary armor-tech path (armorTechBonuses).
//
// technologies.csv: "+1/+2 AR and Cavalry Archer +4 and Mangudai +2 against
// pikemen" — the two attack values differ per line, so this is a table rather
// than a constant.

import type { ResearchableTechnologyType, UnitType } from './types';
import { UNIT_ARMOR_CLASSES } from './prototypeUnitRules/armorClasses';

// Extra damage vs the spearman class, per cavalry-archer line. The War Wagon
// is in the class for the ARMOR half but takes no attack bonus: its CSV row
// carries no anti-spearman bonus and the technology row names only the
// Cavalry Archer and the Mangudai.
export const PARTHIAN_SPEARMAN_ATTACK_BONUS: Partial<Record<UnitType, number>> = {
  'cavalry-archer': 4,
  'heavy-cavalry-archer': 4,
  mangudai: 2,
  'elite-mangudai': 2,
};

/**
 * The extra damage Parthian Tactics adds to one attack: 0 unless the attacker's
 * owner has researched it, the attacker is one of the lines above, and the
 * target is in the `spearman` armor class (so it follows the spear line's own
 * upgrades — Spearman, Pikeman, Halberdier — without naming them).
 */
export function parthianSpearmanAttackBonus(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  attackerType: UnitType,
  targetType: UnitType,
): number {
  if (!researchedTechnologies.has('parthian-tactics')) return 0;
  const bonus = PARTHIAN_SPEARMAN_ATTACK_BONUS[attackerType];
  if (bonus === undefined) return 0;
  return UNIT_ARMOR_CLASSES[targetType].has('spearman') ? bonus : 0;
}
