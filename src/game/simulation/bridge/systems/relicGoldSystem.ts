// Per tick, every owner with deposited relics gets +1 gold per relic.
// Iterates Monasteries and accumulates into each owner's resource bank.

import type { BuildingComponent } from '../../types';
import type { GameWorld } from '../pureHelpers';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import {
  playerResourcesCodec,
  relicsInMonasteryCodec,
} from '../bridgeStateSerialize';

export interface RelicGoldSystemDeps {
  world: GameWorld;
  // Phase 2D: relicsInMonastery + playerResources migrated to
  // world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
}

export function registerRelicGoldSystem(deps: RelicGoldSystemDeps): void {
  const { world, accessor } = deps;

  world.registerSystem({
    name: 'prototypeRelicGold',
    phase: 'update',
    after: ['prototypeMonkBehavior'],
    execute(activeWorld) {
      const relicsInMonastery = accessor.get(relicsInMonasteryCodec);
      const playerResources = accessor.get(playerResourcesCodec);
      let dirty = false;
      let resourcesDirty = false;
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
        resourcesDirty = true;
      }
      if (dirty) {
        accessor.markDirty(relicsInMonasteryCodec);
      }
      if (resourcesDirty) {
        accessor.markDirty(playerResourcesCodec);
      }
    },
  });
}
