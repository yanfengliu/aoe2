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
  UnitComponent,
  GathererComponent,
  ResourceComponent,
  EconomyResourceKind,
} from '../types';
import { manhattanDistance, type GameWorld } from './pureHelpers';
import { canGatherResource, resourceKindToEconomyResource } from '../prototypeEconomyRules';
import { canGathererHarvest } from '../gatherDomain';
import type { UnitMovementPlan } from './movementTypes';

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
    resource: EconomyResourceKind,
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

// How far from its drop-off a villager will be sent to gather on its own. Wide
// enough to cover a base's whole resource neighbourhood, short enough that it
// never reaches another player's territory on the maps this game ships.
const HOME_GATHER_RANGE = 24;

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
  const gathererUnit = activeWorld.getComponent<UnitComponent>(villagerId, 'unit');
  if (!gathererUnit) return;
  const gathererUnitType = gathererUnit.unitType;

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
    // A fish is FOOD, so the kind filter above lets a land villager pick one —
    // and it then walks to the shoreline and never arrives. Domain first.
    if (!canGathererHarvest(gathererUnitType, resource.resourceType)) continue;
    // M1 Farms: a farm (resource+building hybrid) is owner-only — exclude it
    // from another player's matching set. Neutral resources are unaffected.
    const isOwnedStructure =
      activeWorld.getComponent<BuildingComponent>(id, 'building') !== undefined;
    if (!canGatherResource(owner, isOwnedStructure, resource.baseOwner)) continue;
    matchingResources.push({ id, position, resource });
  }

  // No matching resource of the desired kind at all → idle, before paying the
  // reference-drop-off lookup below (a maintain-order villager whose kind is
  // fully depleted re-runs assignment twice per tick indefinitely; review
  // 2026-07-02 low finding).
  if (matchingResources.length === 0) {
    gatherer.task = 'idle';
    gatherer.targetResourceId = null;
    return;
  }

  // Steady-state gather throughput is dominated by the resource↔drop-off
  // ROUND-TRIP (the villager shuttles between them repeatedly), not by the
  // one-time first walk from the villager's current cell. So prefer resources
  // near a drop-off: a villager that goes idle deep in a far forest (its tree
  // depleted, or it fanned out during a momentary near-saturation) then picks a
  // BASE-proximate resource and cycles near the base — instead of spiraling
  // outward and doing a huge round-trip every cycle (the grounded AI
  // wood-starvation: full trees 8 cells from the lumber-camp sat unused while
  // villagers walked 20+ cells, 2026-07-02). Reference point = the drop-off
  // nearest the VILLAGER — a stable one-lookup ranking anchor for the base's
  // drop-off neighbourhood (the ACTUAL deposit building is re-resolved from the
  // villager's live position when it enters `to-dropoff`, and may differ with
  // multiple camps — an accepted one-lookup approximation). Undefined when the
  // owner has no drop-off with a known position → the sort falls back to
  // villager distance (legacy behaviour byte-identical).
  const referenceDropOffId = deps.findNearestDropOffBuilding(
    activeWorld,
    owner,
    gatherer.desiredResource,
    villagerPosition,
  );
  const referenceDropOff = referenceDropOffId === null
    ? undefined
    : activeWorld.getComponent<Position>(referenceDropOffId, 'position');

  // Home range. Ranking alone only ORDERS candidates, so once the nodes beside
  // the base are saturated or unreachable the list runs on to the far side of
  // the map: AI villagers were assigned resources forty cells away, walked into
  // the enemy's base, and were killed there — twenty of them over one match,
  // which is what emptied the AI's economy. A villager gathers near home, and
  // the whole map is still available when home has nothing left.
  const everyMatch = [...matchingResources];
  if (referenceDropOff) {
    const withinHomeRange = matchingResources.filter((candidate) => (
      manhattanDistance(candidate.position, referenceDropOff) <= HOME_GATHER_RANGE
    ));
    if (withinHomeRange.length > 0) {
      matchingResources.length = 0;
      matchingResources.push(...withinHomeRange);
    }
  }

  // Shared comparator. `useDropOffLocality` picks the primary distance key:
  // the STEADY-STATE assignment ranks by proximity to the reference drop-off
  // (round-trip cost); the requireReachable RECOVERY probe ranks by villager
  // proximity — its job is to find SOMETHING reachable within the bounded
  // probe budget, and probing drop-off-first would let a walled-off pocket of
  // >= MAX_REACHABILITY_PROBES unreachable trees near the base exhaust the cap
  // and starve a villager standing beside a reachable tree (review 2026-07-02
  // medium finding, refuting repro included). Owner preference and the
  // unsaturated fan-out dominate both orders.
  const compareCandidates = (
    left: { id: number; position: Position; resource: ResourceComponent },
    right: { id: number; position: Position; resource: ResourceComponent },
    useDropOffLocality: boolean,
  ): number => {
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
    if (useDropOffLocality) {
      // Primary distance: proximity to the reference drop-off (round-trip
      // cost). Both Infinity (no drop-off) compares equal → falls through to
      // villager distance, preserving legacy behaviour.
      const leftDropOff = referenceDropOff
        ? manhattanDistance(left.position, referenceDropOff)
        : Number.POSITIVE_INFINITY;
      const rightDropOff = referenceDropOff
        ? manhattanDistance(right.position, referenceDropOff)
        : Number.POSITIVE_INFINITY;
      if (leftDropOff !== rightDropOff) {
        return leftDropOff - rightDropOff;
      }
    }
    // Villager first-trip distance, then id for a stable deterministic order.
    const leftDistance = manhattanDistance(left.position, villagerPosition);
    const rightDistance = manhattanDistance(right.position, villagerPosition);
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }
    return left.id - right.id;
  };

  matchingResources.sort((l, r) => compareCandidates(l, r, true));

  // Pick the target. Default: the sorted first. With `requireReachable`: probe
  // candidates in VILLAGER-proximity order (the pre-locality legacy order — see
  // the comparator memo), skipping the excluded id, and pick the first that is
  // actually reachable (non-null approach plan) — so an unreachable resource is
  // skipped in favour of a reachable one. The probe count is capped
  // (MAX_REACHABILITY_PROBES) so a fully-boxed villager does a BOUNDED amount of
  // pathfinding per tick. Pathfinding (and the extra re-sort) runs ONLY on this
  // requireReachable recovery path, never on the hot default path.
  let target: { id: number; position: Position; resource: ResourceComponent } | undefined;
  if (options.requireReachable) {
    const probeFrom = (
      candidates: ReadonlyArray<{ id: number; position: Position; resource: ResourceComponent }>,
    ): typeof target => {
      const probeOrder = [...candidates].sort((l, r) => compareCandidates(l, r, false));
      let probes = 0;
      for (const candidate of probeOrder) {
        if (candidate.id === excludeId) continue;
        if (probes >= MAX_REACHABILITY_PROBES) break;
        probes += 1;
        if (deps.findResourceApproachPlan(villagerId, candidate.id, activeWorld) !== null) {
          return candidate;
        }
      }
      return undefined;
    };
    // Home first. Widening only when nothing at home can be reached is what
    // keeps a villager beside a reachable resource from starving behind a
    // walled pocket next to its drop-off, without turning the ordinary
    // fan-out into a walk across the map.
    target = probeFrom(matchingResources) ?? (
      matchingResources.length === everyMatch.length ? undefined : probeFrom(everyMatch)
    );
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
