// Handler for `building.placeConfirm` command (DESIGN v17 §6.2 / §6.4 B2).
// Delegates to startConstructionWithBuildersDirect, which spends resources
// once, creates the building once, and sets a build command on every id
// (primary + additionalBuilderIds). Backward compatible — when
// additionalBuilderIds is omitted, the helper is called with a single-id
// list and the resulting behavior matches the pre-multi-villager flow.

import type { Position, World } from 'civ-engine';

import type { BuildableBuildingType } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface BuildingPlaceConfirmHandlerDeps {
  startConstructionWithBuildersDirect: (
    builderIds: readonly number[],
    buildingType: BuildableBuildingType,
    anchor: Position,
  ) => boolean;
}

export type BuildingPlaceConfirmHandler = (
  data: GameCommands['building.placeConfirm'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeBuildingPlaceConfirmHandler(
  deps: BuildingPlaceConfirmHandlerDeps,
): BuildingPlaceConfirmHandler {
  return (data) => {
    const builderIds = data.additionalBuilderIds && data.additionalBuilderIds.length > 0
      ? [data.builderId, ...data.additionalBuilderIds]
      : [data.builderId];
    deps.startConstructionWithBuildersDirect(builderIds, data.buildingType, data.position);
  };
}
