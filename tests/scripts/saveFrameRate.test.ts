// scripts/saveFrameRate.mjs answers "what frame rate does a loaded save draw, and what does a frame cost the main
// thread": a save loaded through the HUD into a production build, a window of the page's own animation frames.
// These cases hold its arithmetic (scripts/frameRateStats.mjs) against cadences whose answer is known by
// construction, and its command line's refusals.
//
// BOUND. No browser is launched here, so nothing below proves the page is measured rightly: that was checked against
// known answers on the retained worlds (plan 150, "M2b measurement") and against the scratch probe it replaces, run
// alternately on one build. The last case reads the script's source for the checks it must make before it trusts a
// frame: the preview serves this checkout's build, and the rasteriser asked for drew the canvas.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  busyCpus,
  cameraStanding,
  cpuTimes,
  foldFrames,
  parseSaveFrameRateArgs,
  runtimeWorkPerFrame,
} from '../../scripts/frameRateStats.mjs';
import { FRAME_SLOT, FRAME_SLOT_NAMES } from '../../scripts/framePhases.mjs';

type Call = [number, number, number?];

/** `count` frames `intervalMs` apart from t=1000, each with one callback of `costMs`. */
function cadence(count: number, intervalMs: number, costMs: number): Call[] {
  return Array.from({ length: count }, (_, index): Call => [1000 + index * intervalMs, costMs]);
}

describe('a window of animation frames as a frame rate', () => {
  it('reads 60 frames a second from frames one refresh apart', () => {
    const fold = foldFrames(cadence(481, 1000 / 60, 4));
    expect(fold.frames).toBe(481);
    expect(fold.fps).toBe(60);
    expect(fold.medianMs).toBe(16.7);
    expect(fold.p90Ms).toBe(16.7);
  });

  it('reads 30 and 20 from frames two and three refreshes apart', () => {
    expect(foldFrames(cadence(241, 2000 / 60, 20)).fps).toBe(30);
    expect(foldFrames(cadence(161, 3000 / 60, 40)).fps).toBe(20);
    expect(foldFrames(cadence(161, 3000 / 60, 40)).medianMs).toBe(50);
  });

  it('counts a stall in the rate while the median frame stays a refresh', () => {
    // 100 frames at 60 Hz, then one frame half a second late, then 100 more: 200 intervals over 3.82 s.
    const calls = [...cadence(101, 1000 / 60, 4), ...cadence(100, 1000 / 60, 4).map(([time, cost]): Call => [time + 100 * (1000 / 60) + 500, cost])];
    const fold = foldFrames(calls);
    expect(fold.medianMs).toBe(16.7);
    expect(fold.maxMs).toBe(500);
    expect(fold.fps).toBeCloseTo(200 / ((200 * (1000 / 60) + 500 - 1000 / 60) / 1000), 1);
    expect(fold.fps).toBeLessThan(55);
  });

  it('tells the median frame from the slow tenth when three frames in ten take two refreshes', () => {
    // Ten-frame cycles: seven frames a refresh apart, then three two refreshes apart.
    const calls: Call[] = [];
    let time = 0;
    for (let frame = 0; frame < 200; frame += 1) {
      calls.push([time, frame % 10 < 7 ? 6 : 20]);
      time += frame % 10 < 7 ? 1000 / 60 : 2000 / 60;
    }
    const fold = foldFrames(calls);
    expect(fold.medianMs).toBe(16.7);
    expect(fold.p90Ms).toBe(33.3);
    expect(fold.maxMs).toBe(33.3);
    expect(fold.callbackMedianMs).toBe(6);
    expect(fold.callbackP90Ms).toBe(20);
    expect(fold.callbackMeanMs).toBe(10.2);
    // 199 intervals: 139 or 140 short and 59 or 60 long, about 46 frames a second.
    expect(fold.fps).toBeGreaterThan(45.5);
    expect(fold.fps).toBeLessThan(46.7);
  });

  it('takes a frame to be one timestamp, and its cost the sum of its callbacks', () => {
    // Two callbacks a frame (the world's and the HUD's), as the page runs them.
    const calls: Call[] = [];
    for (let frame = 0; frame < 11; frame += 1) {
      calls.push([frame * 20, 9], [frame * 20, 3]);
    }
    const fold = foldFrames(calls);
    expect(fold.frames).toBe(11);
    expect(fold.fps).toBe(50);
    expect(fold.callbackMedianMs).toBe(12);
    expect(fold.callbackMeanMs).toBe(12);
    expect(fold.callbackP90Ms).toBe(12);
  });

  it('reports a frame\'s cost apart from the interval the display rounds it to', () => {
    // 17 ms of work is drawn every second refresh: the interval says 33.3, the cost says 17.
    const fold = foldFrames(cadence(100, 2000 / 60, 17));
    expect(fold.medianMs).toBe(33.3);
    expect(fold.callbackMedianMs).toBe(17);
  });

  it('sums the wait for the GPU per frame, and reads none when it was not measured', () => {
    const waited = foldFrames([[0, 5, 2], [0, 1, 0.5], [20, 5, 2], [20, 1, 0.5], [40, 5, 4], [40, 1, 0.5]]);
    expect(waited.gpuWaitMedianMs).toBe(2.5);
    expect(waited.gpuWaitMeanMs).toBe(3.17);
    expect(foldFrames(cadence(10, 16, 4)).gpuWaitMeanMs).toBe(0);
  });

  it('refuses a window with fewer than two frames, saying why that happens', () => {
    expect(() => foldFrames([])).toThrow(/held 0 animation frames.*paused, over or halted/s);
    expect(() => foldFrames([[5, 1], [5, 2]])).toThrow(/held 1 animation frame;/);
  });
});

describe('the runtime\'s work per drawn frame', () => {
  const before = { instancePresentationMatrixWrites: 1_000, deltaCopyOperations: 10, instances: 3_000, drawCalls: 14, frames: 100 };
  const after = { instancePresentationMatrixWrites: 19_000, deltaCopyOperations: 370, instances: 3_571, drawCalls: 12, frames: 110 };

  it('divides a counter\'s change by the frames and leaves a gauge as it stands', () => {
    const work = runtimeWorkPerFrame(before, after, 10);
    expect(work.perFrame.instancePresentationMatrixWrites).toBe(1_800);
    expect(work.perFrame.deltaCopyOperations).toBe(36);
    expect(work.atEnd).toEqual({ instances: 3_571, drawCalls: 12 });
    // The instances on screen are not a count of work: their change over a window is never a per-frame figure.
    expect(work.perFrame).not.toHaveProperty('instances');
  });

  it('divides by one frame rather than by none', () => {
    expect(runtimeWorkPerFrame(before, after, 0).perFrame.instancePresentationMatrixWrites).toBe(18_000);
  });
});

describe('where the camera stood', () => {
  const corners = [{ cellX: 4.5, cellY: 38 }, { cellX: 24, cellY: 18.5 }, { cellX: 47.5, cellY: 42 }, { cellX: 28, cellY: 61.5 }];

  it('is the middle of the view\'s corners, and how far that is from the cell asked for', () => {
    expect(cameraStanding({ viewCorners: corners }, { x: 26, y: 40 })).toEqual({ centre: { x: 26, y: 40 }, offFocusCells: 0 });
    // The camera keeps the reach of the map the page booted on: asked for (60,60), it stood here.
    expect(cameraStanding({ viewCorners: corners }, { x: 60, y: 60 }).offFocusCells).toBe(39.4);
  });

  it('gives no distance without a focus, and nothing without a camera', () => {
    expect(cameraStanding({ viewCorners: corners }, null)).toEqual({ centre: { x: 26, y: 40 }, offFocusCells: null });
    expect(cameraStanding(null, { x: 1, y: 1 })).toEqual({ centre: null, offFocusCells: null });
  });
});

describe('the machine\'s load beside a number', () => {
  it('counts busy logical CPUs between two readings', () => {
    const cpu = (idle: number, user: number) => ({ times: { user, nice: 0, sys: 0, idle, irq: 0 } });
    const first = cpuTimes([cpu(1_000, 0), cpu(1_000, 0), cpu(1_000, 0), cpu(1_000, 0)]);
    // One CPU fully busy, one half busy, two idle, over the same second.
    const second = cpuTimes([cpu(1_000, 1_000), cpu(1_500, 500), cpu(2_000, 0), cpu(2_000, 0)]);
    expect(busyCpus(first, second)).toEqual({ busy: 1.5, of: 4 });
  });
});

describe('the command line', () => {
  it('measures eight seconds on the GPU at 1600x900 and Normal speed unless told otherwise', () => {
    expect(parseSaveFrameRateArgs(['--save', 'a.json'], {})).toEqual({
      save: 'a.json', focus: null, seconds: 8, width: 1600, height: 900, rasteriser: 'gpu', speed: 'normal',
      tree: '.', port: 4173, label: 'a.json', out: null, paste: false, profile: null, gpuSync: false,
    });
  });

  it('takes the port from PREVIEW_PORT, and --port over it', () => {
    expect(parseSaveFrameRateArgs(['--save', 'a.json'], { PREVIEW_PORT: '4325' }).port).toBe(4325);
    expect(parseSaveFrameRateArgs(['--save', 'a.json', '--port', '4400'], { PREVIEW_PORT: '4325' }).port).toBe(4400);
  });

  it('reads every option', () => {
    const options = parseSaveFrameRateArgs([
      '--save', 's.json', '--focus', '26,40', '--seconds', '16', '--size', '800x600', '--rasteriser', 'swiftshader',
      '--speed', 'slow', '--tree', '../control', '--label', 'main', '--out', 'tmp/rows.jsonl', '--paste',
      '--profile', 'tmp/a.cpuprofile', '--gpu-sync',
    ], {});
    expect(options).toMatchObject({
      focus: { x: 26, y: 40 }, seconds: 16, width: 800, height: 600, rasteriser: 'swiftshader', speed: 'slow',
      tree: '../control', label: 'main', out: 'tmp/rows.jsonl', paste: true, profile: 'tmp/a.cpuprofile', gpuSync: true,
    });
  });

  it('refuses what it cannot measure, naming the flag, the value and what it takes', () => {
    const parse = (...argv: string[]) => () => parseSaveFrameRateArgs(argv, {});
    expect(parse()).toThrow(/--save names the save to measure and is required/);
    expect(parse('--save', 'a.json', '--size', '1600')).toThrow(/--size is the viewport as WIDTHxHEIGHT.*got "1600"/);
    expect(parse('--save', 'a.json', '--size', '0x900')).toThrow(/--size/);
    expect(parse('--save', 'a.json', '--seconds', '0')).toThrow(/--seconds is the window in seconds.*got "0"/);
    expect(parse('--save', 'a.json', '--seconds', 'long')).toThrow(/--seconds/);
    expect(parse('--save', 'a.json', '--focus', '26')).toThrow(/--focus is a world cell as "x,y".*got "26"/);
    expect(parse('--save', 'a.json', '--speed', 'ludicrous')).toThrow(/--speed is one of the game's speeds \(slow, casual, normal, fast\); got "ludicrous"/);
    expect(parse('--save', 'a.json', '--port', '70000')).toThrow(/--port \(or PREVIEW_PORT\).*got "70000"/);
    expect(parse('--save', 'a.json', '--fous', '1,2')).toThrow(/"--fous" is not an option of saveFrameRate/);
    expect(parse('--save', 'a.json', '--label')).toThrow(/--label needs a value/);
    expect(parse('--save', '--paste')).toThrow(/--save needs a value/);
  });
});

describe('scripts/saveFrameRate.mjs', () => {
  const source = readFileSync(fileURLToPath(new URL('../../scripts/saveFrameRate.mjs', import.meta.url)), 'utf8');

  it('checks the preview serves the build and the rasteriser drew the canvas before it measures', () => {
    const served = source.indexOf('await assertPreviewServes(tree, options.port)');
    const drawn = source.indexOf('refuseFrameFromOtherRasteriser(launch.rasteriser, drawnBy)');
    const measured = source.indexOf('probe.on = true');
    expect(served).toBeGreaterThan(-1);
    expect(drawn).toBeGreaterThan(served);
    expect(measured).toBeGreaterThan(drawn);
  });

  it('never unmutes the game', () => {
    expect(source).not.toMatch(/aoe2\.audio|setMuted|unmute\(/i);
  });

  it('runs alternate frames through the two functions the profile fold tells frames apart by', () => {
    // The fold reads the names off the profile, so the page's functions and the fold's pattern must agree.
    expect(FRAME_SLOT_NAMES).toHaveLength(2);
    for (const name of FRAME_SLOT_NAMES) {
      expect(name).toMatch(FRAME_SLOT);
      expect(source).toContain(`function ${name}(callback, time) { callback(time); }`);
    }
    const [even, odd] = FRAME_SLOT_NAMES;
    expect(source).toContain(`if (evenFrame) ${even}(callback, time);`);
    expect(source).toContain(`else ${odd}(callback, time);`);
    expect('saveFrameRateProbe').not.toMatch(FRAME_SLOT);
  });
});
