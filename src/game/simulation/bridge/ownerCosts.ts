// The one place an OWNER's price is computed, for everything a player buys: a
// building, a unit, a technology and a Market trade. Every charge, its
// validator, and every price the player is SHOWN (the command card's tooltips,
// its unaffordable reasons, the rejection toasts, the agent's option lists)
// reads these, so the price on a button and the price the click takes are one
// computation and cannot differ (spec §14.2, work 125). A price computed
// anywhere else is a second copy that drifts: the train tooltip read the base
// table while the queue charged the civilization's price, so an Italian
// Fishing Ship said 75 wood and cost 64.

import type {
  BuildingType,
  EconomyResourceKind,
  PlayerResources,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { GameWorld } from './pureHelpers';
import {
  marketExchangeRatesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import {
  effectiveConstructionCost,
  effectiveResearchCost,
  effectiveTrainingCost,
} from '../civBonusEffects';
import { marketFeeRateFor } from '../marketTechEffects';
import { spiesCost } from '../spiesRules';
import { countEnemyVillagers } from './countEnemyVillagers';
import {
  MAYANS_TEAM_WALL_COST_MULTIPLIER,
  teamHasCivilization,
  VIKINGS_TEAM_DOCK_COST_MULTIPLIER,
} from '../teamBonuses';

const WALL_BUILDINGS = new Set<BuildingType>(['stone-wall', 'palisade-wall']);
const NO_TECHNOLOGIES: ReadonlySet<ResearchableTechnologyType> = new Set();

function researchedBy(
  accessor: BridgeStateAccessor,
  owner: number,
): ReadonlySet<ResearchableTechnologyType> {
  return accessor.get(researchedTechnologiesCodec).get(owner) ?? NO_TECHNOLOGIES;
}

/** A building: civilization discounts (effectiveConstructionCost) composed
 *  with team-bonus discounts (Mayan walls at half price, Viking Docks 15% off,
 *  Ethiopian Outposts without their stone). */
export function ownerConstructionCost(
  accessor: BridgeStateAccessor,
  owner: number,
  buildingType: BuildingType,
): Partial<PlayerResources> {
  const civilizations = accessor.get(playerCivilizationsCodec);
  let cost = effectiveConstructionCost(
    civilizations.get(owner),
    buildingType,
    accessor.get(playerAgesCodec).get(owner) ?? 'dark-age',
  );
  const teams = accessor.get(playerTeamsCodec);
  const scale = (multiplier: number): void => {
    const scaled: Partial<PlayerResources> = {};
    for (const key of Object.keys(cost) as (keyof PlayerResources)[]) {
      scaled[key] = Math.round((cost[key] ?? 0) * multiplier);
    }
    cost = scaled;
  };
  if (
    WALL_BUILDINGS.has(buildingType)
    && teamHasCivilization(teams, civilizations, owner, 'Mayans')
  ) {
    scale(MAYANS_TEAM_WALL_COST_MULTIPLIER);
  }
  if (buildingType === 'dock' && teamHasCivilization(teams, civilizations, owner, 'Vikings')) {
    scale(VIKINGS_TEAM_DOCK_COST_MULTIPLIER);
  }
  // Ethiopian team bonus, DE: "Outposts +3 line of sight and cost no stone"
  // (aoe2techtree 3bb43b14, DE update 185872; sourced v0.3.253). The sight half
  // is teamBuildingVisionBonus in civBuildingBonuses.ts.
  if (buildingType === 'outpost' && teamHasCivilization(teams, civilizations, owner, 'Ethiopians')) {
    const { stone: _stone, ...withoutStone } = cost;
    cost = withoutStone;
  }
  return cost;
}

/** A unit: every civilization cost rule (the Goth infantry ladder, the
 *  Italian Fishing Ship) and Shipwright's -20% ship wood, at the owner's age. */
export function ownerTrainingCost(
  accessor: BridgeStateAccessor,
  owner: number,
  unitType: TrainableUnitType,
): Partial<PlayerResources> {
  return effectiveTrainingCost(
    accessor.get(playerCivilizationsCodec).get(owner),
    accessor.get(playerAgesCodec).get(owner) ?? 'dark-age',
    unitType,
    researchedBy(accessor, owner),
  );
}

/** A technology: the civilization research discounts at the owner's age. Spies
 *  is the one technology whose price is a QUERY rather than a table row — 200
 *  gold per living enemy villager, halved by Atheism — so it needs the world. */
export function ownerResearchCost(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  owner: number,
  technologyType: ResearchableTechnologyType,
): Partial<PlayerResources> {
  if (technologyType === 'spies') {
    return spiesCost(countEnemyVillagers(world, owner), researchedBy(accessor, owner).has('atheism'));
  }
  return effectiveResearchCost(
    accessor.get(playerCivilizationsCodec).get(owner),
    accessor.get(playerAgesCodec).get(owner) ?? 'dark-age',
    technologyType,
  );
}

/** What the Market takes on a trade for this owner: 30%, 15% after Guilds. */
export function ownerMarketFeeRate(accessor: BridgeStateAccessor, owner: number): number {
  return marketFeeRateFor(researchedBy(accessor, owner));
}

/** The gold one Market buy of `commodity` costs this owner at today's rate. */
export function ownerMarketBuyCost(
  accessor: BridgeStateAccessor,
  owner: number,
  commodity: Exclude<EconomyResourceKind, 'gold'>,
): number {
  const rate = accessor.get(marketExchangeRatesCodec)[commodity];
  return Math.ceil(rate * (1 + ownerMarketFeeRate(accessor, owner)));
}
