// What separates one civilization from another (spec §11.4, §11.14), as one
// browsable model.
//
// Two sources, deliberately kept apart and joined here rather than merged.
// `civProfiles` carries the DESIGN — the text of `design/stats/civilizations.csv`,
// which is the spec of record for what a civilization IS. The runtime tables
// (`uniqueUnits`, `uniqueTechnologies`, `civBonusTable`) carry what the
// simulation actually implements. A compendium built from the design alone
// would promise a player a Rattan Archer this game cannot train; one built from
// the runtime alone would show twelve civilizations as blank. So every line
// carries whether it is LIVE, and the panel says so.
//
// The join is by DISPLAY NAME, because that is the only thing the two sides
// share — the CSV names "Jaguar Warrior", the runtime holds `jaguar-warrior`.
// `civCompendiumModel.test.ts` pins that the two agree wherever the runtime has
// an entry at all, so a formatter change cannot silently mark a live unit dead.

import { CIV_PROFILES, type CivProfile } from '../../game/simulation/civProfiles';
import { civBonusesFor } from '../../game/simulation/civBonusTable';
import { uniqueTechnologiesFor } from '../../game/simulation/uniqueTechnologies';
import { uniqueUnitsFor } from '../../game/simulation/uniqueUnits';
import { formatEntityName } from './displayNames/entityNames';
import { formatTechnologyName } from './displayNames/formatters';

/** One named thing a civilization has, and whether this game implements it. */
export interface CivFeature {
  readonly name: string;
  readonly live: boolean;
}

export interface CivCompendiumEntry {
  readonly name: string;
  /** "Age of Kings", "The Conquerors", "African Kingdoms", … */
  readonly expansion: string;
  /** The one-line archetype the CSV gives: "Infantry", "Cavalry Archer", … */
  readonly armyType: string;
  readonly uniqueUnits: readonly CivFeature[];
  readonly uniqueTechnologies: readonly CivFeature[];
  readonly teamBonuses: readonly string[];
  readonly civilizationBonuses: readonly string[];
  /** Whether `civBonusTable` wires any of this civilization's own bonuses. */
  readonly bonusesWired: boolean;
  /** Every unique unit and technology the design names exists in the game. */
  readonly fullyImplemented: boolean;
}

function features(
  designNames: readonly string[],
  implementedNames: readonly string[],
): CivFeature[] {
  const live = new Set(implementedNames);
  return designNames.map((name) => ({ name, live: live.has(name) }));
}

function entryFor(profile: CivProfile): CivCompendiumEntry {
  const uniqueUnits = features(
    profile.uniqueUnits,
    uniqueUnitsFor(profile.name).map((unit) => formatEntityName(unit.unitType)),
  );
  const uniqueTechnologies = features(
    profile.uniqueTechnologies,
    uniqueTechnologiesFor(profile.name).map((tech) => formatTechnologyName(tech.id)),
  );
  return {
    name: profile.name,
    expansion: profile.expansion,
    armyType: profile.armyType,
    uniqueUnits,
    uniqueTechnologies,
    teamBonuses: profile.teamBonuses,
    civilizationBonuses: profile.civilizationBonuses,
    bonusesWired: civBonusesFor(profile.name) !== undefined,
    fullyImplemented:
      uniqueUnits.every((feature) => feature.live)
      && uniqueTechnologies.every((feature) => feature.live),
  };
}

/** Every civilization, in the CSV's own order. */
export function buildCivCompendium(): CivCompendiumEntry[] {
  return CIV_PROFILES.map(entryFor);
}

/**
 * The rows matching a free-text query, case-insensitively, across everything
 * the entry says — name, expansion, archetype, uniques and every bonus line.
 *
 * Searching the BONUS TEXT is the point rather than a convenience: "how do the
 * civilizations differ" is most often asked as "which of them do X", and typing
 * `elephant` or `cheaper` is how a player asks it.
 */
export function filterCivCompendium(
  entries: readonly CivCompendiumEntry[],
  query: string,
): CivCompendiumEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [...entries];
  return entries.filter((entry) => [
    entry.name,
    entry.expansion,
    entry.armyType,
    ...entry.uniqueUnits.map((feature) => feature.name),
    ...entry.uniqueTechnologies.map((feature) => feature.name),
    ...entry.teamBonuses,
    ...entry.civilizationBonuses,
  ].some((text) => text.toLowerCase().includes(needle)));
}
