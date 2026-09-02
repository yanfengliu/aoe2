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

import type {
  BuildingType,
  GathererComponent,
  ResourceComponent,
  ResourceKind,
  UnitComponent,
} from '../../types';
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

const manhattan = (left: Position, right: Position): number =>
  Math.abs(left.x - right.x) + Math.abs(left.y - right.y);

/**
 * Where the owner's gatherers for this building's resources are ALREADY
 * working: the MEDOID of the resource nodes they currently target — the
 * targeted node with the smallest total distance to the others.
 *
 * A medoid rather than a centroid because the answer has to be a real node on
 * the woodline: a centroid can land in a lake, on a cliff, or in a gap between
 * two forests, and the placement ring-search would then plant the camp beside
 * nothing. Targeted nodes only, so it reads the work the economy is actually
 * doing rather than the map's geometry.
 */
function workAnchorFor(
  activeWorld: GameWorld,
  kinds: readonly ResourceKind[],
  owner: number,
): Position | null {
  const worked: Array<{ id: number; position: Position }> = [];
  for (const id of activeWorld.query('unit', 'gatherer')) {
    const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
    const gatherer = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
    if (!unit || !gatherer || unit.owner !== owner) continue;
    const targetId = gatherer.targetResourceId;
    if (targetId === null) continue;
    const resource = activeWorld.getComponent<ResourceComponent>(targetId, 'resource');
    const position = activeWorld.getComponent<Position>(targetId, 'position');
    if (!resource || !position || resource.amount <= 0) continue;
    // The kind filter is what keeps a Mill off a wandering sheep: a food
    // villager on a sheep is not berry work, so it never votes on where the
    // Mill goes.
    if (!kinds.includes(resource.resourceType)) continue;
    worked.push({ id: targetId, position });
  }
  if (worked.length === 0) return null;

  let best: Position | null = null;
  let bestTotal = Number.POSITIVE_INFINITY;
  for (const candidate of worked) {
    let total = 0;
    for (const other of worked) total += manhattan(candidate.position, other.position);
    // Strict `<` plus the id-ordered scan makes the tie deterministic.
    if (total < bestTotal) {
      bestTotal = total;
      best = candidate.position;
    }
  }
  return best;
}

/**
 * The position a drop-off building should be placed beside. Returns null when
 * the building is not a drop-off, or when nothing it serves is in range, so
 * callers fall back to their own anchor rather than inventing a placement.
 *
 * With an `owner`, the camp is sent to the WORK rather than the work to the
 * camp: the anchor is where that owner's gatherers of this resource are
 * already standing (`workAnchorFor`). Measured on ten seeds at the tick each
 * Lumber Camp was placed, the trees the wood villagers were actually working
 * sat a median 14 tiles from the nearest-tree-to-the-Town-Centre anchor this
 * function used before — so the camp was planted on a woodline nobody was
 * cutting, and the routing that would have to move villagers to it never does.
 *
 * Without an `owner`, or when nobody is working the resource yet, it falls
 * back to the nearest harvestable resource it serves, measured from the Town
 * Center. Both answers stay bounded to `DROP_OFF_ANCHOR_RADIUS`: a camp across
 * the map costs more in exposure than the shorter carry saves.
 */
export function dropOffAnchorFor(
  activeWorld: GameWorld,
  buildingType: BuildingType,
  townCenterPosition: Position,
  owner?: number,
): Position | null {
  const kinds = SERVES[buildingType];
  if (!kinds) return null;

  if (owner !== undefined && buildingType === 'lumber-camp') {
    const work = workAnchorFor(activeWorld, kinds, owner);
    if (work && manhattan(work, townCenterPosition) <= DROP_OFF_ANCHOR_RADIUS) {
      return work;
    }
  }

  let best: Position | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const id of activeWorld.query('position', 'resource')) {
    const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
    const position = activeWorld.getComponent<Position>(id, 'position');
    if (!resource || !position || resource.amount <= 0) continue;
    if (!kinds.includes(resource.resourceType)) continue;
    const distance = manhattan(position, townCenterPosition);
    if (distance > DROP_OFF_ANCHOR_RADIUS || distance >= bestDistance) continue;
    bestDistance = distance;
    best = position;
  }
  return best;
}
