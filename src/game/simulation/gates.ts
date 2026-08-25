// Which buildings are gates, and which wall each belongs to.
//
// A gate is a wall with a door: it blocks an enemy exactly as its wall does,
// and its owner's units walk through it. Everything else a wall does — the
// footprint, the placement rules, the wall technologies that raise hit points —
// applies to a gate unchanged, so this module only answers the two questions
// that are specific to gates and leaves the rest to the wall tables.

import { areAllied } from './alliances';
import type { BuildingType } from './types';

const GATE_WALLS: Partial<Record<BuildingType, BuildingType>> = {
  'palisade-gate': 'palisade-wall',
  'stone-gate': 'stone-wall',
};

const WALL_LINE_BUILDINGS = new Set<BuildingType>([
  'stone-wall', 'palisade-wall', 'stone-gate', 'palisade-gate',
]);

/** Whether this building is part of a wall line — a wall segment or a gate. */
export function isWallLineBuilding(buildingType: BuildingType): boolean {
  return WALL_LINE_BUILDINGS.has(buildingType);
}

/** Whether this building is a gate — a wall its owner can walk through. */
export function isGateBuilding(buildingType: BuildingType): boolean {
  return GATE_WALLS[buildingType] !== undefined;
}

/**
 * The wall a gate sits in, or null for anything that is not a gate. The pair
 * shares stats that scale together (the wall technologies raise both), so the
 * link is declared once here rather than restated in each table.
 */
export function gateWallCounterpart(buildingType: BuildingType): BuildingType | null {
  return GATE_WALLS[buildingType] ?? null;
}

/**
 * Whether a gate lets this player's unit through.
 *
 * The gate's own team — its owner, and (v0.3.106, the DE rule) any ally when a
 * teams map is given, because a shared wall would otherwise lock your ally out
 * of your own base — and only once it is finished: an unbuilt gate is a hole in
 * the wall its builder has not closed yet, not a door, and letting units
 * through a construction site would make a half-built wall line meaningless.
 * Without a teams map the rule is the free-for-all one, exact owner only.
 * Anything that is not a gate admits nobody — a wall is a wall.
 */
export function gateAdmits(
  buildingType: BuildingType,
  gateOwner: number | null,
  isComplete: boolean,
  unitOwner: number | null,
  teams?: ReadonlyMap<number, number>,
): boolean {
  if (!isGateBuilding(buildingType)) return false;
  if (!isComplete) return false;
  if (gateOwner === null || unitOwner === null) return false;
  if (gateOwner === unitOwner) return true;
  return teams !== undefined && areAllied(teams, gateOwner, unitOwner);
}
