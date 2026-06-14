// AoE2 economy technology effects, DERIVED (pure) from an owner's researched-
// tech set at gather time — no side-map mutation, because `applyTechnology`
// already records every researched tech in `researchedTechnologiesCodec`. Split
// out of prototypeEconomyRules.ts (500-LOC budget) as the cohesive "tech
// effect" unit: gather-rate (Lumber/Mining Camp) + carry capacity (Town
// Center). All factors stack multiplicatively, matching AoE2.

import type {
  EconomyResourceKind,
  ResearchableTechnologyType,
  ResourceKind,
} from './types';
import {
  gatherAmountFor,
  gatherTicksFor,
  resourceKindToEconomyResource,
} from './prototypeEconomyRules';

// --- Gather-rate techs ("Work Rate ×N") ---
// Food is intentionally absent (Horse Collar is a farm-food tech, deferred
// until farms exist).
const GATHER_RATE_TECH_FACTORS: Partial<
  Record<ResearchableTechnologyType, { resource: EconomyResourceKind; factor: number }>
> = {
  'double-bit-axe': { resource: 'wood', factor: 1.2 },
  'bow-saw': { resource: 'wood', factor: 1.2 },
  'two-man-saw': { resource: 'wood', factor: 1.1 },
  'gold-mining': { resource: 'gold', factor: 1.15 },
  'gold-shaft-mining': { resource: 'gold', factor: 1.15 },
  'stone-mining': { resource: 'stone', factor: 1.15 },
  'stone-shaft-mining': { resource: 'stone', factor: 1.15 },
};

// Product of the factors of every researched gather tech that matches
// `resource`. 1.0 (no speedup) when none are researched.
export function gatherRateMultiplier(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  resource: EconomyResourceKind,
): number {
  let multiplier = 1;
  for (const tech of researchedTechnologies) {
    const effect = GATHER_RATE_TECH_FACTORS[tech];
    if (effect && effect.resource === resource) {
      multiplier *= effect.factor;
    }
  }
  return multiplier;
}

// The owner's gather-rate multiplier for a concrete resource KIND (1.0 for
// non-economy kinds, e.g. relics).
export function gatherRateMultiplierForKind(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  kind: ResourceKind,
): number {
  const resource = resourceKindToEconomyResource(kind);
  return resource === null ? 1 : gatherRateMultiplier(researchedTechnologies, resource);
}

// Ticks to gather a full carry, modelling the villager economy's per-tick rate
// ACCUMULATION: each tick adds the gather-rate multiplier to a progress
// accumulator, and a unit of `amount` is gathered whenever it crosses the base
// per-cycle ticks — carrying the remainder. Carrying the remainder (rather than
// rounding each cycle to an integer cadence) is load-bearing: at AoE2's tiny
// base cadences (tree 5, gold/stone 6) per-cycle rounding collapses stacked
// second-tier techs (Two-Man Saw, Shaft Mining) to no marginal effect and
// overshoots the nominal % on the first tier; rate accumulation over the ~10
// cycles per carry instead tracks the multiplier faithfully. (Multiplying the
// per-cycle AMOUNT is swallowed by the carry cap.) This pure helper is the
// throughput model the gather loop mirrors tick-for-tick.
export function ticksToGatherCarry(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  kind: ResourceKind,
  carryCapacity: number,
): number {
  if (carryCapacity <= 0) {
    return 0;
  }
  const baseTicks = gatherTicksFor(kind);
  const amount = gatherAmountFor(kind);
  const multiplier = gatherRateMultiplierForKind(researchedTechnologies, kind);
  let progress = 0;
  let carried = 0;
  let ticks = 0;
  while (carried < carryCapacity) {
    ticks += 1;
    progress += multiplier;
    if (progress >= baseTicks) {
      progress -= baseTicks;
      carried += amount;
    }
  }
  return ticks;
}

// --- Carry-capacity techs (Town Center) ---
// Wheelbarrow / Hand Cart raise villager carry capacity (their movement-speed
// component is deferred). Carry is resource-agnostic, so this helps food too.
const CARRY_CAPACITY_TECH_FACTORS: Partial<Record<ResearchableTechnologyType, number>> = {
  wheelbarrow: 1.25,
  'hand-cart': 1.5,
};

// Product of the carry factors of every researched carry tech (1.0 if none).
export function carryCapacityMultiplier(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  let multiplier = 1;
  for (const tech of researchedTechnologies) {
    const factor = CARRY_CAPACITY_TECH_FACTORS[tech];
    if (factor !== undefined) {
      multiplier *= factor;
    }
  }
  return multiplier;
}

// A villager's effective carry after its owner's carry techs, rounded to whole
// units. Never below the base (every factor is >= 1).
export function effectiveCarryCapacity(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  baseCarryCapacity: number,
): number {
  return Math.round(baseCarryCapacity * carryCapacityMultiplier(researchedTechnologies));
}
