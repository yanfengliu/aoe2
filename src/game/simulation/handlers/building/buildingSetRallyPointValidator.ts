// Validator for `building.setRallyPoint` command (DESIGN v17 §6.2 / §6.4).
// Structural checks only — rally-point setting has no resource cost or
// per-frame race semantics, so the B2 fix doesn't apply here.

import type { World } from 'civ-engine';

import type { BuildingComponent } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';
import type { BridgeStateAccessor } from '../../bridge/bridgeStateAccessor';
import { constructionStatesCodec } from '../../bridge/bridgeStateSerialize';

export interface BuildingSetRallyPointValidatorDeps {
  // Phase 2D: constructionStates migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  mapWidth: number;
  mapHeight: number;
}

export type BuildingSetRallyPointValidator = (
  data: GameCommands['building.setRallyPoint'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | { code: string; message: string };

export function makeBuildingSetRallyPointValidator(
  deps: BuildingSetRallyPointValidatorDeps,
): BuildingSetRallyPointValidator {
  // Check order mirrors buildingPlaceConfirmValidator (impl-12 review F3 —
  // structural id checks first, entity-shape checks next, OOB last):
  // an out-of-bounds target on a dead building reports `building_not_found`
  // rather than `out_of_bounds`, so log analyzers can key on the most
  // specific real failure.
  return (data, world) => {
    if (!Number.isInteger(data.buildingId)) {
      return { code: 'invalid_building_id', message: 'Building id must be an integer.' };
    }
    if (
      !Number.isInteger(data.target?.x)
      || !Number.isInteger(data.target?.y)
    ) {
      return { code: 'invalid_target', message: 'Target coordinates must be integers.' };
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
      data.target.x < 0
      || data.target.x >= deps.mapWidth
      || data.target.y < 0
      || data.target.y >= deps.mapHeight
    ) {
      return { code: 'out_of_bounds', message: 'Target is out of map bounds.' };
    }
    return true;
  };
}
