// Folds a Chrome CPU profile (CDP Profiler.stop, or a .cpuprofile file) of the built game into named phases, for
// scripts/saveFrameRate.mjs --profile: where the main thread's time goes while a loaded save draws.
//
// WHY A SOURCE MAP. The page under measurement is the production build, whose bundle is minified: a closure such as
// the presentation's `syncFromBridge` is called `f` there, and three classes each have a method called `frame`. So
// a call frame is named by where it was WRITTEN: its position in the bundle is looked up in the bundle's source map
// (`vite build --sourcemap`), which gives the original file and line, and the text of that line. A phase is then a
// file and a pattern on that line, which reads the same for a minified build and an unminified one.
//
// HOW A SAMPLE IS COUNTED. The profile is a call tree, and each sample names the node that was running and lasts
// until the next sample. A sample belongs to the INNERMOST phase on its own stack (the running function first, then
// its callers), so the phases partition the profiled time and their rows add up to it: time in `createSnapshot`
// called from `syncFromBridge` is counted to `createSnapshot`'s phase and not also to its caller's. A sample no
// phase claims goes to V8's own name for it when it has one ("(idle)", "(program)", "(garbage collector)"), and
// otherwise to "unclaimed".
//
// FRAMES OF TWO KINDS. A frame that ran a simulation tick pays for the tick and for everything the tick changed; a
// frame between ticks pays only for what moves between them. The mean over a window mixes the two by the frame rate
// (a slow page runs a tick in every frame), so the fold also splits them: a frame is a run of samples under the
// frame's root phase, and it is a tick frame when any of its samples is under the tick's phase. A call tree does
// not say where one call of a function ends and the next begins, so the page says it: saveFrameRate.mjs runs each
// animation frame's callbacks through one of two functions, in turn, and a run ends where that function's name
// changes. It also ends at a sample of another task: "(idle)", or a phase the table marks as a task of its own (the
// HUD's update). Any other sample from outside the root stays in the open run, because it is the frame itself seen
// badly: the garbage collector or "(program)" interrupting it, or a stack V8 could not walk back to the root (a
// comparator called by Array.prototype.sort shows as a root of its own).
//
// BOUND. A sampling profile: a phase's time is the samples that landed in it, so a phase of a few samples is noise
// (the row carries its sample count). The garbage collector is a root of its own in V8's tree, so the cost of what
// a phase allocates is in the "(garbage collector)" row, not in the phase. In a profile recorded without the two
// alternating functions, two frames with no sample of another task between them count as one; either way the
// fold's frame count is there to be checked against the frames the page drew. Only the page's main thread is
// profiled: the GPU process and workers are not in it.

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUE = new Map([...BASE64].map((char, index) => [char, index]));

/**
 * Decodes a source map's `mappings` into, per generated line, its segments in generated-column order.
 * @param {string} mappings
 * @returns {Array<Array<[number, number, number, number]>>} per line: [generatedColumn, source, line, column], all
 *   0-based; a source of -1 marks generated code that no source produced
 */
export function decodeMappings(mappings) {
  const lines = [];
  let source = 0;
  let line = 0;
  let column = 0;
  for (const generatedLine of mappings.split(';')) {
    const segments = [];
    let generatedColumn = 0;
    for (const segment of generatedLine === '' ? [] : generatedLine.split(',')) {
      const fields = [];
      let value = 0;
      let shift = 0;
      for (const char of segment) {
        const digit = BASE64_VALUE.get(char);
        if (digit === undefined) throw new Error(`Source map mappings hold "${char}", which is not base64.`);
        value += (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
          continue;
        }
        fields.push(value & 1 ? -(value >> 1) : value >> 1);
        value = 0;
        shift = 0;
      }
      generatedColumn += fields[0];
      if (fields.length < 4) {
        segments.push([generatedColumn, -1, 0, 0]);
        continue;
      }
      source += fields[1];
      line += fields[2];
      column += fields[3];
      segments.push([generatedColumn, source, line, column]);
    }
    lines.push(segments);
  }
  return lines;
}

/** `../../src/app/x.ts` reads `src/app/x.ts`, a sibling package `voxel/dist/...`, and an installed one its package path. */
export function tidySourcePath(path) {
  const forward = path.replaceAll('\\', '/');
  const modules = forward.lastIndexOf('/node_modules/');
  if (modules !== -1) return forward.slice(modules + '/node_modules/'.length);
  return forward.replace(/^(\.\.?\/)+/, '');
}

/**
 * A lookup from a position in a bundle to where that code was written.
 * @param {{ sources: string[], sourcesContent?: (string | null)[], mappings: string }} map a parsed source map
 * @returns {(line: number, column: number) => { file: string, line: number, text: string } | null} both 0-based in,
 *   `line` 1-based out
 */
export function sourceLookup(map) {
  const lines = decodeMappings(map.mappings);
  const files = map.sources.map(tidySourcePath);
  const texts = new Map();
  const lineText = (source, line) => {
    if (!texts.has(source)) texts.set(source, (map.sourcesContent?.[source] ?? '').split('\n'));
    return (texts.get(source)[line] ?? '').trim();
  };
  return (generatedLine, generatedColumn) => {
    const segments = lines[generatedLine];
    if (!segments || segments.length === 0) return null;
    let low = 0;
    let high = segments.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (segments[middle][0] <= generatedColumn) low = middle;
      else high = middle - 1;
    }
    const [column, source, line] = segments[low];
    if (column > generatedColumn || source === -1) return null;
    return { file: files[source], line: line + 1, text: lineText(source, line) };
  };
}

/**
 * Where each of a profile's call frames was written.
 * @param {(url: string) => ((line: number, column: number) => { file: string, line: number, text: string } | null) | null} lookupFor
 *   the lookup for a script's URL, or null when that script has no source map
 * @returns {(callFrame: { functionName: string, url: string, lineNumber: number, columnNumber: number }) =>
 *   { name: string, file: string, line: number, text: string }}
 */
export function frameResolver(lookupFor) {
  return (callFrame) => {
    const written = callFrame.url ? lookupFor(callFrame.url)?.(callFrame.lineNumber, callFrame.columnNumber) : null;
    if (written) return { name: callFrame.functionName, ...written };
    return {
      name: callFrame.functionName,
      file: callFrame.url ? callFrame.url.replace(/^https?:\/\/[^/]+\//, '') : '',
      line: callFrame.lineNumber + 1,
      text: '',
    };
  };
}

/** Whether a phase claims a call frame: every field the phase gives must match, and it must give one. */
export function phaseClaims(phase, frame) {
  if (phase.file && !phase.file.test(frame.file)) return false;
  if (phase.text && !phase.text.test(frame.text)) return false;
  if (phase.name && !phase.name.test(frame.name)) return false;
  return Boolean(phase.file || phase.text || phase.name);
}

const V8_OWN = new Set(['(idle)', '(program)', '(garbage collector)']);

/** The call tree as lookups: each node's resolved frame, parent, own phase and the innermost phase on its stack. */
function readTree(profile, phases, resolve) {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const parent = new Map();
  for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id);
  const frames = new Map();
  const frameOf = (id) => {
    if (!frames.has(id)) frames.set(id, resolve(byId.get(id).callFrame));
    return frames.get(id);
  };
  const own = new Map();
  const ownPhase = (id) => {
    if (!own.has(id)) own.set(id, phases.find((phase) => phaseClaims(phase, frameOf(id)))?.key ?? null);
    return own.get(id);
  };
  const innermost = new Map();
  const phaseOnStack = (id) => {
    if (!innermost.has(id)) {
      let found = null;
      for (let at = id; at !== undefined && found === null; at = parent.get(at)) found = ownPhase(at);
      innermost.set(id, found);
    }
    return innermost.get(id);
  };
  const under = new Map();
  /** Whether the node or one of its callers is claimed by the phase `key`. */
  const isUnder = (id, key) => {
    const memo = `${String(id)}|${key}`;
    if (!under.has(memo)) {
      let found = false;
      for (let at = id; at !== undefined && !found; at = parent.get(at)) found = ownPhase(at) === key;
      under.set(memo, found);
    }
    return under.get(memo);
  };
  const slots = new Map();
  /** The name of the nearest function on the node's stack that `pattern` matches, or null. */
  const slotOf = (id, pattern) => {
    if (!slots.has(id)) {
      let found = null;
      for (let at = id; at !== undefined && found === null; at = parent.get(at)) {
        const name = byId.get(at).callFrame.functionName;
        if (pattern.test(name)) found = name;
      }
      slots.set(id, found);
    }
    return slots.get(id);
  };
  return { byId, parent, frameOf, phaseOnStack, isUnder, slotOf };
}

/** Every sample as the node that was running and how long it ran, which is until the next sample. */
function sampleDurations(profile) {
  const durations = [];
  let at = profile.startTime ?? 0;
  const times = profile.samples.map((_, index) => (at += profile.timeDeltas[index] ?? 0));
  for (let index = 0; index < profile.samples.length; index += 1) {
    const until = index + 1 < times.length ? times[index + 1] : Math.max(times[index], profile.endTime ?? times[index]);
    durations.push(Math.max(0, until - times[index]) / 1000);
  }
  return durations;
}

/**
 * The profiled time by phase, the innermost phase on a stack taking the sample.
 * @param {{ nodes: any[], samples: number[], timeDeltas: number[], startTime?: number, endTime?: number }} profile
 * @param {Array<{ key: string, file?: RegExp, text?: RegExp, name?: RegExp }>} phases
 * @param {(callFrame: any) => { name: string, file: string, line: number, text: string }} resolve
 * @param {{ frame: string, tick: string, otherTasks: readonly string[], slot?: RegExp } | null} kinds the keys of
 *   the phase that roots a frame, of the phase that is a simulation tick, and of the phases that are tasks of their
 *   own, and the pattern naming the functions the page alternates between frames; given, the result also splits the
 *   frames by whether a tick ran in them
 */
export function foldCpuProfile(profile, phases, resolve, kinds = null) {
  const tree = readTree(profile, phases, resolve);
  const durations = sampleDurations(profile);
  const rows = new Map(phases.map((phase) => [phase.key, { key: phase.key, ms: 0, samples: 0 }]));
  const unclaimed = new Map();
  const add = (map, key, ms) => {
    const row = map.get(key) ?? { key, ms: 0, samples: 0 };
    row.ms += ms;
    row.samples += 1;
    map.set(key, row);
  };
  const frames = { tick: { frames: 0, ms: 0, rows: new Map() }, between: { frames: 0, ms: 0, rows: new Map() } };
  let run = null;
  let interrupted = [];
  const closeRun = () => {
    if (run === null) return;
    const kind = frames[run.hasTick ? 'tick' : 'between'];
    kind.frames += 1;
    for (const [key, ms] of run.samples) {
      kind.ms += ms;
      add(kind.rows, key, ms);
    }
    run = null;
    interrupted = [];
  };

  let totalMs = 0;
  let counted = 0;
  profile.samples.forEach((id, index) => {
    if (!tree.byId.has(id)) return;
    const ms = durations[index];
    totalMs += ms;
    counted += 1;
    const frame = tree.frameOf(id);
    let key = tree.phaseOnStack(id);
    if (key === null && V8_OWN.has(frame.name)) key = frame.name;
    if (key === null) {
      key = 'unclaimed';
      // Named by the outermost frame under the root that has a file, which says what task the time belongs to.
      const stack = [];
      for (let at = id; at !== undefined; at = tree.parent.get(at)) stack.push(tree.frameOf(at));
      const top = stack.reverse().find((entry) => entry.file !== '') ?? frame;
      const label = `${top.name || '(anonymous)'} ${top.file}:${String(top.line)}`;
      const entry = unclaimed.get(label) ?? { ...top, ms: 0 };
      entry.ms += ms;
      unclaimed.set(label, entry);
    }
    add(rows, key, ms);

    if (kinds === null) return;
    if (tree.isUnder(id, kinds.frame)) {
      const slot = kinds.slot ? tree.slotOf(id, kinds.slot) : null;
      if (run !== null && run.slot !== slot) closeRun();
      run ??= { hasTick: false, slot, samples: [] };
      run.samples.push(...interrupted, [key, ms]);
      interrupted = [];
      if (tree.isUnder(id, kinds.tick)) run.hasTick = true;
    } else if (frame.name === '(idle)' || kinds.otherTasks.some((task) => tree.isUnder(id, task))) {
      closeRun();
    } else if (run !== null) {
      interrupted.push([key, ms]);
    }
  });
  closeRun();

  const listed = (map) => [...map.values()];
  return {
    totalMs,
    samples: counted,
    rows: listed(rows),
    unclaimed: [...unclaimed.values()].sort((a, b) => b.ms - a.ms),
    frames: kinds === null ? null : {
      tick: { frames: frames.tick.frames, ms: frames.tick.ms, rows: listed(frames.tick.rows) },
      between: { frames: frames.between.frames, ms: frames.between.ms, rows: listed(frames.between.rows) },
    },
  };
}

/**
 * The functions holding the most self time, and the most time with their callees, each named by where it was
 * written. For finding what a phase table should name; a recursive function's inclusive time counts each stack once.
 */
export function heaviestFunctions(profile, resolve, count = 40) {
  const tree = readTree(profile, [], resolve);
  const durations = sampleDurations(profile);
  const labels = new Map();
  const labelOf = (id) => {
    if (!labels.has(id)) {
      const frame = tree.frameOf(id);
      labels.set(id, `${frame.name || '(anonymous)'} ${frame.file}:${String(frame.line)}${frame.text ? ` | ${frame.text.slice(0, 90)}` : ''}`);
    }
    return labels.get(id);
  };
  const self = new Map();
  const inclusive = new Map();
  let totalMs = 0;
  profile.samples.forEach((id, index) => {
    if (!tree.byId.has(id)) return;
    const ms = durations[index];
    totalMs += ms;
    self.set(labelOf(id), (self.get(labelOf(id)) ?? 0) + ms);
    const seen = new Set();
    for (let at = id; at !== undefined; at = tree.parent.get(at)) {
      const label = labelOf(at);
      if (seen.has(label)) continue;
      seen.add(label);
      inclusive.set(label, (inclusive.get(label) ?? 0) + ms);
    }
  });
  const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, count)
    .map(([label, ms]) => ({ label, ms, share: totalMs > 0 ? ms / totalMs : 0 }));
  return { totalMs, self: top(self), inclusive: top(inclusive) };
}
