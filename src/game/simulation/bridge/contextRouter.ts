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
  // An own building still under construction covering the clicked cell, and
  // the order that puts a villager to work on it. Right-clicking a foundation
  // is how AoE2 rescues an interrupted build and how extra villagers join one.
  findOwnedConstructionSiteAtCell: (x: number, y: number, owner: number) => number | null;
  setUnitBuildCommandDirect: (unitId: number, buildingId: number) => boolean;
  // Orders a unit to garrison: it walks to the building and goes in when it
  // arrives, or enters immediately if it is already standing against it.
  orderGarrison: (unitId: number, buildingId: number) => boolean;
  // A Transport Ship is a garrison host that moves. Boarding and unloading both
  // ride the ordinary right-click, which is how Age of Empires does it: click
  // the ship to get on, click land to get off.
  findOwnedTransportAtCell: (x: number, y: number, owner: number) => number | null;
  boardTransport: (unitId: number, transportId: number) => boolean;
  unloadTransport: (transportId: number, target: Position) => boolean;
  isLandCell: (x: number, y: number) => boolean;
  setUnitAttackCommandDirect: (
    unitId: number,
    targetId: number,
    kind: 'unit' | 'building' | 'resource',
  ) => boolean;
  setUnitGatherCommandDirect: (unitId: number, resourceId: number) => boolean;
  setUnitMoveCommandDirect: (unitId: number, target: Position) => boolean;
}


// The nearest water cell to a shore target, ring-scanned outward (radius 4):
// where a transport can actually stand to unload onto that land.
function nearestWaterCellNear(
  target: Position,
  isLandCell: (x: number, y: number) => boolean,
  grid: { width: number; height: number },
): Position | null {
  for (let radius = 1; radius <= 4; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
        const x = target.x + dx;
        const y = target.y + dy;
        if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
        if (!isLandCell(x, y)) return { x, y };
      }
    }
  }
  return null;
}

export function createContextRouter(deps: ContextRouterDeps) {
  const {
    world,
    findResourceAtCell,
    findOwnedGarrisonBuildingAtCell,
    findHostileUnitAtCell,
    findHostileBuildingAtCell,
    findHostileWildlifeAtCell,
    findOwnedConstructionSiteAtCell,
    setUnitBuildCommandDirect,
    orderGarrison,
    findOwnedTransportAtCell,
    boardTransport,
    unloadTransport,
    isLandCell,
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

    // A transport ordered onto land puts its cargo ashore there — when the
    // ship is actually at that shore (unloadTransport's distance guard).
    // From farther away the same click is a SAIL toward the nearest water
    // beside that shore; the unload is a second click on arrival (v0.3.95 —
    // the guard closed a cargo teleport, so the far click must do something
    // useful instead of nothing).
    if (unit.unitType === 'transport-ship' && isLandCell(target.x, target.y)) {
      if (unloadTransport(unitId, target)) return true;
      const shoreWater = nearestWaterCellNear(target, isLandCell, world.grid);
      if (shoreWater) return setUnitMoveCommandDirect(unitId, shoreWater);
      return false;
    }
    // A land unit ordered onto a friendly transport gets aboard.
    const transportId = findOwnedTransportAtCell(target.x, target.y, unit.owner);
    if (transportId !== null && transportId !== unitId) {
      return boardTransport(unitId, transportId);
    }

    // An own FOUNDATION under the click is a build order (AoE2): it rescues an
    // interrupted build and adds a builder to one already going. This has to
    // precede the garrison branch — a foundation cannot be garrisoned, and
    // before this branch existed the click fell all the way through to a plain
    // move onto a cell the foundation itself blocks, so the villager walked up
    // to the site and stood there for the rest of the match.
    // The sibling by-entity route (contextAtEntityRouter) already did this;
    // right-click is routed twice here and a rule belonging to it needs both.
    if (unit.unitType === 'villager') {
      const constructionSiteId = findOwnedConstructionSiteAtCell(target.x, target.y, unit.owner);
      if (constructionSiteId !== null && setUnitBuildCommandDirect(unitId, constructionSiteId)) {
        return true;
      }
    }

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
      // The unit WALKS there and goes in on arrival (AoE2). Entering from any
      // distance made garrison a free escape from anything chasing it.
      return orderGarrison(unitId, ownedGarrisonBuildingId);
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
