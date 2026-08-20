// M6 formations (spec §9.5): turning a selection plus a click into an ordered
// list of units and the cells they should aim for. Extracted from
// ./humanInputOps.ts for the 500-LOC budget; it is the only part of that file
// that reasons about the SHAPE of a group rather than about issuing orders.

import type { Position } from 'civ-engine';

import {
  DEFAULT_FORMATION,
  UNIT_FORMATIONS,
  formationAxis,
  formationCells,
  orderForFormation,
  type UnitFormation,
} from '../unitFormation';
import type { UnitComponent } from '../types';
import type { GameWorld } from './pureHelpers';

export interface FormationPlan {
  /** The selection re-ordered front-to-back. */
  orderedIds: number[];
  /** One preferred cell per unit, in the same order. */
  preferredCells: Position[];
}

export interface FormationPlannerDeps {
  world: GameWorld;
  /** This unit's chosen formation, or undefined for the default. */
  formationOf: (unitId: number) => UnitFormation | undefined;
}

export function createFormationPlanner(deps: FormationPlannerDeps) {
  const { world, formationOf } = deps;

  /** The centroid of these units, or null if none of them have a position. */
  function averagePosition(unitIds: readonly number[]): Position | null {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const id of unitIds) {
      const position = world.getComponent<Position>(id, 'position');
      if (!position) continue;
      sumX += position.x;
      sumY += position.y;
      count += 1;
    }
    if (count === 0) return null;
    return { x: Math.round(sumX / count), y: Math.round(sumY / count) };
  }

  /**
   * The shape a group order should arrive in.
   *
   * Returns the selection RE-ORDERED front-to-back plus one preferred cell per
   * unit in that same order — melee first so it stands in front, then shooters,
   * then the things that die instantly. The order matters as much as the cells:
   * the allocator walks them in sequence, so whoever comes first gets the front
   * rank.
   *
   * The group's formation is the one MOST of it is set to, so a mixed selection
   * still has a single shape rather than fragments of four.
   */
  return function planFormation(
    unitIds: readonly number[],
    targetCenter: Position,
  ): FormationPlan {
    const typed = unitIds
      .map((id) => ({ id, unit: world.getComponent<UnitComponent>(id, 'unit') }))
      .filter((entry): entry is { id: number; unit: UnitComponent } => entry.unit !== undefined);
    if (typed.length === 0) return { orderedIds: [...unitIds], preferredCells: [] };

    const tally = new Map<UnitFormation, number>();
    for (const { id } of typed) {
      const formation = formationOf(id) ?? DEFAULT_FORMATION;
      tally.set(formation, (tally.get(formation) ?? 0) + 1);
    }
    let formation: UnitFormation = DEFAULT_FORMATION;
    let best = 0;
    for (const candidate of UNIT_FORMATIONS) {
      const count = tally.get(candidate) ?? 0;
      if (count > best) { formation = candidate; best = count; }
    }

    const ordered = orderForFormation(typed, (entry) => entry.unit.unitType);
    // Face the way the group is travelling, from where it currently stands.
    const origin = averagePosition(ordered.map((entry) => entry.id));
    const axis = formationAxis(origin ?? targetCenter, targetCenter);
    return {
      orderedIds: ordered.map((entry) => entry.id),
      preferredCells: formationCells(formation, targetCenter, ordered.length, axis),
    };
  };
}
