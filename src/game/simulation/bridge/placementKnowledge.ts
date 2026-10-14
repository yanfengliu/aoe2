// What the player placing a building knows about the ground (work 122; defect
// register 2026-09-23; spec §12.1).
//
// The defect: the placement verdict read the true map everywhere, so the ghost
// went red over unexplored water, forest and enemy buildings and green over
// open ground, and sweeping it across black ground mapped them. Definitive
// Edition's notes give the rule this module applies to the player's placement:
//
//  * update 44725 (2021-01-25): a blueprint over unexplored terrain no longer
//    reveals whether a building or unit occupies it; it can still be placed,
//    and it is not buildable if the ground is obstructed;
//  * hotfix 45185 (2021-02-11): a foundation may be placed over unexplored
//    ground if part of it is explored, and never on ground wholly unexplored;
//  * update 46295 (2021-03-24): a foundation over an obstacle the fog hid is
//    cancelled when villagers try to begin construction (foundationStart.ts).
//
// So for the player the verdict reads only explored ground — explored by the
// player or by anyone it shares vision with, the ground the frame does not draw
// black. Under the footprint an unexplored cell blocks nothing: whatever it
// hides is found when building starts. The exception is what the frame draws
// there anyway, which blocks as it would on explored ground: the player's own
// entities; anyone else's of which the player's sight sees a cell, since the
// frame then draws it whole (renderStateOps, `isFootprintSeen`), by its live
// claims; and a building the frame draws from fog memory, by the footprint
// remembered — never by its live claims, which would tell whether it still
// stands. DE fixed the same in update 50292 (2021-07-06): a foundation could be
// placed on top of another player's building on the edge of its line of
// sight. What the frame hides is not counted either: an enemy's foundation
// nobody has started building is drawn neither live nor from memory however
// much of it is lit (work 121, unstartedFoundations.ts), so it no more decides
// the verdict on unexplored ground than anything else the fog hides. Beside the footprint an unexplored cell meets no requirement: a Dock
// needs water the player has seen (placementFootprint.ts). A footprint with no
// explored cell is refused.
// Reachability is asked over explored ground only: a builder must be able to
// walk to a cell beside the footprint without crossing the fog. Taking the fog
// as passable would let a hidden lake or wall strand a paid foundation (the
// register entry of 2026-09-06), and taking the true map would let the ghost
// reveal whether the fog hides a way through. Every one of these readings
// leaves the verdict independent of what any unexplored cell holds, which is
// the property `tests/simulation/placementUnexplored.test.ts` holds.
//
// The route question is answered the way builderReachability.ts answers it
// for the true map: one connected-component labelling of explored, passable
// ground per owner and movement domain, then two array reads per builder and
// ring cell. The view asks once or twice a frame in placement mode, so the
// labelling is kept until the world steps, the ground changes (the structural
// revision) or the owners whose sight the player shares change. Explored ground
// grows only inside a step, so a labelling taken between two steps holds for
// every question until the next one. Its builds and reuses are counted
// (`getDebugSnapshot().placementKnowledge`), and a test holds the count to one
// build per tick however often the preview is asked.
//
// Who places this way: the human seat, unless an AI drives it (the AI-vs-AI
// corpus forces one onto it). An AI seat's site search and commands read the
// true map, unchanged: the notes describe the player's blueprint, and none asks
// the AI to change. The rule is chosen by the owner of the builders the call
// names, so every caller of the three placement answers — the preview, the
// validator, the handler's re-check, the suggestion and the agent's hints —
// gets the right one without being told.

import type { OccupancyCellClaim, Position, VisibilityMap } from 'civ-engine';

import type {
  BuildingComponent,
  ProjectedEntityView,
  RenderableComponent,
  ResourceComponent,
  UnitComponent,
} from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { aiStatesCodec } from './bridgeStateSerialize';
import type {
  PlacementOccupancyOps,
  PlacementReachabilityOps,
  ReachabilityBlockReport,
} from './builderReachability';
import type { PlacementCellView, RememberedClaim } from './placementFootprint';
import { isFootprintSeen, readSightOwners } from './humanSight';
import { isHiddenUnstartedFoundation } from './unstartedFoundations';
import type { GameWorld } from './pureHelpers';
import { unitDomain } from '../unitDomain';

/** Blocked, unexplored, or off the map. Never equal to a component id. */
const NO_COMPONENT = -1;
/** Explored and walkable, not yet reached by a flood. */
const UNLABELLED = -2;

/** A placement report taken through the player's view. */
export interface KnowledgeBlockReport extends ReachabilityBlockReport {
  /** No cell of the footprint has been explored (hotfix 45185). */
  unexplored?: boolean;
}

/** The explored-ground labelling's cost, the feature's own counter. */
export interface PlacementKnowledgeStats {
  /** Labellings of explored, passable ground built by a flood fill. */
  computed: number;
  /** Route questions answered by a labelling already built. */
  served: number;
  /** Wall time spent labelling. */
  computeMs: number;
}

/** The occupancy answers, able to read through a view. */
export interface ViewablePlacementOccupancy extends PlacementOccupancyOps {
  isPlacementBlocked(
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType?: import('../types').BuildingType,
    view?: PlacementCellView,
  ): boolean;
  describePlacementBlockers(
    x: number,
    y: number,
    width: number,
    height: number,
    view?: PlacementCellView,
  ): ReachabilityBlockReport | null;
}

export interface PlacementKnowledgeDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  visibility: Pick<VisibilityMap, 'isExplored' | 'isVisible'>;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  occupancy: ViewablePlacementOccupancy;
  /** The mover's own passability predicate, as builderReachability asks it. */
  isCellPassableForUnit: (unitId: number, x: number, y: number, activeWorld: GameWorld) => boolean;
  /** The mover's own approach ring: one definition of "beside the footprint". */
  getApproachCellsForFootprint: (anchor: Position, width: number, height: number, range?: number) => Position[];
  /** Bumped by every change to what blocks a cell (worldOccupancy). */
  structuralRevision: () => number;
  /** What the frame draws from the human's fog memory, before it drops the
   *  entries whose live entity it draws: fogMemoryOps' own projection, called
   *  with no live ids, so its rules (an explored cell of the footprint, never
   *  another player's unstarted foundation) are the frame's by construction. */
  fogMemoryViews: () => readonly ProjectedEntityView[];
}

export interface PlayerKnowledgePlacement extends PlacementReachabilityOps {
  readonly stats: PlacementKnowledgeStats;
}

/** Whether `owner` places by what it has explored rather than by the true map. */
export function placesByKnowledge(
  accessor: BridgeStateAccessor,
  humanPlayerId: number,
  owner: number,
): boolean {
  return owner === humanPlayerId && !accessor.get(aiStatesCodec).has(owner);
}

interface Knowledge {
  owner: number;
  sight: readonly number[];
  sightKey: string;
  isCellKnown: (x: number, y: number) => boolean;
  /** Whether the frame draws this live entity for the player. */
  isDrawnLive: (entity: number) => boolean;
  view: PlacementCellView;
}

/** The unexplored cells fog memory draws something on, for one tick. */
interface RememberedCells {
  world: GameWorld;
  tick: number;
  sightKey: string;
  cells: Map<number, RememberedClaim>;
}

interface KnownLabelling {
  world: GameWorld;
  tick: number;
  revision: number;
  sightKey: string;
  labels: Int32Array;
}

export function withPlayerKnowledge(
  truth: PlacementReachabilityOps,
  deps: PlacementKnowledgeDeps,
): PlayerKnowledgePlacement {
  const { world, accessor, visibility, humanPlayerId, mapWidth, mapHeight, occupancy } = deps;
  const inMap = (x: number, y: number): boolean => x >= 0 && x < mapWidth && y >= 0 && y < mapHeight;
  const stats: PlacementKnowledgeStats = { computed: 0, served: 0, computeMs: 0 };
  const labellings = new Map<string, KnownLabelling>();
  const remembered = new Map<number, RememberedCells>();
  let floodQueue = new Int32Array(0);

  /** The owner whose knowledge decides, or null for the true map. */
  function knowingOwner(builderIds: readonly number[] | undefined): number | null {
    const first = builderIds?.[0];
    if (first === undefined) return null;
    const unit = world.getComponent<UnitComponent>(first, 'unit');
    if (!unit) return null;
    return placesByKnowledge(accessor, humanPlayerId, unit.owner) ? unit.owner : null;
  }

  /** What `owner` knows: cells explored by it or anyone whose vision it shares
   *  (the cells not drawn black), and what the frame draws for it on any cell —
   *  live entities by their claims, remembered ones by their memory. */
  function knowledgeOf(owner: number): Knowledge {
    const sight = readSightOwners(accessor, owner);
    const sightKey = sight.join(',');
    const isCellKnown = (x: number, y: number): boolean => {
      for (const viewer of sight) if (visibility.isExplored(viewer, x, y)) return true;
      return false;
    };
    // The frame's own rule (renderStateOps `isCurrentlyVisibleTo`): the
    // player's entities always, anyone else's once its sight sees a cell of
    // the footprint, which is then drawn whole.
    const isDrawnLive = (entity: number): boolean => {
      const position = world.getComponent<Position>(entity, 'position');
      if (!position) return false;
      const building = world.getComponent<BuildingComponent>(entity, 'building');
      const entityOwner = building?.owner
        ?? world.getComponent<UnitComponent>(entity, 'unit')?.owner
        ?? world.getComponent<ResourceComponent>(entity, 'resource')?.owner
        ?? null;
      if (entityOwner === owner) return true;
      // The frame never draws an enemy's foundation nobody has started
      // building, however much of it is lit (renderStateOps' `isFoundationHidden`).
      if (building && isHiddenUnstartedFoundation(accessor, entity, building.owner, owner)) return false;
      const renderable = world.getComponent<RenderableComponent>(entity, 'renderable');
      return isFootprintSeen(
        visibility,
        sight,
        position.x,
        position.y,
        renderable?.footprintWidth ?? 1,
        renderable?.footprintHeight ?? 1,
      );
    };
    const isClaimShown = (claim: OccupancyCellClaim): boolean => claim.entity !== null && isDrawnLive(claim.entity);
    const knowledge: Knowledge = { owner, sight, sightKey, isCellKnown, isDrawnLive, view: {} };
    knowledge.view = {
      isCellKnown,
      isClaimShown,
      rememberedAt: (x, y) => rememberedCells(knowledge).get(y * mapWidth + x) ?? null,
    };
    return knowledge;
  }

  /** The unexplored cells on which the frame draws something from the
   *  player's fog memory, and what. The memory views are the frame's own
   *  projection (`fogMemoryViews`); the frame then drops a view whose live
   *  entity it draws instead (renderStateOps), and so does this. A view sits at
   *  the footprint remembered, and that is read, never the live claims under
   *  it: those would tell the player whether a building it cannot see still
   *  stands. Fog memory changes only inside a step, so this is built at most
   *  once a tick, and only when an unexplored cell is asked about. The
   *  projection is the human's, and the knower is always the human seat
   *  (`placesByKnowledge`). */
  function rememberedCells(knowledge: Knowledge): Map<number, RememberedClaim> {
    const tick = world.tick;
    const cached = remembered.get(knowledge.owner);
    if (cached && cached.world === world && cached.tick === tick && cached.sightKey === knowledge.sightKey) {
      return cached.cells;
    }
    const cells = new Map<number, RememberedClaim>();
    for (const view of deps.fogMemoryViews()) {
      if (view.kind !== 'building' && view.kind !== 'resource') continue;
      if (world.isAlive(view.id) && knowledge.isDrawnLive(view.id)) continue;
      for (let cellY = view.y; cellY < view.y + view.footprintHeight; cellY += 1) {
        for (let cellX = view.x; cellX < view.x + view.footprintWidth; cellX += 1) {
          if (!inMap(cellX, cellY) || knowledge.isCellKnown(cellX, cellY)) continue;
          const index = cellY * mapWidth + cellX;
          if (!cells.has(index)) cells.set(index, { kind: view.kind, entityType: view.entityType });
        }
      }
    }
    remembered.set(knowledge.owner, { world, tick, sightKey: knowledge.sightKey, cells });
    return cells;
  }

  function countKnown(x: number, y: number, width: number, height: number, knowledge: Knowledge): number {
    let known = 0;
    for (let cellY = y; cellY < y + height; cellY += 1) {
      for (let cellX = x; cellX < x + width; cellX += 1) {
        if (inMap(cellX, cellY) && knowledge.isCellKnown(cellX, cellY)) known += 1;
      }
    }
    return known;
  }

  /** The components of explored ground `probeId` can walk, kept until the
   *  world steps or the ground or the shared sight changes. The explored set
   *  itself changes only when a vision source moves, which happens inside a
   *  step (visibilitySystem) or while the bridge is built, so between two steps
   *  the tick stands for it. */
  function knownLabels(probeId: number, unit: UnitComponent, knowledge: Knowledge): Int32Array {
    // `isCellPassableForUnit` reads the unit's owner (which gates admit it)
    // and its domain (land or water); the explored set is the knower's.
    const key = `${String(knowledge.owner)}:${String(unit.owner)}:${unitDomain(unit.unitType)}`;
    const tick = world.tick;
    const revision = deps.structuralRevision();
    const cached = labellings.get(key);
    if (
      cached && cached.world === world && cached.tick === tick
      && cached.revision === revision && cached.sightKey === knowledge.sightKey
    ) {
      stats.served += 1;
      return cached.labels;
    }
    const startedAt = performance.now();
    const size = mapWidth * mapHeight;
    // The buffers are reused: a labelling is read only synchronously, by the
    // question that asked for it, and the next one is rebuilt in place.
    const labels = cached?.labels.length === size ? cached.labels : new Int32Array(size);
    if (floodQueue.length !== size) floodQueue = new Int32Array(size);
    const queue = floodQueue;
    // One pass asks each cell once whether it is explored and walkable.
    for (let index = 0; index < size; index += 1) {
      const x = index % mapWidth;
      const y = (index - x) / mapWidth;
      labels[index] = knowledge.isCellKnown(x, y) && deps.isCellPassableForUnit(probeId, x, y, world)
        ? UNLABELLED
        : NO_COMPONENT;
    }
    let component = 0;
    for (let seed = 0; seed < size; seed += 1) {
      if (labels[seed] !== UNLABELLED) continue;
      let head = 0;
      let tail = 0;
      labels[seed] = component;
      queue[tail] = seed;
      tail += 1;
      while (head < tail) {
        const index = queue[head]!;
        head += 1;
        const x = index % mapWidth;
        // The four orthogonal neighbours, as findGridPath walks.
        const west = x > 0 ? index - 1 : -1;
        const east = x < mapWidth - 1 ? index + 1 : -1;
        const north = index - mapWidth;
        const south = index + mapWidth < size ? index + mapWidth : -1;
        for (const next of [west, east, north, south]) {
          if (next < 0 || labels[next] !== UNLABELLED) continue;
          labels[next] = component;
          queue[tail] = next;
          tail += 1;
        }
      }
      component += 1;
    }
    stats.computed += 1;
    stats.computeMs += performance.now() - startedAt;
    labellings.set(key, { world, tick, revision, sightKey: knowledge.sightKey, labels });
    return labels;
  }

  /** Whether some builder can walk to a cell beside the footprint over
   *  explored ground only: the same question builderReachability asks of the
   *  true map, asked of the ground the player knows. */
  function reachesOverKnownGround(
    builderIds: readonly number[],
    x: number,
    y: number,
    width: number,
    height: number,
    knowledge: Knowledge,
  ): boolean {
    const ring = deps.getApproachCellsForFootprint({ x, y }, width, height, 1)
      .filter((cell) => inMap(cell.x, cell.y) && knowledge.isCellKnown(cell.x, cell.y));
    if (ring.length === 0) return false;
    for (const id of builderIds) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      const position = world.getComponent<Position>(id, 'position');
      if (!unit || !position || !inMap(position.x, position.y)) continue;
      const labels = knownLabels(id, unit, knowledge);
      const from = labels[position.y * mapWidth + position.x];
      if (from === undefined || from === NO_COMPONENT) continue;
      if (ring.some((cell) => labels[cell.y * mapWidth + cell.x] === from)) return true;
    }
    return false;
  }

  return {
    stats,
    isPlacementBlocked(x, y, width, height, buildingType, builderIds) {
      const owner = knowingOwner(builderIds);
      if (owner === null) return truth.isPlacementBlocked(x, y, width, height, buildingType, builderIds);
      const knowledge = knowledgeOf(owner);
      if (countKnown(x, y, width, height, knowledge) === 0) return true;
      if (occupancy.isPlacementBlocked(x, y, width, height, buildingType, knowledge.view)) return true;
      return !reachesOverKnownGround(builderIds!, x, y, width, height, knowledge);
    },
    describePlacementBlockers(x, y, width, height, builderIds): KnowledgeBlockReport | null {
      const owner = knowingOwner(builderIds);
      if (owner === null) return truth.describePlacementBlockers(x, y, width, height, builderIds);
      const knowledge = knowledgeOf(owner);
      const report = occupancy.describePlacementBlockers(x, y, width, height, knowledge.view);
      let inMapCells = 0;
      for (let cellY = y; cellY < y + height; cellY += 1) {
        for (let cellX = x; cellX < x + width; cellX += 1) if (inMap(cellX, cellY)) inMapCells += 1;
      }
      if (countKnown(x, y, width, height, knowledge) === 0) {
        // The map edge, or the player's own foundation, is still the reason
        // given where there is one; otherwise the ground is simply unknown.
        return report ?? {
          firstBlockedCell: { x, y },
          cause: 'unexplored ground',
          blockedCellCount: 0,
          totalCellCount: width * height,
          unexploredCellCount: inMapCells,
          unexplored: true,
        };
      }
      if (report) return report;
      if (reachesOverKnownGround(builderIds!, x, y, width, height, knowledge)) return null;
      return {
        firstBlockedCell: { x, y },
        cause: 'no walkable route to it',
        blockedCellCount: 0,
        totalCellCount: width * height,
        unexploredCellCount: inMapCells - countKnown(x, y, width, height, knowledge),
        unreachableForBuilders: true,
      };
    },
    findOpenPlacementAnchors(centerX, centerY, width, height, opts) {
      const owner = knowingOwner(opts.builderIds);
      if (owner === null) return truth.findOpenPlacementAnchors(centerX, centerY, width, height, opts);
      // The occupancy scan offers only anchors the caller's sight covers, so
      // their footprints are explored; the route to them must be too.
      const knowledge = knowledgeOf(owner);
      const candidates = occupancy.findOpenPlacementAnchors(centerX, centerY, width, height, {
        ...opts,
        max: Math.max(opts.max * 8, 64),
      });
      const out: Position[] = [];
      for (const anchor of candidates) {
        if (out.length >= opts.max) break;
        if (!reachesOverKnownGround(opts.builderIds!, anchor.x, anchor.y, width, height, knowledge)) continue;
        out.push(anchor);
      }
      return out;
    },
  };
}
