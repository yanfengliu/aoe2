// What a foundation's first builder finds when it comes to start it (works 122
// and 126; spec §8.1 and §12.1).
//
// A foundation nobody has started is open ground (update 185872): units and
// animals walk over it, and an enemy of its owner may build over it. So when the
// first builder arrives, its ground is checked on the true map with the
// foundation's own claims left out, for every seat:
//
//  * A structure, a foundation of its owner's, terrain it cannot stand on, or a
//    lifeless resource (a tree, a mine, a carcass, a relic lying on the ground):
//    the foundation is cancelled, its whole cost refunded at the owner's price
//    now, and the human is told what was found. Update 46295 (2021-03-24):
//    "Building foundations are now automatically cancelled when Villagers
//    attempt to begin construction if placed over an obstacle previously hidden
//    by the fog of war"; hotfix 45185 (2021-02-11): "Building foundations can no
//    longer begin construction if overlapping other structures or foundations
//    that aren't within a player's line of sight". The player's placement reads
//    only explored ground (placementKnowledge.ts), so this is where what the fog
//    hid is found; and since an enemy may build over an unstarted foundation, it
//    is where the later of two overlapping foundations finds the one started
//    first. That it is cancelled on its own builders' arrival, not when the
//    other one starts, is this game's decision (the coordinator, 2026-10-14).
//  * Another seat's foundation nobody has started stands aside, an ally's as
//    well as an enemy's: the first to start wins the ground, and the other is
//    the one cancelled when its builders come. Placement still refuses an own or
//    allied foundation the placer can know about (foundationClaims.ts), so an
//    ally's overlaps only through the fog (the coordinator, review round 0).
//  * A unit never cancels the start. An enemy's unit holds it: the builders
//    wait beside the site until it has gone (the AoE wiki: "Buildings can be
//    constructed if there is no enemy building or unit present at the location
//    of building foundation"), and so does an enemy's sheep, which DE counts as
//    a unit of its owner's. One exception: a unit building its own seat's
//    construction site from where it stands, a cell beside that site's
//    footprint, does not hold another seat's start, or two seats' builders
//    standing on each other's sites would each wait forever. It is moved off
//    with the owner's and allies' units and the living animals that are Gaia's,
//    the owner's or an ally's (footprintClearing.ts), and the building starts.
//    A unit only passing through on its way to a site elsewhere holds the start
//    like any enemy's: moved off, it could be put on the far side of a pass the
//    foundation then seals, away from its own site. The coordinator chose these
//    where the sources leave a choice (2026-10-14, review rounds 0 and 1).
//  * A Farm stays walkable once started, so nothing on it is moved or waited
//    for, and no resource on it counts; only a structure, or a foundation of
//    its owner's, cancels it.
//
// Cancelling removes the foundation through the same door the Delete key uses
// and gives back what it cost. The refund is the whole cost, as for an
// unstarted foundation deleted in DE. It is the owner's price now, which
// differs from the price paid only if a cost-changing bonus (an age, an ally's
// civilization) arrived in between.
//
// The message names what was found, and where, only when the player sees that
// cell now and the frame draws what blocks it: a builder beside a 3x3 or 4x4
// foundation does not see its far corner, an enemy's foundation nobody has
// started building is not drawn however lit (work 121), and the toast must not
// show what the frame does not. So it names the first such blocked cell, and
// otherwise says only that the builders found the ground blocked. It says the
// fog hid a thing only where nothing could have put it there since: another
// player's building site, and a relic or a carcass, may have arrived after the
// foundation was placed.
//
// Once a builder has added any work the check is over, and the footprint takes
// the building's own claim (`noteStarted`): a wall, or a Farm's plot.

import type { OccupancyCellClaim, OccupancyCellStatus, Position } from 'civ-engine';

import { isEnemyOwner } from '../alliances';
import type { BuildingComponent, BuildingType, PlayerResources, ResourceComponent } from '../types';
import { structureClaimKind } from '../passableStructures';
import { requiresShorePlacement } from '../shorePlacement';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  constructionStatesCodec,
  monkCarriedRelicCodec,
  playerResourcesCodec,
  playerTeamsCodec,
  unitCommandsCodec,
  wildlifeStatesCodec,
} from './bridgeStateSerialize';
import { ANIMAL_RESOURCES, type FootprintArea, type FootprintClearing } from './footprintClearing';
import { ownerConstructionCost } from './ownerCosts';
import type { PlacementBlockReport } from './placementBlockReport';
import type { PlacementCellView } from './placementFootprint';
import { currentEntityId, type GameWorld } from './pureHelpers';
import { isConstructionStarted } from './unstartedFoundations';

export interface FoundationStartDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  humanPlayerId: number;
  /** The footprint rule through a view (placementFootprint.ts). */
  isPlacementBlocked(
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType: BuildingType,
    view: PlacementCellView,
  ): boolean;
  describePlacementBlockers(
    x: number,
    y: number,
    width: number,
    height: number,
    view: PlacementCellView,
  ): PlacementBlockReport | null;
  /** The occupancy's claims on a cell. */
  getCellStatus(x: number, y: number): OccupancyCellStatus;
  /** Whether `owner` sees the cell now, through its own sight or a shared one. */
  isCellSeen(owner: number, x: number, y: number): boolean;
  /** Whether the frame draws live entity `entityId` for `viewer`
   *  (placementKnowledge's `isEntityDrawnFor`, humanSight's rule). */
  isEntityDrawn(viewer: number, entityId: number): boolean;
  /** Who stands on the footprint, and moving them off. */
  clearing: FootprintClearing;
  /** Re-claims a building's footprint by its construction state now. */
  syncBuildingClaim(buildingId: number): void;
  /** The player's message channel, the one the HUD shows as a toast. */
  enqueueRejection(message: string): void;
}

/** What a builder ready to put the first work into a foundation may do. */
export type FoundationStartVerdict = 'begin' | 'wait' | 'cancelled';

export interface FoundationStart {
  /** 'begin': work on; everyone the start moves is off the footprint.
   *  'wait': an enemy's unit stands on it, or someone to move has nowhere to
   *  go; the builder keeps its order and asks again next tick. 'cancelled': the
   *  foundation is gone, its cost is back with its owner, and the human has
   *  been told why. `destroyBuilding` is the caller's removal door, so its
   *  bookkeeping runs as for any other building. */
  tryBegin(buildingId: number, destroyBuilding: (id: number) => void): FoundationStartVerdict;
  /** The first build progress has landed: the footprint takes the building's
   *  own claim from now on. */
  noteStarted(buildingId: number): void;
}

const RESOURCE_KINDS = ['food', 'wood', 'gold', 'stone'] as const;

function describeCost(cost: Partial<PlayerResources>): string {
  const parts = RESOURCE_KINDS
    .filter((kind) => (cost[kind] ?? 0) > 0)
    .map((kind) => `${cost[kind]} ${kind}`);
  return parts.length > 0 ? parts.join(', ') : 'nothing';
}

interface Site {
  id: number;
  building: BuildingComponent;
  anchor: Position;
  area: FootprintArea;
  view: PlacementCellView;
}

/** What the builders found, and whether to say the fog hid it: it did only if
 *  nothing could have put it there since the foundation was placed. */
type Find = { text: string; foggedAtPlacing: boolean };

/** Steps from `cell` to the nearest cell of the footprint at `anchor`,
 *  4-connected: 0 on it, 1 beside an edge, as a builder stands to work. */
function stepsFromFootprint(cell: Position, anchor: Position, width: number, height: number): number {
  const dx = Math.max(anchor.x - cell.x, 0, cell.x - (anchor.x + width - 1));
  const dy = Math.max(anchor.y - cell.y, 0, cell.y - (anchor.y + height - 1));
  return dx + dy;
}

export function createFoundationStart(deps: FoundationStartDeps): FoundationStart {
  const { world, accessor, humanPlayerId } = deps;

  /** Whether `unitId` is building a construction site of its own seat's,
   *  started or not, from where it stands: its order is that site, and it is
   *  on a cell beside the site's footprint, one step from an edge, where a
   *  builder works from. A unit on its way to a site elsewhere is not (review
   *  round 1). */
  function buildsOwnSiteFromHere(unitId: number, owner: number | null): boolean {
    const command = accessor.get(unitCommandsCodec).get(unitId);
    if (owner === null || command?.type !== 'build') return false;
    const siteId = currentEntityId(world, command.buildingRef);
    if (siteId === null) return false;
    const site = world.getComponent<BuildingComponent>(siteId, 'building');
    const state = accessor.get(constructionStatesCodec).get(siteId);
    const siteAnchor = world.getComponent<Position>(siteId, 'position');
    const at = world.getComponent<Position>(unitId, 'position');
    if (site?.owner !== owner || state === undefined || state.isComplete || !siteAnchor || !at) return false;
    return stepsFromFootprint(at, siteAnchor, state.width, state.height) === 1;
  }

  return {
    tryBegin(buildingId, destroyBuilding) {
      const building = world.getComponent<BuildingComponent>(buildingId, 'building');
      const anchor = world.getComponent<Position>(buildingId, 'position');
      const construction = accessor.get(constructionStatesCodec).get(buildingId);
      if (!building || !anchor || !construction || construction.isComplete) return 'begin';
      if (construction.buildProgressTicks > 0) return 'begin';
      const area = { x: anchor.x, y: anchor.y, width: construction.width, height: construction.height };
      const farm = structureClaimKind(building.buildingType) === 'farm';
      const occupants = deps.clearing.occupantsOf(area);
      const animals = new Set(occupants.animals.map((animal) => animal.id));
      // A relic a Monk carries is moved onto the Monk's cell every tick
      // (monkBehaviorSystem, which runs after this one): it is the Monk's, not
      // a thing lying on the ground, so it stands aside with its Monk and
      // follows it off the footprint before the tick ends.
      const carriedRelics = new Set(accessor.get(monkCarriedRelicCodec).values());
      const constructions = accessor.get(constructionStatesCodec);
      /** Another seat's foundation nobody has started, an ally's or an enemy's. */
      const isOthersUnstartedSite = (entity: number): boolean => {
        const other = world.getComponent<BuildingComponent>(entity, 'building');
        return other !== undefined && other.owner !== building.owner && !isConstructionStarted(constructions.get(entity));
      };
      // What the start does not count: the foundation's own claims, another
      // seat's unstarted foundation, every unit, every living animal and every
      // relic a Monk carries; on a Farm, which stays walkable, any resource too.
      const standsAside = (claim: OccupancyCellClaim): boolean => claim.kind === 'unit'
        || (claim.entity !== null && (animals.has(claim.entity) || carriedRelics.has(claim.entity)))
        || (farm && claim.kind === 'resource')
        || (claim.entity !== null && isOthersUnstartedSite(claim.entity));
      const view: PlacementCellView = { ignoredEntityId: buildingId, standsAside };
      if (deps.isPlacementBlocked(area.x, area.y, area.width, area.height, building.buildingType, view)) {
        cancel({ id: buildingId, building, anchor, area, view }, destroyBuilding);
        return 'cancelled';
      }
      if (farm) return 'begin';
      const teams = accessor.get(playerTeamsCodec);
      // An enemy's unit, or an enemy's sheep, holds the start until it has gone,
      // unless it stands beside a site of its own seat's, building it.
      const holdsStart = (occupant: { id: number; owner: number | null }): boolean => occupant.owner !== null
        && isEnemyOwner(teams, building.owner, occupant.owner) && !buildsOwnSiteFromHere(occupant.id, occupant.owner);
      const everyone = [...occupants.units, ...occupants.animals];
      if (everyone.some(holdsStart)) return 'wait';
      const toMove = everyone.map((occupant) => occupant.id);
      if (toMove.length > 0 && !deps.clearing.moveOff(toMove, area)) return 'wait';
      return 'begin';
    },
    noteStarted(buildingId) {
      deps.syncBuildingClaim(buildingId);
    },
  };

  function cancel(site: Site, destroyBuilding: (id: number) => void): void {
    const { building, anchor } = site;
    const found = building.owner === humanPlayerId ? describeFind(site) : null;
    const cost = ownerConstructionCost(accessor, building.owner, building.buildingType);
    const stockpile = accessor.get(playerResourcesCodec).get(building.owner);
    if (stockpile) {
      for (const kind of RESOURCE_KINDS) stockpile[kind] += cost[kind] ?? 0;
      accessor.markDirty(playerResourcesCodec);
    }
    destroyBuilding(site.id);
    if (!found) return;
    deps.enqueueRejection(
      `Your ${building.buildingType} at (${anchor.x},${anchor.y}) was cancelled: its builders found `
      + `${found.text}. Its cost (${describeCost(cost)}) was refunded.`
      + (found.foggedAtPlacing ? ' Place it where the ground you have explored is clear.' : ''),
    );
  }

  /** What the builders found, in words that name only what the player sees. */
  function describeFind(site: Site): Find {
    const { building, anchor, area, view } = site;
    const blocker = deps.describePlacementBlockers(anchor.x, anchor.y, area.width, area.height, view);
    if (!blocker) {
      // Only a rule about the ground's surroundings refuses with nothing in
      // the footprint, and the Dock's is the one a builder can fail.
      return {
        text: requiresShorePlacement(building.buildingType)
          ? 'no water beside it'
          : 'an obstacle the fog of war hid when it was placed',
        foggedAtPlacing: true,
      };
    }
    // Read again through the player's eyes: a cell it does not see now counts
    // as unknown, and on one it sees, a claim of something the frame does not
    // draw counts for nothing, so the report names the first blocked cell it
    // sees blocked.
    const seen = deps.describePlacementBlockers(anchor.x, anchor.y, area.width, area.height, {
      ...view,
      isCellKnown: (x, y) => deps.isCellSeen(building.owner, x, y),
      isClaimHidden: (claim) => claim.entity !== null && !deps.isEntityDrawn(building.owner, claim.entity),
    });
    if (!seen) {
      return { text: 'its ground blocked by something the fog of war hid when it was placed', foggedAtPlacing: true };
    }
    const where = `${seen.cause} at (${seen.firstBlockedCell.x},${seen.firstBlockedCell.y})`;
    switch (arrivedSincePlacing(site, seen.firstBlockedCell)) {
      case 'started': return { text: `${where}, which another player has started building`, foggedAtPlacing: false };
      case 'built': return { text: `${where}, which another player has built`, foggedAtPlacing: false };
      case 'dropped': return { text: where, foggedAtPlacing: false };
      default: return { text: `${where}, hidden under the fog of war when it was placed`, foggedAtPlacing: true };
    }
  }

  /** What on the cell may have come after the foundation was placed: another
   *  player's building raised from a foundation ('started' while unfinished,
   *  'built' once finished), or a relic or a carcass ('dropped'). Null for what
   *  must have been there already, hidden by the fog: terrain, a standing
   *  resource, a building nobody raised from a foundation. */
  function arrivedSincePlacing(site: Site, cell: Position): 'started' | 'built' | 'dropped' | null {
    let found: 'started' | 'built' | 'dropped' | null = null;
    for (const claim of deps.getCellStatus(cell.x, cell.y).blockedBy) {
      if (claim.entity === null || claim.entity === site.id) continue;
      const other = world.getComponent<BuildingComponent>(claim.entity, 'building');
      if (other !== undefined && other.owner !== site.building.owner) {
        const state = accessor.get(constructionStatesCodec).get(claim.entity);
        if (state?.isComplete) return 'built';
        if (state !== undefined && isConstructionStarted(state)) return 'started';
        continue;
      }
      const resource = world.getComponent<ResourceComponent>(claim.entity, 'resource');
      if (resource === undefined) continue;
      const carcass = ANIMAL_RESOURCES.has(resource.resourceType)
        && accessor.get(wildlifeStatesCodec).get(claim.entity)?.isAlive === false;
      if (resource.resourceType === 'relic' || carcass) found = 'dropped';
    }
    return found;
  }
}
