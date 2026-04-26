// Reapplies vision-source mutations to the visibility map every tick.
// `syncVisibilitySources` lives in `bridge/visibility`; this system just
// schedules it on the bridge's tick.

import { VisibilityMap } from 'civ-engine';
import type { GameWorld } from '../pureHelpers';
import { syncVisibilitySources } from '../visibility';

export interface VisibilitySystemDeps {
  world: GameWorld;
  visibility: VisibilityMap;
  trackedVisibilitySources: Map<number, number>;
}

export function registerVisibilitySystem(deps: VisibilitySystemDeps): void {
  const { world, visibility, trackedVisibilitySources } = deps;

  world.registerSystem({
    name: 'prototypeVisibility',
    phase: 'update',
    after: ['prototypeHerdableOwnership'],
    execute(activeWorld) {
      syncVisibilitySources(activeWorld, visibility, trackedVisibilitySources);
    },
  });
}
