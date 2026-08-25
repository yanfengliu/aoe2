// Team production-speed bonuses (spec §9.2 team_bonus): a side with Britons
// trains at Archery Ranges 20% faster, Goths at Barracks, Huns at Stables,
// Turks train GUNPOWDER units faster anywhere, and Malians research at the
// University 80% faster. Multipliers below 1 shorten the queue; they compose
// with Conscription and the rest exactly where those already multiply.

import type { BuildingType, UnitType } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { playerCivilizationsCodec, playerTeamsCodec } from './bridgeStateSerialize';
import {
  MALIANS_TEAM_UNIVERSITY_RESEARCH_MULTIPLIER,
  TEAM_PRODUCTION_SPEED_MULTIPLIER,
  teamHasCivilization,
} from '../teamBonuses';

const GUNPOWDER_UNITS = new Set<UnitType>([
  'hand-cannoneer', 'bombard-cannon', 'cannon-galleon', 'elite-cannon-galleon',
  'conquistador', 'elite-conquistador', 'janissary', 'elite-janissary',
]);

const BUILDING_SPEED_CIVS: ReadonlyArray<readonly [BuildingType, string]> = [
  ['archery-range', 'Britons'],
  ['barracks', 'Goths'],
  ['stable', 'Huns'],
];

export function teamTrainTimeMultiplier(
  accessor: BridgeStateAccessor,
  owner: number,
  buildingType: BuildingType,
  unitType: UnitType,
): number {
  const teams = accessor.get(playerTeamsCodec);
  const civilizations = accessor.get(playerCivilizationsCodec);
  let multiplier = 1;
  for (const [building, civilization] of BUILDING_SPEED_CIVS) {
    if (buildingType === building && teamHasCivilization(teams, civilizations, owner, civilization)) {
      multiplier *= TEAM_PRODUCTION_SPEED_MULTIPLIER;
    }
  }
  if (GUNPOWDER_UNITS.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Turks')) {
    multiplier *= TEAM_PRODUCTION_SPEED_MULTIPLIER;
  }
  return multiplier;
}

export function teamResearchTimeMultiplier(
  accessor: BridgeStateAccessor,
  owner: number,
  buildingType: BuildingType,
): number {
  if (
    buildingType === 'university'
    && teamHasCivilization(
      accessor.get(playerTeamsCodec),
      accessor.get(playerCivilizationsCodec),
      owner,
      'Malians',
    )
  ) {
    return MALIANS_TEAM_UNIVERSITY_RESEARCH_MULTIPLIER;
  }
  return 1;
}
