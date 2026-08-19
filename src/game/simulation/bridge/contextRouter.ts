// Direct-mutation context routing: the decision table behind a right-click.
// Reads world state to dispatch to garrison / attack / gather / move via the
// direct helpers, so the live and replay paths execute identical routing
// against identical state.
//
// Extracted from unitCommandOps.ts to keep that file under the 500-LOC budget.

import type { Position } from 'civ-engine';

import type { UnitComponent } from '../types';
import { gathersResources } from '../unitDomain';
import type { GameWorld } from './pureHelpers';

export interface ContextRouterDeps {
  world: GameWorld;
  findResourceAtCell: (x: number, y: number) => number | null;
  findOwnedGarrisonBuildingAtCell: (
    x: number,
    y: number,
    owner: number,
    unitType: UnitComponent['unitType'],
  ) => number | null;
  findHostileUnitAtCell: (x: number, y: number, owner: number) => number | null;
  findHostileBuildingAtCell: (x: number, y: number, owner: number) => number | null;
  findHostileWildlifeAtCell: (x: number, y: number) => number | null;
  garrisonUnit: (unitId: number, buildingId: number) => boolean;
  setUnitAttackCommandDirect: (
    unitId: number,
    targetId: number,
    kind: 'unit' | 'building' | 'resource',
  ) => boolean;
  setUnitGatherCommandDirect: (unitId: number, resourceId: number) => boolean;
  setUnitMoveCommandDirect: (unitId: number, target: Position) => boolean;
}

export function createContextRouter(deps: ContextRouterDeps) {
  const {
    world,
    findResourceAtCell,
    findOwnedGarrisonBuildingAtCell,
    findHostileUnitAtCell,
    findHostileBuildingAtCell,
    findHostileWildlifeAtCell,
    garrisonUnit,
    setUnitAttackCommandDirect,
    setUnitGatherCommandDirect,
    setUnitMoveCommandDirect,
  } = deps;
  return function routeUnitContextCommandDirect(
    unitId: number,
    target: Position,
    allowGarrison: boolean,
  ): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit) return false;
    // Monk routing is handled by the bridge facade BEFORE submission
    // (HUD-side fast path). The validator rejects monk units so this
    // branch only runs for non-monks.

    const resourceId = gathersResources(unit.unitType)
      ? findResourceAtCell(target.x, target.y) : null;
    // Spec §9.3: without explicit intent an owned building is not a garrison
    // target, so routing falls through to move at the click's own ground cell
    // — that is what makes "base = walk to it, roof = walk behind it" free.
    const ownedGarrisonBuildingId = allowGarrison
      ? findOwnedGarrisonBuildingAtCell(target.x, target.y, unit.owner, unit.unitType)
      : null;
    const hostileUnitId = findHostileUnitAtCell(target.x, target.y, unit.owner);
    const hostileBuildingId = findHostileBuildingAtCell(target.x, target.y, unit.owner);
    const hostileWildlifeId = findHostileWildlifeAtCell(target.x, target.y);

    if (ownedGarrisonBuildingId !== null) {
      return garrisonUnit(unitId, ownedGarrisonBuildingId);
    }
    if (hostileUnitId !== null) {
      return setUnitAttackCommandDirect(unitId, hostileUnitId, 'unit');
    }
    if (hostileBuildingId !== null) {
      return setUnitAttackCommandDirect(unitId, hostileBuildingId, 'building');
    }
    if (hostileWildlifeId !== null) {
      return setUnitAttackCommandDirect(unitId, hostileWildlifeId, 'resource');
    }
    if (resourceId === null) {
      return setUnitMoveCommandDirect(unitId, target);
    }
    if (!setUnitGatherCommandDirect(unitId, resourceId)) {
      return setUnitMoveCommandDirect(unitId, target);
    }
    return true;
    };
}
