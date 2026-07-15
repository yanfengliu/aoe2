// Automatic post-construction mining (spec §6.2, user directive 2026-07-14).
// Fired from the construction-completion event: when a Mining Camp finishes,
// every villager still holding the build command for that camp gets a queued
// `unit.autoGather` intention on the nearest harvestable gold or stone mine
// within AUTO_MINE_GATHER_RADIUS of the camp anchor — straight-line distance,
// exact ties broken by the lowest mine entity id. The intention drains through
// the normal recorded command channel at the next step, so it is validated,
// recorded, and replayed exactly like a player order. An explicit order issued
// in the same window wins through three layers: every human issue path — move,
// context, AND accepted chain-build placement (review iter-1) — evicts pending
// intentions for its units (removePendingUnitCommands, full-review M3);
// agent/AI intention pushes land after the auto-order in FIFO so their
// handlers write last; and the autoGather validator refuses any unit that is
// no longer idle-from-build at its own submit time. No mine in radius ->
// nothing is queued and the builders go idle exactly as before.

import type { Position } from 'civ-engine';

import type { BuildingComponent, ResourceComponent } from '../types';
import { unitCommandsCodec } from './bridgeStateSerialize';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { GameWorld } from './pureHelpers';
import type { RegisterAllSystemsDeps } from './registerAllSystemsTypes';

export const AUTO_MINE_GATHER_RADIUS = 7;

function findNearestHarvestableMine(world: GameWorld, anchor: Position): number | null {
  let bestId: number | null = null;
  let bestDistance = Infinity;
  for (const id of world.query('resource', 'position')) {
    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    if (!resource) continue;
    if (resource.resourceType !== 'gold-mine' && resource.resourceType !== 'stone-mine') continue;
    if (resource.amount <= 0) continue;
    const position = world.getComponent<Position>(id, 'position');
    if (!position) continue;
    const distance = Math.hypot(position.x - anchor.x, position.y - anchor.y);
    if (distance > AUTO_MINE_GATHER_RADIUS) continue;
    if (
      distance < bestDistance
      || (distance === bestDistance && (bestId === null || id < bestId))
    ) {
      bestDistance = distance;
      bestId = id;
    }
  }
  return bestId;
}

export function queuePostConstructionAutoGather(params: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  pendingCommands: RegisterAllSystemsDeps['pendingCommands'];
  buildingId: number;
  buildingType: BuildingComponent['buildingType'];
}): void {
  if (params.buildingType !== 'mining-camp') return;
  const anchor = params.world.getComponent<Position>(params.buildingId, 'position');
  if (!anchor) return;
  const mineId = findNearestHarvestableMine(params.world, anchor);
  if (mineId === null) return;
  // "Actively building" = still holding the build command for THIS camp at the
  // completion event. The current builder's command clears right after the
  // finalize call; other builders' stale build commands clear on their next
  // loop pass — both are still present here.
  for (const [unitId, command] of params.accessor.get(unitCommandsCodec)) {
    if (command.type !== 'build') continue;
    if (command.buildingRef?.id !== params.buildingId) continue;
    params.pendingCommands.push({
      type: 'unit.autoGather',
      data: { unitId, resourceId: mineId, campBuildingId: params.buildingId },
    });
  }
}
