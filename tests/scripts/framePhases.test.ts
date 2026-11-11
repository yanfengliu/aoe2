// scripts/framePhases.mjs names the phases a frame's main-thread time is folded into, each by the file its root
// function is written in and a pattern on the line that function starts on. A renamed or moved function matches
// nothing, and its time then folds silently into whatever phase encloses it: the table would still add up, and say
// the wrong thing. So every phase must still find its line in the sources the build is made from: this repo's
// `src/`, and the installed civ-engine and voxel packages.
//
// BOUND. The pattern is checked against the source, not against a profile: that V8 reports a function at the line
// its declaration starts on, and that the build's source map leads back to it, was seen on real profiles (plan 150,
// "M2b measurement"), where every phase below held samples.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { phaseClaims } from '../../scripts/cpuProfileFold.mjs';
import { FRAME_PHASES, FRAME_ROOT, OTHER_TASKS, TICK_ROOT } from '../../scripts/framePhases.mjs';

const REPO = fileURLToPath(new URL('../..', import.meta.url));

/** Every source file a phase may name, as the build's source map names it. */
function sourceFiles(): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (directory: string, name: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path, `${name}/${entry.name}`);
      else if (/\.(ts|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.set(`${name}/${entry.name}`, path);
    }
  };
  walk(join(REPO, 'src'), 'src');
  for (const dependency of ['civ-engine', 'voxel']) {
    const dist = join(REPO, 'node_modules', dependency, 'dist');
    if (existsSync(dist)) walk(dist, `${dependency}/dist`);
  }
  return files;
}

const FILES = sourceFiles();

/** The lines of the phase's files that its pattern claims, as `file:line`. */
function claimedLines(phase: (typeof FRAME_PHASES)[number]): string[] {
  const found: string[] = [];
  for (const [name, path] of FILES) {
    if (!phase.file.test(name)) continue;
    if (!('text' in phase) || phase.text === undefined) {
      found.push(name);
      continue;
    }
    readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
      if (phaseClaims(phase, { name: '', file: name, line: index + 1, text: line.trim() })) found.push(`${name}:${String(index + 1)}`);
    });
  }
  return found;
}

describe('the frame\'s phases', () => {
  it('reads the installed civ-engine and voxel, which the table names code in', () => {
    expect([...FILES.keys()].some((name) => name.startsWith('civ-engine/dist/'))).toBe(true);
    expect([...FILES.keys()].some((name) => name.startsWith('voxel/dist/three/'))).toBe(true);
  });

  it('have distinct keys, and the roots the fold needs are among them', () => {
    const keys = FRAME_PHASES.map((phase) => phase.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of [FRAME_ROOT, TICK_ROOT, ...OTHER_TASKS]) expect(keys).toContain(key);
  });

  for (const phase of FRAME_PHASES) {
    it(`"${phase.key}" still finds the function that roots it`, () => {
      expect(claimedLines(phase), `lines matching ${String(phase.file)} ${'text' in phase ? String(phase.text) : ''}`).not.toEqual([]);
    });
  }

  it('name one function each where the phase is a single root', () => {
    // A pattern loose enough to match a second function would fold that function's callers into the phase.
    const single = ['frame', 'tick', 'step', 'tick.ai', 'render-state', 'coordinator', 'present', 'snapshot',
      'snapshot.prepare', 'snapshot.lanes', 'snapshot.lanes.shadow', 'snapshot.lanes.memory', 'delta', 'writes', 'draw', 'hud', 'hud.minimap'];
    for (const key of single) {
      const phase = FRAME_PHASES.find((entry) => entry.key === key)!;
      expect(claimedLines(phase), `the lines "${key}" claims`).toHaveLength(1);
    }
  });
});
