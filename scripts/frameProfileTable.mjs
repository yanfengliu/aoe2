// A recorded CPU profile of a build as the frame's phases, and that split as text: what scripts/saveFrameRate.mjs
// --profile prints and what scripts/foldFrameProfile.mjs prints again from a profile on disk.
//
// THE TABLE. One row a phase (framePhases.mjs), a sample counted to the innermost phase on its stack, so the rows
// add up to the profiled time. "share" is of that time; "ms/frame" is the share of the mean interval between the
// frames the page drew; "tick frame" and "between" are the phase's time in a frame that ran a simulation tick and in
// one that did not (cpuProfileFold.mjs says how a frame is told from the samples). A frame's cost at a given frame
// rate is then the between-ticks cost, plus the tick frame's extra as often as a tick falls in a frame.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { foldCpuProfile, frameResolver, sourceLookup } from './cpuProfileFold.mjs';
import { FRAME_PHASES, FRAME_ROOT, FRAME_SLOT, OTHER_TASKS, TICK_ROOT } from './framePhases.mjs';

/** A resolver of call frames through the source maps in `tree`'s build; a script with no map keeps its own names. */
export function buildFrameResolver(tree) {
  const lookups = new Map();
  let unmapped = 0;
  const resolveFrame = frameResolver((url) => {
    const asset = /\/(assets\/[\w.-]+\.js)$/.exec(url)?.[1];
    if (!asset) return null;
    if (!lookups.has(asset)) {
      const mapPath = join(tree, 'dist', `${asset}.map`);
      lookups.set(asset, existsSync(mapPath) ? sourceLookup(JSON.parse(readFileSync(mapPath, 'utf8'))) : null);
      if (lookups.get(asset) === null) unmapped += 1;
    }
    return lookups.get(asset);
  });
  return { resolveFrame, unmappedScripts: () => unmapped };
}

/** The profile's time by phase and by kind of frame, and whether the build's code could be named. */
export function foldProfileOfBuild(profile, tree, phases = FRAME_PHASES) {
  const { resolveFrame, unmappedScripts } = buildFrameResolver(tree);
  const fold = foldCpuProfile(profile, phases, resolveFrame, { frame: FRAME_ROOT, tick: TICK_ROOT, otherTasks: OTHER_TASKS, slot: FRAME_SLOT });
  return { ...fold, unmappedScripts: unmappedScripts(), phases };
}

const pad = (text, width) => String(text).padEnd(width);
const padLeft = (text, width) => String(text).padStart(width);

/**
 * The split as text. `row` is the measurement's row (saveFrameRate.mjs writes it beside the profile); its frames
 * turn a share into milliseconds of a frame, and its drawn frames check the frames the fold found.
 */
export function formatPhaseTable(fold, row) {
  const meanFrameMs = row?.frames > 1 ? (row.wallSeconds * 1000) / row.frames : null;
  const lines = [];
  if (fold.unmappedScripts > 0) {
    lines.push('WARNING: the build has no source maps (dist/assets/*.js.map), so minified code could not be named and '
      + 'most of the page falls to "unclaimed". Build with `npm run build -- --sourcemap` and measure again.');
  }
  lines.push(`profiled ${fold.totalMs.toFixed(0)} ms in ${String(fold.samples)} samples`
    + (meanFrameMs === null ? '' : `; mean frame ${meanFrameMs.toFixed(1)} ms over ${String(row.frames)} frames`));
  const kinds = fold.frames;
  if (kinds) {
    const each = (kind) => (kind.frames > 0 ? `${(kind.ms / kind.frames).toFixed(1)} ms each` : 'none');
    lines.push(`world frames found in the samples: ${String(kinds.tick.frames)} with a tick (${each(kinds.tick)}), `
      + `${String(kinds.between.frames)} between ticks (${each(kinds.between)})`
      + (row ? `; the page drew ${String(row.framesDrawn)}` : ''));
  }
  lines.push(`${pad('phase', 46)}${padLeft('share', 7)}${padLeft('ms/frame', 10)}${padLeft('tick frame', 12)}${padLeft('between', 9)}${padLeft('samples', 9)}`);
  const labels = new Map(fold.phases.map((phase) => [phase.key, phase.label ?? phase.key]));
  const order = new Map(fold.phases.map((phase, index) => [phase.key, index]));
  const perFrame = (kind, key) => {
    if (!kind || kind.frames === 0) return '';
    const ms = kind.rows.find((entry) => entry.key === key)?.ms;
    return ms === undefined ? '' : (ms / kind.frames).toFixed(2);
  };
  const rows = [...fold.rows].sort((a, b) => (order.get(a.key) ?? 1e6) - (order.get(b.key) ?? 1e6) || b.ms - a.ms);
  for (const entry of rows) {
    if (entry.samples === 0) continue;
    const share = fold.totalMs > 0 ? entry.ms / fold.totalMs : 0;
    lines.push(`${pad(labels.get(entry.key) ?? entry.key, 46)}${padLeft(`${(share * 100).toFixed(1)}%`, 7)}`
      + `${padLeft(meanFrameMs === null ? '' : (share * meanFrameMs).toFixed(2), 10)}`
      + `${padLeft(perFrame(kinds?.tick, entry.key), 12)}${padLeft(perFrame(kinds?.between, entry.key), 9)}${padLeft(entry.samples, 9)}`);
  }
  if (fold.unclaimed.length > 0) {
    lines.push('unclaimed, by the task it ran in:');
    for (const entry of fold.unclaimed.slice(0, 8)) {
      lines.push(`  ${(entry.ms / fold.totalMs * 100).toFixed(1).padStart(5)}%  ${entry.name || '(anonymous)'} ${entry.file}:${String(entry.line)}`);
    }
  }
  return lines.join('\n');
}
