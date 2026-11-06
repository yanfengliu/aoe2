// The HUD tooltips' copy: prices, the chips' and stat rows' text and the command
// cards' blurbs. Split from tooltips.ts, which keeps the controller that shows
// it, in work 148 M1; tooltips.ts re-exports all of it.

import type {
  ActionType,
  MarketActionType,
  PlayerResources,
  ResearchableTechnologyType,
} from '../../game/simulation/types';
import { researchTimeTicks } from '../../game/simulation/prototypeEconomyRules';
import { SPIES_GOLD_PER_ENEMY_VILLAGER } from '../../game/simulation/spiesRules';

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

// The PRICE in each command tooltip is the simulation's, passed in from
// `SelectionState.commandCosts` — the per-owner seam the charge itself reads —
// and never looked up here. A tooltip that priced from the base table said an
// Italian Fishing Ship cost 75 wood while the Dock charged 64 (spec §14.2,
// work 125). With no price supplied a tooltip states none, rather than a
// figure the click would not charge.
export function formatTrainTooltip(
  unitDisplayName: string,
  cost: Partial<PlayerResources> | undefined,
): string {
  const price = cost ? ` Cost: ${formatResourceCost(cost)}.` : '';
  return `Queue a ${unitDisplayName} at this building.${price} Needs an open production queue slot.`;
}

export function formatResearchTooltip(
  technologyType: ResearchableTechnologyType,
  techDisplayName: string,
  cost: Partial<PlayerResources> | undefined,
): string {
  const seconds = Math.round(researchTimeTicks(technologyType) / 10);
  // Spies is the one technology priced by a query, so its quoted figure moves
  // with the enemy's villager count; the rule rides beside it.
  const rule = technologyType === 'spies'
    ? ` (${String(SPIES_GOLD_PER_ENEMY_VILLAGER)} per enemy villager, halved by Atheism)`
    : '';
  return cost
    ? `Research ${techDisplayName}. Cost: ${formatResourceCost(cost)}${rule}; takes ${seconds}s.`
    : `Research ${techDisplayName}. Takes ${seconds}s.`;
}

export function formatBuildTooltip(
  buildingDisplayName: string,
  cost: Partial<PlayerResources> | undefined,
): string {
  const price = cost ? ` (cost: ${formatResourceCost(cost)})` : '';
  return `Place a ${buildingDisplayName} foundation${price}. The selected villager walks to the site and builds it.`;
}
