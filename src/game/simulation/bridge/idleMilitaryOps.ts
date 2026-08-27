// The idle-military cycle's bridge half (v0.3.155) — DE's ',' companion to
// the '.' villager bell. Idle = the HUMAN's military unit (any unit that is
// not an economy worker) with no standing command, no monk task, and no
// shelter; cycling remembers the last id and picks the next-greater one,
// wrapping, exactly like the villager cycle.

import type { UnitComponent } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { monkTasksCodec, unitCommandsCodec } from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

const ECONOMY_UNIT_TYPES = new Set<string>([
  'villager', 'fishing-ship', 'trade-cart', 'trade-cog', 'transport-ship',
]);

export function createIdleMilitaryOps(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  humanPlayerId: number;
  isGarrisonedUnit: (id: number) => boolean;
  selectUnitsByIds: (ids: number[]) => boolean;
}) {
  const { world, accessor, humanPlayerId, isGarrisonedUnit, selectUnitsByIds } = deps;
  let lastIdleMilitaryId = -1;

  function findIdleMilitaryIds(): number[] {
    const ids: number[] = [];
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (!unit || unit.owner !== humanPlayerId || ECONOMY_UNIT_TYPES.has(unit.unitType)) continue;
      if (accessor.get(unitCommandsCodec).has(id)) continue;
      if (accessor.get(monkTasksCodec).has(id)) continue;
      if (isGarrisonedUnit(id)) continue;
      ids.push(id);
    }
    ids.sort((a, b) => a - b);
    return ids;
  }

  function countIdleMilitary(): number {
    return findIdleMilitaryIds().length;
  }

  function selectNextIdleMilitary(): boolean {
    const ids = findIdleMilitaryIds();
    if (ids.length === 0) return false;
    const next = ids.find((id) => id > lastIdleMilitaryId) ?? ids[0]!;
    lastIdleMilitaryId = next;
    return selectUnitsByIds([next]);
  }

  return { countIdleMilitary, selectNextIdleMilitary };
}
