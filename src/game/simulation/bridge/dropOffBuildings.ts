// The drop-offs an owner can deliver a resource kind to, enumerated once so
// the nearest-drop-off lookup and the drop-off walk field cannot disagree
// about which buildings count: complete (a foundation is not a drop-off), the
// owner's own, and of a type that accepts the kind.

import type { Position } from 'civ-engine';
import type { BuildingComponent, EconomyResourceKind } from '../types';
import { canDropOffAt } from '../prototypeEconomyRules';
import { getBuildingFootprint } from '../../content/buildingFootprints';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { constructionStatesCodec } from './bridgeStateSerialize';
import { isFootprintInsideDefenceReach, type StaticDefenceView } from './enemyDefenceRange';
import type { GameWorld } from './pureHelpers';

export interface DropOffBuildingView {
  id: number;
  position: Position;
  footprint: { width: number; height: number };
}

export function collectDropOffBuildings(
  activeWorld: GameWorld,
  accessor: BridgeStateAccessor,
  owner: number,
  kind: EconomyResourceKind,
): DropOffBuildingView[] {
  const dropOffs: DropOffBuildingView[] = [];
  for (const id of activeWorld.query('position', 'building')) {
    const position = activeWorld.getComponent<Position>(id, 'position');
    const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
    if (!position || !building || building.owner !== owner) continue;
    const construction = accessor.get(constructionStatesCodec).get(id);
    if (construction && !construction.isComplete) continue;
    if (!canDropOffAt(building.buildingType, kind)) continue;
    const { width, height } = getBuildingFootprint(building.buildingType);
    dropOffs.push({ id, position, footprint: { width, height } });
  }
  return dropOffs;
}

/** The drop-offs outside enemy static-defence reach when any exist, else all
 *  of them — the preference `findNearestDropOffBuilding` applies, so the walk
 *  field ranks nodes against the same buildings a carrier will deliver to. */
export function preferSafeDropOffs(
  dropOffs: readonly DropOffBuildingView[],
  defences: readonly StaticDefenceView[],
): readonly DropOffBuildingView[] {
  if (defences.length === 0) return dropOffs;
  const safe = dropOffs.filter(
    (dropOff) => !isFootprintInsideDefenceReach(dropOff.position, dropOff.footprint, defences),
  );
  return safe.length > 0 ? safe : dropOffs;
}
