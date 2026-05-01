// Handler for `building.action` command (DESIGN v17 §6.2 / §6.4).
// Dispatches by `actionType` to the action-specific direct helper.

import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface BuildingActionHandlerDeps {
  ungarrisonBuildingDirect: (buildingId: number) => boolean;
}

export type BuildingActionHandler = (
  data: GameCommands['building.action'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeBuildingActionHandler(
  deps: BuildingActionHandlerDeps,
): BuildingActionHandler {
  return (data) => {
    switch (data.actionType) {
      case 'ungarrison':
        deps.ungarrisonBuildingDirect(data.buildingId);
        return;
      default:
        // Compile-time exhaustiveness guard — adding a new BuildingActionType
        // value forces this branch to fail typecheck until the new case is
        // wired (impl-14 review F1: both reviewers flagged the missing
        // exhaustive switch).
        return assertNeverBuildingAction(data.actionType);
    }
  };
}

function assertNeverBuildingAction(value: never): never {
  throw new Error(`Unhandled building.action actionType: ${String(value)}`);
}
