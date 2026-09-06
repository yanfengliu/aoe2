// The AI's amphibious line (spec §5.4 Islands, v0.3.95): when the attack
// group is mustered but the target's Town Center is NOT land-reachable, ferry
// the army across. One BFS from the enemy Town Center over land answers every
// question this phase asks: is the probe unit already on the target island
// (then this phase stands down and the ordinary attack marches); which shore
// cells belong to that island; where should the transport sail and unload.
//
// The ferry drives the SAME recorded channels a human uses: soldiers context
// the transport's cell to board, the ship moves to the shore-adjacent water,
// and a context on the shore cell unloads (unloadTransport's distance guard
// makes the far click a sail, so the two-step is honest).

import type { Position } from 'civ-engine';
import type { UnitComponent } from '../../types';
import { attackGroupSize } from '../../ai';
import { transportCapacity } from '../../transportShip';
import { isWaterUnit } from '../../unitDomain';
import {
  constructionStatesCodec,
  garrisonedByBuildingCodec,
  researchedTechnologiesCodec,
} from '../bridgeStateSerialize';
import { EMPTY_TECH_SET } from '../../economyTechEffects';
import { canAfford, trainingCost } from '../../prototypeEconomyRules';
import { ownerConstructionCost } from '../ownerCosts';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';

/** Land cells 4-connected to `from` — the target island, as a Set of "x,y". */
function landRegionFrom(
  from: Position,
  isLandCell: (x: number, y: number) => boolean,
  grid: { width: number; height: number },
): Set<string> {
  const region = new Set<string>();
  if (!isLandCell(from.x, from.y)) return region;
  const queue: Position[] = [from];
  region.add(`${from.x},${from.y}`);
  while (queue.length > 0) {
    const cell = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
      const key = `${x},${y}`;
      if (region.has(key) || !isLandCell(x, y)) continue;
      region.add(key);
      queue.push({ x, y });
    }
  }
  return region;
}

/** Returns true when this phase owns the owner's military this tick (the
 *  attack phase then stands down). */
export function runFerryPhase(deps: AiSystemDeps, ctx: AiOwnerContext): boolean {
  const {
    accessor,
    isLandCell,
    findOwnedMilitaryUnits,
    findOwnedBuilding,
    pushUnitContextIntention,
    pushQueueTrainIntention,
    pushBuildingPlaceConfirmIntention,
    findBuildPlacementNear,
    countQueuedUnits,
  } = deps;
  const { activeWorld, owner, currentAge, stockpile, targetTownCenterPosition, unitCommands } = ctx;

  if (!targetTownCenterPosition || !stockpile) return false;

  // The transport comes first: its HOLD counts toward the army, because
  // findOwnedMilitaryUnits only sees positioned units and a fully boarded
  // army would otherwise read as zero and strand itself mid-ferry.
  let transportId: number | null = null;
  let transportPosition: Position | null = null;
  for (const id of activeWorld.query('unit', 'position')) {
    const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
    if (!unit || unit.owner !== owner || unit.unitType !== 'transport-ship') continue;
    transportId = id;
    transportPosition = activeWorld.getComponent<Position>(id, 'position') ?? null;
    break;
  }
  const aboardCount = transportId === null
    ? 0
    : (accessor.get(garrisonedByBuildingCodec).get(transportId) ?? []).length;

  // The army ashore: land military with positions.
  const ashore = findOwnedMilitaryUnits(owner)
    .map(({ id }) => ({
      id,
      position: activeWorld.getComponent<Position>(id, 'position'),
      unit: activeWorld.getComponent<UnitComponent>(id, 'unit'),
    }))
    .filter((entry): entry is { id: number; position: Position; unit: UnitComponent } =>
      Boolean(entry.unit && entry.position && !isWaterUnit(entry.unit.unitType)));
  const armySize = ashore.length + aboardCount;
  if (armySize < attackGroupSize(currentAge)) return false;

  const targetIsland = landRegionFrom(targetTownCenterPosition, isLandCell, activeWorld.grid);
  if (targetIsland.size === 0) return false;
  const probe = ashore[0];
  if (probe && targetIsland.has(`${probe.position.x},${probe.position.y}`)) {
    // Already on the target island — the ordinary march takes it from here.
    return false;
  }
  if (!probe && aboardCount === 0) return false;
  if (transportId === null || !transportPosition) {
    const dockId = findOwnedBuilding(owner, 'dock');
    const dockComplete = dockId !== null
      && !(accessor.get(constructionStatesCodec).get(dockId)?.isComplete === false);
    if (dockComplete) {
      if (
        countQueuedUnits(dockId, 'transport-ship') === 0
        && canAfford(stockpile, trainingCost('transport-ship'))
      ) {
        pushQueueTrainIntention(dockId, 'transport-ship');
      }
      return true;
    }
    // No dock: put one up near the army's shore-most soldier.
    const builder = probe?.id ?? null;
    if (
      builder !== null
      && canAfford(stockpile, ownerConstructionCost(accessor, owner, 'dock'))
    ) {
      const anchor = findBuildPlacementNear(probe!.position!, 'dock', [builder]);
      if (anchor) pushBuildingPlaceConfirmIntention(builder, 'dock', anchor);
    }
    return true;
  }

  const capacity = transportCapacity(
    accessor.get(researchedTechnologiesCodec).get(owner) ?? EMPTY_TECH_SET,
  );

  // Boarding: fill the hold before sailing.
  if (aboardCount < Math.min(capacity, armySize) && ashore.length > 0) {
    let slots = Math.min(capacity, armySize) - aboardCount;
    for (const soldier of ashore) {
      if (slots <= 0) break;
      if (unitCommands.has(soldier.id)) continue;
      pushUnitContextIntention(
        soldier.id,
        { x: transportPosition.x, y: transportPosition.y },
        false,
      );
      slots -= 1;
    }
    return true;
  }

  if (aboardCount === 0) return true;

  // Sailing and unloading. The target island's shore cell nearest the ship is
  // both the sail waypoint (its water side) and the unload click (its land).
  let shore: Position | null = null;
  let shoreDistance = Number.POSITIVE_INFINITY;
  for (const key of targetIsland) {
    const [xRaw, yRaw] = key.split(',');
    const x = Number(xRaw);
    const y = Number(yRaw);
    let coastal = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= activeWorld.grid.width || ny >= activeWorld.grid.height) continue;
      if (!isLandCell(nx, ny)) { coastal = true; break; }
    }
    if (!coastal) continue;
    const distance = Math.abs(x - transportPosition.x) + Math.abs(y - transportPosition.y);
    if (distance < shoreDistance) {
      shoreDistance = distance;
      shore = { x, y };
    }
  }
  if (!shore) return true;

  if (unitCommands.has(transportId) && shoreDistance > 3) return true;
  // Near enough: the context on land IS the unload (distance guard ≤ 3);
  // farther out the same click sails toward that shore's water side.
  pushUnitContextIntention(transportId, shore, false);
  return true;
}
