// Per-entity read probes for the renderer and HUD: health, wildlife life
// state, and the active work verb. Extracted from `selectionStateOps` (which
// owns the selection-panel assembly) for the 500-LOC budget — these three are
// projection inputs, not selection state.

import type {
  BuildingComponent,
  GathererComponent,
  ResourceComponent,
  UnitComponent,
} from '../types';
import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  buildingHealthStatesCodec,
  combatStatesCodec,
  unitCommandsCodec,
  wildlifeStatesCodec,
} from './bridgeStateSerialize';

export function createEntityReadProbes(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
}) {
  const { world, accessor } = deps;

  function getEntityHealth(id: number): { currentHp: number; maxHp: number } | null {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (unit) {
      const combat = accessor.get(combatStatesCodec).get(id);
      if (!combat) {
        return null;
      }
      return { currentHp: combat.currentHp, maxHp: combat.maxHp };
    }

    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (building) {
      const health = accessor.get(buildingHealthStatesCodec).get(id);
      if (!health) {
        return null;
      }
      return { currentHp: health.currentHp, maxHp: health.maxHp };
    }

    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    if (resource) {
      const wildlife = accessor.get(wildlifeStatesCodec).get(id);
      if (!wildlife || !wildlife.isAlive) {
        return null;
      }
      return { currentHp: wildlife.currentHp, maxHp: wildlife.maxHp };
    }

    return null;
  }

  // Spec §14.5 carcass: the renderer needs wildlife LIFE state explicitly.
  // `getEntityHealth` deliberately returns null for a corpse (no HP bar), so
  // it cannot answer "is this a carcass or a rock?" — this can.
  function getWildlifeAlive(id: number): boolean | undefined {
    if (!world.getComponent<ResourceComponent>(id, 'resource')) return undefined;
    return accessor.get(wildlifeStatesCodec).get(id)?.isAlive;
  }

  // Spec §14.5 work animation: the smallest honest carrier for "this villager
  // is working". Build/repair from the SAME `unitCommands` predicate the HUD
  // reads; gathering (v0.3.113) from the gatherer task, which is true only AT
  // the resource — not walking, not hauling.
  function getUnitActiveVerb(id: number): 'building' | 'gathering' | undefined {
    const type = accessor.get(unitCommandsCodec).get(id)?.type;
    if (type === 'build' || type === 'repair') return 'building';
    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    return gatherer?.task === 'gathering' ? 'gathering' : undefined;
  }

  return { getEntityHealth, getWildlifeAlive, getUnitActiveVerb };
}
