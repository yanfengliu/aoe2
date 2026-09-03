// The wildlife movement clocks, in their own module because two layers read
// them: the sim systems run the throttles, and the renderer's display delay
// (`rendering/unitStepCadence`) trails a drawn animal by exactly one of its
// steps so it walks instead of pulsing between them. `pureHelpers` sits at
// the 500-line cap and cannot host them.
//
// §12.4.2 clock (v0.3.160): the herd contract is HALF villager speed. A
// villager earns 0.32 fine units/tick, so a sheep's contract is 0.16; 1 step
// per 6 ticks lands on 0.1667 — 4% hot, the closest a whole-step throttle
// gets (1/7 = 0.143 is 11% slow) — one whole subgrid step every 6th tick via
// the same tick-modulo throttle the wander path uses (a fractional carry has
// no meaning for the replanned-per-tick herd step either).
export const SHEEP_SUBGRID_STEP_PER_TICK = 1;
export const SHEEP_STEP_TICK_INTERVAL = 6;

// units.csv:42 gives the Deer a speed of 0.737 tiles/s. At TPS 10 that is one
// whole cell every 13.6 ticks; 14 lands on 0.714 tiles/s, 3% slow, and inside
// the ±5% band the economy rates are held to. Whole cells rather than subgrid
// steps because every other wildlife mover in the bridge works in whole cells.
export const DEER_STEP_TICK_INTERVAL = 14;
