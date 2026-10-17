// The Delete key (spec §9, v0.3.114): `entity.delete` removes the issuer's
// OWN unit or building. Validator enforces existence + ownership; the handler
// routes to the same destroy ops combat uses, so population, refs, rally
// points, and render feeds all settle through the one door.

import type { World } from 'civ-engine';

import type { BuildingComponent, UnitComponent } from '../types';
import type { GameCommands, GameEvents, GameComponents } from '../bridge/pureHelpers';
import type { BridgeStateAccessor } from '../bridge/bridgeStateAccessor';
import { constructionStatesCodec, playerResourcesCodec } from '../bridge/bridgeStateSerialize';
import { ownerConstructionCost } from '../bridge/ownerCosts';
import { isConstructionStarted } from '../bridge/unstartedFoundations';

type GameWorldT = World<GameEvents, GameCommands, GameComponents>;

export const entityDeleteValidator = (
  data: GameCommands['entity.delete'],
  world: GameWorldT,
): true | { code: string; message: string } => {
  if (!Number.isInteger(data.entityId)) {
    return { code: 'invalid_entity_id', message: 'Entity id must be an integer.' };
  }
  if (!world.isAlive(data.entityId)) {
    return { code: 'entity_not_found', message: 'Entity no longer exists.' };
  }
  const unit = world.getComponent<UnitComponent>(data.entityId, 'unit');
  const building = world.getComponent<BuildingComponent>(data.entityId, 'building');
  const owner = unit?.owner ?? building?.owner;
  if (owner === undefined) {
    return { code: 'not_deletable', message: 'Only units and buildings can be deleted.' };
  }
  if (owner !== data.requestedBy) {
    return { code: 'not_yours', message: 'Only your own units and buildings can be deleted.' };
  }
  return true;
};

export function makeEntityDeleteHandler(deps: {
  accessor: BridgeStateAccessor;
  destroyUnitEntity: (id: number) => void;
  destroyBuildingEntity: (id: number) => void;
}) {
  return (data: GameCommands['entity.delete'], world: GameWorldT): void => {
    if (!world.isAlive(data.entityId)) return;
    if (world.getComponent<UnitComponent>(data.entityId, 'unit')) {
      deps.destroyUnitEntity(data.entityId);
      return;
    }
    const building = world.getComponent<BuildingComponent>(data.entityId, 'building');
    if (building && building.owner === data.requestedBy) {
      // No paid receipt is saved. As with foundationStart's cancellation,
      // old and new foundations refund the owner's current effective price.
      // Combat destruction never passes through this voluntary-delete path.
      if (!isConstructionStarted(deps.accessor.get(constructionStatesCodec).get(data.entityId))) {
        const stockpile = deps.accessor.get(playerResourcesCodec).get(building.owner);
        if (stockpile) {
          const cost = ownerConstructionCost(deps.accessor, building.owner, building.buildingType);
          for (const kind of ['food', 'wood', 'gold', 'stone'] as const) stockpile[kind] += cost[kind] ?? 0;
          deps.accessor.markDirty(playerResourcesCodec);
        }
      }
      deps.destroyBuildingEntity(data.entityId);
    }
  };
}
