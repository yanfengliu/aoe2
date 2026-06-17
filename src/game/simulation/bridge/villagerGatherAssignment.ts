// Villager gather-target assignment (extracted from villagerEconomySystem to
// keep that file under the 500-LOC cap and to give the reachability-aware
// reroute a clean home). `assignNearestResource` picks an owner's nearest
// matching, gatherable resource, honouring owner preference (own > home-base
// neutral > other) and an optional fan-out that prefers under-subscribed
// resources.
//
// Reachability-aware reroute (campaign-11): a villager whose target resource
// is UNREACHABLE (all approach cells blocked — e.g. a sheep boxed in by
// berries + buildings) used to fall to `idle` and get re-assigned to the same
// unreachable owned resource every tick, oscillating forever (food income 0,
// never reached Feudal). Passing `requireReachable` makes the assignment skip
// the excluded id AND any candidate with no approach plan, so the villager
// falls through from an unreachable owned sheep to a reachable berry instead
// of latching. Default behaviour (neither option set) is byte-identical to the
// pre-extraction inline function, so the two hot call sites are unchanged.

import type { Position } from 'civ-engine';
import type {
  BuildingComponent,
  GathererComponent,
  ResourceComponent,
} from '../types';
import { manhattanDistance, type GameWorld } from './pureHelpers';
import { canGatherResource, resourceKindToEconomyResource } from '../prototypeEconomyRules';
import type { UnitMovementPlan } from './movementTypes';

type EconomyResource = 'food' | 'wood' | 'gold' | 'stone';

// Cap on how many candidates the reachability-aware reroute pathfinds against
// per call. The success case (a reachable resource exists) short-circuits at
// the first reachable candidate — typically the 1st–3rd, well within this cap.
// The cap only bites for a genuinely fully-boxed villager (NO reachable
// resource of its kind), bounding its per-tick pathfinding to a constant
// instead of scanning every resource on the map (campaign-11 review: a per-tick
// BFS that scaled with the map's resource count). 16 comfortably exceeds the
// number of same-kind resources clustered near any base, so it never idles a
// villager that has a reachable resource within reach.
const MAX_REACHABILITY_PROBES = 16;

export interface GatherAssignmentDeps {
  isHarvestableResource: (id: number, resource: ResourceComponent) => boolean;
  findNearestDropOffBuilding: (
    activeWorld: GameWorld,
    owner: number,
    resource: EconomyResource,
    position: Position,
  ) => number | null;
  // Used only when `requireReachable` is set: a null plan means the villager
  // cannot path to any cell adjacent to the resource (it is boxed in).
  findResourceApproachPlan: (
    villagerId: number,
    resourceId: number,
    activeWorld: GameWorld,
  ) => UnitMovementPlan | null;
}

export interface AssignNearestResourceOptions {
  // When true, fan out: prefer resources with FEWER than `spreadCap` gatherers.
  preferUnsaturated: boolean;
  spreadCap: number;
  // Reachability-aware reroute: when true, skip any candidate whose approach
  // plan is null (and the `excludeResourceId`), picking the nearest REACHABLE
  // resource instead. Default false → behaviour identical to the legacy inline
  // function (pick the sorted first, no pathfinding). `excludeResourceId` is
  // honoured ONLY under `requireReachable` (its sole caller passes both).
  requireReachable?: boolean;
  excludeResourceId?: number | null;
}

// Assigns `gatherer` (owned by `owner`) to a resource, mutating it in place to
// `to-resource` + the chosen target (or `idle` if none qualifies). The chosen
// target's slot in `gatherTargetCounts` is reserved (count++) so later
// same-tick assignments see it one fuller and spread to the next one.
export function assignNearestResource(
  deps: GatherAssignmentDeps,
  activeWorld: GameWorld,
  villagerId: number,
  gatherer: GathererComponent,
  owner: number,
  gatherTargetCounts: Map<number, number>,
  options: AssignNearestResourceOptions,
): void {
  const villagerPosition = activeWorld.getComponent<Position>(villagerId, 'position');
  if (!villagerPosition) return;

  const { preferUnsaturated, spreadCap } = options;
  const excludeId = options.excludeResourceId ?? null;

  // V4-9: filter inline before allocating wrappers — only resources that pass
  // the type + harvestability + ownership gates get a wrapper.
  const matchingResources: Array<{
    id: number;
    position: Position;
    resource: ResourceComponent;
  }> = [];
  for (const id of activeWorld.query('position', 'resource')) {
    const position = activeWorld.getComponent<Position>(id, 'position');
    const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
    if (!position || !resource) continue;
    if (!deps.isHarvestableResource(id, resource)) continue;
    if (resourceKindToEconomyResource(resource.resourceType) !== gatherer.desiredResource) continue;
    // M1 Farms: a farm (resource+building hybrid) is owner-only — exclude it
    // from another player's matching set. Neutral resources are unaffected.
    const isOwnedStructure =
      activeWorld.getComponent<BuildingComponent>(id, 'building') !== undefined;
    if (!canGatherResource(owner, isOwnedStructure, resource.baseOwner)) continue;
    matchingResources.push({ id, position, resource });
  }
  matchingResources.sort((left, right) => {
    // Owner preference FIRST (own > home-base neutral > other), so fan-out
    // NEVER jumps to an enemy or far-off neutral resource just because it is
    // unsaturated — it stays within the player's own forest (Codex
    // gather-stall iter-1 HIGH).
    const leftPreferred =
      left.resource.owner === owner ? 0
      : left.resource.owner === null && left.resource.baseOwner === owner ? 1
      : 2;
    const rightPreferred =
      right.resource.owner === owner ? 0
      : right.resource.owner === null && right.resource.baseOwner === owner ? 1
      : 2;
    if (leftPreferred !== rightPreferred) {
      return leftPreferred - rightPreferred;
    }
    // Within the same owner tier, when redistributing a stuck villager, push
    // already-saturated resources to the back so it picks an under-subscribed
    // one; saturated resources stay a last resort.
    if (preferUnsaturated) {
      const leftSaturated =
        (gatherTargetCounts.get(left.id) ?? 0) >= spreadCap ? 1 : 0;
      const rightSaturated =
        (gatherTargetCounts.get(right.id) ?? 0) >= spreadCap ? 1 : 0;
      if (leftSaturated !== rightSaturated) {
        return leftSaturated - rightSaturated;
      }
    }
    const leftDistance = manhattanDistance(left.position, villagerPosition);
    const rightDistance = manhattanDistance(right.position, villagerPosition);
    return leftDistance - rightDistance;
  });

  // Pick the target. Default: the sorted first (legacy behaviour, byte-identical
  // to the pre-extraction inline function). With `requireReachable`: probe
  // candidates in sorted order, skipping the excluded id, and pick the first
  // that is actually reachable (non-null approach plan) — so an unreachable
  // resource is skipped in favour of a reachable one. The probe count is capped
  // (MAX_REACHABILITY_PROBES) so a fully-boxed villager does a BOUNDED amount of
  // pathfinding per tick. Pathfinding runs ONLY on this requireReachable path,
  // never on the hot default path.
  let target: { id: number; position: Position; resource: ResourceComponent } | undefined;
  if (options.requireReachable) {
    let probes = 0;
    for (const candidate of matchingResources) {
      if (candidate.id === excludeId) continue;
      if (probes >= MAX_REACHABILITY_PROBES) break;
      probes += 1;
      if (deps.findResourceApproachPlan(villagerId, candidate.id, activeWorld) !== null) {
        target = candidate;
        break;
      }
    }
  } else {
    target = matchingResources[0];
  }

  if (!target) {
    gatherer.task = 'idle';
    gatherer.targetResourceId = null;
    return;
  }

  // Reserve the chosen resource so other villagers assigned later THIS tick
  // already see it one fuller and spread to the next one.
  gatherTargetCounts.set(target.id, (gatherTargetCounts.get(target.id) ?? 0) + 1);
  gatherer.task = 'to-resource';
  gatherer.targetResourceId = target.id;
  gatherer.dropOffBuildingId = deps.findNearestDropOffBuilding(
    activeWorld,
    owner,
    gatherer.desiredResource,
    target.position,
  );
  gatherer.gatherProgressTicks = 0;
}
