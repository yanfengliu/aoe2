// A foundation nobody has started building is hidden from its owner's enemies
// (work 121, spec §12.2 "An unstarted foundation is hidden from the owner's
// enemies").
//
// Definitive Edition hides one from every player at war with its owner. Update
// 61321: "Players can no longer see unbuilt foundations of enemy players if
// treaty is active" — a treaty shows enemies as allies, so that was the leak;
// outside a treaty enemies never saw them. Update 58259 closed the same leak
// through allied vision in fog and unexplored ground, update 46295 the minimap
// showing enemy Gate foundations, and forum report 199626 (build 59165,
// tracked by the developers) expects that a player "should not be able to find
// out in any way" that an enemy has placed a foundation before construction
// starts. So an enemy does not draw one (world, minimap, fog memory), cannot
// select it or right-click it, cannot order an attack or a conversion on it,
// and no unit or AI of its picks it as a target; and a foundation does not
// keep its owner in the match (update 46295 stopped a Donjon foundation doing
// so), since no enemy could find it to destroy it. Allies see one where their
// sight reaches, as no note says otherwise, but fog memory keeps no unstarted
// foundation of another player's, an ally's included: update 46295 fixed
// allied foundations yet to begin construction showing in fog, which this game
// did by remembering one an ally had shown until work 121.
//
// This module is the one place that says what "started" means: some build
// progress stands. Progress only rises, so a started foundation never hides
// again, and from then on it is a building site like any other.

import { isEnemyOwner } from '../alliances';
import type { BuildingComponent } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { GameWorld } from './pureHelpers';
import { constructionStatesCodec, playerTeamsCodec } from './bridgeStateSerialize';

/** The two fields "started" is read from. The construction slot and the
 *  economy state's building rows both carry them. */
export interface ConstructionProgress {
  isComplete: boolean;
  buildProgressTicks: number;
}

/** Whether anyone has built on it: complete, or with some progress. A building
 *  with no construction state was never a foundation. */
export function isConstructionStarted(construction: ConstructionProgress | undefined): boolean {
  return construction === undefined || construction.isComplete || construction.buildProgressTicks > 0;
}

/** A foundation nobody has started building. */
export function isUnstartedFoundation(accessor: BridgeStateAccessor, buildingId: number): boolean {
  return !isConstructionStarted(accessor.get(constructionStatesCodec).get(buildingId));
}

/** Whether `viewer` is kept from knowing building `buildingId` (owned by
 *  `owner`) exists: an unstarted foundation of a player `viewer` is at war with. */
export function isHiddenUnstartedFoundation(
  accessor: BridgeStateAccessor,
  buildingId: number,
  owner: number,
  viewer: number,
): boolean {
  return isUnstartedFoundation(accessor, buildingId)
    && isEnemyOwner(accessor.get(playerTeamsCodec), viewer, owner);
}

/** Whether building `buildingId` is kept from `viewer` however much of it is
 *  lit. The one place such a rule goes: the frame asks it through the bridge's
 *  `isFoundationHiddenFrom`, and the player's placement directly (work 122),
 *  both by way of humanSight's `isLiveEntityDrawn`. */
export function isBuildingHiddenFrom(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  buildingId: number,
  viewer: number,
): boolean {
  const building = world.getComponent<BuildingComponent>(buildingId, 'building');
  return building !== undefined && isHiddenUnstartedFoundation(accessor, buildingId, building.owner, viewer);
}
