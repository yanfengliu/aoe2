// Team production-speed bonuses (spec §9.2 team_bonus): a side with Britons
// trains at Archery Ranges 20% faster, Goths at Barracks, Huns at Stables,
// Turks train GUNPOWDER units faster anywhere, and Malians research at the
// University 80% faster. Multipliers below 1 shorten the queue; they compose
// with Conscription and the rest exactly where those already multiply.

import type { BuildingType, UnitType } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { playerAgesCodec, playerCivilizationsCodec, playerTeamsCodec } from './bridgeStateSerialize';
import {
  BRITONS_TEAM_ARCHERY_MULTIPLIER,
  MALIANS_TEAM_UNIVERSITY_RESEARCH_MULTIPLIER,
  TEAM_PRODUCTION_SPEED_MULTIPLIER,
  TURKS_TEAM_GUNPOWDER_MULTIPLIER,
  teamHasCivilization,
} from '../teamBonuses';

const GUNPOWDER_UNITS = new Set<UnitType>([
  'hand-cannoneer', 'bombard-cannon', 'cannon-galleon', 'elite-cannon-galleon',
  'conquistador', 'elite-conquistador', 'janissary', 'elite-janissary',
]);

// Sourced v0.3.144: per-civ team speeds differ (Britons +10%, Goths/Huns
// and Celts' siege workshops +20%, Turks' gunpowder +25%).
const BUILDING_SPEED_CIVS: ReadonlyArray<readonly [BuildingType, string, number]> = [
  ['archery-range', 'Britons', BRITONS_TEAM_ARCHERY_MULTIPLIER],
  ['barracks', 'Goths', TEAM_PRODUCTION_SPEED_MULTIPLIER],
  ['stable', 'Huns', TEAM_PRODUCTION_SPEED_MULTIPLIER],
  ['siege-workshop', 'Celts', TEAM_PRODUCTION_SPEED_MULTIPLIER],
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
  for (const [building, civilization, speed] of BUILDING_SPEED_CIVS) {
    if (buildingType === building && teamHasCivilization(teams, civilizations, owner, civilization)) {
      multiplier *= speed;
    }
  }
  if (GUNPOWDER_UNITS.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Turks')) {
    multiplier *= TURKS_TEAM_GUNPOWDER_MULTIPLIER;
  }
  // Magyar team bonus (sourced v0.3.144, replacing the DE-dead foot-archer
  // LoS): mounted archers train +25% faster anywhere they train.
  if ((unitType === 'cavalry-archer' || unitType === 'heavy-cavalry-archer')
    && teamHasCivilization(teams, civilizations, owner, 'Magyars')) {
    multiplier *= TURKS_TEAM_GUNPOWDER_MULTIPLIER;
  }
  // Persians (sourced v0.3.151): TCs and Docks WORK faster by age — their
  // training rides the same clause as their research.
  if (civilizations.get(owner) === 'Persians'
    && (buildingType === 'town-center' || buildingType === 'dock')) {
    multiplier *= PERSIAN_WORK_RATE_BY_AGE[accessor.get(playerAgesCodec).get(owner) ?? 'dark-age'] ?? 1;
  }
  return multiplier;
}

// v0.3.151: CIV research-time clauses ride the same multiplier the team
// bonuses use — Goths' instant Loom, Vietnamese eco research +100% faster,
// Persian TC/Dock work rate by age.
const VIETNAMESE_ECO_TECHS = new Set<string>([
  'double-bit-axe', 'bow-saw', 'two-man-saw', 'horse-collar', 'heavy-plow', 'crop-rotation',
  'gold-mining', 'gold-shaft-mining', 'stone-mining', 'stone-shaft-mining',
  'wheelbarrow', 'hand-cart', 'loom',
]);
const PERSIAN_WORK_RATE_BY_AGE: Record<string, number> = {
  'dark-age': 1 / 1.05, 'feudal-age': 1 / 1.1, 'castle-age': 1 / 1.15, 'imperial-age': 1 / 1.2,
};

export function teamResearchTimeMultiplier(
  accessor: BridgeStateAccessor,
  owner: number,
  buildingType: BuildingType,
  technologyType?: string,
): number {
  let multiplier = 1;
  const civ = accessor.get(playerCivilizationsCodec).get(owner);
  if (civ === 'Goths' && technologyType === 'loom') {
    // DE: "Loom is researched instantly".
    return 0;
  }
  if (civ === 'Vietnamese' && technologyType !== undefined && VIETNAMESE_ECO_TECHS.has(technologyType)) {
    multiplier *= 0.5;
  }
  if (civ === 'Persians' && (buildingType === 'town-center' || buildingType === 'dock')) {
    multiplier *= PERSIAN_WORK_RATE_BY_AGE[accessor.get(playerAgesCodec).get(owner) ?? 'dark-age'] ?? 1;
  }
  if (
    buildingType === 'university'
    && teamHasCivilization(
      accessor.get(playerTeamsCodec),
      accessor.get(playerCivilizationsCodec),
      owner,
      'Malians',
    )
  ) {
    multiplier *= MALIANS_TEAM_UNIVERSITY_RESEARCH_MULTIPLIER;
  }
  // Portuguese team bonus (current DE, replacing the retired free
  // Cartography): every technology researches 25% faster for the side.
  if (
    teamHasCivilization(
      accessor.get(playerTeamsCodec),
      accessor.get(playerCivilizationsCodec),
      owner,
      'Portuguese',
    )
  ) {
    multiplier *= PORTUGUESE_TEAM_RESEARCH_MULTIPLIER;
  }
  return multiplier;
}

// +25% speed = time × 1/1.25.
export const PORTUGUESE_TEAM_RESEARCH_MULTIPLIER = 0.8;
