// Can a builder actually WALK to this building site?
//
// Why it exists (defect register 2026-09-06). Placement was validated against
// the footprint alone: `isPlacementBlocked` asks whether the cells the building
// would stand on are free, and nothing asked whether a villager could get to a
// cell beside them. So a site inside a forest pocket previewed GREEN, the click
// was accepted, the wood was spent — and `playerCommandsSystem` then called
// `findBuildingApproachPlan`, got null, and cleared the build command in the
// same tick. Idle villager, foundation at 0/200 forever, no message. Measured
// on a fresh `aoe2-prototype` at tick 600: ten cells accept a 1x1 palisade gate
// that no villager can reach, and the stranded foundations are solid obstacles,
// so a player who keeps placing seals their own base in.
//
// The one rule this module has to obey: it must give the MOVER'S OWN ANSWER. A
// second opinion about "can I get there" that drifts from the approach search
// is worse than the defect, so this is the same question `findBuildingApproachPlan`
// asks, computed a cheaper way:
//
//   `findBuildingApproachPlan` -> `findMovementPlan` -> `findMovementPathToCandidates`,
//   which keeps the candidates that pass `isCellPassableForUnit` and then runs
//   `findGridPath` (4-connected — no `allowDiagonal` — refusing a blocked start
//   or goal) from the unit's cell to each in turn.
//
// A path over a uniform-cost 4-connected grid exists exactly when start and
// goal are both passable and lie in the same 4-connected component of passable
// cells. So one connected-component labelling of the map answers every
// (builder, site) pair with two array reads, and the answer is A*'s by
// construction. `tests/simulation/placementReachability.test.ts` holds this
// check's verdicts to an independent flood of the same map on a real scenario,
// so a divergence goes red — through its AI-seat arm, because every AI seat
// reads this check while the human seat, since work 122, asks the route over
// explored ground instead (placementKnowledge.ts).
//
// Why a labelling rather than a path per hovered cell: the placement preview
// runs on every mouse move. A* per hovered cell re-solves a full failing search
// each time — the cost that forced the same trade in `dropOffWalkField.ts`.
//
// The pending footprint is deliberately NOT carved out of the map before the
// search, and that is exact rather than an approximation. The builder never
// stands inside the footprint (a unit standing there is itself a placement
// blocker), so take any path from the builder to a ring cell: if it never
// enters the footprint, that ring cell is still reached once the foundation is
// down; if it does, the cell just before its first footprint cell is
// orthogonally adjacent to the footprint — a ring cell itself — and its prefix
// never entered. Either way SOME ring cell survives the foundation, which is
// all a builder needs.
//
// KNOWN BOUNDARY. The equivalence above is exact for the grid, but `findPath`
// also gives up after `maxIterations` (10,000 by default, and nothing here
// raises it). A failing search pushes at most one entry per edge, so on the
// two-player 60x36 map (2,160 cells, ~8,641 pushes) A* always exhausts the
// component and the two answers cannot differ. On the §4 ladder's larger maps —
// up to 116x72 = 8,352 cells — A* can bail early and report unreachable where
// this says reachable, which is the OLD behaviour (a foundation nobody walks
// to) rather than a new one. Untested; `tests/simulation/placementReachability.test.ts`
// asserts the map size for exactly this reason.
//
// FUTURE WALLS (work 126). A foundation nobody has started is open ground that
// every unit walks over (update 185872), and a wall from its first build
// progress. So the labelling takes the asking owner's own and its allies'
// unstarted foundations as the walls they will be (`futureWallsOf`,
// foundationClaims.ts): a second foundation founded behind a first must not
// count on crossing it, or it is stranded the moment the first goes up. This is
// the one place the labelling is not the mover's answer today, and it errs
// toward refusing. A builder standing on such a foundation may still walk off
// it, so its reach is that of the labelled cells beside it.
//
// Invalidation: a labelling is replayed only for the same world and the same
// `worldOccupancy.structuralRevision` (the fifth consumer of that counter).
// Units never block passability, so nothing else the search reads can change
// between bumps; the one in-place owner change that would, monk conversion,
// announces itself as a bump. A foundation placed, started or removed re-claims
// its footprint, which bumps, so the future walls follow it.

import type { Position } from 'civ-engine';

import type { BuildingType, UnitComponent } from '../types';
import { unitDomain } from '../unitDomain';
import type { GameWorld } from './pureHelpers';
import type { PlacementBlockReport, PlacementCellView } from './cellPassability';
import { componentsReachedFrom, reachesFromEvery, type ClaimTest } from './foundationClaims';

/** Blocked, or off the map. Never equal to a component id. */
const NO_COMPONENT = -1;

export interface BuilderReachabilityStats {
  /** Labellings built by a flood fill. */
  computed: number;
  /** Asks answered by a labelling already built. */
  served: number;
  /** Wall time spent labelling, so the cost is a number and not a belief. */
  computeMs: number;
}

export interface BuilderReachabilityDeps {
  mapWidth: number;
  mapHeight: number;
  /** The mover's own passability predicate — the same one
   *  `findMovementPathToCandidates` hands to `findGridPath`. */
  isCellPassableForUnit: (
    unitId: number,
    x: number,
    y: number,
    activeWorld: GameWorld,
  ) => boolean;
  structuralRevision: () => number;
  /** The mover's own approach ring, so there is one definition of "beside the
   *  footprint" rather than two that can disagree. */
  getApproachCellsForFootprint: (
    anchor: Position,
    width: number,
    height: number,
    range?: number,
  ) => Position[];
  /** The cells of the foundations nobody has started that will wall
   *  `owner`'s ground once started, its own and its allies' (foundationClaims.ts),
   *  as a map-sized mask; null for none. A route does not count on crossing one. */
  futureWallsOf?: (owner: number) => Uint8Array | null;
}

export interface BuilderReachability {
  /** Whether ANY of `builderIds` can walk to a cell beside the footprint at
   *  `(anchorX, anchorY)`. An empty list is not an answer — callers that have
   *  no builder in hand must not ask. */
  canAnyBuilderReachFootprint(
    builderIds: readonly number[],
    anchorX: number,
    anchorY: number,
    width: number,
    height: number,
    activeWorld: GameWorld,
  ): boolean;
  readonly stats: BuilderReachabilityStats;
}

interface LabelEntry {
  world: GameWorld;
  revision: number;
  labels: Int32Array;
}

export function createBuilderReachability(deps: BuilderReachabilityDeps): BuilderReachability {
  const { mapWidth, mapHeight, isCellPassableForUnit, structuralRevision } = deps;
  const size = Math.max(0, mapWidth * mapHeight);
  // One labelling per owner and movement domain: those are the only two things
  // `isCellPassableForUnit` reads about the asking unit (its owner decides
  // which gates admit it, its type decides land or water).
  const entries = new Map<string, LabelEntry>();
  const stats: BuilderReachabilityStats = { computed: 0, served: 0, computeMs: 0 };

  function label(activeWorld: GameWorld, probeUnitId: number, owner: number): Int32Array {
    const labels = new Int32Array(size).fill(NO_COMPONENT);
    const queue = new Int32Array(size);
    const walls = deps.futureWallsOf?.(owner) ?? null;
    const walkable = (x: number, y: number): boolean => (
      isCellPassableForUnit(probeUnitId, x, y, activeWorld) && walls?.[y * mapWidth + x] !== 1
    );
    let component = 0;
    for (let seed = 0; seed < size; seed += 1) {
      if (labels[seed] !== NO_COMPONENT) continue;
      const seedX = seed % mapWidth;
      const seedY = (seed - seedX) / mapWidth;
      if (!walkable(seedX, seedY)) continue;
      let head = 0;
      let tail = 0;
      labels[seed] = component;
      queue[tail] = seed;
      tail += 1;
      while (head < tail) {
        const index = queue[head];
        head += 1;
        const x = index % mapWidth;
        const y = (index - x) / mapWidth;
        const visit = (nx: number, ny: number): void => {
          if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) return;
          const next = ny * mapWidth + nx;
          if (labels[next] !== NO_COMPONENT) return;
          if (!walkable(nx, ny)) return;
          labels[next] = component;
          queue[tail] = next;
          tail += 1;
        };
        visit(x - 1, y);
        visit(x + 1, y);
        visit(x, y - 1);
        visit(x, y + 1);
      }
      component += 1;
    }
    return labels;
  }

  function labelsFor(activeWorld: GameWorld, probeUnitId: number): Int32Array | null {
    const unit = activeWorld.getComponent<UnitComponent>(probeUnitId, 'unit');
    if (!unit) return null;
    const key = `${String(unit.owner)}:${unitDomain(unit.unitType)}`;
    const revision = structuralRevision();
    const cached = entries.get(key);
    if (cached && cached.world === activeWorld && cached.revision === revision) {
      stats.served += 1;
      return cached.labels;
    }
    const startedAt = performance.now();
    const labels = label(activeWorld, probeUnitId, unit.owner);
    stats.computeMs += performance.now() - startedAt;
    stats.computed += 1;
    entries.set(key, { world: activeWorld, revision, labels });
    return labels;
  }

  return {
    canAnyBuilderReachFootprint(builderIds, anchorX, anchorY, width, height, activeWorld) {
      if (builderIds.length === 0) return false;
      const ring = deps.getApproachCellsForFootprint(
        { x: anchorX, y: anchorY },
        width,
        height,
        1,
      );
      if (ring.length === 0) return false;
      for (const builderId of builderIds) {
        const position = activeWorld.getComponent<Position>(builderId, 'position');
        if (!position) continue;
        const labels = labelsFor(activeWorld, builderId);
        if (!labels) continue;
        if (
          position.x < 0 || position.x >= mapWidth
          || position.y < 0 || position.y >= mapHeight
        ) continue;
        // A blocked start is a null path in `findGridPath`, so a builder whose
        // own cell is off the field reaches nothing — never NO_COMPONENT ===
        // NO_COMPONENT by accident. A builder standing on a future wall may
        // still walk off it, so it reaches what lies beyond, and the site must
        // be reachable from every side it could be standing on when the wall
        // goes up (work 126).
        const from = labels[position.y * mapWidth + position.x]!;
        const owner = activeWorld.getComponent<UnitComponent>(builderId, 'unit')?.owner;
        const walls = from === NO_COMPONENT && owner !== undefined ? deps.futureWallsOf?.(owner) ?? null : null;
        const reached = walls === null
          ? new Set([from])
          : componentsReachedFrom(position, mapWidth, mapHeight, labels, (x, y) => (
            walls[y * mapWidth + x] === 1 && isCellPassableForUnit(builderId, x, y, activeWorld)
          ));
        reached.delete(NO_COMPONENT);
        const ringLabels = ring
          .filter((cell) => cell.x >= 0 && cell.x < mapWidth && cell.y >= 0 && cell.y < mapHeight)
          .map((cell) => labels[cell.y * mapWidth + cell.x]!);
        if (reachesFromEvery(reached, ringLabels)) return true;
      }
      return false;
    },
    stats,
  };
}

/** The occupancy answers this module wraps, with the builder-blind signatures
 *  `cellPassability` exposes. */
export interface PlacementOccupancyOps {
  isPlacementBlocked(
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType?: BuildingType,
    view?: PlacementCellView,
  ): boolean;
  describePlacementBlockers(
    x: number,
    y: number,
    width: number,
    height: number,
    view?: PlacementCellView,
  ): PlacementBlockReport | null;
  findOpenPlacementAnchors(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    opts: {
      max: number;
      maxRadius?: number;
      isCellVisible: (x: number, y: number) => boolean;
      standsAside?: ClaimTest;
    },
  ): Position[];
}

/** A blocked-placement report that says the footprint itself was clear and the
 *  refusal is that no builder can walk to it. The validator branches on this
 *  rather than on the cause string. */
export interface ReachabilityBlockReport extends PlacementBlockReport {
  unreachableForBuilders?: boolean;
}

export interface PlacementReachabilityOps {
  isPlacementBlocked(
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType?: BuildingType,
    builderIds?: readonly number[],
  ): boolean;
  describePlacementBlockers(
    x: number,
    y: number,
    width: number,
    height: number,
    builderIds?: readonly number[],
  ): ReachabilityBlockReport | null;
  findOpenPlacementAnchors(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    opts: {
      max: number;
      maxRadius?: number;
      isCellVisible: (x: number, y: number) => boolean;
      /** When given, an anchor is only offered if one of these builders can
       *  walk to it. A suggestion the game would itself refuse is worse than
       *  no suggestion: on `aoe2-prototype` the pre-fix "Nearest open ground"
       *  line named an unreachable cell for 4 of 12 probed refusals. */
      builderIds?: readonly number[];
    },
  ): Position[];
}

/** Fold reachability into the three placement answers, so the preview, the
 *  validator, the authoritative re-check and the suggestion all read ONE
 *  verdict — the pairing `cellPassability.isPlacementBlocked` already keeps for
 *  shore placement, for the same reason. Callers that pass no builders get the
 *  occupancy-only answer unchanged. */
export function withBuilderReachability(
  occupancy: PlacementOccupancyOps,
  reachability: BuilderReachability,
  world: GameWorld,
  /** Which claims stand aside for a placer: an enemy's unstarted foundation
   *  (foundationClaims.ts). Without builders a call has no placer, and every
   *  claim counts. */
  standsAsideFor?: (placer: number) => ClaimTest,
): PlacementReachabilityOps {
  const standsAsideForBuilders = (builderIds: readonly number[] | undefined): ClaimTest | undefined => {
    const first = builderIds?.[0];
    const placer = first === undefined ? undefined : world.getComponent<UnitComponent>(first, 'unit')?.owner;
    return placer === undefined || standsAsideFor === undefined ? undefined : standsAsideFor(placer);
  };
  const viewFor = (builderIds: readonly number[] | undefined): PlacementCellView | undefined => {
    const standsAside = standsAsideForBuilders(builderIds);
    return standsAside === undefined ? undefined : { standsAside };
  };
  const unreachable = (
    x: number,
    y: number,
    width: number,
    height: number,
    builderIds: readonly number[] | undefined,
  ): boolean => (
    builderIds !== undefined
    && builderIds.length > 0
    && !reachability.canAnyBuilderReachFootprint(builderIds, x, y, width, height, world)
  );

  return {
    isPlacementBlocked(x, y, width, height, buildingType, builderIds) {
      if (occupancy.isPlacementBlocked(x, y, width, height, buildingType, viewFor(builderIds))) return true;
      return unreachable(x, y, width, height, builderIds);
    },
    describePlacementBlockers(x, y, width, height, builderIds) {
      const report = occupancy.describePlacementBlockers(x, y, width, height, viewFor(builderIds));
      if (report) return report;
      if (!unreachable(x, y, width, height, builderIds)) return null;
      return {
        firstBlockedCell: { x, y },
        cause: 'no walkable route to it',
        blockedCellCount: 0,
        totalCellCount: width * height,
        unreachableForBuilders: true,
      };
    },
    findOpenPlacementAnchors(centerX, centerY, width, height, opts) {
      const { builderIds } = opts;
      if (builderIds === undefined || builderIds.length === 0) {
        return occupancy.findOpenPlacementAnchors(centerX, centerY, width, height, opts);
      }
      // Ask for more than the caller wants and keep the reachable ones, in the
      // ring order the scan already produces, so the suggestion stays the
      // NEAREST open ground rather than merely a reachable one.
      const wanted = opts.max;
      const candidates = occupancy.findOpenPlacementAnchors(centerX, centerY, width, height, {
        ...opts,
        max: Math.max(wanted * 8, 64),
        standsAside: standsAsideForBuilders(builderIds),
      });
      const out: Position[] = [];
      for (const anchor of candidates) {
        if (out.length >= wanted) break;
        if (unreachable(anchor.x, anchor.y, width, height, builderIds)) continue;
        out.push(anchor);
      }
      return out;
    },
  };
}
