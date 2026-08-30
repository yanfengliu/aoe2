// Team bonuses (spec §9.2, civilizations.csv `team_bonus`): a civilization's
// gift to its whole SIDE. Active for an owner when the owner or any teammate
// plays the civilization — a team of one still enjoys its own, which is
// AoE2's rule and what makes every bonus testable in a 1v1.
//
// Like the civilization bonuses, only lines the derived seams can express are
// encoded; the spec lists the remainder (Genitour and Condottiero need units
// that do not exist, the Vietnamese Imperial Skirmisher needs a tier, the
// Burmese minimap reveal is a UI surface).

import { areAllied } from './alliances';

/** Whether `owner`'s side carries `civilization`'s team bonus. */
export function teamHasCivilization(
  teams: ReadonlyMap<number, number>,
  civilizations: ReadonlyMap<number, string>,
  owner: number,
  civilization: string,
): boolean {
  for (const [candidate, candidateCiv] of civilizations) {
    if (candidateCiv !== civilization) continue;
    if (candidate === owner || areAllied(teams, owner, candidate)) return true;
  }
  return false;
}

// The numbers, one constant per CSV line so a test can name each.
export const AZTECS_TEAM_RELIC_GOLD_MULTIPLIER = 1.33;
export const SPANISH_TEAM_TRADE_GOLD_MULTIPLIER = 1.25; // DE: +25%.
export const CHINESE_TEAM_FARM_FOOD_MULTIPLIER = 1.1; // DE: farms +10% food.
export const BYZANTINES_TEAM_HEAL_MULTIPLIER = 2; // DE: monks heal +100% faster.
export const TEUTONS_TEAM_CONVERT_RESISTANCE_MULTIPLIER = 0.5;
export const MAYANS_TEAM_WALL_COST_MULTIPLIER = 0.5;
export const VIKINGS_TEAM_DOCK_COST_MULTIPLIER = 0.85; // DE: docks -15%.
export const MALIANS_TEAM_UNIVERSITY_RESEARCH_MULTIPLIER = 1 / 1.8;
export const SLAVS_TEAM_MILITARY_BUILDING_POP = 5;
// `civilizations.csv:23` — "Farms built 50% faster". Held to the CSV rather
// than to live DE on purpose: DE raised this to 100% and later replaced the
// bonus outright with a Spearman/Skirmisher sight line, and `design/stats/` is
// this repo's stated authority. Recorded rather than silently followed, because
// the neighbouring bonuses in the spec carry sourcing notes and this one's
// divergence is the kind that looks like a typo years later.
export const INCAS_TEAM_FARM_BUILD_MULTIPLIER = 1.5;
// Per-civ team production speeds (sourced v0.3.144): DE gives Britons +10%,
// Goths/Huns/Celts +20%, Turks +25% — the old shared 1/1.2 overbuffed
// Britons and shorted Turks.
export const TEAM_PRODUCTION_SPEED_MULTIPLIER = 1 / 1.2;
export const BRITONS_TEAM_ARCHERY_MULTIPLIER = 1 / 1.1;
export const TURKS_TEAM_GUNPOWDER_MULTIPLIER = 1 / 1.25;
