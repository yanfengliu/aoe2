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
export const SPANISH_TEAM_TRADE_GOLD_MULTIPLIER = 1.33;
export const CHINESE_TEAM_FARM_FOOD_BONUS = 45;
export const BYZANTINES_TEAM_HEAL_MULTIPLIER = 1.5;
export const TEUTONS_TEAM_CONVERT_RESISTANCE_MULTIPLIER = 0.5;
export const MAYANS_TEAM_WALL_COST_MULTIPLIER = 0.5;
export const VIKINGS_TEAM_DOCK_COST_MULTIPLIER = 0.75;
export const MALIANS_TEAM_UNIVERSITY_RESEARCH_MULTIPLIER = 1 / 1.8;
export const SLAVS_TEAM_MILITARY_BUILDING_POP = 5;
export const TEAM_PRODUCTION_SPEED_MULTIPLIER = 1 / 1.2;
