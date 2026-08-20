// Masonry / Architecture applied to the buildings an owner ALREADY has.
//
// The other half — everything built afterwards — is derived at the creation
// site from the same multiplier (entityCreateOps). Both halves are needed, and
// this is the same shape as loomEffect / sanctityEffect / bloodlinesEffect.
//
// A damaged building keeps the damage it has taken: the upgrade raises the
// ceiling, it does not repair. A building at full health stays at full health,
// which is what makes the tech feel like an upgrade rather than a heal.

import {
  buildingHitPointMultiplier,
  singleBuildingHpMultiplier,
} from '../buildingTechEffects';
import type { BuildingComponent } from '../types';
import type { ResearchableTechnologyType } from '../technologyTypes';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { buildingHealthStatesCodec } from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

export function applyBuildingHpTechnology(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  owner: number,
  technology: ResearchableTechnologyType,
): void {
  // The multiplier for THIS technology alone: the owner's others, if
  // researched, are already baked into the stored maxHp. A technology that
  // toughens only ONE kind of building (Fortified Wall, the tower upgrades)
  // contributes 1 to everything else, so the loop below leaves them untouched.
  const generalMultiplier = buildingHitPointMultiplier(
    new Set<ResearchableTechnologyType>([technology]),
  );
  accessor.mutate(buildingHealthStatesCodec, (healths) => {
    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (!building || building.owner !== owner) continue;
      const health = healths.get(id);
      if (!health) continue;
      const multiplier = generalMultiplier
        * singleBuildingHpMultiplier(technology, building.buildingType);
      if (multiplier === 1) continue;
      const wasFull = health.currentHp >= health.maxHp;
      const maxHp = Math.round(health.maxHp * multiplier);
      healths.set(id, {
        ...health,
        maxHp,
        currentHp: wasFull ? maxHp : health.currentHp,
      });
    }
  });
}
