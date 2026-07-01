// Reachability-aware drop-off selection (extracted from villagerEconomySystem
// to keep that file under the 500-LOC cap and to give the reroute a clean home,
// mirroring villagerGatherAssignment for the RESOURCE leg).
//
// The bug it fixes (AI-vs-AI grounding, 2026-07-01): a villager carrying a full
// load whose NEAREST drop-off building is unreachable (every approach cell
// blocked — e.g. the AI packed buildings around its own Town Center) used to
// latch in `to-dropoff` forever. `findNearestDropOffBuilding` returns the
// nearest by Manhattan distance with no reachability check, so the economy loop
// re-picked that same boxed-in nearest every retry and never tried a farther
// REACHABLE drop-off. Deposited resources froze; an AI stuck this way never
// reached the 500 food for Feudal and stayed in the Dark Age all game.
//
// `findReachableDropOff` probes drop-off candidates in nearest-first order,
// skipping any whose building-approach plan is null, and returns the first
// REACHABLE one with its plan — so an unreachable nearest is skipped in favour
// of a reachable farther one. It reuses `findNearestDropOffBuilding`'s
// `excludeIds` param to advance to the next-nearest candidate.

import type { UnitMovementPlan } from './movementTypes';
import type { GameWorld } from './pureHelpers';
import type { Position } from 'civ-engine';

type EconomyResource = 'food' | 'wood' | 'gold' | 'stone';

// Cap on how many drop-off candidates the reroute pathfinds against per call.
// The success case (the nearest drop-off is reachable) short-circuits at the
// first candidate — the common path costs exactly one approach-plan probe, the
// same as the pre-fix code. The cap only bites when the nearest few drop-offs
// are all unreachable, bounding a genuinely boxed-in villager's per-call
// pathfinding to a constant. A base rarely has more than a handful of drop-off
// buildings for one resource kind, so 8 comfortably covers every reachable one.
const MAX_DROPOFF_PROBES = 8;

export interface DropOffAssignmentDeps {
  findNearestDropOffBuilding: (
    activeWorld: GameWorld,
    owner: number,
    resource: EconomyResource,
    position: Position,
    excludeIds?: ReadonlySet<number>,
  ) => number | null;
  findBuildingApproachPlan: (
    unitId: number,
    targetId: number,
    range: number,
    activeWorld: GameWorld,
  ) => UnitMovementPlan | null;
}

export interface ReachableDropOff {
  buildingId: number;
  plan: UnitMovementPlan;
}

// Returns the nearest REACHABLE drop-off for `resource` (its id + approach
// plan), or `null` when none of the nearest `MAX_DROPOFF_PROBES` candidates is
// reachable (the villager is genuinely boxed in — the caller then backs off).
export function findReachableDropOff(
  deps: DropOffAssignmentDeps,
  activeWorld: GameWorld,
  owner: number,
  resource: EconomyResource,
  villagerId: number,
  origin: Position,
): ReachableDropOff | null {
  const excludeIds = new Set<number>();
  for (let probes = 0; probes < MAX_DROPOFF_PROBES; probes += 1) {
    const buildingId = deps.findNearestDropOffBuilding(
      activeWorld,
      owner,
      resource,
      origin,
      excludeIds,
    );
    if (buildingId === null) {
      return null;
    }
    const plan = deps.findBuildingApproachPlan(villagerId, buildingId, 1, activeWorld);
    if (plan) {
      return { buildingId, plan };
    }
    excludeIds.add(buildingId);
  }
  return null;
}
