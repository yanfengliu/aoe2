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

  it('claim exactly the functions that root them: one each, or the number a phase says', () => {
    // One root moving would leave a phase's others matching, and its time folding into its caller's row; a pattern
    // loose enough to match one function more would fold that function's callers into the phase. So every phase
    // that names a line is held to an exact count, and the phases with several roots are listed here with theirs,
    // where a change to one shows (review round 2 of work 150 M2b rank 1, F5: two phases with several roots said
    // no count, and one pattern also matched a line of an interface).
    const several: Record<string, number> = {};
    for (const phase of FRAME_PHASES) {
      if (phase.roots !== undefined) several[phase.key] = phase.roots;
    }
    expect(several).toEqual({
      'tick.engine-diff': 4, 'tick.projection': 3, ground: 2, 'snapshot.terrain': 2, 'snapshot.hit': 2, ingest: 2, 'renderer-frame': 2,
    });
    expect(FRAME_PHASES.filter((phase) => phase.text === undefined).map((phase) => phase.key), 'the phases that are whole files').toEqual(['json', 'recording']);
    for (const phase of FRAME_PHASES) {
      if (phase.text === undefined) continue;
      expect(claimedLines(phase), `the lines "${phase.key}" claims`).toHaveLength(several[phase.key] ?? 1);
    }
  });
});
