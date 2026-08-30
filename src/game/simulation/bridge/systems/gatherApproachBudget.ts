// How long a villager may spend walking to a CONTESTED resource before it
// gives up and fans out to an uncontended one.
//
// This was a flat 80 ticks, written when a unit moved 2 fine units per tick —
// 0.5 tiles/tick, so 80 ticks bought roughly 40 tiles of walking and only a
// villager genuinely stuck behind others ever reached it. The §12.4.2 movement
// clock (v0.3.160) walks a villager at 0.08 tiles/tick, which turned the same
// 80 ticks into 6.4 tiles and made villagers abandon ordinary walks.
//
// It is expressed in TILES and converted, so it tracks the movement clock
// instead of silently changing meaning the next time that clock moves — which
// is the whole failure this file exists to prevent.
//
// It is deliberately FLAT rather than a function of the distance to the
// target. A first attempt (v0.3.163) recomputed the budget from the villager's
// CURRENT distance every tick, and review measured that this inverts the rule:
// the budget shrinks as the villager closes while its timer keeps running, so
// it fires at ~56% of any walk and, for anything under 11.5 tiles, gives LESS
// reach than the flat 80 it replaced — 3.9 tiles into a 7-tile walk against
// the old 6.4. A per-tick distance also mismeasured the walk (movement steps
// one axis per tick, so travel is MANHATTAN, while the budget used Euclidean
// hypot — insufficient beyond ~18° off-axis), collapsed to the floor for a
// villager standing on the destination cell, and could exceed the 600-tick
// unreachable backstop past 38 tiles, inverting that documented ordering.
// A flat budget has none of those failure modes.

import { UNIT_SUBGRID_RESOLUTION, UNIT_SUBGRID_STEP_PER_TICK } from '../pureHelpers';

/** Ticks a villager needs to cover one tile at the base walk speed. */
export const TICKS_PER_TILE = UNIT_SUBGRID_RESOLUTION / UNIT_SUBGRID_STEP_PER_TICK;

// 32 tiles of walking. Close to the ~40 the original constant bought, and
// chosen over the alternatives by measuring all three corpus seeds: it is the
// only setting with no frozen player on any of them AND no regression on
// `default-seed`, where both the distance-based formula (15,800) and an
// unbounded budget (15,500) pushed owner 1 out from 12,200.
const APPROACH_TILES = 32;

/**
 * The tick budget for walking to a contested resource. Long enough that an
 * ordinary walk finishes — the villager is meant to hit this only when it is
 * queued behind others — and comfortably under `GATHER_UNREACHABLE_TIMEOUT_TICKS`
 * (600), so a genuinely unreachable target still falls to that backstop rather
 * than being churned by the fan-out.
 */
export const GATHER_APPROACH_BUDGET_TICKS = Math.round(APPROACH_TILES * TICKS_PER_TILE);
