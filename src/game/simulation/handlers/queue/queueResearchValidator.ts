// Validator for `queue.research` command (DESIGN v17 §6.2 / §6.4 B2).
// Same shape as queue.train — best-effort affordability + in-flight-tech
// check. Handler runs at start of next step's processCommands and
// re-checks authoritatively (B2 fix).

import type { World } from 'civ-engine';

import type {
  BuildingComponent,
  BuildingType,
  PlayerResources,
  ResearchableTechnologyType,
} from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';
import { canResearchAt } from '../../prototypeBuildingRules';
import { researchCost, canAfford } from '../../prototypeEconomyRules';

export interface QueueResearchValidatorDeps {
  constructionStates: Map<number, { isComplete: boolean }>;
  playerResources: Map<number, PlayerResources>;
  getResearchOptions: (
    owner: number,
    buildingType: BuildingType,
  ) => readonly ResearchableTechnologyType[];
  inFlightTechSetFor: (owner: number) => Set<ResearchableTechnologyType>;
}

export type QueueResearchValidator = (
  data: GameCommands['queue.research'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | { code: string; message: string };

export function makeQueueResearchValidator(deps: QueueResearchValidatorDeps): QueueResearchValidator {
  return (data, world) => {
    if (!Number.isInteger(data.buildingId)) {
      return { code: 'invalid_building_id', message: 'Building id must be an integer.' };
    }
    if (!world.isAlive(data.buildingId)) {
      return { code: 'building_not_found', message: 'Building no longer exists.' };
    }
    const building = world.getComponent<BuildingComponent>(data.buildingId, 'building');
    if (!building) {
      return { code: 'not_a_building', message: 'Entity is not a building.' };
    }
    const construction = deps.constructionStates.get(data.buildingId);
    if (construction && !construction.isComplete) {
      return { code: 'under_construction', message: 'Building is still under construction.' };
    }
    if (
      !canResearchAt(building.buildingType, data.technologyType)
      || !deps.getResearchOptions(building.owner, building.buildingType).includes(data.technologyType)
    ) {
      return { code: 'cannot_research', message: 'Cannot research that here.' };
    }
    if (deps.inFlightTechSetFor(building.owner).has(data.technologyType)) {
      return { code: 'in_flight_tech', message: 'Research is already in progress.' };
    }
    const stockpile = deps.playerResources.get(building.owner);
    if (!stockpile) {
      return { code: 'no_stockpile', message: 'No resource stockpile for the owner.' };
    }
    if (!canAfford(stockpile, researchCost(data.technologyType))) {
      return { code: 'insufficient_resources', message: 'Not enough resources to research.' };
    }
    return true;
  };
}
