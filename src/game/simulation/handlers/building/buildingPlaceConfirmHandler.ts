// Handler for `building.placeConfirm` command (DESIGN v17 §6.2 / §6.4 B2).
// Delegates to startConstructionDirect (= existing startConstruction body),
// which already does authoritative re-check + spendResources + entity
// creation + builder unit-command set atomically.

import type { Position, World } from 'civ-engine';

import type { BuildableBuildingType } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface BuildingPlaceConfirmHandlerDeps {
  startConstructionDirect: (
    builderId: number,
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
    deps.startConstructionDirect(data.builderId, data.buildingType, data.position);
  };
}
