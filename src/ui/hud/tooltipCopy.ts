// The HUD tooltips' copy: prices, the chips' and stat rows' text and the command
// cards' blurbs. Split from tooltips.ts, which keeps the controller that shows
// it, in work 148 M1; tooltips.ts re-exports all of it.

import type {
  ActionType,
  BuildingType,
  MarketActionType,
  PlayerResources,
  ResearchableTechnologyType,
  UnitType,
} from '../../game/simulation/types';
import { researchTimeTicks } from '../../game/simulation/prototypeEconomyRules';
import {
  AGE_ADVANCE_REQUIRED_COUNT,
  agePrerequisiteBuildingTypes,
  isAgeUpTechnology,
  type AgeUpTechnologyType,
} from '../../game/simulation/prototypeBuildingRules';
import { SPIES_GOLD_PER_ENEMY_VILLAGER } from '../../game/simulation/spiesRules';
import { formatEntityName, formatTechnologyName } from './displayNames';
import { buildingHelp, technologyHelp, technologyVerb, unitHelp, unitVerb } from './helpText';

// A short, human-readable cost like "60 food, 20 gold" from a partial resource
// cost, listing only the non-zero resources in a stable food/wood/gold/stone
// order. "nothing" for an empty cost (defensive — no shippable content is free).
export function formatResourceCost(cost: Partial<PlayerResources>): string {
  const order: (keyof PlayerResources)[] = ['food', 'wood', 'gold', 'stone'];
  const parts = order
    .filter((key) => (cost[key] ?? 0) > 0)
    .map((key) => `${cost[key]} ${key}`);
  return parts.length > 0 ? parts.join(', ') : 'nothing';
}

// Slice 11: tooltip copy lives next to the chip definition so the HUD renders
// a single source of truth. The data-tooltip attribute is read on hover and
// reflected into the single shared tooltip element.
export const HUD_CHIP_TOOLTIPS: Record<string, string> = {
  food: 'Food stockpile. Farms, hunting, sheep, and berries feed villagers and soldiers.',
  wood: 'Wood stockpile. Cut by villagers at forests and returned to Lumber Camps.',
  gold: 'Gold stockpile. Mined from gold deposits and earned through trade and relics.',
  stone: 'Stone stockpile. Mined from stone deposits; required for Town Centers, walls, and Castles.',
  age: 'Current age. Research the next age at a Town Center to unlock new units and buildings.',
  pop: 'Population used out of the current cap. Build Houses or Town Centers to raise the cap.',
  time: 'Elapsed match time (minutes:seconds), and the game speed in brackets. The numpad + and − keys change the speed.',
  countdown: 'A victory countdown is active. If it finishes without interruption the holder wins.',
};

// Slice 11: per-selection-detail hover copy. The detail row keys are the
// render slots in the selection panel (health / attack / melee armor /
// pierce armor / faction / civ / inventory).
export const SELECTION_DETAIL_TOOLTIPS: Record<
  'health' | 'attack' | 'armor' | 'pierce-armor' | 'faction' | 'civ' | 'inventory',
  string
> = {
  health: 'Current hit points and maximum hit points.',
  attack: 'Attack damage per strike before bonuses and armor.',
  // Total armor, base plus upgrades, as Definitive Edition's panel shows it (work 140).
  armor: 'Melee armor: subtracted from every melee hit, base plus upgrades.',
  'pierce-armor': 'Pierce armor: subtracted from every pierce hit, base plus upgrades. Top-tier armor and Loom add +2.',
  faction: 'Group the entity belongs to (player, ally, enemy, neutral).',
  civ: 'Civilization bonuses and unique units that apply.',
  inventory: 'Resources currently carried by the unit.',
};

// Slice 11: command-button tooltip factories. Each returns a short hover
// blurb suitable for rendering via data-tooltip on the corresponding
// command button. The HUD renders one <button> per option and surfaces
// the tooltip copy through the shared tooltip element on hover.
export function formatActionTooltip(actionType: ActionType): string {
  switch (actionType) {
    case 'ungarrison':
      return 'Empty the building of all garrisoned units.';
    case 'ring-town-bell':
      return 'Send every villager to the nearest shelter with room.';
    case 'back-to-work':
      return 'Release sheltering villagers back to their tasks.';
  }
}

export function formatMarketActionTooltip(actionType: MarketActionType): string {
  switch (actionType) {
    case 'buy-food':
      return 'Buy food with gold at the current market rate.';
    case 'sell-food':
      return 'Sell food for gold at the current market rate.';
    case 'buy-wood':
      return 'Buy wood with gold at the current market rate.';
    case 'sell-wood':
      return 'Sell wood for gold at the current market rate.';
    case 'buy-stone':
      return 'Buy stone with gold at the current market rate.';
    case 'sell-stone':
      return 'Sell stone for gold at the current market rate.';
  }
}

// A command's tooltip is DE's help text in shape (work 148 M2): a title line,
// DE's verb, the name and the price in brackets ("Create <b>Villager<b>
// (<cost>)", string 26121; "Research <b>Loom<b> (<cost>)", 28022), then what it
// does (./helpText), then what it needs, one line each. The controller draws the
// first line as the title. Until M2 a tooltip gave the price and the time and
// nothing of what the thing did.
//
// The PRICE in each command tooltip is the simulation's, passed in from
// `SelectionState.commandCosts` — the per-owner seam the charge itself reads —
// and never looked up here. A tooltip that priced from the base table said an
// Italian Fishing Ship cost 75 wood while the Dock charged 64 (spec §14.2,
// work 125). With no price supplied a tooltip states none, rather than a
// figure the click would not charge.
function helpTooltip(title: string, bracket: readonly (string | null)[], lines: readonly (string | null)[]): string {
  const parts = bracket.filter((part): part is string => part !== null);
  const head = parts.length > 0 ? `${title} (${parts.join('; ')})` : title;
  return [head, ...lines.filter((line): line is string => line !== null)].join('\n');
}

const priceOf = (cost: Partial<PlayerResources> | undefined): string | null => (cost ? formatResourceCost(cost) : null);

export function formatTrainTooltip(unitType: UnitType, cost: Partial<PlayerResources> | undefined): string {
  return helpTooltip(`${unitVerb(unitType)} ${formatEntityName(unitType)}`, [priceOf(cost)], [unitHelp(unitType)]);
}

// An age needs two buildings of the age before it, which DE's tooltip says in
// its title and its text whether or not the player has them (28101: "Advance to
// <b>Feudal Age<b> (<cost>; two Dark Age buildings)", then "Before you can
// advance, you must have any two Dark Age buildings: ..."). The buildings and
// the count are the simulation's own (prototypeBuildingRules, which the age
// gates read), so the tooltip cannot name a building the gate does not count.
// The Imperial Age's alternative, a Castle on its own (spec §7.2), is the gate's
// (bridge/playerQueries.ts `canAdvanceToImperialAge`), as DE's 28103 says it.
const AGE_LEFT_BEHIND: Readonly<Record<AgeUpTechnologyType, string>> = {
  'feudal-age': 'Dark Age',
  'castle-age': 'Feudal Age',
  'imperial-age': 'Castle Age',
};
const AGE_ALTERNATIVE: Readonly<Partial<Record<AgeUpTechnologyType, BuildingType>>> = { 'imperial-age': 'castle' };
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four'];

function listWithOr(names: readonly string[]): string {
  return names.length <= 2 ? names.join(' or ') : `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
}

function ageRequirement(technologyType: AgeUpTechnologyType): { short: string; sentence: string; buildings: readonly string[] } {
  const count = COUNT_WORDS[AGE_ADVANCE_REQUIRED_COUNT] ?? String(AGE_ADVANCE_REQUIRED_COUNT);
  const era = AGE_LEFT_BEHIND[technologyType];
  const alternative = AGE_ALTERNATIVE[technologyType];
  const buildings = agePrerequisiteBuildingTypes(technologyType)
    .filter((buildingType) => buildingType !== alternative)
    .map((buildingType) => formatEntityName(buildingType));
  const either = alternative ? `a ${formatEntityName(alternative)} or ` : '';
  return {
    short: `${count} ${era} buildings${alternative ? ` or a ${formatEntityName(alternative)}` : ''}`,
    sentence: `Before you can advance, you need ${either}any ${count} ${era} buildings: ${listWithOr(buildings)}.`,
    buildings,
  };
}

export function formatResearchTooltip(
  technologyType: ResearchableTechnologyType,
  cost: Partial<PlayerResources> | undefined,
  refusal?: string,
): string {
  const seconds = Math.round(researchTimeTicks(technologyType) / 10);
  const age = isAgeUpTechnology(technologyType) ? ageRequirement(technologyType) : null;
  // Spies is the one technology priced by a query, so its quoted figure moves
  // with the enemy's villager count; the rule rides beside it.
  const rule = technologyType === 'spies'
    ? `Costs ${String(SPIES_GOLD_PER_ENEMY_VILLAGER)} gold per enemy villager, halved by Atheism.`
    : null;
  // While the player lacks the buildings, the simulation's refusal names them
  // too, with its count ("Needs 2 completed Dark Age buildings (Mill, ...). You
  // have 1."), so the requirement is said once, by the refusal; the title's
  // bracket says it either way.
  const refusalNamesThem = refusal !== undefined && age !== null && age.buildings.every((name) => refusal.includes(name));
  const needs = age !== null && !refusalNamesThem ? age.sentence : null;
  return helpTooltip(
    `${technologyVerb(technologyType)} ${formatTechnologyName(technologyType)}`,
    [priceOf(cost), `${seconds}s`, age?.short ?? null],
    [technologyHelp(technologyType), needs, rule, refusal ?? null],
  );
}

export function formatBuildTooltip(buildingType: BuildingType, cost: Partial<PlayerResources> | undefined): string {
  return helpTooltip(`Build ${formatEntityName(buildingType)}`, [priceOf(cost)], [buildingHelp(buildingType)]);
}

/** A tooltip with the simulation's reason a control refuses, on a line of its
 *  own after what the control does (spec §14.2, "An unavailable command
 *  explains itself"). */
export function withRefusal(tooltip: string, reason: string | undefined): string {
  return reason ? `${tooltip}\n${reason}` : tooltip;
}
