// Who stands on a foundation when its first builder starts it, and moving them
// off (work 126; spec §8.1).
//
// Units and animals walk over a foundation nobody has started (update 185872;
// an animal as a unit does, review round 0), so some may stand on it when the
// first builder arrives. Definitive Edition moves its owner's units and
// animals off: the AoE wiki's "Building (Age of Empires II)"
// (sentence added 2024-01-16) has "If there are Gaia animals or units of the
// player present at the location of a building foundation, they will move away
// automatically once the Villager reach the foundation", and update 87863 made
// allies' units do the same ("Own/ally units ... don't obstruct building
// foundations anymore"). An enemy's unit is not moved; the start waits for it
// (foundationStart.ts), unless it stands beside a site of its own seat's,
// building it; that one is moved like the owner's units.
//
// Here each one is put on the nearest open cell outside the footprint, by its
// own passability, in the tick the building starts, and keeps whatever it was
// doing; DE walks it off. "Nearest" is counted in 4-connected steps from where
// it stands, across the footprint, with east, west, south, north as the
// tie-break, so the answer is the same in every replay. It is all or none: if
// one of them has no open cell to go to, nobody is moved and the start waits.
//
// An animal here is a living one: a sheep or a deer, or a boar or wolf still
// alive. A carcass, like a tree or a mine, is a lifeless resource, which
// cancels the start instead (foundationStart.ts). An animal carries its owner,
// if it has one: an enemy's sheep is an enemy's, and holds the start as its
// units do.

import type { OccupancyCellStatus, Position } from 'civ-engine';

import type { ResourceComponent, UnitComponent } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { wildlifeStatesCodec } from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

export interface FootprintArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FootprintClearingDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  mapWidth: number;
  mapHeight: number;
  getCellStatus(x: number, y: number): OccupancyCellStatus;
  isCellPassableForUnit(unitId: number, x: number, y: number): boolean;
  isCellPassableForWildlife(entityId: number, x: number, y: number): boolean;
  /** Puts an entity on a cell: its position, its occupancy claim and, where it
   *  has one, its drawn place in the cell. */
  relocate(entityId: number, cell: Position): void;
}

export interface FootprintOccupants {
  /** Every unit standing on the footprint, with its owner. */
  units: Array<{ id: number; owner: number }>;
  /** Every living animal standing on it, with its owner, null for Gaia's. */
  animals: Array<{ id: number; owner: number | null }>;
}

export interface FootprintClearing {
  occupantsOf(area: FootprintArea): FootprintOccupants;
  /** Puts each of `ids` on the nearest open cell outside `area`. All or none:
   *  false, and nobody moved, when one of them has nowhere to go. */
  moveOff(ids: readonly number[], area: FootprintArea): boolean;
}

/** The resource types that are animals, living or a carcass. */
export const ANIMAL_RESOURCES: ReadonlySet<ResourceComponent['resourceType']> = new Set(['sheep', 'deer', 'boar', 'wolf']);
/** East, west, south, north: the tie-break between equally near cells. */
const STEPS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const inside = (area: FootprintArea, x: number, y: number): boolean => (
  x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height
);

export function createFootprintClearing(deps: FootprintClearingDeps): FootprintClearing {
  const { world, accessor, mapWidth, mapHeight } = deps;

  /** A sheep or a deer, or a boar or wolf that is still alive. */
  function isLivingAnimal(entityId: number): boolean {
    const resource = world.getComponent<ResourceComponent>(entityId, 'resource');
    if (!resource || !ANIMAL_RESOURCES.has(resource.resourceType)) return false;
    return accessor.get(wildlifeStatesCodec).get(entityId)?.isAlive ?? true;
  }

  /** The nearest cell outside `area` that `passable` admits, reached from
   *  `start` across the footprint; null when there is none. */
  function exitFor(start: Position, area: FootprintArea, passable: (x: number, y: number) => boolean): Position | null {
    const seen = new Set<number>([start.y * mapWidth + start.x]);
    const queue: Position[] = [start];
    for (let head = 0; head < queue.length; head += 1) {
      const cell = queue[head]!;
      for (const [dx, dy] of STEPS) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) continue;
        const index = y * mapWidth + x;
        if (seen.has(index)) continue;
        seen.add(index);
        if (inside(area, x, y)) queue.push({ x, y });
        else if (passable(x, y)) return { x, y };
      }
    }
    return null;
  }

  return {
    occupantsOf(area) {
      const units: Array<{ id: number; owner: number }> = [];
      const animals: Array<{ id: number; owner: number | null }> = [];
      const counted = new Set<number>();
      for (let y = area.y; y < area.y + area.height; y += 1) {
        for (let x = area.x; x < area.x + area.width; x += 1) {
          const status = deps.getCellStatus(x, y);
          for (const claim of [...status.crowdedBy, ...status.blockedBy]) {
            const id = claim.entity;
            if (id === null || counted.has(id)) continue;
            if (claim.kind === 'unit') {
              const unit = world.getComponent<UnitComponent>(id, 'unit');
              if (!unit) continue;
              counted.add(id);
              units.push({ id, owner: unit.owner });
            } else if (claim.kind === 'resource' && isLivingAnimal(id)) {
              counted.add(id);
              animals.push({ id, owner: world.getComponent<ResourceComponent>(id, 'resource')?.owner ?? null });
            }
          }
        }
      }
      return { units, animals };
    },

    moveOff(ids, area) {
      const moves: Array<{ id: number; to: Position }> = [];
      for (const id of ids) {
        const from = world.getComponent<Position>(id, 'position');
        if (!from) continue;
        const isUnit = world.getComponent<UnitComponent>(id, 'unit') !== undefined;
        const to = exitFor(from, area, isUnit
          ? (x, y) => deps.isCellPassableForUnit(id, x, y)
          : (x, y) => deps.isCellPassableForWildlife(id, x, y));
        if (to === null) return false;
        moves.push({ id, to });
      }
      for (const { id, to } of moves) deps.relocate(id, to);
      return true;
    },
  };
}
