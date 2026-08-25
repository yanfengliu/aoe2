// One tick of a Trade Cart's route (spec §6.7), advanced by the player-command
// loop the way 'garrison' is: walk to the current leg's Market, and on arrival
// flip the leg — loading the distance-scaled profit at the far Market, paying
// it out at your own. The route lives entirely in the unit's `trade` command,
// so it survives a save mid-leg and dies with the cart, and the goods survive
// the far Market: once loaded, the gold is on the cart (AoE2's behaviour).

import type { EntityRef, Position } from 'civ-engine';

import type { BuildingComponent } from '../types';
import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { UnitCommand } from './sharedTypes';
import { constructionStatesCodec, playerResourcesCodec } from './bridgeStateSerialize';
import { tradeProfit } from '../tradeRules';

export interface TradeStepDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  id: number;
  owner: number;
  command: UnitCommand;
  buildingId: number;
  building: BuildingComponent;
  approachDestination: Position;
  isUnitAtTarget: (id: number, target: Position, world: GameWorld) => boolean;
  moveUnitOneSubgridStep: (id: number, step: Position, world: GameWorld) => void;
  clearUnitCommand: (id: number) => void;
  setUnitCommand: (id: number, command: UnitCommand) => void;
  currentEntityId: (world: GameWorld, ref: EntityRef | undefined) => number | null;
  getEntityRef: (id: number) => EntityRef | null;
  approachStep: Position;
}

/** Which building a trade unit trades BETWEEN: Markets by land, Docks by sea. */
export function tradeAnchorBuildingType(unitType: string): 'market' | 'dock' {
  return unitType === 'trade-cog' ? 'dock' : 'market';
}

/** The trader's own complete Market (or Dock) nearest to `position`. */
export function nearestOwnMarket(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  owner: number,
  position: Position,
  buildingType: 'market' | 'dock' = 'market',
): { id: number; position: Position } | null {
  let best: { id: number; position: Position } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const id of world.query('building', 'position')) {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (!building || building.owner !== owner || building.buildingType !== buildingType) continue;
    const construction = accessor.get(constructionStatesCodec).get(id);
    if (construction && !construction.isComplete) continue;
    const marketPosition = world.getComponent<Position>(id, 'position');
    if (!marketPosition) continue;
    const distance = Math.hypot(marketPosition.x - position.x, marketPosition.y - position.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { id, position: marketPosition };
    }
  }
  return best;
}

/** Advance one trade tick. Returns true when it handled the command. */
export function runTradeStep(deps: TradeStepDeps): boolean {
  const {
    world, accessor, id, owner, command, buildingId, approachDestination,
    isUnitAtTarget, moveUnitOneSubgridStep, clearUnitCommand, setUnitCommand,
    currentEntityId, getEntityRef, approachStep,
  } = deps;
  if (command.type !== 'trade') return false;

  if (!isUnitAtTarget(id, approachDestination, world)) {
    moveUnitOneSubgridStep(id, approachStep, world);
    return true;
  }

  const cartPosition = world.getComponent<Position>(id, 'position');
  if (!cartPosition) {
    clearUnitCommand(id);
    return true;
  }

  if (command.tradeCarriedGold === undefined) {
    // Arrived at the FAR Market: load the goods and turn for home. The profit
    // is fixed here, from the two Markets as they stand — what the cart
    // carries no longer depends on either surviving the walk back.
    const farPosition = world.getComponent<Position>(buildingId, 'position');
    const unit = world.getComponent<{ unitType: string }>(id, 'unit');
    const home = nearestOwnMarket(
      world, accessor, owner, cartPosition,
      tradeAnchorBuildingType(unit?.unitType ?? 'trade-cart'),
    );
    if (!farPosition || !home) {
      // Nowhere to bring it home: the route cannot run.
      clearUnitCommand(id);
      return true;
    }
    setUnitCommand(id, {
      type: 'trade',
      target: home.position,
      buildingRef: getEntityRef(home.id) ?? undefined,
      tradeFarMarketRef: command.tradeFarMarketRef,
      tradeCarriedGold: tradeProfit(farPosition, home.position),
    });
    return true;
  }

  // Arrived HOME: pay out, and turn back for the far Market if it still
  // stands — a burned-down far end simply ends the route after this payout.
  const stockpile = accessor.get(playerResourcesCodec).get(owner);
  if (stockpile) {
    stockpile.gold += command.tradeCarriedGold;
    accessor.markDirty(playerResourcesCodec);
  }
  const farId = currentEntityId(world, command.tradeFarMarketRef);
  const farPosition = farId === null
    ? null
    : world.getComponent<Position>(farId, 'position');
  if (farId === null || !farPosition) {
    clearUnitCommand(id);
    return true;
  }
  setUnitCommand(id, {
    type: 'trade',
    target: farPosition,
    buildingRef: command.tradeFarMarketRef,
    tradeFarMarketRef: command.tradeFarMarketRef,
  });
  return true;
}
