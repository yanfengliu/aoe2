// Buildings WEAR their damage (v0.3.97, spec building damage states): a
// completed building whose hit points fall under the threshold flips its
// renderable variant to 'damaged' - the recipe layer adds fire and smoke -
// and repairing it back over the threshold restores the clean look. The flip
// is a plain component write, so fog memory naturally snapshots whichever
// look was last seen, and saves carry it like any renderable field.

import type { BuildingComponent, RenderableComponent } from '../../types';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { buildingHealthStatesCodec, constructionStatesCodec } from '../bridgeStateSerialize';
import type { GameWorld } from '../pureHelpers';

export const BUILDING_DAMAGED_VARIANT_THRESHOLD = 0.4;

export function registerBuildingDamageVariantSystem(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  markOutOfBandRenderChange: () => void;
}): void {
  const { world, accessor, markOutOfBandRenderChange } = deps;
  world.registerSystem({
    name: 'buildingDamageVariant',
    phase: 'update',
    execute(activeWorld) {
      const healths = accessor.get(buildingHealthStatesCodec);
      const constructions = accessor.get(constructionStatesCodec);
      let changed = false;
      for (const id of activeWorld.query('building', 'renderable')) {
        const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
        const renderable = activeWorld.getComponent<RenderableComponent>(id, 'renderable');
        if (!building || !renderable) continue;
        // Scaffolds keep their construction look whatever their HP.
        if (renderable.visualVariant === 'construction') continue;
        const construction = constructions.get(id);
        if (construction && !construction.isComplete) continue;
        const health = healths.get(id);
        if (!health || health.maxHp <= 0) continue;
        const desired = health.currentHp / health.maxHp < BUILDING_DAMAGED_VARIANT_THRESHOLD
          ? 'damaged' as const
          : 'complete' as const;
        if (renderable.visualVariant !== desired) {
          renderable.visualVariant = desired;
          changed = true;
        }
      }
      if (changed) markOutOfBandRenderChange();
    },
  });
}
