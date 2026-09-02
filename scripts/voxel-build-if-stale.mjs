// Rebuild the linked sibling `../voxel` only when its sources are newer than
// its dist. Every gate here (`predev`, `prebuild`, `pretypecheck`, `pretest`,
// `prelint`) ran `npm --prefix ../voxel run build` unconditionally, so two
// gate runs on one machine — two agents, or an agent and a play session —
// rebuilt the same unchanged package under each other. Measured 2026-09-02:
// a live match on the dev server went black mid-play ("Failed to load url
// .../voxel/dist/three/index.js — does the file exist?"), and a merge's
// `npm test` lost three rendering files to "Cannot find package 'voxel/core'"
// while a sibling's gate was mid-rebuild. The sibling's sources change only
// when someone edits that repo; rebuilding it on every gate bought nothing.
//
// Stale means: any file under ../voxel/src, or its package.json / tsconfig*,
// is newer than the newest file under ../voxel/dist, or dist is missing.
// FORCE_VOXEL_BUILD=1 rebuilds regardless.

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const voxelRoot = resolve(process.cwd(), '..', 'voxel');
const src = join(voxelRoot, 'src');
const dist = join(voxelRoot, 'dist');

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
      const mtime = statSync(full).mtimeMs;
      if (mtime > newest) newest = mtime;
    }
  }
  return newest;
}

function build(reason) {
  console.log(`[voxel:build] building ../voxel — ${reason}`);
  const result = spawnSync('npm', ['--prefix', voxelRoot, 'run', 'build'], { stdio: 'inherit', shell: true });
  process.exit(result.status ?? 1);
}

if (process.env.FORCE_VOXEL_BUILD === '1') build('FORCE_VOXEL_BUILD=1');
if (!existsSync(dist)) build('dist is missing');

const srcNewest = Math.max(
  newestMtime(src),
  ...['package.json', 'tsconfig.json', 'tsconfig.build.json']
    .map((name) => join(voxelRoot, name))
    .filter((path) => existsSync(path))
    .map((path) => statSync(path).mtimeMs),
);
const distNewest = newestMtime(dist);

if (srcNewest > distNewest) build(`sources are newer than dist by ${Math.round((srcNewest - distNewest) / 1000)}s`);
console.log('[voxel:build] ../voxel/dist is up to date — skipping rebuild');
