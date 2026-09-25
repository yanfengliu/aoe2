import type { Position } from 'civ-engine';

import { unitBlastRadius } from '../prototypeUnitRules';
import type { UnitType } from '../types';

// Where the blast census's fixtures (./blastCensus.ts) put everything, kept
// apart from the fixture factory so a browser spec can read the layout without
// importing the scenario registry.
//
// Owner 1's attacker stands at ATTACKER. Owner 2 has three places the attack
// can land, far enough apart that no blast reaches from one to another: a unit
// (UNIT_TARGET), a building (BUILDING_TARGET) and an empty cell
// (GROUND_TARGET). Around each impact point stand two witnesses of owner 2: one
// on the farthest cell still inside the attacker's blast radius, and one on the
// nearest cell outside it.

export const BLAST_CENSUS_ATTACKER: Position = { x: 30, y: 18 };
export const BLAST_CENSUS_UNIT_TARGET: Position = { x: 36, y: 18 };
/** A building's position is its anchor, the top-left cell of its footprint,
 *  which runs east and south from there. An attack on a building is centred on
 *  that anchor here (spec §10.7 records DE's difference). */
export const BLAST_CENSUS_BUILDING_TARGET: Position = { x: 21, y: 18 };
export const BLAST_CENSUS_GROUND_TARGET: Position = { x: 30, y: 12 };

export type BlastCensusImpact = 'unit' | 'building' | 'ground';

/** Which way the witnesses stand from each impact point: away from the
 *  attacker, and for the building to the north-west, off its footprint. */
const WITNESS_SIDE: Record<BlastCensusImpact, { x: number; y: number }> = {
  unit: { x: 1, y: -1 },
  building: { x: -1, y: -1 },
  ground: { x: -1, y: -1 },
};

export function blastCensusSeed(unitType: UnitType): string {
  return `blast-census-${unitType}-fixture`;
}

export function blastCensusImpactCell(impact: BlastCensusImpact): Position {
  if (impact === 'unit') return BLAST_CENSUS_UNIT_TARGET;
  if (impact === 'building') return BLAST_CENSUS_BUILDING_TARGET;
  return BLAST_CENSUS_GROUND_TARGET;
}

/**
 * The offset from an impact point to the cell a witness stands on, before
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

/** Where the census places the witness inside (or outside) the attacker's
 *  blast around one impact point. */
export function blastCensusWitnessCell(
  unitType: UnitType,
  impact: BlastCensusImpact,
  inside: boolean,
): Position {
  const offset = blastCensusWitnessOffset(unitBlastRadius(unitType), inside);
  const side = WITNESS_SIDE[impact];
  const at = blastCensusImpactCell(impact);
  return { x: at.x + side.x * offset.x, y: at.y + side.y * offset.y };
}
