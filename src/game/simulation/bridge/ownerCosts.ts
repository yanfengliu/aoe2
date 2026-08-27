// The one place an OWNER's building price is computed: civilization discounts
// (effectiveConstructionCost) composed with team-bonus discounts (Mayan walls
// at half stone, Viking Docks a quarter off). Every charge, afford, validator,
// AI, reseed, and HUD site reads this — the effectiveTrainingCost rule, now
// with the team layer on top.

import type { BuildingType, PlayerResources } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  playerAgesCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
} from './bridgeStateSerialize';
import { effectiveConstructionCost } from '../civBonusEffects';
import {
  MAYANS_TEAM_WALL_COST_MULTIPLIER,
  teamHasCivilization,
  VIKINGS_TEAM_DOCK_COST_MULTIPLIER,
} from '../teamBonuses';

const WALL_BUILDINGS = new Set<BuildingType>(['stone-wall', 'palisade-wall']);

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
  return cost;
}
