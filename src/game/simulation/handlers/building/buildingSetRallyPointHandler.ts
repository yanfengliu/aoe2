// Handler for `building.setRallyPoint` command (DESIGN v17 §6.2 / §6.4).
// Direct mutation: rallyPoints.set(buildingId, target). No re-check needed
// — rally points have no resource cost or shared-state race condition.

import type { Position, World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface BuildingSetRallyPointHandlerDeps {
  rallyPoints: Map<number, Position>;
}

export type BuildingSetRallyPointHandler = (
  data: GameCommands['building.setRallyPoint'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeBuildingSetRallyPointHandler(
  deps: BuildingSetRallyPointHandlerDeps,
): BuildingSetRallyPointHandler {
  return (data) => {
    deps.rallyPoints.set(data.buildingId, { x: data.target.x, y: data.target.y });
  };
}
