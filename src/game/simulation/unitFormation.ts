// M6 control: formations (spec §9.5).
//
// A formation decides WHERE a group stands when it arrives, and in what order.
// Without one, `allocateGroupMoveTargets` fills a deterministic spiral outward
// from the click, which packs everything into a blob: the archers end up in
// front as often as behind, and one mangonel shot catches the lot.
//
// This module is pure. It produces an ORDERED list of candidate cells; the
// allocator still decides what is actually reachable and free, so a formation
// never places a unit somewhere it cannot stand — a shape pressed against a
// cliff degrades to the spiral fallback rather than stacking units on rock.

import { isMonasticUnit } from './monasticUnits';
import type { Position } from 'civ-engine';

import { isMeleeUnit, unitAttackRange } from './prototypeUnitRules';
import type { UnitType } from './unitTypes';

export const UNIT_FORMATIONS = ['line', 'staggered', 'box', 'flank'] as const;
export type UnitFormation = (typeof UNIT_FORMATIONS)[number];

/** AoE2's own default. Every other formation is opt-in, so nothing is stored. */
export const DEFAULT_FORMATION: UnitFormation = 'line';

export function isUnitFormation(value: string): value is UnitFormation {
  return (UNIT_FORMATIONS as readonly string[]).includes(value);
}

/**
 * Where a unit belongs front-to-back. Lower ranks stand nearer the enemy.
 *
 * The ordering is the whole reason a formation is worth having: melee in
 * front absorbing hits, shooters behind them with a clear line, and the things
 * that die instantly and cost the most — siege, monks, villagers — at the back.
 */
export function formationRank(unitType: UnitType): number {
  if (unitType === 'villager') return 3;
  if (isMonasticUnit(unitType)) return 3;
  const range = unitAttackRange(unitType);
  if (range >= 5) return 2; // siege and the long-range lines stay well back
  if (isMeleeUnit(unitType)) return 0;
  return 1;
}

/** Unit ids sorted into their formation order. Stable within a rank. */
export function orderForFormation<T>(
  units: readonly T[],
  unitTypeOf: (unit: T) => UnitType,
): T[] {
  return units
    .map((unit, index) => ({ unit, index, rank: formationRank(unitTypeOf(unit)) }))
    .sort((left, right) => (left.rank - right.rank) || (left.index - right.index))
    .map((entry) => entry.unit);
}

interface Axis {
  /** Unit vector along the formation's width. */
  readonly across: Position;
  /** Unit vector pointing BACK from the enemy — ranks grow this way. */
  readonly back: Position;
}

/**
 * The formation's axes, from the direction the group is travelling.
 *
 * A line has to be perpendicular to the march or it is a column. With no
 * meaningful heading (a group already standing on the target) the axes fall
 * back to screen-aligned, which is at least stable rather than arbitrary.
 */
export function formationAxis(from: Position, to: Position): Axis {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const step = dx === 0 ? 1 : Math.sign(dx);
    return { across: { x: 0, y: 1 }, back: { x: -step, y: 0 } };
  }
  const step = Math.sign(dy);
  return { across: { x: 1, y: 0 }, back: { x: 0, y: -step } };
}

function cell(center: Position, axis: Axis, across: number, back: number): Position {
  return {
    x: center.x + axis.across.x * across + axis.back.x * back,
    y: center.y + axis.across.y * across + axis.back.y * back,
  };
}

/** Widths chosen so a group reads as its shape rather than as a blob. */
function rowWidth(formation: UnitFormation, count: number): number {
  if (formation === 'box') return Math.max(1, Math.ceil(Math.sqrt(count)));
  if (formation === 'flank') return Math.max(2, Math.ceil(count / 2));
  return Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * 3))));
}

/**
 * Ordered candidate cells for `count` units in this formation.
 *
 * The caller walks the list in order and takes the first cell each unit can
 * actually stand in, so a returned cell is a PREFERENCE, never a placement.
 */
export function formationCells(
  formation: UnitFormation,
  center: Position,
  count: number,
  axis: Axis,
): Position[] {
  const cells: Position[] = [];
  const width = rowWidth(formation, count);

  if (formation === 'flank') {
    // Two wings with a hole in the middle: the group parts around whatever it
    // is walking into instead of feeding into it one unit at a time.
    const perWing = Math.ceil(count / 2);
    const gap = 2;
    for (let index = 0; index < perWing; index += 1) {
      const across = gap + Math.floor(index / 2);
      const back = index % 2;
      cells.push(cell(center, axis, across, back));
      cells.push(cell(center, axis, -across, back));
    }
    return cells.slice(0, Math.max(count, cells.length));
  }

  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / width);
    const column = index % width;
    // Centre each row on the target rather than starting at one end, so the
    // click lands in the middle of the formation and not on its flank.
    const across = column - Math.floor(width / 2);
    if (formation === 'staggered') {
      // Alternate rows shift half a cell and rows sit two apart: the point is
      // that one blast cannot cover the whole block.
      cells.push(cell(center, axis, across * 2 + (row % 2), row * 2));
    } else {
      cells.push(cell(center, axis, across, row));
    }
  }
  return cells;
}
