// Validator for `queue.train` command (DESIGN v17 §6.2 / §6.4).
// Structural checks + best-effort affordability for HUD-time UX rejection.
// The handler runs at start of next step's processCommands and re-checks
// authoritatively (B2 fix in §6.4): two queue.train commands in the same
// frame whose total cost exceeds the player's stockpile must result in
// exactly one of them succeeding.

import type { World } from 'civ-engine';

import type { BuildingComponent, BuildingType, TrainableUnitType } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';
import { canTrainAt } from '../../prototypeBuildingRules';
import { trainingCost, canAfford, describeMissingResources } from '../../prototypeEconomyRules';
import type { BridgeStateAccessor } from '../../bridge/bridgeStateAccessor';
import {
  constructionStatesCodec,
  playerResourcesCodec,
} from '../../bridge/bridgeStateSerialize';

export interface QueueTrainValidatorDeps {
  // Phase 2D: constructionStates + playerResources migrated to
  // world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  // The owner-aware filter (covers age/civ gating); validator imports only
  // for the "can owner train this from this building" check.
  getTrainOptions: (
    owner: number,
    buildingType: BuildingType,
  ) => readonly TrainableUnitType[];
}

export type QueueTrainValidator = (
  data: GameCommands['queue.train'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | { code: string; message: string };

export function makeQueueTrainValidator(deps: QueueTrainValidatorDeps): QueueTrainValidator {
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
    // agent-affordances A1/A2: name the rejected unit + what IS
    // trainable here, and the need-vs-have resource detail, so the LLM
    // agent (and HUD toast fallback) can act instead of guessing.
    const options = deps.getTrainOptions(building.owner, building.buildingType);
    if (!canTrainAt(building.buildingType, data.unitType) || !options.includes(data.unitType)) {
      const note = options.length > 0
        ? `Currently trainable here: ${options.join(', ')}.`
        : 'Nothing is currently trainable at this building right now (check your age).';
      return {
        code: 'cannot_train',
        message: `Cannot train ${data.unitType} at this ${building.buildingType}. ${note}`,
      };
    }
    const stockpile = deps.accessor.get(playerResourcesCodec).get(building.owner);
    if (!stockpile) {
      return { code: 'no_stockpile', message: 'No resource stockpile for the owner.' };
    }
    const cost = trainingCost(data.unitType);
    if (!canAfford(stockpile, cost)) {
      const detail = describeMissingResources(stockpile, cost);
      return {
        code: 'insufficient_resources',
        message: detail
          ? `Not enough resources to train ${data.unitType}: ${detail}.`
          : 'Not enough resources to train.',
      };
    }
    return true;
  };
}
