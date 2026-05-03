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
import { trainingCost, canAfford } from '../../prototypeEconomyRules';
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
    if (
      !canTrainAt(building.buildingType, data.unitType)
      || !deps.getTrainOptions(building.owner, building.buildingType).includes(data.unitType)
    ) {
      return { code: 'cannot_train', message: 'Cannot train that unit here.' };
    }
    const stockpile = deps.accessor.get(playerResourcesCodec).get(building.owner);
    if (!stockpile) {
      return { code: 'no_stockpile', message: 'No resource stockpile for the owner.' };
    }
    if (!canAfford(stockpile, trainingCost(data.unitType))) {
      return { code: 'insufficient_resources', message: 'Not enough resources to train.' };
    }
    return true;
  };
}
