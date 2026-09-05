// An INDEPENDENT measurement of the haul a gatherer pays: the true
// 4-connected walk from beside a node to beside the nearest drop-off, computed
// from world components alone — terrain kind, building footprints, resource
// cells — with no reference to the simulation's passability predicate or to
// `dropOffWalkField.ts`. A check built from the same symbol as the thing it
// checks proves only that the code agrees with itself, so the gate on the
// gather ranking and `scripts/aiGatherWalk.mjs` both read THIS.
//
// Known difference from the game's own predicate, deliberate: a finished gate
// admits its owner's units in the game and is a wall here. The probe therefore
// over-states a haul that crosses an owner's own gate; it never under-states
// one. Walled starts (Arena, Fortress) keep their woodline inside the wall
// since v0.3.203, so the trees a villager is ranked against sit on the probe's
// side of every gate.

import type { Position } from 'civ-engine';
import type {
  BuildingComponent,
  EconomyResourceKind,
  ResourceComponent,
  TerrainComponent,
} from '../simulation/types';
import { buildingFootprint, type GameWorld } from '../simulation/bridge/pureHelpers';
import { terrainPassableForDomain } from '../simulation/unitDomain';
import { canDropOffAt } from '../simulation/prototypeEconomyRules';

export interface StaticGrid {
  width: number;
  height: number;
  /** 1 where a land unit cannot stand. */
  blocked: Uint8Array;
}

export interface DropOffRing {
  position: Position;
  footprint: { width: number; height: number };
}

export interface HaulProbe {
  /** The walk from the best cell beside `node` to the nearest drop-off ring;
   *  Infinity when no drop-off can be reached from beside it. */
  haulAt(node: Position): number;
}

/** Land passability rebuilt from components: a cell is blocked when its
 *  terrain refuses land units, when a building footprint covers it, or when a
 *  resource stands on it. Cells with no terrain entity are blocked. */
export function staticGridOf(world: GameWorld): StaticGrid {
  const { width, height } = world.grid;
  const blocked = new Uint8Array(width * height).fill(1);
  const inBounds = (x: number, y: number): boolean => x >= 0 && x < width && y >= 0 && y < height;
  for (const id of world.query('position', 'terrain')) {
    const position = world.getComponent<Position>(id, 'position');
    const terrain = world.getComponent<TerrainComponent>(id, 'terrain');
    if (!position || !terrain || !inBounds(position.x, position.y)) continue;
    blocked[position.y * width + position.x] = terrainPassableForDomain(terrain.kind, 'land') ? 0 : 1;
  }
  for (const id of world.query('position', 'building')) {
    const position = world.getComponent<Position>(id, 'position');
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (!position || !building) continue;
    const footprint = buildingFootprint(building.buildingType);
    for (let y = position.y; y < position.y + footprint.height; y += 1) {
      for (let x = position.x; x < position.x + footprint.width; x += 1) {
        if (inBounds(x, y)) blocked[y * width + x] = 1;
      }
    }
  }
  for (const id of world.query('position', 'resource')) {
    const position = world.getComponent<Position>(id, 'position');
    if (!position || !inBounds(position.x, position.y)) continue;
    blocked[position.y * width + position.x] = 1;
  }
  return { width, height, blocked };
}

/** The owner's complete drop-offs for `kind`, from a caller-supplied
 *  completeness test (the economy state carries `isComplete`; a component
 *  walk does not). */
export function dropOffRingsOf(
  world: GameWorld,
  owner: number,
  kind: EconomyResourceKind,
  isComplete: (buildingId: number) => boolean,
): DropOffRing[] {
  const rings: DropOffRing[] = [];
  for (const id of world.query('position', 'building')) {
    const position = world.getComponent<Position>(id, 'position');
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (!position || !building || building.owner !== owner) continue;
    if (!isComplete(id)) continue;
    if (!canDropOffAt(building.buildingType, kind)) continue;
    rings.push({ position, footprint: buildingFootprint(building.buildingType) });
  }
  return rings;
}

/** Multi-source breadth-first search from every ring cell, 4-connected. */
export function haulProbeFor(grid: StaticGrid, rings: readonly DropOffRing[]): HaulProbe {
  const { width, height, blocked } = grid;
  const distance = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const inBounds = (x: number, y: number): boolean => x >= 0 && x < width && y >= 0 && y < height;
  const seed = (x: number, y: number): void => {
    if (!inBounds(x, y)) return;
    const index = y * width + x;
    if (blocked[index] === 1 || distance[index] !== -1) return;
    distance[index] = 0;
    queue[tail] = index;
    tail += 1;
  };
  for (const ring of rings) {
    const { x: ax, y: ay } = ring.position;
    for (let x = ax; x < ax + ring.footprint.width; x += 1) {
      seed(x, ay - 1);
      seed(x, ay + ring.footprint.height);
    }
    for (let y = ay; y < ay + ring.footprint.height; y += 1) {
      seed(ax - 1, y);
      seed(ax + ring.footprint.width, y);
    }
  }
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = (index - x) / width;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const next = ny * width + nx;
      if (blocked[next] === 1 || distance[next] !== -1) continue;
      distance[next] = distance[index] + 1;
      queue[tail] = next;
      tail += 1;
    }
  }
  return {
    haulAt(node) {
      let best = Number.POSITIVE_INFINITY;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const x = node.x + dx;
        const y = node.y + dy;
        if (!inBounds(x, y)) continue;
        const d = distance[y * width + x];
        if (d !== -1 && d < best) best = d;
      }
      return best;
    },
  };
}

/** Manhattan from a node to the nearest cell of the nearest drop-off — the
 *  quantity the comparator used to rank by, kept so a report can show both. */
export function manhattanHaulAt(node: Position, rings: readonly DropOffRing[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const ring of rings) {
    const nearestX = Math.min(Math.max(node.x, ring.position.x), ring.position.x + ring.footprint.width - 1);
    const nearestY = Math.min(Math.max(node.y, ring.position.y), ring.position.y + ring.footprint.height - 1);
    best = Math.min(best, Math.abs(node.x - nearestX) + Math.abs(node.y - nearestY));
  }
  return best;
}

/** Whether a resource is a wood node a villager could be sent to. */
export function isStandingTree(resource: ResourceComponent): boolean {
  return resource.resourceType === 'tree' && resource.amount > 0;
}

/** The comparator's ownership tier: own nodes, then neutral nodes on the
 *  owner's home base, then everything else. Mirrored here rather than
 *  imported so this probe shares no symbol with the ranking under test. */
export function ownershipTier(resource: ResourceComponent, owner: number): number {
  if (resource.owner === owner) return 0;
  if (resource.owner === null && resource.baseOwner === owner) return 1;
  return 2;
}

export interface BestAvailableHauls {
  /** The best haul among standing, unsaturated trees of any tier. */
  anyTier: number;
  /** How far `haul` exceeds the best haul among standing, unsaturated trees
   *  the comparator would rank at least as high as `target` — its own tier or
   *  a better one. Zero when nothing better was available. */
  gapFor(target: ResourceComponent, haul: number): number;
}

/** What the ranking could have chosen instead, per tier, at this moment. A
 *  tree with `spreadCap` or more gatherers already on it is not available. */
export function bestAvailableHauls(
  world: GameWorld,
  probe: HaulProbe,
  owner: number,
  targetCounts: ReadonlyMap<number, number>,
  spreadCap: number,
): BestAvailableHauls {
  const bestByTier = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  for (const id of world.query('position', 'resource')) {
    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    const position = world.getComponent<Position>(id, 'position');
    if (!resource || !position || !isStandingTree(resource)) continue;
    if ((targetCounts.get(id) ?? 0) >= spreadCap) continue;
    const tier = ownershipTier(resource, owner);
    bestByTier[tier] = Math.min(bestByTier[tier], probe.haulAt(position));
  }
  return {
    anyTier: Math.min(...bestByTier),
    gapFor(target, haul) {
      const tier = ownershipTier(target, owner);
      const best = Math.min(...bestByTier.slice(0, tier + 1));
      return Number.isFinite(best) ? Math.max(0, haul - best) : 0;
    },
  };
}
