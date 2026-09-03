import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  SNAP_DISTANCE_TILES,
  createDisplayedPositionSmoother,
  type DisplayedPositionSmoother,
} from '../../src/rendering/displayedPositionSmoother';
import {
  UNIT_TILES_PER_TICK,
  displayDelayTicksFor,
  maxTilesPerTickFor,
} from '../../src/rendering/unitStepCadence';

// The DISCONTINUITY half of the smoother's contract, split from
// `displayedPositionSmoother.test.ts` at the 500-LOC cap by ROLE: that file
// asks "does the picture MOVE", this one asks "when does it stop replaying
// history and start over". The rule both files are written against, and the
// one v0.3.192 changed: a discontinuity is a jump in SPACE, not in time. A
// forward tick gap glides, because its two ends were both observed; a move
// longer than that gap could have carried THAT ENTITY snaps, and so do a
// rewind, a bridge swap, a recycled id, a type change and a fresh sighting.

const FRAMES_PER_TICK = 10;

function entity(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 7,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 0,
    y: 5,
    tint: 0xffffff,
    size: 0.72,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory: false,
    ...overrides,
  };
}

/** Sim x for a villager whose fine steps land at the ticks in `stepTicks`. */
function stepwise(stepTicks: readonly number[]): (tick: number) => number {
  return (tick) => 0.25 * stepTicks.filter((stepTick) => stepTick <= tick).length;
}

/** Drives the smoother at 10 render frames per sim tick. */
function drive(
  smoother: DisplayedPositionSmoother,
  simXAt: (tick: number) => number,
  ticks: number,
  firstTick = 0,
): void {
  for (let tick = firstTick; tick < firstTick + ticks; tick += 1) {
    for (let frame = 0; frame < FRAMES_PER_TICK; frame += 1) {
      smoother.apply([entity({ x: simXAt(tick) })], tick, frame / FRAMES_PER_TICK);
    }
  }
}

describe('displayed position smoother — discontinuities', () => {
  it('snaps a jump past the snap distance within the same frame', () => {
    const smoother = createDisplayedPositionSmoother();
    drive(smoother, stepwise([3, 6, 9]), 12);
    const teleported = entity({ x: 0.75 + 5 });
    const [shown] = smoother.apply([teleported], 12, 0.5);
    expect(shown!.x).toBe(teleported.x);
    expect(shown).toBe(teleported);
    // A jump just inside what a tick could carry this UNIT still glides.
    const nudged = entity({ x: teleported.x + UNIT_TILES_PER_TICK - 0.01 });
    const [gliding] = smoother.apply([nudged], 13, 0.5);
    expect(gliding!.x).toBeGreaterThan(teleported.x);
    expect(gliding!.x).toBeLessThan(nudged.x);
  });
  it('glides a deer\'s diagonal flee hop (1.41 tiles) and snaps a move over 1.5 tiles: both sides of the line', () => {
    const deer = (x: number, y: number) => entity({
      id: 21, kind: 'resource', layer: 'resource', entityType: 'deer', x, y, currentHp: null, maxHp: null,
    });
    const smoother = createDisplayedPositionSmoother();
    for (let tick = 0; tick < 14; tick += 1) smoother.apply([deer(10, 10)], tick, 0);
    // The longest step the sim ever takes in one tick: one cell on both axes.
    const hopped = deer(11, 11);
    expect(Math.hypot(1, 1)).toBeLessThan(SNAP_DISTANCE_TILES);
    const [midHop] = smoother.apply([hopped], 14, 0.5);
    expect(midHop!.x).toBeGreaterThan(10);
    expect(midHop!.x).toBeLessThan(11);
    expect(midHop!.y).toBeGreaterThan(10);
    expect(midHop!.y).toBeLessThan(11);
    // Anything longer is not a step the sim makes; it is drawn where it landed.
    const relocated = deer(11 + 1.5, 11 + 0.01);
    expect(Math.hypot(1.5, 0.01)).toBeGreaterThan(SNAP_DISTANCE_TILES);
    const [afterSnap] = smoother.apply([relocated], 15, 0.5);
    expect(afterSnap).toBe(relocated);
  });
  it('still snaps a coalesced gap whose travel passed what the gap could carry', () => {
    // The distance guard is the whole of the discontinuity rule now, so it
    // has to carry the case the tick-gap rule used to: a gap big enough to
    // hold a teleport (or a fast-forward) is caught by how far the entity
    // moved AGAINST HOW LONG THE GAP WAS — no entity moves more than one
    // whole diagonal cell per tick, so three ticks may carry 4.5 tiles.
    // `drive(..., 10)` presents ticks 0..9, so a sync at tick 13 is a gap of
    // FOUR ticks and may carry 6.0 tiles.
    const gapTicks = 4;
    const smoother = createDisplayedPositionSmoother();
    drive(smoother, stepwise([3, 6, 9]), 10);
    const teleported = entity({ x: 0.75 + UNIT_TILES_PER_TICK * gapTicks + 0.01 });
    const [snapped] = smoother.apply([teleported], 13, 0.5);
    expect(snapped).toBe(teleported);
    // ...and a move the same gap COULD have carried is drawn as the move it is.
    const smoother2 = createDisplayedPositionSmoother();
    drive(smoother2, stepwise([3, 6, 9]), 10);
    const travelled = entity({ x: 0.75 + UNIT_TILES_PER_TICK * gapTicks - 0.01 });
    const [glided] = smoother2.apply([travelled], 13, 0.5);
    expect(glided).not.toBe(travelled);
    expect(glided!.x).toBeLessThan(travelled.x);
  });
  it('leaves rest at the observed interval\'s own speed when that frame coalesced ticks', () => {
    // The departure re-timing claims the unit left rest `delay` ticks ago, so
    // that motion is drawn the tick the first step lands. Across a gap LONGER
    // than the delay that claim is false: the entity was observed standing at
    // the last presented tick, and every tick of travel since then belongs to
    // the gap. Timing the departure at `tick - delay` there would compress the
    // whole gap into `delay` ticks of drawing — a wolf crossing three cells in
    // a three-tick frame drawn back at its start and then made to cross all
    // three inside one tick. The segment starts at the last SIGHTING instead.
    // A whole-cell-per-tick mover (delay 1) is where the two claims disagree
    // most: seen at tick 0, three cells on at tick 3. `tick - delay` is 2, the
    // last sighting is 0, and the EARLIER of the two wins — so the departure
    // segment is the observed [0, 3] and the drawn root is already two thirds
    // along rather than back at the start about to sprint.
    const wolf = (x: number) => entity({
      id: 33, kind: 'resource', layer: 'resource', entityType: 'wolf', x, y: 5, currentHp: null, maxHp: null,
    });
    const charging = createDisplayedPositionSmoother();
    charging.apply([wolf(10)], 0, 0);
    const [midCharge] = charging.apply([wolf(13)], 3, 0);
    expect(midCharge!.x).toBeCloseTo(12, 9);

    // A unit whose delay is LONGER than the gap keeps the cadence claim,
    // because that is the earlier of the two: tick 3, delay 4, so the segment
    // is [-1, 3] and the drawn root starts the walk now and takes four ticks
    // over three ticks of travel — the delay paid at departure, gently, never
    // the gap's travel compressed into it.
    const smoother = createDisplayedPositionSmoother();
    smoother.apply([entity({ x: 0 })], 0, 0);
    const [start] = smoother.apply([entity({ x: 0.75 })], 3, 0);
    expect(start!.x).toBe(0);
    const [midway] = smoother.apply([entity({ x: 0.75 })], 5, 0.5);
    expect(midway!.x).toBeCloseTo(0.75 * 2.5 / 4, 9);
    // A genuine rest still departs at cadence speed: standing for twenty
    // ticks and then stepping is drawn from `tick - delay`, not from tick 20.
    const resting = createDisplayedPositionSmoother();
    for (let tick = 0; tick <= 20; tick += 1) resting.apply([entity({ x: 0 })], tick, 0);
    const [justLeft] = resting.apply([entity({ x: 0.25 })], 21, 0);
    expect(justLeft!.x).toBe(0);
    const [oneTickIn] = resting.apply([entity({ x: 0.25 })], 22, 0);
    expect(oneTickIn!.x).toBeCloseTo(0.0625, 9);
  });
  it('gives a unit half the allowance a whole-cell mover gets, because it provably cannot use more', () => {
    // A single per-tick allowance cannot serve both. `moveCarryCapHundredths`
    // bounds every unit at TWO fine steps a tick — half a tile, swept over
    // every unit type and every movement technology, worst case the Demolition
    // Ship — while `wildlifeCombatSystem` moves a charging wolf a whole
    // diagonal cell every tick. A bound loose enough for the wolf lets a
    // villager slide across a garrison-and-eject that completed inside one
    // coalesced frame; the eject below is 2.5 tiles over two ticks, which two
    // ticks of a UNIT cannot be and two ticks of a wolf easily could.
    expect(maxTilesPerTickFor(entity())).toBe(UNIT_TILES_PER_TICK);
    expect(maxTilesPerTickFor(entity({ kind: 'resource', entityType: 'wolf' }))).toBe(SNAP_DISTANCE_TILES);
    // The list is the whole correctness of the ceiling, so it is asserted
    // rather than trusted. A carried RELIC is a whole-cell mover because
    // `monkBehaviorSystem` puts it on the monk's integer cell; a SHEEP is not
    // — it takes one quarter-tile subgrid step every sixth tick, and giving
    // it the wildlife allowance would sextuple its teleport tolerance for
    // nothing.
    for (const wholeCell of ['deer', 'boar', 'wolf', 'relic'] as const) {
      expect(maxTilesPerTickFor({ kind: 'resource', entityType: wholeCell })).toBe(SNAP_DISTANCE_TILES);
    }
    expect(maxTilesPerTickFor({ kind: 'resource', entityType: 'sheep' })).toBe(UNIT_TILES_PER_TICK);
    expect(UNIT_TILES_PER_TICK * 2).toBeLessThan(2.5);
    expect(SNAP_DISTANCE_TILES * 2).toBeGreaterThan(2.5);

    const smoother = createDisplayedPositionSmoother();
    smoother.apply([entity({ x: 0 })], 0, 0);
    smoother.apply([entity({ x: 0.25 })], 1, 0);
    const ejected = entity({ x: 2.75 });
    const [shown] = smoother.apply([ejected], 3, 0);
    expect(shown).toBe(ejected);
  });
  it('draws a charging wolf running when a frame coalesces its whole-cell steps', () => {
    // `wildlifeCombatSystem` moves a charging boar or wolf a WHOLE CELL every
    // tick along its range plan — 1.41 tiles diagonally, the fastest thing in
    // the game — so a two-tick frame moves one 2.83 tiles. A flat 1.5-tile
    // guard called that a teleport and snapped it: measured on the real bridge
    // with `wolf-aggro-fixture`, the drawn root covered 2.0616 tiles in one
    // frame at 150 ms and 3.1623 at 200 ms. The guard is per TICK of the gap
    // for exactly this mover.
    const wolf = (x: number, y: number) => entity({
      id: 33, kind: 'resource', layer: 'resource', entityType: 'wolf', x, y, currentHp: null, maxHp: null,
    });
    const smoother = createDisplayedPositionSmoother();
    expect(displayDelayTicksFor(wolf(0, 0))).toBe(1);
    smoother.apply([wolf(10, 10)], 0, 0);
    // Two ticks in one frame, one diagonal cell each: 2.83 tiles of ordinary
    // charging, which must glide rather than snap.
    const charged = wolf(12, 12);
    const [drawn] = smoother.apply([charged], 2, 0);
    expect(drawn).not.toBe(charged);
    expect(drawn!.x).toBeLessThan(12);
    const [next] = smoother.apply([wolf(13, 13)], 3, 0);
    expect(next!.x).toBeGreaterThan(drawn!.x);
    expect(next!.x).toBeLessThan(13);
    // Past what the gap could carry (tick 3 to 5 is two ticks, 3.0 tiles), it
    // is a teleport again.
    const port = wolf(13 + SNAP_DISTANCE_TILES * 2 + 0.01, 13);
    const [snapped] = smoother.apply([port], 5, 0);
    expect(snapped).toBe(port);
  });
  it('starts a fresh track when the unit type changes under the same id (a line upgrade)', () => {
    const smoother = createDisplayedPositionSmoother();
    drive(smoother, stepwise([3, 6, 9]), 10);
    const upgraded = entity({ entityType: 'man-at-arms', x: 0.75 });
    const [shown] = smoother.apply([upgraded], 10, 0.5);
    expect(shown).toBe(upgraded);
  });
  it('snaps on a rewind (replay scrub) and on a reset (bridge swap) instead of gliding across unrelated state', () => {
    const smoother = createDisplayedPositionSmoother();
    drive(smoother, stepwise([3, 6, 9]), 12);
    const rewound = entity({ x: 0.25 });
    const [afterRewind] = smoother.apply([rewound], 4, 0.2);
    expect(afterRewind).toBe(rewound);

    drive(smoother, stepwise([6, 9, 12]), 10, 4);
    smoother.reset();
    const swapped = entity({ x: 0 });
    const [afterReset] = smoother.apply([swapped], 0, 0);
    expect(afterReset).toBe(swapped);
  });
  it('does not slide a unit from a position it held while out of sight', () => {
    // Seen at tick 0-2, PRESENTED as absent at tick 3 (fogged, garrisoned),
    // back at tick 4 one tile over: that is a fresh sighting, drawn where the
    // sim says. The rule is "absent from the previously PRESENTED tick", and
    // since v0.3.192 that is strictly weaker than "absent the tick before":
    // an entity that left and returned entirely inside ONE coalesced frame
    // was never presented as absent and glides instead. The smoother cannot
    // see that — at frame granularity the history does not exist — and the
    // exposure is bounded by the distance guard. Named in the module header,
    // not covered here, and this test deliberately presents the empty frame.
    const smoother = createDisplayedPositionSmoother();
    for (let tick = 0; tick < 3; tick += 1) smoother.apply([entity({ x: 0 })], tick, 0.5);
    smoother.apply([], 3, 0.5);
    const returned = entity({ x: 1 });
    const [shown] = smoother.apply([returned], 4, 0.5);
    expect(shown).toBe(returned);
  });
  it('does not treat a recycled id as the destroyed unit it replaced', () => {
    const smoother = createDisplayedPositionSmoother();
    for (let tick = 0; tick < 3; tick += 1) smoother.apply([entity({ generation: 1, x: 0 })], tick, 0.5);
    const recycled = entity({ generation: 2, x: 1 });
    const [shown] = smoother.apply([recycled], 3, 0.5);
    expect(shown).toBe(recycled);
  });
  it('seeds a fresh cancellation-tick checkpoint from the attack source, like the tick lerp did', () => {
    const smoother = createDisplayedPositionSmoother();
    const cancelled = entity({
      x: 0.25,
      attackAnimation: {
        tick: 4,
        cancelTick: 5,
        sourceX: 0,
        sourceY: 5,
        targetX: 1,
        targetY: 5,
      },
    });
    const [atZero] = smoother.apply([cancelled], 5, 0);
    expect(atZero!.x).toBe(0);
    const [midway] = smoother.apply([cancelled], 5, 0.5);
    expect(midway!.x).toBeGreaterThan(0);
    expect(midway!.x).toBeLessThan(0.25);
  });
});
