// Rebuild the linked voxel package only when its sources are newer than its
// dist — and never concurrently with another builder.
//
// WHICH voxel: the directory this checkout's `node_modules/voxel` links to,
// found from this script's own location, never from the working directory.
// It used to be `resolve(process.cwd(), '..', 'voxel')`, which is right only
// in the main checkout. A worktree lives at `../aoe2-worktrees/<name>`, where
// `../voxel` does not exist, so every script whose first step is voxel:build
// (test, typecheck, lint, build, dev) exited 127 there (measured 2026-09-22,
// fixed 2026-09-24). `node_modules/voxel` is what tsc, vitest and vite import
// — in the main checkout, in a worktree (whose node_modules is a junction to
// the main one) and on CI (where `npm ci` links it to ../voxel) — so it is the
// only copy worth checking. `--print-root` prints it and builds nothing.
// tests/scripts/voxelBuildIfStale.test.ts holds this.
//
// Every gate here (`predev`, `prebuild`, `pretypecheck`, `pretest`,
// `prelint`) ran `npm --prefix ../voxel run build` unconditionally, and the
// sibling's own `prebuild` DELETES its dist before `tsc` recreates it. So two
// gate runs on one machine — two agents, an agent and a merge, an agent and a
// play session — each deleted and rewrote the same unchanged package under
// the other. Measured 2026-09-02: a live match went black mid-play, one
// merge's `npm test` lost three rendering files to "Cannot find package
// 'voxel/core'", a second merge's browser pre-build died in Rollup on an
// invalid resolved id, and a rendering agent's build failed on "Could not
// resolve ./ThreeRenderRuntime.js" — every one a dist mid-rewrite.
//
// Two rules. (1) Stale means any file under voxel's src/, or its
// package.json / tsconfig*, is newer than the newest file under
// its dist/, or dist is missing. (2) One builder at a time: a lock file in
// the OS temp dir, keyed by the sibling's absolute path, held for the build.
// A caller that finds the lock held WAITS for it, then re-checks freshness —
// which is now satisfied by the build it waited for — and skips. A lock
// older than 10 minutes is treated as abandoned. FORCE_VOXEL_BUILD=1 forces
// a build (still under the lock).

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, existsSync, openSync, closeSync, unlinkSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const voxelLink = join(repoRoot, 'node_modules', 'voxel');
if (!existsSync(join(voxelLink, 'package.json'))) {
  console.error(`[voxel:build] FAILED: no voxel package at ${voxelLink}.`
    + ' This checkout imports voxel through that link, and without it this script cannot tell which'
    + ' voxel to check or build, so it stops (exit 1). In the main checkout, run `npm install`'
    + ' (package.json links voxel from ../voxel). A new worktree gets the link from'
    + ' `node scripts/controlWorktree.mjs create <name>`; an existing worktree with no node_modules needs a'
    + ' junction named node_modules pointing at the main checkout\'s node_modules.');
  process.exit(1);
}
const voxelRoot = realpathSync(voxelLink);
if (process.argv.includes('--print-root')) { console.log(voxelRoot); process.exit(0); }
const src = join(voxelRoot, 'src');
const dist = join(voxelRoot, 'dist');
const lockPath = join(tmpdir(), `voxel-build-${createHash('sha1').update(voxelRoot.toLowerCase()).digest('hex').slice(0, 12)}.lock`);
const LOCK_STALE_MS = 10 * 60 * 1000;
const WAIT_POLL_MS = 500;
const WAIT_MAX_MS = 15 * 60 * 1000;

function newestMtime(dir) {
  let newest = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try { entries = readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') stack.push(full); continue; }
      let mtime = 0;
      try { mtime = statSync(full).mtimeMs; } catch { continue; }
      if (mtime > newest) newest = mtime;
    }
  }
  return newest;
}

function isStale() {
  if (!existsSync(dist)) return 'dist is missing';
  const srcNewest = Math.max(
    newestMtime(src),
    ...['package.json', 'tsconfig.json', 'tsconfig.build.json']
      .map((name) => join(voxelRoot, name))
      .filter((path) => existsSync(path))
      .map((path) => statSync(path).mtimeMs),
  );
  const distNewest = newestMtime(dist);
  if (distNewest === 0) return 'dist is empty';
  if (srcNewest > distNewest) return `sources are newer than dist by ${Math.round((srcNewest - distNewest) / 1000)}s`;
  return null;
}

function tryLock() {
  try {
    const fd = openSync(lockPath, 'wx');
    writeFileSync(fd, `${process.pid} ${new Date().toISOString()}\n`);
    closeSync(fd);
    return true;
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
          console.log('[voxel:build] removing an abandoned build lock');
          unlinkSync(lockPath);
          return tryLock();
        }
      } catch { /* raced with the holder releasing it */ }
      return false;
    }
    throw error;
  }
}

function sleep(ms) { const end = Date.now() + ms; while (Date.now() < end) { /* spin: sync script, sub-second */ } }

function waitForOtherBuilder() {
  const start = Date.now();
  process.stdout.write('[voxel:build] another build holds the lock — waiting');
  while (existsSync(lockPath)) {
    if (Date.now() - start > WAIT_MAX_MS) { console.log('\n[voxel:build] waited 15 minutes; giving up on the lock'); return; }
    sleep(WAIT_POLL_MS);
  }
  console.log(` (${Math.round((Date.now() - start) / 1000)}s)`);
}

function build(reason) {
  console.log(`[voxel:build] building ${voxelRoot} — ${reason}`);
  const result = spawnSync('npm', ['--prefix', voxelRoot, 'run', 'build'], { stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

const force = process.env.FORCE_VOXEL_BUILD === '1';
let reason = force ? 'FORCE_VOXEL_BUILD=1' : isStale();
if (!reason) { console.log(`[voxel:build] ${dist} is up to date — skipping rebuild`); process.exit(0); }

if (!tryLock()) {
  waitForOtherBuilder();
  reason = force ? 'FORCE_VOXEL_BUILD=1' : isStale();
  if (!reason) { console.log('[voxel:build] the build we waited for made dist current — skipping'); process.exit(0); }
  if (!tryLock()) { console.log('[voxel:build] lock still held; building anyway to avoid a deadlock'); process.exit(build(reason)); }
}
let status = 1;
try { status = build(reason); } finally { try { unlinkSync(lockPath); } catch { /* already gone */ } }
process.exit(status);
