// A civilization unique technology applied to what the owner ALREADY has.
//
// The other half — everything trained afterwards — is derived in
// combatStateFactory from the same declarations, so this file only has to walk
// the units on the field. Same two-halves shape as Loom, Sanctity, Bloodlines
// and Masonry; the difference is that the effect is read from a table instead
// of written out per technology.

import { applyUniqueUnitEffect } from './combatStateFactory';
import { unitEffectsOf } from '../uniqueTechnologies';
import type { ResearchableTechnologyType } from '../technologyTypes';
import type { UnitComponent } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { combatStatesCodec } from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

export function applyUniqueTechnologyToOwnedUnits(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  owner: number,
  technology: ResearchableTechnologyType,
): void {
  const effects = unitEffectsOf(technology);
  if (effects.length === 0) return;
  const combatStates = accessor.get(combatStatesCodec);
  let changed = false;
  for (const id of world.query('unit')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (!unit || unit.owner !== owner) continue;
    const state = combatStates.get(id);
    if (!state) continue;
    for (const effect of effects) {
      applyUniqueUnitEffect(state, effect, unit.unitType);
    }
    changed = true;
  }
  if (changed) accessor.markDirty(combatStatesCodec);
}
