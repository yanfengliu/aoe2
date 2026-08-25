// Trade-route ordering (spec §6.7), extracted from `unitCommandOps` for the
// 500-LOC budget: a Trade Cart/Cog right-clicked on another player's Market/
// Dock opens the walking route; the command carries the far end by ref so the
// leg survives saves and the far Market burning down mid-run.

import type { EntityRef, Position } from 'civ-engine';

import type { UnitCommand } from './sharedTypes';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { constructionStatesCodec } from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

export function createTradeRouteOrder(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  clearGathererOrder: (id: number) => void;
  setUnitCommand: (unitId: number, command: UnitCommand) => void;
  getEntityRef: (id: number) => EntityRef | null;
}) {
  const { world, accessor, clearGathererOrder, setUnitCommand, getEntityRef } = deps;
  return function orderTradeRoute(unitId: number, marketId: number): boolean {
    const marketPosition = world.getComponent<Position>(marketId, 'position');
    const marketRef = getEntityRef(marketId);
    const construction = accessor.get(constructionStatesCodec).get(marketId);
    if (!marketPosition || !marketRef || (construction && !construction.isComplete)) {
      return false;
    }
    clearGathererOrder(unitId);
    setUnitCommand(unitId, {
      type: 'trade',
      target: { x: marketPosition.x, y: marketPosition.y },
      buildingRef: marketRef,
      tradeFarMarketRef: marketRef,
    });
    return true;
  }
}
