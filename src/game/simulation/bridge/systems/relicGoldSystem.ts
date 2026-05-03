// Per tick, every owner with deposited relics gets +1 gold per relic.
// Iterates Monasteries and accumulates into each owner's resource bank.

import type { BuildingComponent, PlayerResources } from '../../types';
import type { GameWorld } from '../pureHelpers';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { relicsInMonasteryCodec } from '../bridgeStateSerialize';

export interface RelicGoldSystemDeps {
  world: GameWorld;
  // Phase 2D: relicsInMonastery migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  playerResources: Map<number, PlayerResources>;
}

export function registerRelicGoldSystem(deps: RelicGoldSystemDeps): void {
  const { world, accessor, playerResources } = deps;

  world.registerSystem({
    name: 'prototypeRelicGold',
    phase: 'update',
    after: ['prototypeMonkBehavior'],
    execute(activeWorld) {
      const relicsInMonastery = accessor.get(relicsInMonasteryCodec);
      let dirty = false;
      for (const [monasteryId, count] of relicsInMonastery.entries()) {
        if (count <= 0) {
          continue;
        }
        const building = activeWorld.getComponent<BuildingComponent>(monasteryId, 'building');
        if (!building || building.buildingType !== 'monastery') {
          relicsInMonastery.delete(monasteryId);
          dirty = true;
          continue;
        }
        const stockpile = playerResources.get(building.owner);
        if (!stockpile) {
          continue;
        }
        stockpile.gold += count;
      }
      if (dirty) {
        accessor.markDirty(relicsInMonasteryCodec);
      }
    },
  });
}
