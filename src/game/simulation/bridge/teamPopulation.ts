// Slav team bonus: "Military buildings provide +5% population" — read as the
// DE effect, +5 population per standing military building. Applied at the one
// populationProvided derivation, so both raw-supply sites and construction
// records agree by construction.

import type { BuildingType } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { playerCivilizationsCodec, playerTeamsCodec } from './bridgeStateSerialize';
import { SLAVS_TEAM_MILITARY_BUILDING_POP, teamHasCivilization } from '../teamBonuses';

// DE (sourced v0.3.144): "Military buildings (except Castles)".
const MILITARY_BUILDINGS = new Set<BuildingType>([
  'barracks', 'archery-range', 'stable', 'siege-workshop', 'dock',
]);

export function slavsTeamMilitaryPop(
  accessor: BridgeStateAccessor,
  owner: number,
  buildingType: BuildingType,
): number {
  if (!MILITARY_BUILDINGS.has(buildingType)) return 0;
  return teamHasCivilization(
    accessor.get(playerTeamsCodec),
    accessor.get(playerCivilizationsCodec),
    owner,
    'Slavs',
  ) ? SLAVS_TEAM_MILITARY_BUILDING_POP : 0;
}
