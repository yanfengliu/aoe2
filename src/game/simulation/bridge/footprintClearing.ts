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
// Here each one prefers the nearest open cell outside the footprint, by its
// own passability, in the tick the building starts, and keeps whatever it was
// doing; DE walks it off. "Nearest" is counted in 4-connected steps from where
// it stands, across the footprint, with east, west, south, north as the
// tie-break, so the answer is the same in every replay. It is all or none: if
// one of them has no open cell to go to, nobody is moved and the start waits.
// Planned destinations reserve their occupancy before the next search: an
// animal needs its own cell, while units may share the available subcell
// slots. Otherwise a later animal could claim the earlier unit's destination
// as a resource and strand it on blocked ground (integration review IR1).
// If that greedy plan fails, reserve exclusive animal exits first and reassign
// unit slots as needed; a unit must not take the only exit a later occupant
// can use while another legal complete plan exists (integration review IR3).
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

  /** Exit cells in nearest-first order, reached across the footprint. */
  function exitsFrom(start: Position, area: FootprintArea): Position[] {
    const exits: Position[] = [];
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
        else exits.push({ x, y });
      }
    }
    return exits;
  }

  /** Only used when nearest-first reservations fail. Animals need an empty
   *  land cell; every land unit admits those cells too, plus its own gates.
   *  Units then use an augmenting path over the remaining subcell capacity. */
  function reassignMoves(ids: readonly number[], area: FootprintArea): Array<{ id: number; to: Position }> | null {
    const candidates = new Map<number, Position[]>();
    const units: number[] = [];
    const animals: number[] = [];
    const destinations = new Map<number, Position>();
    const animalCells = new Set<number>();
    const reservations = new Map<number, number[]>();
    const keyOf = (cell: Position): number => cell.y * mapWidth + cell.x;
    for (const id of ids) {
      const from = world.getComponent<Position>(id, 'position');
      if (!from) continue;
      const unit = world.getComponent<UnitComponent>(id, 'unit') !== undefined;
      (unit ? units : animals).push(id);
      candidates.set(id, exitsFrom(from, area).filter(({ x, y }) => unit
        ? deps.isCellPassableForUnit(id, x, y)
        : deps.getCellStatus(x, y).crowdedBy.length === 0 && deps.isCellPassableForWildlife(id, x, y)));
    }
    for (const id of animals) {
      const to = candidates.get(id)!.find((cell) => !animalCells.has(keyOf(cell)));
      if (!to) return null;
      animalCells.add(keyOf(to));
      destinations.set(id, to);
    }
    function assignUnit(id: number, seen: Set<number>): boolean {
      for (const to of candidates.get(id)!) {
        const key = keyOf(to);
        if (animalCells.has(key) || seen.has(key)) continue;
        seen.add(key);
        const sharing = reservations.get(key) ?? [];
        const capacity = deps.getCellStatus(to.x, to.y).freeSubcellSlots ?? 1;
        if (sharing.length >= capacity && !sharing.some((other) => assignUnit(other, seen))) continue;
        const previous = destinations.get(id);
        if (previous) {
          const old = reservations.get(keyOf(previous))!;
          old.splice(old.indexOf(id), 1);
        }
        sharing.push(id);
        reservations.set(key, sharing);
        destinations.set(id, to);
        return true;
      }
      return false;
    }
    for (const id of units) if (!assignUnit(id, new Set())) return null;
    return [...destinations].map(([id, to]) => ({ id, to }));
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
      const reserved = new Map<number, { units: number; animal: boolean }>();
      for (const id of ids) {
        const from = world.getComponent<Position>(id, 'position');
        if (!from) continue;
        const isUnit = world.getComponent<UnitComponent>(id, 'unit') !== undefined;
        const to = exitsFrom(from, area).find(({ x, y }) => {
          const planned = reserved.get(y * mapWidth + x);
          if (planned?.animal) return false;
          const status = deps.getCellStatus(x, y);
          if (isUnit) {
            return deps.isCellPassableForUnit(id, x, y)
              && (status.freeSubcellSlots ?? 1) > (planned?.units ?? 0);
          }
          return (planned?.units ?? 0) === 0 && status.crowdedBy.length === 0
            && deps.isCellPassableForWildlife(id, x, y);
        });
        if (to === undefined) {
          const reassigned = reassignMoves(ids, area);
          if (reassigned === null) return false;
          moves.splice(0, moves.length, ...reassigned);
          break;
        }
        const cell = to.y * mapWidth + to.x;
        const planned = reserved.get(cell) ?? { units: 0, animal: false };
        if (isUnit) planned.units += 1;
        else planned.animal = true;
        reserved.set(cell, planned);
        moves.push({ id, to });
      }
      for (const { id, to } of moves) deps.relocate(id, to);
      return true;
    },
  };
}
