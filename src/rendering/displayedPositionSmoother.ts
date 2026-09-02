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
// The history covers only what the presentation OBSERVED tick by tick, and
// every discontinuity snaps rather than glides, as the spec's motion-
// continuity contract requires: a sample farther than SNAP_DISTANCE_TILES
// from the last one (garrison, transport unload, teleport), a tick going
// backwards (replay scrub), a presentation that skipped a tick (a coalesced
// frame — the live loop coalesces up to 2.5 ticks, 5 at double speed — or a
// test-API multi-tick advance: where the steps inside the gap landed is
// unknown, so nothing is invented for them), a bridge swap (reset), a
// recycled id (keyed by id:generation), a unit whose type changed under the
// same id (a line upgrade, with a different base cadence), and an entity
// absent from the previously presented tick (fog, hidden frame) all start a
// fresh track drawn at the sim position — the render store's old rule that
// an interpolation source must have been visible the tick before.

import type { ProjectedEntityView } from '../game/simulation/types';
import { displayDelayTicksFor } from './unitStepCadence';

/** A sample this far from the previous one is a teleport, not a step. The
 *  longest single move the sim makes is a deer's diagonal flee hop, 1.41
 *  tiles, which must glide; both sides of the line are pinned by test. */
export const SNAP_DISTANCE_TILES = 1.5;

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
    && Math.hypot(entity.x - attack.sourceX, entity.y - attack.sourceY) <= SNAP_DISTANCE_TILES
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
  if (jump > SNAP_DISTANCE_TILES) {
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
    track.times[last] = tick - track.delayTicks;
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
      // A rewind, or a presentation that skipped a tick: what happened in
      // between was never observed, so every track starts over at the sim
      // position rather than gliding across the gap.
      if (lastProcessedTick >= 0 && (tick < lastProcessedTick || tick - lastProcessedTick >= 2)) {
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
