// `scripts/voxel-build-if-stale.mjs` runs first in test, typecheck, lint, build and dev. It must find voxel through
// THIS checkout's `node_modules/voxel`, from its own location, and never through `../voxel` from the working directory.
// The working-directory form is right only in the main checkout: in a worktree at `../aoe2-worktrees/<name>` there is
// no `../voxel`, and every one of those npm scripts exited 127 (measured 2026-09-22, register 2026-09-24).
//
// The sandbox has the worktree's real shape: the script sits in a checkout whose `node_modules` is a junction to
// another checkout's `node_modules`, which holds a `voxel` junction to a package somewhere else again. The script runs
// from a directory that has a DECOY `../voxel` beside it, so the working-directory form does not merely fail, it
// answers with the wrong package, and the test tells the two apart by path.
//
// BOUND. `--print-root` stops after resolving, so these tests prove WHICH package the script would check and build,
// not that the staleness check or the build lock behave. The last case reads this checkout's own link and so needs
// `npm install` to have run, which every test run already needs. The sandbox junctions are real junctions on Windows
// and directory symlinks elsewhere; a checkout whose node_modules is a copy rather than a link is not exercised.

import { spawnSync } from 'node:child_process';
import {
  copyFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmdirSync, rmSync, symlinkSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../scripts/voxel-build-if-stale.mjs', import.meta.url));
const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const sandboxes: string[] = [];

function link(target: string, path: string) {
  symlinkSync(target, path, 'junction');
}

function pkg(dir: string, name: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name }));
}

// Remove every link under root one at a time, never descending one, and only then delete the rest recursively.
function cleanup(root: string) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (lstatSync(full).isSymbolicLink()) {
        try { unlinkSync(full); } catch { rmdirSync(full); }
      } else if (entry.isDirectory()) {
        stack.push(full);
      }
    }
  }
  rmSync(root, { recursive: true, force: true });
}

afterEach(() => {
  while (sandboxes.length) cleanup(sandboxes.pop()!);
});

function sandbox(withLink: boolean) {
  const root = mkdtempSync(join(tmpdir(), 'voxel-root-'));
  sandboxes.push(root);
  const realVoxel = join(root, 'packages', 'voxel');
  pkg(realVoxel, 'voxel');
  const mainModules = join(root, 'main', 'node_modules');
  mkdirSync(mainModules, { recursive: true });
  if (withLink) link(realVoxel, join(mainModules, 'voxel'));
  const worktree = join(root, 'worktrees', 'gate');
  mkdirSync(join(worktree, 'scripts'), { recursive: true });
  copyFileSync(SCRIPT, join(worktree, 'scripts', 'voxel-build-if-stale.mjs'));
  link(mainModules, join(worktree, 'node_modules'));
  // A wrong voxel exactly where the working-directory form would look.
  const cwd = join(root, 'elsewhere', 'cwd');
  mkdirSync(cwd, { recursive: true });
  pkg(join(root, 'elsewhere', 'voxel'), 'decoy');
  return { script: join(worktree, 'scripts', 'voxel-build-if-stale.mjs'), realVoxel, cwd, link: join(worktree, 'node_modules', 'voxel') };
}

function run(script: string, cwd: string) {
  const r = spawnSync(process.execPath, [script, '--print-root'], { cwd, encoding: 'utf8' });
  return { status: r.status, out: r.stdout.trim(), err: r.stderr };
}

describe('voxel-build-if-stale finds voxel through node_modules, not the working directory', () => {
  it('in a worktree-shaped checkout, resolves the package node_modules/voxel links to', () => {
    const box = sandbox(true);
    const r = run(box.script, box.cwd);
    expect(r.err).toBe('');
    expect(r.status).toBe(0);
    expect(r.out.toLowerCase()).toBe(realpathSync(box.realVoxel).toLowerCase());
  });

  it('with no node_modules/voxel, fails naming the path it looked at and how to get one', () => {
    const box = sandbox(false);
    const r = run(box.script, box.cwd);
    expect(r.status).toBe(1);
    expect(r.out).toBe('');
    expect(r.err).toContain(box.link);
    expect(r.err).toContain('controlWorktree.mjs create');
  });

  it('in this checkout, from an unrelated directory, resolves the package this checkout imports', () => {
    const r = run(SCRIPT, tmpdir());
    expect(r.status).toBe(0);
    expect(r.out.toLowerCase()).toBe(realpathSync(join(REPO, 'node_modules', 'voxel')).toLowerCase());
  });
});
