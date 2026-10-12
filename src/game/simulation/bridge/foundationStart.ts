// A foundation the player placed partly over unexplored ground is checked when
// a builder comes to put the first work into it (work 122; spec §12.1).
//
// Definitive Edition, update 46295 (2021-03-24): a foundation placed over an
// obstacle that the fog of war hid is cancelled automatically when villagers
// try to begin construction. The placement itself reads only explored ground
// (placementKnowledge.ts, after update 44725 and hotfix 45185), so whatever the
// fog hid under the foundation — water, forest, a mine, someone else's
// building, a unit — is found here, by the true map with the foundation's own
// claims left out.
//
// Cancelling removes the foundation through the same door the Delete key uses,
// gives back what it cost, and tells the player what was found. The refund is
// the whole cost, as for an unstarted foundation deleted in DE: the game
// accepted the placement, and the player could not have seen the reason it
// fails. This game's Delete key refunds nothing (v0.3.114), so this is the one
// way an unstarted foundation's cost comes back, and only the fog can trigger
// it. It is the owner's price now, which differs from the price paid only if a
// cost-changing bonus (an age, an ally's civilization) arrived in between.
//
// The message names what was found, and where, only when the player sees that
// cell now: a builder beside a 3x3 or 4x4 foundation does not see its far
// corner, and the toast must not map what the fog still hides. So it names the
// first blocked cell the player sees, and otherwise says only that the
// builders found the ground blocked.
//
// Who is checked: the owners that place by what they have explored, which is
// the human seat (placesByKnowledge). An AI seat placed by the true map, so
// nothing can be hidden under its foundation, and a foundation the player
// raised over one of its foundations is the PLAYER's to lose, never the AI's.
// A Farm is not checked: it is walkable ground, so a villager, a sheep or a
// dropped relic may stand on its foundation by the time a builder comes, and as
// one cell it is never placed on unexplored ground anyway (a one-cell footprint
// is either explored, and judged on what is there, or refused). Every other
// foundation is a wall, so anything inside one was there when it was placed.
// Once a builder has added any work, the check is over.

import type { Position } from 'civ-engine';

import type { BuildingComponent, BuildingType, PlayerResources } from '../types';
import { structureClaimKind } from '../passableStructures';
import { requiresShorePlacement } from '../shorePlacement';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { constructionStatesCodec, playerResourcesCodec } from './bridgeStateSerialize';
import { ownerConstructionCost } from './ownerCosts';
import type { PlacementBlockReport } from './placementBlockReport';
import type { PlacementCellView } from './placementFootprint';
import { placesByKnowledge } from './placementKnowledge';
import type { GameWorld } from './pureHelpers';

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
  /** Whether `owner` sees the cell now, through its own sight or a shared one. */
  isCellSeen(owner: number, x: number, y: number): boolean;
  /** The player's message channel, the one the HUD shows as a toast. */
  enqueueRejection(message: string): void;
}

export interface FoundationStart {
  /** Whether a builder may put the first work into this foundation. False
   *  after cancelling it: the foundation is gone, its cost is back with its
   *  owner, and the owner has been told why. `destroyBuilding` is the caller's
   *  removal door, so its bookkeeping runs as for any other building. */
  mayBegin(buildingId: number, destroyBuilding: (id: number) => void): boolean;
}

const RESOURCE_KINDS = ['food', 'wood', 'gold', 'stone'] as const;

function describeCost(cost: Partial<PlayerResources>): string {
  const parts = RESOURCE_KINDS
    .filter((kind) => (cost[kind] ?? 0) > 0)
    .map((kind) => `${cost[kind]} ${kind}`);
  return parts.length > 0 ? parts.join(', ') : 'nothing';
}

export function createFoundationStart(deps: FoundationStartDeps): FoundationStart {
  const { world, accessor, humanPlayerId } = deps;
  return {
    mayBegin(buildingId, destroyBuilding) {
      const building = world.getComponent<BuildingComponent>(buildingId, 'building');
      const anchor = world.getComponent<Position>(buildingId, 'position');
      const construction = accessor.get(constructionStatesCodec).get(buildingId);
      if (!building || !anchor || !construction || construction.isComplete) return true;
      if (construction.buildProgressTicks > 0) return true;
      if (!placesByKnowledge(accessor, humanPlayerId, building.owner)) return true;
      if (structureClaimKind(building.buildingType) === 'farm') return true;
      const { width, height } = construction;
      const view: PlacementCellView = { ignoredEntityId: buildingId };
      if (!deps.isPlacementBlocked(anchor.x, anchor.y, width, height, building.buildingType, view)) {
        return true;
      }
      const found = describeFind(building, anchor, width, height, view);
      const cost = ownerConstructionCost(accessor, building.owner, building.buildingType);
      const stockpile = accessor.get(playerResourcesCodec).get(building.owner);
      if (stockpile) {
        for (const kind of RESOURCE_KINDS) stockpile[kind] += cost[kind] ?? 0;
        accessor.markDirty(playerResourcesCodec);
      }
      destroyBuilding(buildingId);
      deps.enqueueRejection(
        `Your ${building.buildingType} at (${anchor.x},${anchor.y}) was cancelled: its builders found `
        + `${found}. Its cost (${describeCost(cost)}) `
        + 'was refunded. Place it where the ground you have explored is clear.',
      );
      return false;
    },
  };

  /** What the builders found, in words that name only what the player sees. */
  function describeFind(
    building: BuildingComponent,
    anchor: Position,
    width: number,
    height: number,
    view: PlacementCellView,
  ): string {
    const blocker = deps.describePlacementBlockers(anchor.x, anchor.y, width, height, view);
    if (!blocker) {
      // Only a rule about the ground's surroundings refuses with nothing in
      // the footprint, and the Dock's is the one a builder can fail.
      return requiresShorePlacement(building.buildingType)
        ? 'no water beside it'
        : 'an obstacle the fog of war hid when it was placed';
    }
    // Read again through the player's eyes: a cell it does not see now counts
    // as unknown, so the report names the first blocked cell it does see.
    const seen = deps.describePlacementBlockers(anchor.x, anchor.y, width, height, {
      ...view,
      isCellKnown: (x, y) => deps.isCellSeen(building.owner, x, y),
    });
    return seen
      ? `${seen.cause} at (${seen.firstBlockedCell.x},${seen.firstBlockedCell.y}), `
        + 'hidden under the fog of war when it was placed'
      : 'its ground blocked by something the fog of war hid when it was placed';
  }
}
