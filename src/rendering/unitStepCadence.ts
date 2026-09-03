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

/** Whole-cell movers: the sim relocates these a full CELL at a time rather
 *  than a quarter-tile fine step, so one tick of theirs is one diagonal cell.
 *  Enumerated from every `setPositionAndSyncOccupancy` call site rather than
 *  from memory, because the list is the whole correctness of the ceiling
 *  below: a fleeing deer (`deerFleeSystem`), a charging boar or wolf
 *  (`wildlifeCombatSystem`, every tick), and a RELIC being carried by a monk
 *  — `monkBehaviorSystem` puts it on the monk's integer CELL, not the monk's
 *  fine transform, so it moves a whole cell every time the monk crosses a
 *  boundary while the monk beside it glides. A sheep is NOT one: it takes a
 *  single subgrid step (`SHEEP_SUBGRID_STEP_PER_TICK` = one quarter tile)
 *  every sixth tick through `moveUnitOneSubgridStep`, so it belongs with the
 *  units. Its cadence is still its own — that is `displayDelayTicksFor`. */
const WHOLE_CELL_MOVERS = new Set(['deer', 'boar', 'wolf', 'relic']);
/** The furthest one tick of simulation can move a whole-cell mover: a
 *  diagonal cell, plus slack. */
export const WHOLE_CELL_TILES_PER_TICK = 1.5;
/** The furthest one tick can move anything else, and it is PROVABLE rather
 *  than observed. `movementTechEffects.moveCarryCapHundredths(perTick)` is
 *  `max(100 + perTick, round(perTick * 1.5))`, so a tick can grant at most
 *  `floor((cap + perTick) / 100)` fine steps; sweeping every unit type in
 *  `unitBaseSpeed` against every movement-technology multiplier, the worst is
 *  the Demolition Ship at 260% (200% base, Dry Dock and then some) earning 83
 *  hundredths a tick, which grants TWO fine steps — half a tile — and nothing
 *  in the game grants three. The other unit movers are further inside it: a
 *  path corner and an occupancy recentre are one fine step each (0.354
 *  diagonal), the AI scout's wander is `wanderStepUnits = 1` (0.354), and a
 *  blocked unit freed after banking is still the carry cap's two steps. 0.75
 *  is the worst of those with 50% of slack. ONE INVARIANT holds it up and is
 *  named here because nothing else names it: `scoutMovementSystem`'s legacy
 *  branch for a unit with NO `unitTransform` steps a whole cell per tick, and
 *  it is unreachable only because `entityCreateOps` gives every unit a
 *  transform at creation. A unit that could reach that branch would belong
 *  above, not here. */
export const UNIT_TILES_PER_TICK = 0.75;

/** How far this entity's own simulation can move it in ONE tick, which is
 *  what makes a longer move a teleport rather than a step. The renderer's
 *  displayed-position smoother is the only caller: it snaps a sample that is
 *  further from the last one than the gap between them could have carried it,
 *  and a single global bound cannot serve both a villager (half a tile a tick
 *  at its absolute fastest) and a charging wolf (a whole diagonal cell every
 *  tick) — a bound loose enough for the wolf lets a villager slide seven
 *  tiles across a five-tick frame. */
export function maxTilesPerTickFor(
  entity: Pick<ProjectedEntityView, 'kind' | 'entityType'>,
): number {
  return entity.kind === 'resource' && WHOLE_CELL_MOVERS.has(entity.entityType)
    ? WHOLE_CELL_TILES_PER_TICK
    : UNIT_TILES_PER_TICK;
}
