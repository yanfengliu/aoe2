// Handler for `building.setRallyPoint` command (DESIGN v17 §6.2 / §6.4).
// Direct mutation via accessor: writes to world.state.aoe2.rallyPoints. No
// re-check needed — rally points have no resource cost or shared-state
// race condition.

import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';
import type { BridgeStateAccessor } from '../../bridge/bridgeStateAccessor';
import { rallyPointsCodec } from '../../bridge/bridgeStateSerialize';

export interface BuildingSetRallyPointHandlerDeps {
  // Phase 2D: rallyPoints migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
}

export type BuildingSetRallyPointHandler = (
  data: GameCommands['building.setRallyPoint'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeBuildingSetRallyPointHandler(
  deps: BuildingSetRallyPointHandlerDeps,
): BuildingSetRallyPointHandler {
  return (data) => {
    deps.accessor.mutate(rallyPointsCodec, (m) => {
      m.set(data.buildingId, { x: data.target.x, y: data.target.y });
    });
  };
}
