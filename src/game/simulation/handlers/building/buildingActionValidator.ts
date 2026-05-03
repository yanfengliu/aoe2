// Validator for `building.action` command (DESIGN v17 §6.2 / §6.4).
// `BuildingActionType` is currently `'ungarrison'`; extensible as new
// building-scoped actions land. Validator does structural checks; handler
// delegates to the action-specific direct helper.

import type { World } from 'civ-engine';

import type { BuildingComponent } from '../../types';
import type { BuildingActionType } from '../../commands';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';
import type { BridgeStateAccessor } from '../../bridge/bridgeStateAccessor';
import { constructionStatesCodec } from '../../bridge/bridgeStateSerialize';

const SUPPORTED_ACTIONS: ReadonlySet<BuildingActionType> = new Set<BuildingActionType>([
  'ungarrison',
]);

export interface BuildingActionValidatorDeps {
  // Phase 2D: constructionStates migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
}

export type BuildingActionValidator = (
  data: GameCommands['building.action'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | { code: string; message: string };

export function makeBuildingActionValidator(
  deps: BuildingActionValidatorDeps,
): BuildingActionValidator {
  return (data, world) => {
    if (!Number.isInteger(data.buildingId)) {
      return { code: 'invalid_building_id', message: 'Building id must be an integer.' };
    }
    if (!SUPPORTED_ACTIONS.has(data.actionType)) {
      return { code: 'unknown_action', message: 'Unknown building action.' };
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
    return true;
  };
}
