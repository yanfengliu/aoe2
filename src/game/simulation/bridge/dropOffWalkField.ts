// The drop-off walk field: for one owner, one resource kind and one movement
// domain, the true 4-connected walk distance from every cell of the map to the
// nearest cell beside one of that owner's drop-offs for the kind.
//
// Why it exists (register entry 2026-09-01). The gather comparator ranked
// candidate resources by MANHATTAN distance while movement is strictly
// 4-connected (`findGridPath` is called with no `allowDiagonal`). On open
// ground the two agree exactly; around obstacles Manhattan is arbitrarily
// wrong, and a forest is a dense block of impassable cells — so wood villagers
// were sent to trees at Manhattan 8-9 whose real walk was 35-45 cells while
// trees at walk 0-3 sat unused. Seventeen attempts at re-weighting the
// comparator failed because every one re-weighted a broken measurement. The
// ablation in `docs/threads/current/lumber-camp-routing/2026-09-01/REVIEW.md`
// shows the metric fix dominates the anchor fix and is never worse.
//
// Why a field rather than a path per candidate. Pathfinding every candidate on
// every assignment is what made the naive fix unshippable. One multi-source
// breadth-first search from every drop-off's approach ring costs one visit per
// map cell and answers EVERY candidate with four array reads, and it answers
// "unreachable" (Infinity) for free — the thing the per-call
// `MAX_REACHABILITY_PROBES` budget exists to approximate.
//
// Invalidation. A cached field is replayed only for the same world, the same
// `structuralRevision` (the fourth consumer of that counter; see
// `docs/architecture/decisions.md`) and the same SET of drop-offs — a camp
// completing turns a claimed foundation into a drop-off without moving the
// revision, so the set is part of the key. Units never block passability, so
// nothing else the search reads can change between bumps.

import type { Position } from 'civ-engine';
import type { EconomyResourceKind, UnitComponent } from '../types';
import { unitDomain } from '../unitDomain';
import type { GameWorld } from './pureHelpers';

/** A complete drop-off building: where it stands and how much ground it covers. */
export interface DropOffSource {
  id: number;
  position: Position;
  footprint: { width: number; height: number };
}

/** The walk down the field from the cell a unit stands on: where it ends (a
 *  cell beside the drop-off), the first step, and which drop-off that is. */
export interface DropOffDescent {
  destination: Position;
  nextStep: Position;
  dropOffId: number;
}

export interface DropOffWalkField {
  /** The shortest walk, in cells, from a cell beside `position` to a cell
   *  beside the nearest drop-off — the haul a gatherer working that node pays
   *  on every load. Infinity when no drop-off can be reached from there. */
  haulDistance(position: Position): number;
  /** The drop-off that shortest walk ends at; null when there is none. */
  nearestDropOffId(position: Position): number | null;
  /** The delivery walk from `cell` itself, for a unit standing on it: the
   *  gradient of the field, which is the true shortest route to the
   *  walk-nearest ring cell of the walk-nearest drop-off. Null when the cell
   *  is off the field (blocked, or no drop-off can be reached from it). A
   *  unit already beside a drop-off gets its own cell back as both. */
  descendFrom(cell: Position): DropOffDescent | null;
}

export interface DropOffWalkFieldDeps {
  mapWidth: number;
  mapHeight: number;
  isCellPassableForUnit: (
    unitId: number,
    x: number,
    y: number,
    activeWorld: GameWorld,
  ) => boolean;
  structuralRevision: () => number;
  /** The owner's complete drop-offs for the kind, already narrowed to the
   *  safe ones when any exist (the same preference the nearest-drop-off
   *  lookup applies). */
  listDropOffBuildings: (
    activeWorld: GameWorld,
    owner: number,
    kind: EconomyResourceKind,
  ) => readonly DropOffSource[];
}

export interface DropOffWalkFieldStats {
  /** Fields built by a breadth-first search. */
  computed: number;
  /** Asks answered by a field already built. */
  served: number;
  /** Wall time spent building fields, so the cost is a number and not a
   *  belief: `scripts/aiGatherWalk.mjs` reports it beside ticks per second. */
  computeMs: number;
}

export interface DropOffWalkFields {
  /** The field for `owner`'s `kind`, walked as `probeUnitId` walks (its owner
   *  decides which gates admit it, its type decides land or water). Null when
   *  the owner has no complete drop-off for the kind. */
  fieldFor(
    activeWorld: GameWorld,
    owner: number,
    kind: EconomyResourceKind,
    probeUnitId: number,
  ): DropOffWalkField | null;
  readonly stats: DropOffWalkFieldStats;
}

const UNREACHABLE = -1;
const NO_SOURCE = -1;
/** Passability memo states, per cell. */
const UNKNOWN = 0;
const PASSABLE = 1;
const BLOCKED = 2;

interface FieldEntry {
  world: GameWorld;
  revision: number;
  sourcesKey: string;
  field: DropOffWalkField;
}

interface PassabilityMemo {
  world: GameWorld;
  revision: number;
  cells: Uint8Array;
}

/** The cells a unit stands on to touch a footprint: the orthogonal ring at
 *  distance one, corners excluded — exactly `getApproachCellsForFootprint`
 *  at range 1, which is what the drop-off approach plan searches. */
function forEachRingCell(
  source: DropOffSource,
  visit: (x: number, y: number) => void,
): void {
  const { x: anchorX, y: anchorY } = source.position;
  const { width, height } = source.footprint;
  for (let x = anchorX; x < anchorX + width; x += 1) {
    visit(x, anchorY - 1);
    visit(x, anchorY + height);
  }
  for (let y = anchorY; y < anchorY + height; y += 1) {
    visit(anchorX - 1, y);
    visit(anchorX + width, y);
  }
}

export function createDropOffWalkFields(deps: DropOffWalkFieldDeps): DropOffWalkFields {
  const { mapWidth, mapHeight, isCellPassableForUnit, structuralRevision } = deps;
  const size = Math.max(0, mapWidth * mapHeight);
  const entries = new Map<string, FieldEntry>();
  // One passability memo per owner and domain, shared by every kind's field:
  // the predicate is the expensive half of the search and it does not depend
  // on the kind.
  const passability = new Map<string, PassabilityMemo>();
  const stats: DropOffWalkFieldStats = { computed: 0, served: 0, computeMs: 0 };

  function passabilityMemo(key: string, activeWorld: GameWorld, revision: number): Uint8Array {
    const existing = passability.get(key);
    if (existing && existing.world === activeWorld && existing.revision === revision) {
      return existing.cells;
    }
    const cells = new Uint8Array(size);
    passability.set(key, { world: activeWorld, revision, cells });
    return cells;
  }

  function compute(
    activeWorld: GameWorld,
    probeUnitId: number,
    sources: readonly DropOffSource[],
    memo: Uint8Array,
  ): DropOffWalkField {
    const distance = new Int32Array(size).fill(UNREACHABLE);
    const nearest = new Int32Array(size).fill(NO_SOURCE);
    const queue = new Int32Array(size);
    let head = 0;
    let tail = 0;

    const passable = (index: number, x: number, y: number): boolean => {
      const known = memo[index];
      if (known !== UNKNOWN) return known === PASSABLE;
      const answer = isCellPassableForUnit(probeUnitId, x, y, activeWorld);
      memo[index] = answer ? PASSABLE : BLOCKED;
      return answer;
    };
    const inBounds = (x: number, y: number): boolean =>
      x >= 0 && x < mapWidth && y >= 0 && y < mapHeight;

    sources.forEach((source, sourceIndex) => {
      forEachRingCell(source, (x, y) => {
        if (!inBounds(x, y)) return;
        const index = y * mapWidth + x;
        if (distance[index] !== UNREACHABLE || !passable(index, x, y)) return;
        distance[index] = 0;
        nearest[index] = sourceIndex;
        queue[tail] = index;
        tail += 1;
      });
    });

    const visit = (x: number, y: number, fromIndex: number): void => {
      if (!inBounds(x, y)) return;
      const index = y * mapWidth + x;
      if (distance[index] !== UNREACHABLE || !passable(index, x, y)) return;
      distance[index] = distance[fromIndex] + 1;
      nearest[index] = nearest[fromIndex];
      queue[tail] = index;
      tail += 1;
    };
    while (head < tail) {
      const index = queue[head];
      head += 1;
      const x = index % mapWidth;
      const y = (index - x) / mapWidth;
      visit(x - 1, y, index);
      visit(x + 1, y, index);
      visit(x, y - 1, index);
      visit(x, y + 1, index);
    }

    // A gatherer stands on one of the four cells beside its node, so the
    // node's haul is the best of those four. The node's own cell is never
    // read: a tree, bush or mine blocks it, and a farm — walkable ground since
    // farms became 'farm' claims (passableStructures.ts), so the search above
    // flows THROUGH a block of farms and an inner farm has a finite haul — is
    // still worked from beside it; the farmer's stance is approachOrdering's
    // question, not this field's.
    const bestNeighbourIndex = (position: Position): number => {
      let best = NO_SOURCE;
      let bestDistance = Number.POSITIVE_INFINITY;
      const consider = (x: number, y: number): void => {
        if (!inBounds(x, y)) return;
        const index = y * mapWidth + x;
        const d = distance[index];
        if (d !== UNREACHABLE && d < bestDistance) {
          bestDistance = d;
          best = index;
        }
      };
      consider(position.x - 1, position.y);
      consider(position.x + 1, position.y);
      consider(position.x, position.y - 1);
      consider(position.x, position.y + 1);
      return best;
    };

    // One step down the gradient: a neighbour one closer to the ring. The
    // breadth-first search guarantees one exists for every reached cell that
    // is not a ring cell, and the fixed W, E, N, S order keeps the route a
    // pure function of the field, so two units on one cell walk the same way
    // rather than through each other.
    const stepDown = (index: number): number => {
      const x = index % mapWidth;
      const y = (index - x) / mapWidth;
      const want = distance[index] - 1;
      const candidates: Array<[number, number]> = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of candidates) {
        if (!inBounds(nx, ny)) continue;
        const next = ny * mapWidth + nx;
        if (distance[next] === want) return next;
      }
      return NO_SOURCE;
    };

    return {
      haulDistance(position) {
        const index = bestNeighbourIndex(position);
        return index === NO_SOURCE ? Number.POSITIVE_INFINITY : distance[index];
      },
      nearestDropOffId(position) {
        const index = bestNeighbourIndex(position);
        if (index === NO_SOURCE) return null;
        return sources[nearest[index]]?.id ?? null;
      },
      descendFrom(cell) {
        if (!inBounds(cell.x, cell.y)) return null;
        const start = cell.y * mapWidth + cell.x;
        if (distance[start] === UNREACHABLE) return null;
        let current = start;
        let first = start;
        while (distance[current] > 0) {
          const next = stepDown(current);
          if (next === NO_SOURCE) return null;
          if (current === start) first = next;
          current = next;
        }
        const dropOff = sources[nearest[current]];
        if (!dropOff) return null;
        return {
          destination: { x: current % mapWidth, y: (current - (current % mapWidth)) / mapWidth },
          nextStep: { x: first % mapWidth, y: (first - (first % mapWidth)) / mapWidth },
          dropOffId: dropOff.id,
        };
      },
    };
  }

  return {
    fieldFor(activeWorld, owner, kind, probeUnitId) {
      const sources = deps.listDropOffBuildings(activeWorld, owner, kind);
      if (sources.length === 0) return null;
      const unit = activeWorld.getComponent<UnitComponent>(probeUnitId, 'unit');
      const domain = unit ? unitDomain(unit.unitType) : 'land';
      const revision = structuralRevision();
      const sourcesKey = sources.map((source) => source.id).sort((a, b) => a - b).join(',');
      const key = `${String(owner)}:${domain}:${kind}`;
      const cached = entries.get(key);
      if (
        cached
        && cached.world === activeWorld
        && cached.revision === revision
        && cached.sourcesKey === sourcesKey
      ) {
        stats.served += 1;
        return cached.field;
      }
      const memo = passabilityMemo(`${String(owner)}:${domain}`, activeWorld, revision);
      const startedAt = performance.now();
      const field = compute(activeWorld, probeUnitId, sources, memo);
      stats.computeMs += performance.now() - startedAt;
      entries.set(key, { world: activeWorld, revision, sourcesKey, field });
      stats.computed += 1;
      return field;
    },
    stats,
  };
}
