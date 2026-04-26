// Sheep ownership is recomputed every tick: a sheep is owned by the owner
// whose nearest scout/villager is closest. The flip can be visible (tint
// change), so any flip schedules an out-of-band render refresh.

import type { GameWorld } from '../pureHelpers';
import { updateSheepOwnership } from '../visibility';

export interface HerdableOwnershipSystemDeps {
  world: GameWorld;
  markOutOfBandRenderChange: () => void;
}

export function registerHerdableOwnershipSystem(deps: HerdableOwnershipSystemDeps): void {
  const { world, markOutOfBandRenderChange } = deps;

  world.registerSystem({
    name: 'prototypeHerdableOwnership',
    phase: 'update',
    after: ['prototypeWildlifeCombat'],
    execute(activeWorld) {
      if (updateSheepOwnership(activeWorld)) {
        markOutOfBandRenderChange();
      }
    },
  });
}
