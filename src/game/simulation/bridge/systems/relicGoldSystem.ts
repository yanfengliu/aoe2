// Per tick, every owner with deposited relics gets +1 gold per relic.
// Iterates Monasteries and accumulates into each owner's resource bank.

import type { BuildingComponent, PlayerResources } from '../../types';
import type { GameWorld } from '../pureHelpers';

export interface RelicGoldSystemDeps {
  world: GameWorld;
  relicsInMonastery: Map<number, number>;
  playerResources: Map<number, PlayerResources>;
}

export function registerRelicGoldSystem(deps: RelicGoldSystemDeps): void {
  const { world, relicsInMonastery, playerResources } = deps;

  world.registerSystem({
    name: 'prototypeRelicGold',
    phase: 'update',
    after: ['prototypeMonkBehavior'],
    execute(activeWorld) {
      for (const [monasteryId, count] of relicsInMonastery.entries()) {
        if (count <= 0) {
          continue;
        }
        const building = activeWorld.getComponent<BuildingComponent>(monasteryId, 'building');
        if (!building || building.buildingType !== 'monastery') {
          relicsInMonastery.delete(monasteryId);
          continue;
        }
        const stockpile = playerResources.get(building.owner);
        if (!stockpile) {
          continue;
        }
        stockpile.gold += count;
      }
    },
  });
}
