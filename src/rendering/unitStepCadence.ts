// How often the simulation moves a unit, as the renderer needs to know it.
//
// At the §12.4.2 clock a unit earns `round(0.32 × speedPercent)` hundredths
// of a fine step per tick and moves one whole fine step (a quarter tile) each
// time its bank crosses 100 — a villager on ticks 4, 7, 10, 13, ..., a scout
// every second or third tick, a Battering Ram every fifth. Between those
// ticks the sim position does not change at all. Two presentation concerns
// hang off that cadence: the locomotion window that decides whether a unit
// is walking (aoeVoxelUnitAnimation), and the display delay that lets the
// drawn root replay the sim's trajectory without ever running out of it
// (displayedPositionSmoother). Both read the BASE rate: movement
// technologies only shorten the cadence, so the base is the upper bound.

import { UNIT_SUBGRID_STEP_PER_TICK } from '../game/simulation/bridge/pureHelpers';
import {
  DEER_STEP_TICK_INTERVAL,
  SHEEP_STEP_TICK_INTERVAL,
} from '../game/simulation/bridge/wildlifeCadence';
import { unitBaseSpeedPercent } from '../game/simulation/prototypeUnitRules/unitBaseSpeed';
import type { ProjectedEntityView, UnitType } from '../game/simulation/types';

/** The longest gap, in ticks, between two consecutive fine steps of a unit
 *  walking unobstructed at its base rate: `ceil(100 / hundredthsPerTick)`.
 *  An entity type without a base rate (wildlife) reads as a villager. */
export function unitStepCadenceTicks(entityType: ProjectedEntityView['entityType']): number {
  const percent = unitBaseSpeedPercent(entityType as UnitType) ?? 100;
  const hundredthsPerTick = Math.max(1, Math.round(UNIT_SUBGRID_STEP_PER_TICK * percent));
  return Math.ceil(100 / hundredthsPerTick);
}

/** Ticks the drawn root of this entity trails the simulation by — its step
 *  cadence, so the delayed trajectory always has a known far end. Wildlife
 *  moves on tick-modulo throttles rather than the carry, each its own clock:
 *  a sheep steps a quarter tile every sixth tick (herdableMovementSystem); a
 *  fleeing deer hops a whole cell every fourteenth (deerFleeSystem), and a
 *  fourteen-tick delay draws that hop as a 1.4 s glide at its 0.71 tiles/s
 *  instead of a cell crossed in one tick (measured on `deer-flight-fixture`:
 *  the frames inside a hop drew the deer standing 91.1% of the time at a
 *  one-tick delay, 0% at fourteen); charging
 *  wildlife (boar, wolf — wildlifeCombatSystem) moves a whole cell EVERY tick
 *  along its range plan, so one tick is already its cadence. A resource that
 *  never moves never gets a track. */
export function displayDelayTicksFor(
  entity: Pick<ProjectedEntityView, 'kind' | 'entityType'>,
): number {
  if (entity.kind === 'resource') {
    if (entity.entityType === 'sheep') return SHEEP_STEP_TICK_INTERVAL;
    if (entity.entityType === 'deer') return DEER_STEP_TICK_INTERVAL;
    return 1;
  }
  return unitStepCadenceTicks(entity.entityType);
}
