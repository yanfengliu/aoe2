// The DISPLAYED position of a moving unit, replayed from the simulation's
// sampled trajectory with a short, per-unit delay.
//
// The defect this cures (owner, 2026-09-01, watching live): "units seem to
// move and briefly stop mid-movement between cells." The sim advances a
// villager one 0.25-tile fine step only on the ticks its carry bank crosses
// 100 hundredths (4, 7, 10, 13, ...), and the renderer blended only between
// the previous tick and the current one — so the drawn root moved for the
// 100 ms of a stepping tick and stood still for the ~200 ms until the next,
// a 3.3 Hz pulse (measured: 67.4% of mid-walk frames drawn with zero travel;
// a fleeing deer, which hops a whole cell every fourteenth tick, 91.1% of
// the frames inside its hops — both 0% with the delays below).
//
// The cure is the classic interpolation buffer: keep each unit's recent
// (tick, position) samples, recorded only when the sim position changes, and
// draw the unit where the samples say it was `delay` ticks ago, linearly
// between the two that bracket that moment. With the delay set to the unit's
// own step cadence (unitStepCadence) the render time always sits inside a
// segment whose far end is already known, so the drawn root never waits for
// a step that has not landed: between two samples it moves at exactly that
// interval's average speed, and the 3-tick/4-tick alternation of an honest
// villager leaves a 4:3 speed ripple where there was a full stop. A unit
// leaving rest has its rest sample re-timed to `delay` ticks before its first
// step, so motion is drawn the moment the sim first moves, at cadence speed,
// and the delay is paid at arrival (the drawn root settles `delay` ticks
// after the sim does) rather than at departure. Nothing here feeds back into
// the simulation; the sim's subgrid, occupancy and determinism are untouched.
//
// The history covers only what the presentation OBSERVED, and every
// discontinuity snaps rather than glides, as the spec's motion-continuity
// contract requires: a sample farther than SNAP_DISTANCE_TILES from the last
// one (garrison, transport unload, teleport), a tick going backwards (replay
// scrub), a bridge swap (reset), a recycled id (keyed by id:generation), a
// unit whose type changed under the same id (a line upgrade, with a different
// base cadence), and an entity absent from the previously PRESENTED tick
// (fog, hidden frame) all start a fresh track drawn at the sim position. That
// last one is the render store's old rule with one word changed and the
// change matters: the store said "visible the tick before", and a
// presentation that coalesces ticks can only say "visible the frame before"
// — see WHAT THIS DOES NOT COVER at the end of this header.
//
// A DISCONTINUITY IS A JUMP IN SPACE, NOT A JUMP IN TIME, and that is the one
// rule this module changed on 2026-09-02 (v0.3.192). A forward tick gap — a
// frame that coalesced two or three ticks, which is every frame on a machine
// drawing slower than 10 fps, five at double speed, or a test-API multi-tick
// advance — used to reset every track. That threw away the history on which
// continuous motion depends, and the machines it fired on were exactly the
// slow ones the smoother exists for: measured on `deer-flight-fixture`, the
// share of frames inside a hop that drew the deer STANDING went 0.0% at a
// 16.7 ms frame, 14.8% at 105 ms, 92.4% at 143 ms and 100% at 200 ms. It also
// invented nothing to remove it: interpolating between the two OBSERVED sim
// positions that bracket a two-tick gap is the same operation, with less
// extrapolation, as interpolating between the two samples fourteen ticks
// apart that a deer's hop already gives. The distance guard is what separates
// ordinary coalescing from a teleport: a move is a teleport when it is longer
// than the gap it crossed could have carried THAT ENTITY
// (`maxTilesPerTickFor` per tick, capped at MAX_COALESCED_TICKS). Both halves
// were wrong in the first cut and both were caught by a critic rather than by
// a test. PER TICK, because `wildlifeCombatSystem` moves a charging boar or
// wolf a whole cell EVERY tick, so a two-tick frame moves one 2.83 tiles and
// a flat 1.5 snapped it — measured on `wolf-aggro-fixture`, 2.0616 tiles of
// drawn travel in one frame at 150 ms and 3.1623 at 200 ms. PER ENTITY,
// because a single allowance loose enough for that wolf gives a VILLAGER
// 3.0 tiles across an ordinary two-tick frame and 7.5 across a five-tick
// one, and a unit provably cannot use them: the carry cap bounds every unit
// in the game at two fine steps a tick, half a tile (see
// UNIT_TILES_PER_TICK). A gap large enough to matter still resolves at the
// sim position on its own: the render time then lands a hair short of the
// newest sample, so the drawn root is within `delay` ticks of travel of the
// sim root, exactly as it is on any ordinary frame.
//
// WHAT THIS DOES NOT COVER, stated rather than implied. The fresh-sighting
// rule is "absent from the previously PRESENTED tick", and a coalesced frame
// makes that coarser than "absent from the previous tick": an entity that
// garrisoned and was ejected, or blinked out of fog and back, entirely
// INSIDE one coalesced frame was never observed absent, so its drawn root
// glides across that instead of snapping. That is why the per-entity ceiling
// is worth the extra function — it is the only thing bounding this case, and
// it bounds it at 1.5 tiles over an ordinary two-tick frame and 3.75 over the
// worst five-tick one for a unit, instead of 3.0 and 7.5. Beyond that the
// smoother cannot do better: at frame granularity the absence was never
// observed, and closing it needs the bridge to report it.

import type { ProjectedEntityView } from '../game/simulation/types';
import { displayDelayTicksFor, maxTilesPerTickFor } from './unitStepCadence';

/** The loosest per-tick allowance any entity gets — a whole diagonal cell,
 *  which is what a fleeing deer's hop and a charging wolf's every step cover.
 *  A UNIT's own allowance is `UNIT_TILES_PER_TICK`, half of it, because a
 *  unit provably cannot exceed two fine steps in a tick; `maxTilesPerTickFor`
 *  picks. Both sides of both lines are pinned by test. */
export const SNAP_DISTANCE_TILES = 1.5;
/** Ticks of gap the allowance above is granted for, and no more. A live
 *  frame cannot cover more: the frame loop bounds visible simulation time at
 *  250 ms, which is 2.5 ticks at normal speed and 5 at double. Past that the
 *  sync is a fast-forward rather than a frame (a test-API `advanceTicks(N)`,
 *  a capture script's staging), and a fast-forward's endpoints are not two
 *  ends of one continuous move. Scaling the allowance at all is what makes
 *  the guard describe the SIMULATION's top speed rather than the frame rate:
 *  a flat 1.5 tiles fires on a charging wolf's ordinary two-tick frame
 *  (2.06 tiles measured at 150 ms, 3.16 at 200 ms), which is the same defect
 *  the tick-gap reset was, wearing the distance guard's clothes. */
export const MAX_COALESCED_TICKS = 5;

// Samples a track can hold beyond the bound it needs. The samples that
// matter are the one just before the render time and every later one; with
// at most one position change per presented tick that is `delay + 1` inside
// the window plus the sample pushed this tick before compaction, `delay + 2`.
// Two more is margin. A villager's ring is 8 long, a sheep's 10, a deer's 18.
const HISTORY_MARGIN = 4;
// id:generation as one number, so a frame allocates no key strings. A
// generation is a per-id recycle counter; 2^20 recycles of one id is far
// beyond any match.
const GENERATION_SPAN = 2 ** 20;

interface Track {
  readonly times: Float64Array;
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  /** Ring index of the oldest sample. */
  head: number;
  count: number;
  lastSeenTick: number;
  readonly delayTicks: number;
  /** The furthest this entity's sim can move it in one tick (unitStepCadence);
   *  a move longer than this times the gap it crossed is a teleport. */
  readonly maxTilesPerTick: number;
  /** The type the delay was derived from; a change under the same id starts
   *  a fresh track. */
  readonly entityType: ProjectedEntityView['entityType'];
}

export interface DisplayedPositionSmoother {
  /** The entities to draw for this frame: live units and moving resources get
   *  their displayed position, everything else is handed back untouched. */
  apply(
    entities: readonly ProjectedEntityView[],
    tick: number,
    interpolationAlpha: number,
  ): ProjectedEntityView[];
  /** Forget every track — a bridge swap or load, where nothing on screen is
   *  related to what was there before. */
  reset(): void;
}

export interface DisplayedPositionSmootherOptions {
  /** Override of the per-entity delay, in ticks; the default is the entity's
   *  step cadence. */
  readonly delayTicksFor?: (entity: ProjectedEntityView) => number;
}

function trackKey(entity: ProjectedEntityView): number {
  return entity.id * GENERATION_SPAN + (entity.generation ?? 0);
}

function slot(track: Track, index: number): number {
  return (track.head + index) % track.times.length;
}

function pushSample(track: Track, time: number, x: number, y: number): void {
  if (track.count === track.times.length) {
    track.head = (track.head + 1) % track.times.length;
    track.count -= 1;
  }
  const at = slot(track, track.count);
  track.times[at] = time;
  track.xs[at] = x;
  track.ys[at] = y;
  track.count += 1;
}

function dropOldest(track: Track): void {
  track.head = (track.head + 1) % track.times.length;
  track.count -= 1;
}

function createTrack(entity: ProjectedEntityView, tick: number, delayTicks: number): Track {
  const capacity = delayTicks + HISTORY_MARGIN;
  const track: Track = {
    times: new Float64Array(capacity),
    xs: new Float64Array(capacity),
    ys: new Float64Array(capacity),
    head: 0,
    count: 0,
    lastSeenTick: tick,
    delayTicks,
    maxTilesPerTick: maxTilesPerTickFor(entity),
    entityType: entity.entityType,
  };
  // A fresh sighting on an attack's cancellation tick is a checkpoint (load,
  // replay scrub) taken as the attacker started moving again: the tick lerp
  // used to blend it from the recorded attack source, and so does this.
  const attack = entity.attackAnimation;
  if (
    attack !== undefined
    && attack.cancelTick === tick
    && (attack.sourceX !== entity.x || attack.sourceY !== entity.y)
    && Math.hypot(entity.x - attack.sourceX, entity.y - attack.sourceY) <= track.maxTilesPerTick
  ) {
    pushSample(track, tick - delayTicks, attack.sourceX, attack.sourceY);
  }
  pushSample(track, tick, entity.x, entity.y);
  return track;
}

function observe(track: Track, entity: ProjectedEntityView, tick: number): void {
  const last = slot(track, track.count - 1);
  if (track.xs[last] === entity.x && track.ys[last] === entity.y) return;
  const jump = Math.hypot(entity.x - track.xs[last]!, entity.y - track.ys[last]!);
  // Ticks of simulation this move could have taken: the gap since this
  // entity was last OBSERVED (`lastSeenTick` is still the previous
  // observation here — `displayedEntity` stamps it after this call), capped
  // at what one frame can coalesce. `track.times[last]` is not usable for
  // this: the leaving-rest rule below re-times it to `tick - delayTicks`,
  // which is a render time and not an observation.
  const gapTicks = Math.max(1, Math.min(tick - track.lastSeenTick, MAX_COALESCED_TICKS));
  if (jump > track.maxTilesPerTick * gapTicks) {
    track.head = 0;
    track.count = 0;
    pushSample(track, tick, entity.x, entity.y);
    return;
  }
  if (track.times[last] === tick) {
    // The sim moved this entity again within the tick already sampled (an
    // out-of-band change the render state flushed mid-tick): the tick's
    // sample is corrected rather than doubled, so no zero-length segment
    // enters the history.
    track.xs[last] = entity.x;
    track.ys[last] = entity.y;
    return;
  }
  if (track.count === 1) {
    // Leaving rest: the rest sample is re-timed so the departure segment runs
    // at cadence speed from this very tick, instead of a creep from whenever
    // the unit last arrived.
    //
    // Never later than the last tick this entity was actually observed at
    // that position, though — which for a GENUINE rest is no constraint at
    // all, since the sighting is then the previous tick and later than
    // `tick - delayTicks`, so the cadence claim wins as it always did. It
    // binds only when the gap is longer than the delay, and that is what a
    // coalesced frame needs:
    // when the gap is longer than the delay, `tick - delayTicks` would claim
    // the entity left rest after we had already stopped watching, compressing
    // every tick of travel inside the gap into `delay` ticks of drawing. A
    // charging wolf covering three cells across a three-tick frame was drawn
    // back at its start and then made to cross all three inside one tick —
    // found by looking at the capture, not by a test. Taking the earlier of
    // the two makes the departure segment run at the interval's OWN average
    // speed whenever the interval was really observed, and keeps the cadence
    // rule for a genuine rest, where the last sighting is older than it.
    track.times[last] = Math.min(tick - track.delayTicks, track.lastSeenTick);
  }
  pushSample(track, tick, entity.x, entity.y);
}

export function createDisplayedPositionSmoother(
  options: DisplayedPositionSmootherOptions = {},
): DisplayedPositionSmoother {
  const delayTicksFor = options.delayTicksFor ?? displayDelayTicksFor;
  const tracks = new Map<number, Track>();
  let lastProcessedTick = -1;

  function reset(): void {
    tracks.clear();
    lastProcessedTick = -1;
  }

  function pruneAbsent(previousTick: number): void {
    for (const [key, track] of tracks) {
      if (track.lastSeenTick < previousTick) tracks.delete(key);
    }
  }

  function displayedEntity(entity: ProjectedEntityView, tick: number, alpha: number): ProjectedEntityView {
    const key = trackKey(entity);
    let track = tracks.get(key);
    if (track === undefined || track.entityType !== entity.entityType) {
      track = createTrack(entity, tick, Math.max(1, Math.floor(delayTicksFor(entity))));
      tracks.set(key, track);
    } else {
      observe(track, entity, tick);
    }
    track.lastSeenTick = tick;
    const renderTime = tick + alpha - track.delayTicks;
    while (track.count >= 2 && track.times[slot(track, 1)]! <= renderTime) dropOldest(track);
    // One sample left: the render time has reached the sim's latest position,
    // which is exactly what the entity carries — hand it back as-is.
    if (track.count === 1) return entity;
    const from = slot(track, 0);
    const to = slot(track, 1);
    // Consecutive samples are always at distinct times (a same-tick change
    // corrects the tick's sample), so the span is positive.
    const span = track.times[to]! - track.times[from]!;
    const fraction = Math.max(0, Math.min(1, (renderTime - track.times[from]!) / span));
    return {
      ...entity,
      x: track.xs[from]! + (track.xs[to]! - track.xs[from]!) * fraction,
      y: track.ys[from]! + (track.ys[to]! - track.ys[from]!) * fraction,
    };
  }

  return {
    apply(entities, tick, interpolationAlpha) {
      // A REWIND (replay scrub, rollback): the samples ahead of the new render
      // time belong to a timeline that is being left, so every track starts
      // over at the sim position. A forward gap is NOT a rewind and does not
      // reset — see the module header; it is bounded by the distance guard in
      // `observe` like any other move.
      if (lastProcessedTick >= 0 && tick < lastProcessedTick) {
        reset();
      }
      if (tick !== lastProcessedTick) {
        if (lastProcessedTick >= 0) pruneAbsent(lastProcessedTick);
        lastProcessedTick = tick;
      }
      const alpha = Math.max(0, Math.min(1, interpolationAlpha));
      return entities.map((entity) => (
        entity.isMemory || (entity.kind !== 'unit' && entity.kind !== 'resource')
          ? entity
          : displayedEntity(entity, tick, alpha)
      ));
    },
    reset,
  };
}
