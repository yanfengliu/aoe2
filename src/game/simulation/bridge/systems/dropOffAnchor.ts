// Where a resource drop-off building should be BUILT.
//
// AoE2 places a Lumber Camp at the woodline and a Mining Camp on the gold, so
// the carry walk is a tile or two. The AI placed them wherever the general
// build path anchors — the Town Center for everything except the bootstrap
// Lumber Camp, which used the builder's own feet — and measurement showed the
// cost: camps landed a median 5 tiles from the resource they serve, with
// outliers at 16 (a Mining Camp) and 52 (a Mill with no berries anywhere near
// it), and villagers spent 45% of their time walking against an ideal nearer
// 24%.
//
// The anchor is the nearest harvestable resource of the kind the building
// serves, bounded to the owner's own neighbourhood: a camp across the map is
// worse than a camp two tiles too far, because the villagers walking to build
// it — and the ones later hauling to it — are exposed the whole way.

import type { Position } from 'civ-engine';

import type { BuildingType, ResourceComponent, ResourceKind } from '../../types';
import type { GameWorld } from '../pureHelpers';

/** Which resource kinds each drop-off building is worth standing beside. */
const SERVES: Partial<Record<BuildingType, readonly ResourceKind[]>> = {
  'lumber-camp': ['tree'],
  'mining-camp': ['gold-mine', 'stone-mine'],
  // BERRIES ONLY, and the omissions are deliberate. Sheep are herded TO the
  // Town Center and boar are lured to it, so neither is a place to stand a
  // building — including them measurably moved mills AWAY from the berries
  // they serve (2 tiles to 8 on the boot map) because a wandering sheep won
  // the nearest-resource contest. Farms are built AROUND a mill rather than
  // served by one, so they play no part in the anchor either.
  mill: ['berry-bush'],
};

/** How far from the Town Center the AI will plant a drop-off. Beyond this the
 *  walk to build it, and the exposure of everyone hauling to it, costs more
 *  than the shorter carry saves. */
export const DROP_OFF_ANCHOR_RADIUS = 12;

/** Whether this building exists to shorten a carry. */
export function isDropOffBuilding(buildingType: BuildingType): boolean {
  return SERVES[buildingType] !== undefined;
}

/**
 * The position a drop-off building should be placed beside — the nearest
 * harvestable resource it serves, measured from the Town Center and bounded to
 * `DROP_OFF_ANCHOR_RADIUS`. Returns null when the building is not a drop-off,
 * or when nothing it serves is in range, so callers fall back to their own
 * anchor rather than inventing a placement.
 */
export function dropOffAnchorFor(
  activeWorld: GameWorld,
  buildingType: BuildingType,
  townCenterPosition: Position,
): Position | null {
  const kinds = SERVES[buildingType];
  if (!kinds) return null;

  let best: Position | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const id of activeWorld.query('position', 'resource')) {
    const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
    const position = activeWorld.getComponent<Position>(id, 'position');
    if (!resource || !position || resource.amount <= 0) continue;
    if (!kinds.includes(resource.resourceType)) continue;
    const distance = Math.abs(position.x - townCenterPosition.x)
      + Math.abs(position.y - townCenterPosition.y);
    if (distance > DROP_OFF_ANCHOR_RADIUS || distance >= bestDistance) continue;
    bestDistance = distance;
    best = position;
  }
  return best;
}
