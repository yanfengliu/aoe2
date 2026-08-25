// The idle villager bell's bridge half (v0.3.103), extracted from
// humanInputOps for the 500-LOC budget: the standing-around count and the
// round-robin next-selection AoE2 binds to '.'.

import type { GathererComponent, UnitComponent } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { unitCommandsCodec } from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

export function createIdleVillagerOps(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  humanPlayerId: number;
  isGarrisonedUnit: (id: number) => boolean;
  selectUnitsByIds: (ids: number[]) => boolean;
}) {
  const { world, accessor, humanPlayerId, isGarrisonedUnit, selectUnitsByIds } = deps;
  // Idle = the HUMAN's villager with no standing command, an idle gather
  // task, and no shelter. Cycling remembers the last id and picks the
  // next-greater one (wrapping), so repeated presses walk the whole set even
  // as it changes underneath.
  let lastIdleVillagerId = -1;

  function findIdleVillagerIds(): number[] {
    const ids: number[] = [];
    for (const id of world.query('unit', 'gatherer')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
      if (!unit || !gatherer || unit.owner !== humanPlayerId || unit.unitType !== 'villager') continue;
      if (gatherer.task !== 'idle') continue;
      if (accessor.get(unitCommandsCodec).has(id)) continue;
      if (isGarrisonedUnit(id)) continue;
      ids.push(id);
    }
    ids.sort((a, b) => a - b);
    return ids;
  }

  function countIdleVillagers(): number {
    return findIdleVillagerIds().length;
  }

  function selectNextIdleVillager(): boolean {
    const ids = findIdleVillagerIds();
    if (ids.length === 0) return false;
    const next = ids.find((id) => id > lastIdleVillagerId) ?? ids[0]!;
    lastIdleVillagerId = next;
    return selectUnitsByIds([next]);
  }

  return { countIdleVillagers, selectNextIdleVillager };
}
