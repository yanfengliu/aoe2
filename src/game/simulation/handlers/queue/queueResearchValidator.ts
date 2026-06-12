// Validator for `queue.research` command (DESIGN v17 §6.2 / §6.4 B2).
// Same shape as queue.train — best-effort affordability + in-flight-tech
// check. Handler runs at start of next step's processCommands and
// re-checks authoritatively (B2 fix).

import type { World } from 'civ-engine';

import type {
  BuildingComponent,
  BuildingType,
  ResearchableTechnologyType,
} from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';
import { canResearchAt } from '../../prototypeBuildingRules';
import { researchCost, canAfford, describeMissingResources } from '../../prototypeEconomyRules';
import type { BridgeStateAccessor } from '../../bridge/bridgeStateAccessor';
import {
  constructionStatesCodec,
  playerResourcesCodec,
} from '../../bridge/bridgeStateSerialize';

export interface QueueResearchValidatorDeps {
  // Phase 2D: constructionStates + playerResources migrated to
  // world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  getResearchOptions: (
    owner: number,
    buildingType: BuildingType,
  ) => readonly ResearchableTechnologyType[];
  inFlightTechSetFor: (owner: number) => Set<ResearchableTechnologyType>;
  // agent-affordances A1: actionable cannot_research messages. The
  // reason engine (bridge/researchAvailability.ts) names the actual
  // unmet rule; the dispatch feedback loop delivers it to the LLM agent
  // and the HUD toast falls back to it for the cannot_research code.
  researchUnavailableReason: (
    owner: number,
    buildingType: BuildingType,
    tech: ResearchableTechnologyType,
  ) => string;
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
    const construction = deps.accessor.get(constructionStatesCodec).get(data.buildingId);
    if (construction && !construction.isComplete) {
      return { code: 'under_construction', message: 'Building is still under construction.' };
    }
    if (
      !canResearchAt(building.buildingType, data.technologyType)
      || !deps.getResearchOptions(building.owner, building.buildingType).includes(data.technologyType)
    ) {
      return {
        code: 'cannot_research',
        message: deps.researchUnavailableReason(
          building.owner,
          building.buildingType,
          data.technologyType,
        ),
      };
    }
    if (deps.inFlightTechSetFor(building.owner).has(data.technologyType)) {
      return {
        code: 'in_flight_tech',
        message: `${data.technologyType} is already being researched.`,
      };
    }
    const stockpile = deps.accessor.get(playerResourcesCodec).get(building.owner);
    if (!stockpile) {
      return { code: 'no_stockpile', message: 'No resource stockpile for the owner.' };
    }
    const cost = researchCost(data.technologyType);
    if (!canAfford(stockpile, cost)) {
      const detail = describeMissingResources(stockpile, cost);
      return {
        code: 'insufficient_resources',
        message: detail
          ? `Not enough resources to research ${data.technologyType}: ${detail}.`
          : 'Not enough resources to research.',
      };
    }
    return true;
  };
}
