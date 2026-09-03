import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';
import {
  analyseHops,
  analyseMotion,
  describeHops,
  describeMotion,
  type MotionSample,
} from './helpers/motionAnalysis';
import {
  drivenDeerSamples,
  drivenWalkSamples,
  orderCorridorWalk,
  planOpenGroundWalk,
  stageAtCorridor,
  writeDeerStrip,
  writeStrip,
} from './helpers/motionStaging';

// The gate for the CLASS of defect the owner reported on 2026-09-01 watching
// the game live: "units seem to move and briefly stop mid-movement between
// cells." The sim hands a villager one 0.25-tile fine step only when its
// carry bank crosses 100 hundredths (ticks 4, 7, 10, 13, ...), and the
// renderer used to lerp only between the previous tick and the current one,
// so on screen a walking villager moved for 100 ms and stood for ~200 ms,
// over and over — a 3.3 Hz pulse.
//
// This spec measures what the presentation layer actually PUTS ON SCREEN,
// frame by frame, on the real boot map (`aoe2-prototype`, fog on, real base):
// it stages one villager at the near end of the straight open-grass corridor
// nearest the base, orders it eight tiles down that corridor, drives 60 Hz
// frames through the same bridge/presentation path the live loop uses, and
// reads the drawn root after every frame. Every assertion is about the
// PICTURE and none about the sim: mid-walk (first and last 300 ms excluded)
// no more than 2% of frames may show a root that did not move at all, and
// the largest per-frame step must be under twice the smallest. The sim-side
// checks in each test are instrument checks — did the unit really walk, is
// the window long enough for a percentage to mean anything — and they come
// first so a gate that did not run cannot report as a gate that passed.
//
// Red check on the v0.3.177 build, before the fix (2026-09-02, this machine):
//   driven 60 Hz — 661 frames, window 552: still 372 = 67.4%; per-frame step
//   min/max 0.0417/0.0417 tiles (ratio 1.00; every moving frame was one sixth
//   of a fine step, at 2.50 tiles/s, then nothing until the next step landed);
//   sim 8.00 tiles, drawn 8.00 tiles.
//   live rAF — 81 frames in 4 s (window 53): still 23 = 43.4% of frames and
//   of the window's DURATION, which is what the live bar now measures; step
//   min/max 0.0002/0.1665 tiles; speed 0.00-2.50 tiles/s; sim 3.00 tiles.
// The same numbers are recorded in docs/learning/defect-register.md
// (2026-09-02 entry) next to the ones measured after the fix.
//
// Set MOTION_STRIP_DIR to also write two 12-frame strips as PNGs plus their
// drawn/sim series: the villager mid-walk at 60 ms spacing (frame-NN.png +
// frames.json) and the deer at `SLOW_FRAME_MS` (deer-slow-NN.png +
// deer-slow-frames.json). A still cannot show whether a picture moved, so
// the strip is the visual evidence a motion change needs; the pair the
// defect-register entry cites lives under tmp/motion/{before,after}.
//
// A limit of the driven halves: `advanceTicks` syncs the presentation with
// `force = true`, while the live frame loop syncs unforced and skips a frame
// whose tick, interpolation alpha, selection and interaction state are all
// unchanged — a frame the driven path can never produce. The live test is
// the one that exercises that path; the driven tests measure the smoother's
// output under a frame grid the live loop cannot hold headlessly (~20 fps).
//
// WHAT THIS GATE IS BOUND BY, and what v0.3.192 had to add after those bounds
// let a defect through. Every driven test below drove a 16.7 ms frame, and
// every still-frame verdict was a COUNT over a window the machine's own frame
// rate sized. Both bounds were load-bearing and neither was stated:
//
//  - FRAME PACE. Nothing here looked at a frame slower than 100 ms, and the
//    whole defect lived past that line: the presentation advances two or more
//    ticks in one frame there, which the first cut of this smoother treated as a
//    discontinuity and answered by throwing every track away. Measured on
//    this machine through the real bridge: a fleeing deer drawn STANDING in
//    0.0% of its hop frames at 16.7 ms and 100 ms, 14.8% at 105 ms, 92.4% at
//    143 ms, 93.4% at 167 ms and 100% at 200 ms; a walking villager 0.0% at
//    100 ms and 25.0 / 31.7 / 37.8 / 20.0% at 125 / 150 / 200 / 250 ms, its
//    per-frame step ratio reaching 25.0. Every machine that runs this suite
//    in CI is slower than this one, so the pace this gate ignored is the pace
//    CI runs at. `SLOW_FRAME_MS` now drives the same two walks there.
//  - WINDOW SIZE. The live half allowed `max(1, floor(2% × windowFrames))`
//    still frames over a window of 51-75 frames — an allowance of exactly
//    ONE frame against a measurement of zero. A single duplicate rAF
//    timestamp would have spent it. The live verdict is now taken on TIME
//    (`stillTimeShare`), where a zero-length frame weighs nothing and a
//    100 ms stall weighs 100 ms — 4% of the 2,500 ms window this test
//    requires, against a 2% bar. Measured after the fix: 0 ms still out of a
//    3,116-3,150 ms window, 83 frames, median frame 33 ms.
//  - AND THE INSTRUMENT'S OWN RESOLUTION, which the time-weighted form does
//    not fix and which a critic found in the first version of this rewrite:
//    a still step needs two consecutive frames at the same drawn position,
//    so a stall shorter than ONE FRAME INTERVAL leaves no trace at all. The
//    100 ms sentence above is therefore true at 60 fps and at 20 fps and
//    FALSE at 6.7 fps, where a one-tick stall measures 0.0% and the test
//    would pass having seen nothing. `LIVE_MAX_MEDIAN_FRAME_MS` makes the
//    live half SKIP with that number in the message instead, and the driven
//    150 ms halves are what cover the slow-frame regime.

const FRAME_MS = 1_000 / 60;
const WALK_FRAMES = 660;
const EDGE_MS = 300;
/** Mid-walk frames allowed to draw a root that did not move, as a share of
 *  the window; a plain share on the driven halves (windows of 550+ frames),
 *  a floored frame count on the short live window. */
const STILL_SHARE_BAR = 0.02;
/** The pace of a machine several times slower than the one this was written
 *  on: 150 ms a frame, 6.7 fps, where every frame advances the simulation
 *  more than one tick and the presentation never sees a single-tick step.
 *  Chosen past the 100 ms line where coalescing begins rather than at it, so
 *  the gate measures the regime and not its boundary. */
const SLOW_FRAME_MS = 150;
/** Mid-walk still frames allowed at `SLOW_FRAME_MS`. Same 2% as the 60 Hz
 *  bar; measured 0 before and after the window edges are trimmed. */
const SLOW_STILL_SHARE_BAR = 0.02;
/** Per-frame step ratio allowed at `SLOW_FRAME_MS`, and why it is not the
 *  60 Hz bar of 2. A presentation that only looks every 1.5 ticks sees a
 *  villager's 3-tick sim cadence as alternating 1- and 2-tick intervals, so
 *  the drawn speed RIPPLES from the frame grid alone where a 60 Hz
 *  presentation ripples 1.33. A ripple is aliasing; a STOP is the defect,
 *  and the still bar holds that. Before the fix this ratio was 8.00 at
 *  150 ms and 25.00 at 125 ms.
 *
 *  THIS BAR IS FOR THIS PACE and is not a general property, which is the
 *  bound that matters about it: the aliasing ripple is 1.67 at the 150 ms
 *  this gate drives, but an independent sweep of the same walk measured 2.50
 *  at 110, 120, 145, 170, 175, 180, 210, 225 and 240 ms and 3.00 at 320 ms.
 *  At those paces this bar would sit exactly ON the phenomenon. It has 50%
 *  of margin at the pace it is asserted at, and none anywhere else; a future
 *  pace added here needs its own measured bar rather than this number. */
const SLOW_STEP_RATIO_BAR = 2.5;
/** Live rAF: the share of the window's DURATION the drawn root may spend not
 *  moving. Taken on time rather than on frames so no single frame can decide
 *  the verdict — see the header. */
const LIVE_STILL_TIME_SHARE_BAR = 0.02;
/** The live half's INSTRUMENT RESOLUTION, and the reason it is asserted. A
 *  still step needs two consecutive frames at the same drawn position, so a
 *  freeze shorter than one frame interval leaves no trace: at 6.7 fps a
 *  one-tick (100 ms) stall measures 0.0% still and the test passes without
 *  having looked at anything. A machine whose median live frame is slower
 *  than one simulation tick cannot measure this, and says so by SKIPPING
 *  rather than by passing — the driven halves above cover the slow-frame
 *  regime deterministically, which is what makes a skip here honest instead
 *  of a hole. Measured on this machine: 27-35 ms.
 *
 *  A MEDIAN is what it is, and that is its bound: it catches a machine that
 *  is systematically too slow, not a fast one with occasional 300 ms hitches,
 *  whose stalls stay invisible to any still-frame measure. A systematic
 *  stutter is what this gate exists for. And a skip is not a failure in the
 *  reporter, so on a CI box below 10 fps the live half simply never runs and
 *  the two driven halves carry the whole contract — the trade, made
 *  deliberately, because those two are deterministic. */
const LIVE_MAX_MEDIAN_FRAME_MS = 100;
/** How far the drawn root may trail the sim root. The smoother trails by ONE
 *  step cadence of travel by design, so this is the bar that says the delay
 *  is the entity's own: a villager covers 0.32 tiles in its four ticks and a
 *  fleeing deer one whole diagonal hop, 1.414, in its fourteen. Without it
 *  every other bar here passes on a smoother given a 30-tick delay, which
 *  draws the deer 2.879 tiles behind the sim. */
const VILLAGER_MAX_LAG_TILES = 0.5;
const DEER_MAX_LAG_TILES = 1.5;
/** The live window must be long enough that the bar above is worth more than
 *  a frame, and short enough that a slow machine still reaches it. The four
 *  second run less the two 300 ms edges leaves at most 3,400 ms and measured
 *  3,116 ms here, so 2,500 leaves ~600 ms of headroom for a machine several
 *  times slower (the window is bounded by WALL CLOCK, not by frame count, so
 *  a slower machine loses only the time before its first drawn movement).
 *  At 2,500 ms the 2% bar is a 50 ms budget, and the smallest real stutter —
 *  one 100 ms simulation tick standing still — spends at least 4% of it and
 *  fails. */
const LIVE_MIN_WINDOW_MS = 2_500;

// Ten seconds of deer flight, sampled at 60 Hz: six or seven fourteen-tick
// hops at the stop-and-go rate a scout sustains (see the deer test).
const DEER_FRAMES = 600;
/** Frames judged after each hop lands, at a given frame pace: the hop's
 *  fourteen ticks converted to frames, less a margin so the verdict never
 *  rides on the exact frame the glide ends. */
function deerHopSpanFrames(frameMs: number): number {
  return Math.max(1, Math.round(14 * 100 / frameMs) - Math.max(2, Math.round(4 * 16.667 / frameMs)));
}
const DEER_HOP_SPAN_FRAMES = deerHopSpanFrames(FRAME_MS);

test.describe('unit motion smoothness', () => {
  test('a walking villager is drawn advancing every frame at a near-constant rate', async ({
    page,
  }) => {
    test.slow();
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const plan = await planOpenGroundWalk(page);
    await stageAtCorridor(page, plan);
    await orderCorridorWalk(page, plan);

    const samples = await drivenWalkSamples(page, plan, FRAME_MS, WALK_FRAMES);

    const report = analyseMotion(samples, EDGE_MS);
    test.info().annotations.push({ type: 'motion', description: describeMotion(report) });
    console.log(`[motion] driven 60 Hz: ${describeMotion(report)}`);

    // Evidence before verdict: the strip and the raw series are wanted most
    // when the assertions below fail, so they are written before those run.
    const stripDir = process.env.MOTION_STRIP_DIR;
    if (stripDir) {
      mkdirSync(stripDir, { recursive: true });
      writeFileSync(join(stripDir, 'driven-samples.json'), JSON.stringify(samples));
      await writeStrip(page, plan, stripDir);
    }

    // Instrument checks first: the villager really walked, and the window is
    // long enough for a percentage to mean something.
    expect(report.simTiles).toBeGreaterThanOrEqual(4);
    expect(report.windowFrames).toBeGreaterThan(200);
    // The claims about the picture. Before the fix the still share was the
    // failing number; the step ratio was 1.00 because every moving frame was
    // one sixth of a fine step — it guards the cure against trading a stop
    // for a burst-and-crawl. The bar of 2 is for the villager's own 3-tick/
    // 4-tick alternation (4/3); a unit earning 50-99 hundredths a tick (light
    // cavalry at 188%) alternates 1- and 2-tick intervals and would sit at
    // exactly 2.0, so this walk must stay a villager's.
    expect(report.stillShare).toBeLessThanOrEqual(STILL_SHARE_BAR);
    expect(report.stepRatio).toBeLessThan(2);
    expect(report.maxLag).toBeLessThanOrEqual(VILLAGER_MAX_LAG_TILES);
  });

  test('a live, unpaused walk is drawn advancing on every animation frame', async ({ page }) => {
    test.slow();
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const plan = await planOpenGroundWalk(page);
    await stageAtCorridor(page, plan);
    await orderCorridorWalk(page, plan);

    const samples = await page.evaluate(({ id, durationMs }) => new Promise<MotionSample[]>(
      (resolve, reject) => {
        const api = window.__AOE2_TEST__!;
        const out: MotionSample[] = [];
        let startMs: number | undefined;
        const onFrame = (nowMs: number) => {
          try {
            const shown = api.getDisplayedEntities().find((entity) => entity.id === id);
            const sim = api.getRenderState().entities.find((entity) => entity.id === id);
            if (!shown || !sim) throw new Error(`Villager ${String(id)} left the render state mid-walk.`);
            startMs ??= nowMs;
            out.push({ timeMs: nowMs, x: shown.x, y: shown.y, simX: sim.x, simY: sim.y });
            if (nowMs - startMs < durationMs) {
              window.requestAnimationFrame(onFrame);
            } else {
              api.setPaused(true);
              resolve(out);
            }
          } catch (error) {
            api.setPaused(true);
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        };
        api.setPaused(false);
        window.requestAnimationFrame(onFrame);
      },
    ), { id: plan.id, durationMs: 4_000 });

    const report = analyseMotion(samples, EDGE_MS);
    test.info().annotations.push({ type: 'motion', description: describeMotion(report) });
    console.log(`[motion] live rAF: ${describeMotion(report)}`);
    const stripDir = process.env.MOTION_STRIP_DIR;
    if (stripDir) {
      mkdirSync(stripDir, { recursive: true });
      writeFileSync(join(stripDir, 'live-samples.json'), JSON.stringify(samples));
    }

    // INSTRUMENT FIRST, and this one decides whether the test can run at
    // all: a stall shorter than one frame interval leaves no still frame, so
    // a machine whose median live frame is slower than a simulation tick
    // would report a clean 0.0% having seen nothing. Skip rather than pass —
    // the driven 150 ms halves cover that regime deterministically.
    test.skip(
      report.medianFrameMs > LIVE_MAX_MEDIAN_FRAME_MS,
      `This machine's median live frame is ${report.medianFrameMs.toFixed(1)} ms, slower than the `
      + `${String(LIVE_MAX_MEDIAN_FRAME_MS)} ms simulation tick this test has to resolve, so a still `
      + 'frame shorter than one frame interval would be invisible and a pass would mean nothing. '
      + 'The driven halves of this spec measure the slow-frame regime instead.',
    );
    // A machine too slow to walk for two and a half seconds of window cannot
    // measure this either; say so rather than pass on an empty window.
    expect(report.windowMs).toBeGreaterThanOrEqual(LIVE_MIN_WINDOW_MS);
    // Derived, not chosen: a >= 2,500 ms window whose median frame is <= 100 ms
    // holds at least 25 frames.
    expect(report.windowFrames).toBeGreaterThanOrEqual(25);
    expect(report.simTiles).toBeGreaterThanOrEqual(1.5);
    // The verdict on TIME, not on a frame count. The old form allowed
    // `max(1, floor(2% × windowFrames))` still frames over a 51-75 frame
    // window, which is an allowance of exactly ONE frame against a
    // measurement of zero — one duplicate rAF timestamp from spending it,
    // and CI machines are slower than this one. A zero-length frame weighs
    // nothing here, while the smallest real stutter is one 100 ms simulation
    // tick and spends 4% of the 2,500 ms window this bar is measured over —
    // which is true only on a machine that passed the median-frame check
    // above, and is exactly what that check is for. Before the smoother:
    // 43.4% of live frames still (a frame share; that run's samples do not
    // survive, so its time share is not recomputable).
    expect(report.stillTimeShare).toBeLessThanOrEqual(LIVE_STILL_TIME_SHARE_BAR);
    expect(report.maxLag).toBeLessThanOrEqual(VILLAGER_MAX_LAG_TILES);
  });

  // A DISCONTINUITY IS A JUMP IN SPACE, NOT A JUMP IN TIME (v0.3.192; this
  // test asserted the opposite until then). A sync covering several ticks
  // brackets the gap with two OBSERVED sim positions, which is the same
  // evidence the smoother interpolates between on any other pair of samples,
  // so it keeps gliding and keeps its history; only a jump past the snap
  // distance is a teleport. Treating the gap itself as a discontinuity threw
  // the history away on every frame slower than 100 ms — that is, on every
  // machine slower than this one — and stood the picture still there.
  test('a sync that coalesces several ticks keeps gliding, and still trails the sim root', async ({
    page,
  }) => {
    test.slow();
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const plan = await planOpenGroundWalk(page);
    await stageAtCorridor(page, plan);
    await orderCorridorWalk(page, plan);

    const probe = await page.evaluate(({ id }) => {
      const api = window.__AOE2_TEST__!;
      const read = () => {
        const shown = api.getDisplayedEntities().find((entity) => entity.id === id);
        const sim = api.getRenderState().entities.find((entity) => entity.id === id);
        if (!shown || !sim) throw new Error(`Villager ${String(id)} left the render state mid-walk.`);
        return { gap: Math.hypot(shown.x - sim.x, shown.y - sim.y), x: shown.x, y: shown.y, simX: sim.x, simY: sim.y };
      };
      // Tick by tick, as the live loop presents: after the first steps the
      // drawn root trails the sim root by up to a cadence of travel.
      let trailing = 0;
      for (let tick = 0; tick < 12; tick += 1) {
        api.advanceTicks(1, 100);
        trailing = Math.max(trailing, read().gap);
      }
      // One sync covering five ticks — twice what a live frame can coalesce
      // at normal speed, what one can at double speed.
      const before = read();
      api.advanceTicks(5, 100);
      const coalesced = read();
      // The frames after it keep advancing the drawn root rather than
      // restarting: no frame in the next villager cadence stands still.
      let stillAfter = 0;
      let previous = coalesced;
      for (let tick = 0; tick < 8; tick += 1) {
        api.advanceTicks(1, 100);
        const next = read();
        if (Math.hypot(next.x - previous.x, next.y - previous.y) === 0) stillAfter += 1;
        previous = next;
      }
      return { trailing, before, coalesced, stillAfter, resumedGap: previous.gap };
    }, { id: plan.id });

    // Instrument: the villager really was walking and really did trail.
    expect(probe.trailing).toBeGreaterThan(0);
    expect(Math.hypot(probe.coalesced.simX - probe.before.simX, probe.coalesced.simY - probe.before.simY))
      .toBeGreaterThan(0);
    // The claim: the coalesced sync did NOT snap the drawn root onto the sim
    // root (it kept its cadence of trailing), it did not overshoot it, and
    // the drawn root advanced.
    expect(probe.coalesced.gap).toBeGreaterThan(0);
    // Bounded by the trailing the walk ALREADY had, not by the snap distance:
    // 1.5 tiles is six times a villager's 0.25-tile phenomenon and would pass
    // on a smoother that had lost the plot. The coalesced frame may add up to
    // one more cadence of trail, hence 2x.
    expect(probe.coalesced.gap).toBeLessThanOrEqual(probe.trailing * 2);
    expect(probe.trailing).toBeLessThanOrEqual(VILLAGER_MAX_LAG_TILES);
    expect(Math.hypot(probe.coalesced.x - probe.before.x, probe.coalesced.y - probe.before.y))
      .toBeGreaterThan(0);
    // And the walk after it is continuous — the whole point of not resetting.
    expect(probe.stillAfter).toBe(0);
    expect(probe.resumedGap).toBeGreaterThan(0);
  });

  // The slow-machine regime, and the reason it is a separate test rather than
  // a bar loosened on the ones above: at 150 ms a frame the presentation
  // never sees a single-tick step, so it exercises the coalescing path on
  // EVERY frame instead of on none. Driven, so it is deterministic — the
  // pace is the test's input, not the machine's.
  test('a walking villager is drawn advancing every frame at 6.7 fps, the pace of a much slower machine', async ({
    page,
  }) => {
    test.slow();
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const plan = await planOpenGroundWalk(page);
    await stageAtCorridor(page, plan);
    await orderCorridorWalk(page, plan);

    const frames = Math.round(WALK_FRAMES * FRAME_MS / SLOW_FRAME_MS);
    const samples = await drivenWalkSamples(page, plan, SLOW_FRAME_MS, frames);
    const report = analyseMotion(samples, EDGE_MS);
    test.info().annotations.push({ type: 'motion', description: describeMotion(report) });
    console.log(`[motion] driven ${String(SLOW_FRAME_MS)} ms: ${describeMotion(report)}`);

    // Instrument first: the villager really walked, and the window is long
    // enough for a percentage to mean something at this pace.
    expect(report.simTiles).toBeGreaterThanOrEqual(4);
    expect(report.windowFrames).toBeGreaterThan(30);
    // Measured on this machine through the real bridge: 31.7% still and a
    // step ratio of 8.00 before the fix, 0.0% and 1.67 after.
    expect(report.stillShare).toBeLessThanOrEqual(SLOW_STILL_SHARE_BAR);
    expect(report.stepRatio).toBeLessThanOrEqual(SLOW_STEP_RATIO_BAR);
    expect(report.maxLag).toBeLessThanOrEqual(VILLAGER_MAX_LAG_TILES);
  });

  // The other mover on the boot map's most-watched screen: a deer. The sim
  // moves a fleeing deer one whole cell every fourteenth tick (units.csv
  // 0.737 tiles/s), the worst instance of the owner's symptom — drawn still
  // for thirteen ticks, then across a tile in one. `deer-flight-fixture`
  // seats a scout five tiles from a deer on open grass with twelve tiles of
  // sight (a villager's four loses the deer within a tick of its first
  // diagonal hop — measured 2026-09-02, live for five ticks in fourteen); the
  // scout is sent after the deer every ten ticks. A scout paths on the
  // four-connected grid at 1.2 tiles/s while a diagonal hop gains two tiles
  // of Manhattan distance every 1.4 s, so the deer periodically escapes the
  // five-tile flee trigger and STANDS until the scout closes again — real
  // sim behaviour, not a drawing defect — which is why the verdict is taken
  // over the fourteen ticks after each hop (`analyseHops`), not over the
  // whole series: was each hop drawn as a crossing, or as a jump?
  test('a fleeing deer is drawn running, not hopping a cell at a time', async ({ page }) => {
    test.slow();
    await game.waitForPausedBootWithSeed(page, 'deer-flight-fixture');

    const samples = await drivenDeerSamples(page, FRAME_MS, DEER_FRAMES);

    const report = analyseHops(samples, DEER_HOP_SPAN_FRAMES);
    test.info().annotations.push({ type: 'motion', description: describeHops(report) });
    console.log(`[motion] deer flight, driven 60 Hz: ${describeHops(report)}`);
    console.log(`[motion] deer flight, whole series: ${describeMotion(analyseMotion(samples, EDGE_MS))}`);
    const stripDir = process.env.MOTION_STRIP_DIR;
    if (stripDir) {
      mkdirSync(stripDir, { recursive: true });
      writeFileSync(join(stripDir, 'deer-samples.json'), JSON.stringify(samples));
    }

    // The deer really fled — several hops, three or more cells — and every
    // hop was drawn as a crossing: within the ~13.3 ticks after a hop lands
    // (`deerHopSpanFrames` trims a margin off the hop's fourteen so the
    // verdict never rides on the exact frame the glide ends), at most 2% of
    // frames may draw the root where the previous frame had it. A straight hop and a diagonal one differ by root two,
    // well under the step-ratio bar.
    expect(report.hops).toBeGreaterThanOrEqual(4);
    expect(report.simTiles).toBeGreaterThanOrEqual(3);
    expect(report.flightFrames).toBeGreaterThan(200);
    expect(report.stillShare).toBeLessThanOrEqual(STILL_SHARE_BAR);
    expect(report.stepRatio).toBeLessThan(2);
    expect(report.maxLag).toBeLessThanOrEqual(DEER_MAX_LAG_TILES);
  });

  // The headline case of the v0.3.192 defect, and the one a player sees: the
  // same chase at the pace of a machine several times slower than this one.
  // Measured BY THIS TEST, before the fix: the deer drawn STANDING in 98.1%
  // of its 105 hop frames, crossing a whole diagonal cell (1.3637 tiles) in
  // a single frame; after, 0.0% at 0.1414-0.1515 tiles a frame. (The same
  // chase read through the headless harness over a 60-second run and a
  // narrower hop span gives 92.7%; two instruments, and this test's own
  // number is the one its bars are set against.)
  test('a fleeing deer is drawn running at 6.7 fps, the pace of a much slower machine', async ({ page }) => {
    test.slow();
    await game.waitForPausedBootWithSeed(page, 'deer-flight-fixture');

    const frames = Math.round(DEER_FRAMES * FRAME_MS / SLOW_FRAME_MS) * 3;
    const samples = await drivenDeerSamples(page, SLOW_FRAME_MS, frames);
    const report = analyseHops(samples, deerHopSpanFrames(SLOW_FRAME_MS));
    test.info().annotations.push({ type: 'motion', description: describeHops(report) });
    console.log(`[motion] deer flight, driven ${String(SLOW_FRAME_MS)} ms: ${describeHops(report)}`);
    const stripDir = process.env.MOTION_STRIP_DIR;
    if (stripDir) {
      mkdirSync(stripDir, { recursive: true });
      writeFileSync(join(stripDir, 'deer-samples-slow.json'), JSON.stringify(samples));
      await writeDeerStrip(page, SLOW_FRAME_MS, stripDir);
    }

    expect(report.hops).toBeGreaterThanOrEqual(4);
    expect(report.simTiles).toBeGreaterThanOrEqual(3);
    expect(report.flightFrames).toBeGreaterThan(60);
    expect(report.stillShare).toBeLessThanOrEqual(SLOW_STILL_SHARE_BAR);
    // A whole cell drawn in one frame is what "not running" looks like at
    // this pace; the deer covers 0.71 tiles a second, so no frame may draw
    // more than the frame's own worth of that plus slack.
    expect(report.maxStep).toBeLessThan(0.5);
    expect(report.stepRatio).toBeLessThanOrEqual(SLOW_STEP_RATIO_BAR);
    expect(report.maxLag).toBeLessThanOrEqual(DEER_MAX_LAG_TILES);
  });
});
