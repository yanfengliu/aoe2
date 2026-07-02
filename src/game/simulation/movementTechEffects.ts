// Movement-speed tech effects, DERIVED (pure) from an owner's researched-tech
// set at the single step executor (transformOps.moveUnitOneSubgridStep). A
// speed multiplier on the 2-fine-units-per-tick base CANNOT be applied by
// rounding (round(2 × 1.1) = 2 is a silent no-op — the v0.1.26 gather-rate
// lesson), and a stateless tick-derived surge schedule ALSO fails: movement is
// handed out as per-CELL waypoints (plan.nextStep, 4 fine units per leg) and
// stepUnitTransformToward clamps each tick's step to the remaining leg, so a
// 3-step surge landing on a 2-remaining leg was silently cut to 2 and every
// leg cost 2 ticks regardless — the whole +10% was eaten by per-cell
// quantization (measured: 40 = 40 ticks over 20 cells). The fix is the same
// one v0.1.26 shipped for gather rates: a per-unit fractional accumulator that
// CARRIES the unconsumed entitlement across ticks and waypoint clamps —
// `moveCarryHundredths` on UnitTransformComponent (persisted with the entity,
// additive like v0.1.53's pierceArmorBonus, `?? 0` for pre-speed saves). The
// carry is read/written ONLY when a unit's speed percent ≠ 100, so un-teched
// movement stays byte-identical and never materializes the field.

import type { ResearchableTechnologyType, UnitType } from './types';
import { isInfantryUnit, isMountedUnit } from './prototypeUnitRules';

// AoE2 Husbandry (technologies.csv:79): mounted units move 10% faster.
export const HUSBANDRY_SPEED_PERCENT = 110;

// AoE2 Squires (technologies.csv:12): infantry move 10% faster.
export const SQUIRES_SPEED_PERCENT = 110;

// Bound on the banked entitlement so a long-clamped unit cannot burst-move
// later: grant ≤ floor((cap + 220)/100) = 5 fine units, and consumption is
// further clamped to the current waypoint leg anyway. In normal unobstructed
// motion the carry stays < 200.
export const MOVE_CARRY_CAP_HUNDREDTHS = 300;

// Whole-percent speed multiplier for a unit derived from the owner's researched
// set: Husbandry → mounted units, Squires → infantry. The two techs target
// disjoint unit classes (no unit is both mounted and infantry), so at most one
// applies and there is no stacking. Future speed techs that share a class
// (e.g. the Wheelbarrow/Hand Cart villager ×1.1 halves) will need to multiply
// their percents here instead of the flat return. 100 = no modifier (the
// executor's byte-identical fast path).
export function movementSpeedPercent(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  unitType: UnitType,
): number {
  if (researchedTechnologies.has('husbandry') && isMountedUnit(unitType)) {
    return HUSBANDRY_SPEED_PERCENT;
  }
  if (researchedTechnologies.has('squires') && isInfantryUnit(unitType)) {
    return SQUIRES_SPEED_PERCENT;
  }
  return 100;
}

// Phase 1 (entitle): add this tick's earned distance (base × percent, in
// hundredths of a fine unit) to the banked carry and grant the whole fine
// units. base 2 at 110% earns 220/tick — grant 2 with 20 banked, and every
// 5th unobstructed tick the bank crosses 100 and grants 3.
export function movementEntitlement(
  carryHundredths: number,
  baseStepUnits: number,
  speedPercent: number,
): { grantedSteps: number; entitledHundredths: number } {
  const entitledHundredths = carryHundredths + baseStepUnits * speedPercent;
  return {
    grantedSteps: Math.floor(entitledHundredths / 100),
    entitledHundredths,
  };
}

// Phase 2 (settle): subtract what the move ACTUALLY consumed (waypoint /
// map-bound clamps can consume fewer fine units than granted — the shortfall
// stays banked so no entitlement is ever lost to a clamp), then cap the bank.
export function settleMovementCarry(
  entitledHundredths: number,
  movedSteps: number,
): number {
  const remaining = entitledHundredths - movedSteps * 100;
  return Math.min(Math.max(remaining, 0), MOVE_CARRY_CAP_HUNDREDTHS);
}
