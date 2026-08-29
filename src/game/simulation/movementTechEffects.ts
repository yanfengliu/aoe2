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

import { isMonasticUnit } from './monasticUnits';
import { civSpeedMultiplier } from './civBonusEffects';
import type { ResearchableTechnologyType, UnitType } from './types';
import { DRY_DOCK_SPEED_PERCENT, dryDockSpeedsUp } from './dockTechEffects';
import { isInfantryUnit, isMountedUnit } from './prototypeUnitRules';
import { unitBaseSpeedPercent } from './prototypeUnitRules/unitBaseSpeed';
import { unitEffectsOf } from './uniqueTechnologies';

// The unique technologies that carry a speed multiplier. Naming them keeps
// this loop off the whole table on every movement step.
const SPEED_UNIQUE_TECHNOLOGIES: readonly ResearchableTechnologyType[] = [
  'drill',
  'mahouts',
];

// AoE2 Husbandry (technologies.csv:79): mounted units move 10% faster.
// technologies.csv row 64: Monks have +15% speed.
export const FERVOR_SPEED_PERCENT = 115;
export const HUSBANDRY_SPEED_PERCENT = 110;
// Caravan (Market, Castle): Trade Carts move 50% faster — technologies.csv.
export const CARAVAN_SPEED_PERCENT = 150;

// AoE2 Squires (technologies.csv:12): infantry move 10% faster.
export const SQUIRES_SPEED_PERCENT = 110;

// AoE2 Wheelbarrow / Hand Cart (technologies.csv:89/90 — "Movement rate * 1.1
// and carrying capacity * 1.25/1.5"): each raises villager movement speed by
// 10% (the movement HALF of the carry-capacity techs, whose carry half already
// shipped). Unlike Husbandry/Squires these two apply to the SAME class
// (villagers) and STACK, so they multiply: 100 → 110 (Wheelbarrow) → 121 (both).
export const WHEELBARROW_SPEED_PERCENT = 110;
export const HAND_CART_SPEED_PERCENT = 110;

// Bound on the banked entitlement so a long-clamped unit cannot burst-move
// later; consumption is further clamped to the current waypoint leg anyway.
//
// PROPORTIONAL to the per-tick entitlement (v0.3.160), floored at one fine
// step plus a tick: at §12.4.2 rates the bank IS the walk (a villager needs
// four 32-hundredth ticks to afford one step), so the cap must always admit
// one full step's accumulation — but no more than that plus 1.5 ticks, where
// the old absolute 300 had become 9.4 villager-ticks and a long-blocked unit
// burst-moved 3 fine units (0.75 tiles) in a single tick when freed.
export const MOVE_CARRY_CAP_TICKS = 1.5;
export function moveCarryCapHundredths(perTickHundredths: number): number {
  return Math.max(
    100 + perTickHundredths,
    Math.round(perTickHundredths * MOVE_CARRY_CAP_TICKS),
  );
}

// Whole-percent speed multiplier for a unit derived from the owner's researched
// set: Husbandry → mounted units, Squires → infantry, Wheelbarrow/Hand Cart →
// villagers. The three unit classes are disjoint, so a unit matches at most one
// branch. Within a class the modifiers STACK multiplicatively (the villager
// branch below — Wheelbarrow × Hand Cart = 121); across the single-tech classes
// a flat return is correct because each has one applicable tech. 100 = no
// modifier (the executor's byte-identical fast path) — which after the
// per-unit base-speed table means a VILLAGER with no techs, and nothing else.
export function movementSpeedPercent(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  unitType: UnitType,
  civilization?: string,
  /** v0.3.152: the Berber villager bonus is +5% in the Dark Age, +10% after. */
  age?: import('./types').AgeType,
): number {
  // The unit's own rate is the STARTING point, not a special case: a Mangonel
  // is slow whether or not anyone researched anything, and Husbandry makes a
  // knight 10% faster than a KNIGHT rather than 10% faster than a villager.
  let percent = unitBaseSpeedPercent(unitType);
  // Civilization speed bonuses (Celts infantry, Berbers villagers and ships,
  // Ethiopians archers) multiply first, so the tech ladder stacks on top of a
  // civ's own rate exactly as it stacks on a unit's own rate.
  let civMultiplier = civSpeedMultiplier(civilization, unitType);
  if (civilization === 'Berbers' && unitType === 'villager' && age === 'dark-age') {
    civMultiplier = 1.05; // DE: +5% Dark, +10% from Feudal.
  }
  if (civMultiplier !== 1) {
    percent = Math.round(percent * civMultiplier);
  }
  // Civilization unique technologies that move a unit faster (Drill, Mahouts)
  // multiply the base like any other modifier. They are read from the researched
  // set alone rather than from the owner's civilization, because a technology
  // can only BE in that set if its civilization researched it.
  for (const technology of SPEED_UNIQUE_TECHNOLOGIES) {
    if (!researchedTechnologies.has(technology)) continue;
    for (const effect of unitEffectsOf(technology)) {
      if (effect.speedMultiplier !== undefined && effect.applies(unitType)) {
        percent = Math.round(percent * effect.speedMultiplier);
      }
    }
  }
  // Fervor (Monastery, Castle): monks move faster. It stands apart from the
  // branches below because a monk is neither mounted, infantry, nor a villager,
  // so none of them would ever reach it.
  if (isMonasticUnit(unitType) && researchedTechnologies.has('fervor')) {
    percent = Math.round((percent * FERVOR_SPEED_PERCENT) / 100);
  }
  // Dry Dock (Dock, Imperial): every SHIP moves 15% faster. It sits with the
  // class branches below rather than in them, because a ship is none of
  // mounted, infantry or villager and would never reach any of them.
  if (dryDockSpeedsUp(researchedTechnologies, unitType)) {
    percent = Math.round((percent * DRY_DOCK_SPEED_PERCENT) / 100);
  }
  // Caravan reaches exactly the trade line, which no class branch covers.
  if ((unitType === 'trade-cart' || unitType === 'trade-cog') && researchedTechnologies.has('caravan')) {
    percent = Math.round((percent * CARAVAN_SPEED_PERCENT) / 100);
  }
  if (researchedTechnologies.has('husbandry') && isMountedUnit(unitType)) {
    percent = Math.round((percent * HUSBANDRY_SPEED_PERCENT) / 100);
  } else if (researchedTechnologies.has('squires') && isInfantryUnit(unitType)) {
    percent = Math.round((percent * SQUIRES_SPEED_PERCENT) / 100);
  } else if (unitType === 'villager') {
    if (researchedTechnologies.has('wheelbarrow')) {
      percent = Math.round((percent * WHEELBARROW_SPEED_PERCENT) / 100);
    }
    if (researchedTechnologies.has('hand-cart')) {
      percent = Math.round((percent * HAND_CART_SPEED_PERCENT) / 100);
    }
  }
  return percent;
}

// Phase 1 (entitle): add this tick's earned distance (base × percent, in
// hundredths of a fine unit) to the banked carry and grant the whole fine
// units. base 0.32 at 110% earns 35/tick — grants land every third tick, and every
// 5th unobstructed tick the bank crosses 100 and grants 3.
export function movementEntitlement(
  carryHundredths: number,
  baseStepUnits: number,
  speedPercent: number,
): { grantedSteps: number; entitledHundredths: number } {
  // Rounded so the bank stays integral: 0.32 x 112 = 35.84 float becomes 36
  // hundredths/tick deterministically, instead of drifting float dust into
  // the carry (0.45% on the worst percent, far under a fine unit per walk —
  // and a deliberate, spec-noted bias: 112% plays as 112.5%, 110% as 109.4%).
  const entitledHundredths = carryHundredths + Math.round(baseStepUnits * speedPercent);
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
  perTickHundredths: number,
): number {
  const remaining = entitledHundredths - movedSteps * 100;
  return Math.min(Math.max(remaining, 0), moveCarryCapHundredths(perTickHundredths));
}
