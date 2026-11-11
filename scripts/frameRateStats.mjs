// The arithmetic of scripts/saveFrameRate.mjs, kept apart from the browser so tests/scripts/saveFrameRate.test.ts
// can hold it: the command line, the fold of a window's animation frames into a frame rate and a frame's cost, the
// runtime's counters per drawn frame, where the camera stands, and the machine's load beside the number.

/** The runtime metrics that only ever count up, so their change over a window divides by its frames. */
export const RUNTIME_COUNTERS = Object.freeze([
  'animationMatrixUpdates',
  'instancePresentationMatrixWrites',
  'instancePresentationColorWrites',
  'instancePresentationUpdateRanges',
  'snapshotInputTypedArrayBytes',
  'snapshotCopiedTypedArrayBytes',
  'snapshotCopyOperations',
  'deltaInputTypedArrayBytes',
  'deltaCopiedTypedArrayBytes',
  'deltaCopyOperations',
]);

/** The runtime metrics that describe the frame on screen, reported as they stand when the window ends. */
export const RUNTIME_GAUGES = Object.freeze([
  'instances', 'instanceBatches', 'animatedInstances', 'drawCalls', 'triangles', 'chunks',
]);

const USAGE = [
  'node scripts/saveFrameRate.mjs --save <save.json> [options]',
  '  --save <path>        the save to load through the HUD (required)',
  '  --focus <x,y>        the world cell the camera is asked to centre on (default: where the load leaves it,',
  '                       the map\'s corner)',
  '  --seconds <n>        the window, in seconds of wall time (default 8)',
  '  --size <WxH>         the viewport (default 1600x900)',
  '  --rasteriser <name>  gpu or swiftshader (default gpu)',
  '  --speed <name>       the game speed: slow, casual, normal or fast (default normal)',
  '  --tree <path>        the checkout whose dist/ the preview serves (default: this one)',
  '  --port <n>           the preview\'s port (default: PREVIEW_PORT, then 4173)',
  '  --label <text>       names the row (default: the save\'s path)',
  '  --out <file.jsonl>   appends the row there as well as printing it',
  '  --paste              loads through the Load panel\'s paste source, for a save too large for the browser save',
  '  --profile <file>     also records a CPU profile of the window there, and prints its split by phase',
  '  --gpu-sync           waits for the GPU after every frame and reports that wait; such a row\'s frame rate is',
  '                       not the game\'s',
].join('\n');

const SPEEDS = ['slow', 'casual', 'normal', 'fast'];
const VALUE_FLAGS = new Set(['save', 'focus', 'seconds', 'size', 'rasteriser', 'speed', 'tree', 'port', 'label', 'out', 'profile']);
const BARE_FLAGS = new Set(['paste', 'gpu-sync']);

/**
 * The options of one run. Throws, naming the flag, the value it was given and what it takes.
 * @param {readonly string[]} argv the arguments after the script's name
 * @param {Record<string, string | undefined>} env
 */
export function parseSaveFrameRateArgs(argv, env = {}) {
  const given = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const name = flag.startsWith('--') ? flag.slice(2) : null;
    if (name !== null && BARE_FLAGS.has(name)) {
      given.set(name, true);
    } else if (name !== null && VALUE_FLAGS.has(name)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value.\n${USAGE}`);
      given.set(name, value);
      index += 1;
    } else {
      throw new Error(`"${flag}" is not an option of saveFrameRate.\n${USAGE}`);
    }
  }
  const save = given.get('save');
  if (!save) throw new Error(`--save names the save to measure and is required.\n${USAGE}`);

  const sizeText = given.get('size') ?? '1600x900';
  const size = /^(\d+)x(\d+)$/.exec(sizeText);
  if (!size || Number(size[1]) === 0 || Number(size[2]) === 0) {
    throw new Error(`--size is the viewport as WIDTHxHEIGHT in pixels, such as 1600x900; got "${sizeText}".`);
  }
  const seconds = Number(given.get('seconds') ?? 8);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 120) {
    throw new Error(`--seconds is the window in seconds, more than 0 and at most 120; got "${given.get('seconds')}".`);
  }
  const portText = given.get('port') ?? env.PREVIEW_PORT ?? '4173';
  const port = Number(portText);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`--port (or PREVIEW_PORT) is the vite preview's TCP port, from 1 to 65535; got "${portText}".`);
  }
  const speed = given.get('speed') ?? 'normal';
  if (!SPEEDS.includes(speed)) {
    throw new Error(`--speed is one of the game's speeds (${SPEEDS.join(', ')}); got "${speed}".`);
  }
  let focus = null;
  if (given.has('focus')) {
    const cell = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(given.get('focus'));
    if (!cell) throw new Error(`--focus is a world cell as "x,y", such as 26,40; got "${given.get('focus')}".`);
    focus = { x: Number(cell[1]), y: Number(cell[2]) };
  }
  return {
    save,
    focus,
    seconds,
    width: Number(size[1]),
    height: Number(size[2]),
    // Not validated here: captureRasteriser.mjs owns which rasterisers exist and on which platform.
    rasteriser: given.get('rasteriser') ?? 'gpu',
    speed,
    tree: given.get('tree') ?? '.',
    port,
    label: given.get('label') ?? save,
    out: given.get('out') ?? null,
    paste: given.has('paste'),
    profile: given.get('profile') ?? null,
    gpuSync: given.has('gpu-sync'),
  };
}

function quantile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

const round1 = (value) => Math.round(value * 10) / 10;
const round2 = (value) => Math.round(value * 100) / 100;

/**
 * A window's animation frames as a frame rate and a frame's cost on the main thread.
 *
 * `calls` is what the page recorded: for every animation-frame callback that ran, the frame's timestamp (the
 * argument the browser passes, equal for every callback of one frame), how long the callback took, and, with
 * --gpu-sync, how long the page then waited for the GPU. A frame is one timestamp. The frame rate is the frames
 * after the first over the time from the first to the last, so a window holding one long stall reads slow rather
 * than dropping it; the cost of a frame is the sum of its callbacks, which a slow display does not round up to a
 * refresh the way the interval between frames is rounded.
 * @param {ReadonlyArray<readonly [number, number, number?]>} calls [frameTimeMs, callbackMs, gpuWaitMs?]
 */
export function foldFrames(calls) {
  const frames = new Map();
  for (const [time, callbackMs, gpuWaitMs] of calls) {
    const frame = frames.get(time) ?? { callbackMs: 0, gpuWaitMs: 0 };
    frame.callbackMs += callbackMs;
    frame.gpuWaitMs += gpuWaitMs ?? 0;
    frames.set(time, frame);
  }
  const times = [...frames.keys()].sort((a, b) => a - b);
  if (times.length < 2) {
    throw new Error(
      `The window held ${String(times.length)} animation frame${times.length === 1 ? '' : 's'}; a frame rate needs `
      + 'at least two. The page drew nothing: is the match paused, over or halted, or the tab hidden?',
    );
  }
  const intervals = times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b);
  const callbacks = times.map((time) => frames.get(time).callbackMs).sort((a, b) => a - b);
  const gpuWaits = times.map((time) => frames.get(time).gpuWaitMs).sort((a, b) => a - b);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    frames: times.length,
    fps: round1(intervals.length / ((times.at(-1) - times[0]) / 1000)),
    medianMs: round1(quantile(intervals, 0.5)),
    p90Ms: round1(quantile(intervals, 0.9)),
    maxMs: round1(intervals.at(-1)),
    callbackMeanMs: round2(mean(callbacks)),
    callbackMedianMs: round2(quantile(callbacks, 0.5)),
    callbackP90Ms: round2(quantile(callbacks, 0.9)),
    gpuWaitMeanMs: round2(mean(gpuWaits)),
    gpuWaitMedianMs: round2(quantile(gpuWaits, 0.5)),
  };
}

/** The runtime's counters per drawn frame over a window, and its gauges as the window ended. */
export function runtimeWorkPerFrame(before, after, framesDrawn) {
  const frames = Math.max(1, framesDrawn);
  /** @type {Record<string, number>} */
  const perFrame = {};
  for (const key of RUNTIME_COUNTERS) {
    if (typeof after[key] === 'number' && typeof before[key] === 'number') perFrame[key] = round1((after[key] - before[key]) / frames);
  }
  /** @type {Record<string, number>} */
  const atEnd = {};
  for (const key of RUNTIME_GAUGES) if (typeof after[key] === 'number') atEnd[key] = after[key];
  return { perFrame, atEnd };
}

/**
 * Where the camera stands, in world cells, from the four corners of its view, and how far that is from the cell it
 * was asked for. The camera keeps the reach of the map the page booted on (plan 150, M1's review 1), so a save of a
 * larger map can leave it short of the cell: the row says where it stood rather than where it was sent.
 */
export function cameraStanding(camera, focus) {
  const corners = camera?.viewCorners;
  if (!Array.isArray(corners) || corners.length === 0) return { centre: null, offFocusCells: null };
  const centre = {
    x: round1(corners.reduce((sum, corner) => sum + corner.cellX, 0) / corners.length),
    y: round1(corners.reduce((sum, corner) => sum + corner.cellY, 0) / corners.length),
  };
  const offFocusCells = focus ? round1(Math.hypot(centre.x - focus.x, centre.y - focus.y)) : null;
  return { centre, offFocusCells };
}

/** One reading of every logical CPU's idle and total time, for `busyCpus`. */
export function cpuTimes(cpus) {
  return cpus.map((cpu) => ({ idle: cpu.times.idle, total: Object.values(cpu.times).reduce((sum, value) => sum + value, 0) }));
}

/**
 * How many of the machine's logical CPUs were busy between two readings, this measurement's own browser included
 * (as the retained probe's sampler counted it), so numbers taken under different load can be told apart.
 */
export function busyCpus(before, after) {
  let busy = 0;
  after.forEach((cpu, index) => {
    const total = cpu.total - before[index].total;
    busy += total > 0 ? 1 - (cpu.idle - before[index].idle) / total : 0;
  });
  return { busy: round1(busy), of: after.length };
}
