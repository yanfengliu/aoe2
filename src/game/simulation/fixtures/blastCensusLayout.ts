import type { Position } from 'civ-engine';

import { getBuildingFootprint } from '../../content/buildingFootprints';
import { detonatesOnAttack, unitBlastRadius } from '../prototypeUnitRules';
import type { BuildingType, UnitType } from '../types';
import { isWaterUnit } from '../unitDomain';

// Where the blast census's fixtures (./blastCensus.ts) put everything, kept
// apart from the fixture factory so a browser spec can read the layout without
// importing the scenario registry.
//
// Owner 1's attacker stands at ATTACKER. Owner 2 has the places the attack can
// land, far enough apart that no blast reaches from one to another: a unit
// (UNIT_TARGET), a building (BUILDING_TARGET) and an empty cell
// (GROUND_TARGET). On land there is a fourth, a boar (WILDLIFE_TARGET), which
// belongs to nobody. Around each landing point stand four witnesses: two of
// owner 2, one on the farthest cell still inside the attacker's blast radius
// and one on the nearest cell outside it, and two on the attacker's side,
// inside the radius: one of its own and one of owner 3, its ally.
//
// The landing point is where Definitive Edition's attack lands (spec §10.7).
// A shot lands on the cell it was aimed at, and a shot at a building on the
// centre of its footprint, so the land building is a one-cell Outpost: every
// cell beside a 2x2 or larger building is more than 1.5 from its centre, and a
// mangonel-line blast there reaches nobody a witness could stand for. A
// detonation goes off where the detonating ship stands, on the cell beside its
// target that its approach ends on, and its witnesses stand around that cell.

export const BLAST_CENSUS_ATTACKER: Position = { x: 30, y: 18 };
export const BLAST_CENSUS_UNIT_TARGET: Position = { x: 36, y: 18 };
/** A building's position is its anchor, the top-left cell of its footprint,
 *  which runs east and south from there. */
export const BLAST_CENSUS_BUILDING_TARGET: Position = { x: 21, y: 18 };
export const BLAST_CENSUS_GROUND_TARGET: Position = { x: 30, y: 12 };
/** Land fixtures only: a boar, which never starts a fight, so it stands still
 *  until the attack lands. */
export const BLAST_CENSUS_WILDLIFE_TARGET: Position = { x: 30, y: 24 };
/** Owner 1's ally. Its AI is off, so its witnesses never move. */
export const BLAST_CENSUS_ALLY_OWNER = 3;

export type BlastCensusImpact = 'unit' | 'building' | 'ground' | 'wildlife';
export type BlastCensusFriend = 'own' | 'ally';

/** Which way each witness stands from its landing point. Owner 2's two stand
 *  away from the attacker, and for the building to the north-west, off its
 *  footprint and, at sea, off the Dock's. The friendly two take other sides,
 *  with their offset turned a quarter (blastCensusFriendCell), which keeps them
 *  off owner 2's cells and two rows clear of a detonating ship's approach: a
 *  witness beside that lane turns the ship's path aside, and the ship then
 *  goes off on a cell the layout did not put the witnesses around. */
const WITNESS_SIDE: Record<BlastCensusImpact, Record<'enemy' | BlastCensusFriend, { x: number; y: number }>> = {
  unit: { enemy: { x: 1, y: -1 }, own: { x: 1, y: 1 }, ally: { x: -1, y: -1 } },
  building: { enemy: { x: -1, y: -1 }, own: { x: 1, y: 1 }, ally: { x: 1, y: -1 } },
  ground: { enemy: { x: -1, y: -1 }, own: { x: 1, y: 1 }, ally: { x: 1, y: -1 } },
  wildlife: { enemy: { x: 1, y: 1 }, own: { x: -1, y: 1 }, ally: { x: -1, y: -1 } },
};

export function blastCensusSeed(unitType: UnitType): string {
  return `blast-census-${unitType}-fixture`;
}

/** The orders the census gives this unit. An animal lives on land, so a ship
 *  is not ordered at one. */
export function blastCensusImpacts(unitType: UnitType): BlastCensusImpact[] {
  return isWaterUnit(unitType) ? ['unit', 'building', 'ground'] : ['unit', 'building', 'ground', 'wildlife'];
}

/** The building owner 2 has at BUILDING_TARGET: a one-cell Outpost on land,
 *  and at sea a Dock, which only the demolition line attacks today. */
export function blastCensusBuildingType(unitType: UnitType): BuildingType {
  return isWaterUnit(unitType) ? 'dock' : 'outpost';
}

/** Where the target of each order stands: the cell the order names. */
export function blastCensusImpactCell(impact: BlastCensusImpact): Position {
  if (impact === 'unit') return BLAST_CENSUS_UNIT_TARGET;
  if (impact === 'building') return BLAST_CENSUS_BUILDING_TARGET;
  if (impact === 'wildlife') return BLAST_CENSUS_WILDLIFE_TARGET;
  return BLAST_CENSUS_GROUND_TARGET;
}

/**
 * Where this unit's attack on each target lands, as DE lands it: a shot on the
 * cell it was aimed at, a building's centre for a building, and a detonation on
 * the cell beside its target that the detonating unit comes to from ATTACKER.
 * The census reads the real landing point from the attack itself and names
 * these witnesses when the two part.
 */
export function blastCensusLandingCell(unitType: UnitType, impact: BlastCensusImpact): Position {
  const at = blastCensusImpactCell(impact);
  const footprint = impact === 'building'
    ? getBuildingFootprint(blastCensusBuildingType(unitType))
    : { width: 1, height: 1 };
  if (detonatesOnAttack(unitType)) {
    // The cell the approach search takes the ship to, traced on the live
    // bridge on 2026-09-26: for a unit, the first cell within reach in its own
    // order, the target's north side (it steps up a row and runs east along
    // it); for the Dock, the cell beside its east face, facing ATTACKER.
    if (impact === 'unit') return { x: at.x, y: at.y - 1 };
    if (impact === 'building') return { x: at.x + footprint.width, y: at.y };
    return at;
  }
  const centre = { x: at.x + (footprint.width - 1) / 2, y: at.y + (footprint.height - 1) / 2 };
  if (!Number.isInteger(centre.x) || !Number.isInteger(centre.y)) {
    throw new Error(
      `A ${unitType}'s shot at the census's ${blastCensusBuildingType(unitType)} lands on its centre `
      + `(${centre.x}, ${centre.y}), between cells, so no witness can stand a whole cell from it; give `
      + 'fixtures/blastCensusLayout.ts a building with an odd footprint for this unit.',
    );
  }
  return centre;
}

/**
 * The offset from a landing point to the cell a witness stands on, before
 * WITNESS_SIDE turns it: the farthest whole-cell offset still within `radius`
 * (`inside`), or the nearest one beyond it. Distance is Euclidean, as the
 * blast measures it; a tie goes to the offset with the larger x.
 */
export function blastCensusWitnessOffset(radius: number, inside: boolean): { x: number; y: number } {
  if (!(radius >= 1)) {
    throw new Error(
      `A blast radius of ${radius} reaches no whole cell but the impact's own, so the blast census cannot `
      + 'stand a witness inside it; a sub-cell blast needs a witness sharing the impact cell, which '
      + 'fixtures/blastCensusLayout.ts does not place yet.',
    );
  }
  const reach = Math.ceil(radius) + 1;
  let best: { x: number; y: number; distance: number } | null = null;
  for (let y = 0; y <= reach; y += 1) {
    for (let x = 0; x <= reach; x += 1) {
      const distance = Math.hypot(x, y);
      if (distance === 0 || (inside ? distance > radius : distance <= radius)) continue;
      const better = best === null
        || (inside ? distance > best.distance : distance < best.distance)
        || (distance === best.distance && x > best.x);
      if (better) best = { x, y, distance };
    }
  }
  if (best === null) throw new Error(`No witness cell found for a blast radius of ${radius} (inside: ${inside}).`);
  return { x: best.x, y: best.y };
}

/** A witness cell, refused by name if it falls on the census building, where
 *  no unit can stand. */
function offTheBuilding(unitType: UnitType, impact: BlastCensusImpact, cell: Position): Position {
  if (impact !== 'building') return cell;
  const at = BLAST_CENSUS_BUILDING_TARGET;
  const footprint = getBuildingFootprint(blastCensusBuildingType(unitType));
  if (cell.x >= at.x && cell.x < at.x + footprint.width && cell.y >= at.y && cell.y < at.y + footprint.height) {
    throw new Error(
      `The blast census would stand a witness for the ${unitType} at (${cell.x}, ${cell.y}), on its `
      + `${blastCensusBuildingType(unitType)}'s ${footprint.width}x${footprint.height} footprint at (${at.x}, ${at.y}); `
      + 'give fixtures/blastCensusLayout.ts a building this unit\'s blast reaches past.',
    );
  }
  return cell;
}

/** Where the census places owner 2's witness inside (or outside) the
 *  attacker's blast around one landing point. */
export function blastCensusWitnessCell(
  unitType: UnitType,
  impact: BlastCensusImpact,
  inside: boolean,
): Position {
  const offset = blastCensusWitnessOffset(unitBlastRadius(unitType), inside);
  const side = WITNESS_SIDE[impact].enemy;
  const at = blastCensusLandingCell(unitType, impact);
  return offTheBuilding(unitType, impact, { x: at.x + side.x * offset.x, y: at.y + side.y * offset.y });
}

/** Where the census places the attacker's own witness, or its ally's, inside
 *  the blast around one landing point: as far out as owner 2's inside witness,
 *  with the offset turned a quarter. */
export function blastCensusFriendCell(
  unitType: UnitType,
  impact: BlastCensusImpact,
  friend: BlastCensusFriend,
): Position {
  const offset = blastCensusWitnessOffset(unitBlastRadius(unitType), true);
  const turned = { x: offset.y, y: offset.x };
  const side = WITNESS_SIDE[impact][friend];
  const at = blastCensusLandingCell(unitType, impact);
  return offTheBuilding(unitType, impact, { x: at.x + side.x * turned.x, y: at.y + side.y * turned.y });
}
