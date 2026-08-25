// Right-click ON AN ENTITY. The sibling of `contextRouter`, which handles a
// right-click on a CELL — this repo routes right-click twice, and a rule that
// belongs to right-click has to land in both. Split out of `unitCommandOps` for
// the 500-line budget.

import type { Position } from 'civ-engine';

import type {
  BuildingComponent,
  ResourceComponent,
  UnitComponent,
} from '../types';
import { canGarrisonAt } from '../prototypeBuildingRules';
import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { constructionStatesCodec, wildlifeStatesCodec } from './bridgeStateSerialize';

export function createContextAtEntityRouter(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  setUnitAttackCommandDirect: (
    unitId: number,
    targetEntityId: number,
    kind: 'unit' | 'building' | 'resource',
  ) => boolean;
  setUnitBuildCommandDirect: (unitId: number, buildingId: number) => boolean;
  tryRepairCharge: (
    unitId: number,
    targetEntityId: number,
    targetBuilding: BuildingComponent,
  ) => boolean;
  orderGarrison: (unitId: number, buildingId: number) => boolean;
  setUnitGatherCommandDirect: (unitId: number, resourceId: number) => boolean;
  setUnitMoveCommandDirect: (unitId: number, target: Position) => boolean;
  orderTradeRoute: (unitId: number, marketId: number) => boolean;
}) {
  const {
    world,
    accessor,
    setUnitAttackCommandDirect,
    setUnitBuildCommandDirect,
    tryRepairCharge,
    orderGarrison,
    setUnitGatherCommandDirect,
    setUnitMoveCommandDirect,
    orderTradeRoute,
  } = deps;

  function routeUnitContextAtEntityCommandDirect(unitId: number, targetEntityId: number, allowGarrison: boolean): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const targetPosition = world.getComponent<Position>(targetEntityId, 'position');
    if (!unit || !targetPosition) return false;

    const targetUnit = world.getComponent<UnitComponent>(targetEntityId, 'unit');
    if (targetUnit && targetUnit.owner !== unit.owner) {
      return setUnitAttackCommandDirect(unitId, targetEntityId, 'unit');
    }

    const targetBuilding = world.getComponent<BuildingComponent>(targetEntityId, 'building');
    if (targetBuilding) {
      if (targetBuilding.owner !== unit.owner) {
        // A Trade Cart right-clicked on another player's Market opens a trade
        // route (spec §6.7) — any other player's, ally or enemy, as in AoE2.
        // It has to precede the attack branch: an attack-0 cart "attacking" a
        // Market is nonsense, and the enemy Market is the profitable target.
        if (
          unit.unitType === 'trade-cart'
          && targetBuilding.buildingType === 'market'
          && orderTradeRoute(unitId, targetEntityId)
        ) {
          return true;
        }
        return setUnitAttackCommandDirect(unitId, targetEntityId, 'building');
      }

      const construction = accessor.get(constructionStatesCodec).get(targetEntityId);
      if (
        construction
        && !construction.isComplete
        && unit.unitType === 'villager'
        && setUnitBuildCommandDirect(unitId, targetEntityId)
      ) {
        return true;
      }

      // Repair a friendly, complete, damaged building (spec §8.1) — charges up
      // front + queues the repair. Precedes garrison so right-clicking a damaged
      // garrisonable building repairs it (AoE2-faithful).
      if (tryRepairCharge(unitId, targetEntityId, targetBuilding)) {
        return true;
      }

      // Spec §9.3: garrison only on explicit intent; a plain right-click falls
      // through to the move below and walks up to the building.
      if (
        allowGarrison
        && canGarrisonAt(targetBuilding.buildingType, unit.unitType)
        && (!construction || construction.isComplete)
      ) {
        // AoE2 walks the unit to the building and puts it in on arrival. Going
        // in from any distance made garrison a free escape from anything
        // chasing the unit — so a unit already standing against the building
        // enters now, and everyone else gets a walk order that ends in the
        // same place.
        return orderGarrison(unitId, targetEntityId);
      }
    }

    const targetResource = world.getComponent<ResourceComponent>(targetEntityId, 'resource');
    const wildlife = accessor.get(wildlifeStatesCodec).get(targetEntityId);
    if (targetResource && wildlife?.isAlive) {
      return setUnitAttackCommandDirect(unitId, targetEntityId, 'resource');
    }

    if (unit.unitType === 'villager' && setUnitGatherCommandDirect(unitId, targetEntityId)) {
      return true;
    }

    return setUnitMoveCommandDirect(unitId, targetPosition);
  }

  return routeUnitContextAtEntityCommandDirect;
}
