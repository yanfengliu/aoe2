#!/usr/bin/env node
// The one sanctioned way to create or remove a git worktree of this repo on this machine.
//
//   node scripts/controlWorktree.mjs create <name> [<base>] [--dry-run]
//   node scripts/controlWorktree.mjs remove <name-or-path> [--dry-run] [--discard-changes]
//   node scripts/controlWorktree.mjs delete-branch <branch> [--dry-run]
//
// create         `git worktree add -b <name>` from <base> (default main) at <parent>/<repo>-worktrees/<name>, beside
//                the main checkout. Then a JUNCTION <worktree>/node_modules -> <main checkout>/node_modules. Prints
//                the path and the branch.
// remove         Refuses, before touching anything: a worktree whose HEAD is not contained in main (naming its
//                branch), a locked one, one that holds another worktree, one whose admin directory holds a link, and
//                one holding changes that exist nowhere else (modified, staged or untracked files) unless
//                --discard-changes says to lose them. Then it
//                removes every reparse point inside the tree one at a time, never recursing, re-scans, and refuses if
//                any remain. Only then does it run `git worktree remove`. Afterwards it checks that every former link
//                target lost nothing, and deletes the worktree's branch if its tip is contained in main.
// delete-branch  Deletes a branch that no worktree holds, only if its tip is contained in main.
// --dry-run      Prints exactly what would be done, and does none of it.
//
// WHY. On 2026-09-03 `git worktree remove --force` on a control worktree followed a `civ-engine` junction inside it
// and emptied ../civ-engine/.git down to refs/ (docs/learning/defect-register-past.md, 2026-09-05). Measured on this
// machine on 2026-09-22 with git 2.42.0.windows.2: the PLAIN form does the same. `git worktree remove` on a CLEAN
// worktree whose node_modules is a junction exits 0 and deletes the files of the junction's target. Git for Windows'
// lstat reports a junction as a directory, so git's recursive delete walks into it. The flag is not the hazard; any
// recursive delete over a junction is. A worktree's node_modules junction leads to aoe2/node_modules, which holds
// junctions to ../civ-engine and ../voxel.
//
// RULES. The script obeys each one. A change that breaks one is a defect, not a tradeoff.
//  1. Never follow a junction. The scan lists each directory with readdir(withFileTypes), lstats each entry, and never
//     descends an entry that either call reports as a link. On Windows readdir reports EVERY reparse point as a link
//     (libuv's fs__scandir tests FILE_ATTRIBUTE_REPARSE_POINT before FILE_ATTRIBUTE_DIRECTORY), not only junctions
//     and symlinks. A directory on another device is refused, never entered.
//  2. Never delete recursively through a path not proven free of reparse points. This script never deletes
//     recursively at all. It removes single links with rmdirSync/unlinkSync, which cannot recurse: on a real directory
//     they fail with ENOTEMPTY or EPERM (measured 2026-09-22). The one recursive delete is git's, over two trees: the
//     worktree and its admin directory <common git dir>/worktrees/<id>. git runs only after a fresh scan of the
//     worktree finds no link, and the admin directory is refused if it holds one.
//  3. Never pass --force to `git worktree remove` unless the plain form failed AND a fresh scan shows no reparse
//     points. The change check must also pass again: every change git reports is a deleted tracked file (whose content
//     the merged tip already holds), or --discard-changes was given.
//  4. Never delete an unmerged branch. A branch goes only by `git update-ref -d refs/heads/<b> <sha>` after
//     `git merge-base --is-ancestor <sha> refs/heads/main`. That delete is atomic, so a branch that moved after the
//     check stays. Plain `git branch -d` is not used: it judges a branch that has an upstream against the upstream,
//     not against main. It would have refused `shadow-silhouette`, whose tip is in main but not in
//     origin/shadow-silhouette; tests/scripts/controlWorktree.test.ts reproduces that refusal in a sandbox.
//
// BOUND. A scan proves the tree free of links at the moment it runs. A process that makes a new junction inside the
// worktree between the last scan and git's delete defeats it; nothing should be writing into a worktree that is being
// removed. The post-removal target check sees only a LOSS of files or directories behind a former link, so a writer
// that deletes its own cache files there (a dev server, a test run) can trip it. The repo is found from the working
// directory; the script refuses to run with GIT_DIR or GIT_WORK_TREE set, because they would point git at another repo
// than the one the paths name.

import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import process from 'node:process';

const MAIN = 'main';
const WIN = process.platform === 'win32';
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const FLAGS = new Set(['--dry-run', '--discard-changes']);
const USAGE = 'usage: node scripts/controlWorktree.mjs create <name> [<base>] [--dry-run]'
  + ' | remove <name-or-path> [--dry-run] [--discard-changes] | delete-branch <branch> [--dry-run]';

class Refusal extends Error {}

function refuse(message) {
  throw new Refusal(message);
}

const say = (line) => process.stdout.write(`${line}\n`);
const firstLine = (text) => String(text ?? '').trim().split(/\r?\n/)[0] || '(no output)';
const short = (sha) => String(sha).slice(0, 12);

function git(args, cwd, { allowFail = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
  if (r.error) refuse(`could not start \`git ${args.join(' ')}\`: ${r.error.message}. Put git on PATH and run again.`);
  if (r.status !== 0 && !allowFail) refuse(`\`git ${args.join(' ')}\` in ${cwd} failed (exit ${r.status}): ${firstLine(r.stderr || r.stdout)}`);
  return { status: r.status, out: r.stdout, err: r.stderr };
}

// ---- paths ------------------------------------------------------------------

function norm(path) {
  const s = resolve(path).replace(/\\/g, '/').replace(/\/+$/, '');
  return WIN ? s.toLowerCase() : s;
}

function present(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function samePath(a, b) {
  if (norm(a) === norm(b)) return true;
  try {
    return norm(realpathSync.native(a)) === norm(realpathSync.native(b));
  } catch {
    return false;
  }
}

const inside = (child, parent) => norm(child).startsWith(`${norm(parent)}/`);

function linkTarget(path) {
  try {
    return resolve(dirname(path), readlinkSync(path));
  } catch (error) {
    return `(unreadable: ${error.code})`;
  }
}

// ---- rule 1: find every link without following one --------------------------

function scan(root) {
  const links = [];
  const foreign = [];
  const stack = [root];
  let rootDevice;
  try {
    rootDevice = lstatSync(root).dev;
    while (stack.length) {
      const dir = stack.pop();
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        const stat = lstatSync(path);
        if (entry.isSymbolicLink() || stat.isSymbolicLink()) links.push({ path, target: linkTarget(path) });
        else if (stat.isDirectory()) (stat.dev === rootDevice ? stack : foreign).push(path);
      }
    }
  } catch (error) {
    refuse(`could not read ${error.path ?? root} (${error.code}) while scanning ${root} for links, so the tree cannot be proven free of them. git was not run.`);
  }
  return { links, foreign };
}

function assertNotLink(root) {
  const entry = readdirSync(dirname(root), { withFileTypes: true })
    .find((e) => (WIN ? e.name.toLowerCase() === basename(root).toLowerCase() : e.name === basename(root)));
  if (lstatSync(root).isSymbolicLink() || entry?.isSymbolicLink()) {
    refuse(`${root} is itself a link to ${linkTarget(root)}. Remove only the link, with \`cmd /c rmdir "${root}"\` (never /s), then run remove again. Nothing was touched.`);
  }
}

// ---- rule 2: remove ONE link, never what it points at -----------------------

// rmdirSync and unlinkSync cannot recurse: on a real directory they answer ENOTEMPTY or EPERM.
function unlinkOne(path) {
  const tried = [];
  for (const op of WIN ? [rmdirSync, unlinkSync] : [unlinkSync, rmdirSync]) {
    try {
      op(path);
      return;
    } catch (error) {
      tried.push(`${op.name} ${error.code}`);
    }
  }
  refuse(`could not remove the link ${path} on its own (${tried.join(', ')}). git was not run. Remove that one link by hand with \`cmd /c rmdir "${path}"\` (never /s), then run remove again.`);
}

function proveNoLinks(root, when) {
  if (!present(root)) return;
  const again = scan(root);
  const first = again.links[0]?.path ?? again.foreign[0];
  if (first) {
    refuse(`a fresh scan of ${root} ${when} still finds ${again.links.length} link(s) and ${again.foreign.length} other-device directory(ies), first ${first}. git was not run, so nothing was deleted through them.`);
  }
  say(`  fresh scan ${when}: no reparse point`);
}

// ---- rule 3: what `--force` would destroy -----------------------------------

// A deleted tracked file loses nothing (the merged tip holds it), and neither does an entry that is a link or sits
// behind one: the link is unlinked, never deleted through. Anything else exists only in this worktree.
function changes(root, links) {
  const fields = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none'], root).out.split('\0');
  const all = [];
  for (let i = 0; i < fields.length; i++) {
    if (!fields[i]) continue;
    const xy = fields[i].slice(0, 2);
    all.push({ xy, path: fields[i].slice(3) });
    if (xy[0] === 'R' || xy[0] === 'C') i++;
  }
  const viaLink = (c) => links.some((l) => norm(join(root, c.path)) === norm(l.path) || inside(join(root, c.path), l.path));
  const linked = all.filter(viaLink);
  const deleted = all.filter((c) => !viaLink(c) && /^[ D]{2}$/.test(c.xy));
  const lossy = all.filter((c) => !viaLink(c) && !/^[ D]{2}$/.test(c.xy));
  return { linked, deleted, lossy, summary: `${deleted.length} deleted tracked file(s), ${lossy.length} other change(s)${linked.length ? `, ${linked.length} entry(ies) that are links or behind one` : ''}` };
}

function refuseLossy(root, lossy) {
  const list = lossy.slice(0, 5).map((c) => `"${c.xy} ${c.path}"`).join(', ');
  refuse(`${root} holds ${lossy.length} change(s) that exist nowhere else, first ${list}. Commit or save them, or pass --discard-changes to lose them. Nothing was deleted.`);
}

// ---- rule 4: branches -------------------------------------------------------

function contained(ctx, sha) {
  const r = git(['merge-base', '--is-ancestor', sha, `refs/heads/${MAIN}`], ctx.main, { allowFail: true });
  if (r.status === 0 || r.status === 1) return r.status === 0;
  return refuse(`\`git merge-base --is-ancestor ${sha} refs/heads/${MAIN}\` failed (exit ${r.status}): ${firstLine(r.err)}. Does ${ctx.main} have a ${MAIN} branch?`);
}

function dropBranch(ctx, branch, expected, { dryRun = false } = {}) {
  if (branch === MAIN) refuse(`refusing to delete ${MAIN} itself`);
  const r = git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], ctx.main, { allowFail: true });
  const sha = r.out.trim();
  if (r.status !== 0 || !sha) refuse(`there is no branch named ${branch} in ${ctx.main}`);
  if (expected && sha !== expected) refuse(`branch ${branch} moved from ${short(expected)} to ${short(sha)} after it was checked, so it was left alone`);
  if (!contained(ctx, sha)) refuse(`branch ${branch} at ${short(sha)} is NOT contained in ${MAIN}, so it was left alone. Merge it first, or delete it by hand if it is truly abandoned.`);
  const holder = worktrees(ctx.main).find((w) => w.branch === branch);
  if (holder) refuse(`branch ${branch} is checked out in ${holder.path}; remove that worktree first`);
  if (dryRun) {
    say(`would delete branch ${branch} (${short(sha)}, contained in ${MAIN})`);
    return;
  }
  git(['update-ref', '-d', `refs/heads/${branch}`, sha], ctx.main);
  const key = `^branch\\.${branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`;
  if (git(['config', '--local', '--get-regexp', key], ctx.main, { allowFail: true }).out.trim()) {
    git(['config', '--local', '--remove-section', `branch.${branch}`], ctx.main);
  }
  say(`  branch ${branch} deleted (was ${short(sha)}, contained in ${MAIN})`);
}

// ---- the repo ---------------------------------------------------------------

function worktrees(cwd) {
  return git(['worktree', 'list', '--porcelain'], cwd).out.split(/\r?\n\r?\n/).filter((b) => b.trim()).map((block) => {
    const wt = {};
    for (const line of block.split(/\r?\n/)) {
      const space = line.indexOf(' ');
      const key = space < 0 ? line : line.slice(0, space);
      const value = space < 0 ? '' : line.slice(space + 1);
      if (key === 'worktree') wt.path = resolve(value);
      else if (key === 'HEAD') wt.head = value;
      else if (key === 'branch') wt.branch = value.replace(/^refs\/heads\//, '');
      else if (key === 'locked') wt.locked = value || '(no reason given)';
      else if (key === 'bare' || key === 'detached' || key === 'prunable') wt[key] = true;
    }
    return wt;
  });
}

function context() {
  for (const name of ['GIT_DIR', 'GIT_WORK_TREE']) {
    if (process.env[name]) refuse(`${name} is set (${process.env[name]}); it points git at a repo other than the one this directory is in. Unset it and run again.`);
  }
  const list = worktrees(process.cwd());
  if (!list[0]?.path || list[0].bare) refuse(`${process.cwd()} is not inside a non-bare git repository; run this from the main checkout or one of its worktrees`);
  const main = list[0].path;
  return { main, list, home: join(dirname(main), `${basename(main)}-worktrees`) };
}

// git's remove deletes a second tree recursively: the worktree's admin directory, <common git dir>/worktrees/<id>.
// Found by its `gitdir` file, so it is found even when the worktree directory is already gone.
function adminDir(ctx, wtPath) {
  const root = join(resolve(ctx.main, git(['rev-parse', '--git-common-dir'], ctx.main).out.trim()), 'worktrees');
  for (const id of present(root) ? readdirSync(root) : []) {
    try {
      if (samePath(dirname(readFileSync(join(root, id, 'gitdir'), 'utf8').trim()), wtPath)) return join(root, id);
    } catch {
      // Not an admin directory, or not this worktree's.
    }
  }
  return null;
}

function find(ctx, arg) {
  const byPath = isAbsolute(arg) || /[\\/]/.test(arg);
  const hits = ctx.list.filter((w) => (byPath ? samePath(w.path, resolve(arg)) : basename(w.path) === arg || w.branch === arg));
  if (hits.length === 0) {
    const known = ctx.list.slice(1).map((w) => `\n  ${w.path}${w.branch ? ` [${w.branch}]` : ' (detached)'}`).join('');
    refuse(`${arg} is not a registered worktree of ${ctx.main}. This script removes only what \`git worktree list\` shows and never deletes a plain directory. Registered:${known || ' none'}`);
  }
  if (hits.length > 1) refuse(`${arg} names ${hits.length} worktrees; pass the full path of one:${hits.map((w) => `\n  ${w.path}`).join('')}`);
  if (samePath(hits[0].path, ctx.main)) refuse(`${arg} is the main checkout ${ctx.main}; it is never removed`);
  return hits[0];
}

// ---- after git: did anything behind a former link lose files? ----------------

function census(target) {
  if (!present(target)) return null;
  let files = 0;
  let dirs = 0;
  let seen = 0;
  const stack = [target];
  try {
    while (stack.length && seen < 500_000) {
      const dir = stack.pop();
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        seen++;
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          dirs++;
          stack.push(join(dir, entry.name));
        } else files++;
      }
    }
  } catch {
    return null;
  }
  return { files, dirs };
}

function checkTargets(before) {
  const lost = [];
  for (const { target, count } of before.values()) {
    if (!count) continue;
    const now = census(target);
    if (!now) lost.push(`${target} is gone (had ${count.files} files, ${count.dirs} dirs)`);
    else if (now.files < count.files || now.dirs < count.dirs) {
      lost.push(`${target} went from ${count.files} files / ${count.dirs} dirs to ${now.files} / ${now.dirs}`);
    }
  }
  if (lost.length) {
    refuse(`STOP. A former link target lost entries while the worktree was removed: ${lost.join('; ')}. A dev server or test run deleting its own cache files there can also do this, so check what else was running, but inspect those targets before running anything else.`);
  }
  if (before.size) say(`  former link targets: nothing lost (${before.size} checked)`);
}

// ---- commands -----------------------------------------------------------------

function create(ctx, name, base, { dryRun }) {
  if (!NAME.test(name ?? '')) refuse(`"${name ?? ''}" is not a usable worktree name: 1-64 letters, digits, dots, dashes or underscores, starting with a letter or digit`);
  const path = join(ctx.home, name);
  const modules = join(ctx.main, 'node_modules');
  const link = join(path, 'node_modules');
  const r = git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`], ctx.main, { allowFail: true });
  if (r.status !== 0) refuse(`base "${base}" does not name a commit in ${ctx.main}; pass a branch, tag or sha that \`git rev-parse\` resolves`);
  const sha = r.out.trim();
  if (git(['show-ref', '--verify', '--quiet', `refs/heads/${name}`], ctx.main, { allowFail: true }).status === 0) {
    refuse(`a branch named ${name} already exists; choose another name. create never reuses or resets a branch.`);
  }
  if (present(path)) refuse(`${path} already exists; choose another name`);
  let stat;
  try {
    stat = lstatSync(modules);
  } catch {
    refuse(`${modules} does not exist. Run \`npm install\` in the main checkout first: a worktree gets node_modules only as a junction to it.`);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) refuse(`${modules} is not a real directory; refusing to chain a junction through a link`);
  say(`${dryRun ? 'would create' : 'creating'} worktree ${path}`);
  say(`  ${dryRun ? 'would run' : 'running'}: git worktree add -b ${name} "${path}" ${short(sha)} (${base})`);
  say(`  ${dryRun ? 'would make' : 'making'}: junction ${link} -> ${modules}`);
  if (dryRun) return;
  mkdirSync(ctx.home, { recursive: true });
  git(['worktree', 'add', '-b', name, path, sha], ctx.main);
  if (present(link)) refuse(`${link} already exists in the checkout of ${base}; refusing to replace it. Remove the worktree with \`remove ${name}\`.`);
  symlinkSync(modules, link, 'junction');
  if (!lstatSync(link).isSymbolicLink() || !samePath(linkTarget(link), modules)) {
    refuse(`${link} does not resolve to ${modules}; remove the worktree with \`remove ${name}\``);
  }
  say(`path   ${path}`);
  say(`branch ${name}`);
}

function remove(ctx, arg, { dryRun, discard }) {
  const wt = find(ctx, arg);
  const label = wt.branch ? `branch ${wt.branch}` : 'detached HEAD';
  if (wt.locked) refuse(`${wt.path} is locked (${wt.locked}). If its owner is done, run \`git worktree unlock "${wt.path}"\` and then remove again. Nothing was touched.`);
  const nested = ctx.list.find((w) => w !== wt && inside(w.path, wt.path));
  if (nested) refuse(`${wt.path} holds another worktree, ${nested.path}; remove that one first. Nothing was touched.`);
  if (inside(process.cwd(), wt.path) || samePath(process.cwd(), wt.path)) refuse(`the working directory is inside ${wt.path}; run this from the main checkout. Nothing was touched.`);
  if (!contained(ctx, wt.head)) refuse(`${wt.path} is on ${label} at ${short(wt.head)}, which is NOT contained in ${MAIN}. Merge it into ${MAIN} first, or keep the worktree. Nothing was touched.`);
  const onDisk = present(wt.path);
  let found = { links: [], foreign: [] };
  let pending = null;
  if (onDisk) {
    assertNotLink(wt.path);
    found = scan(wt.path);
    if (found.foreign.length) refuse(`${wt.path} holds a directory on another device, ${found.foreign[0]}; unmount it first. Nothing was touched.`);
    pending = changes(wt.path, found.links);
    if (pending.lossy.length && !discard) refuseLossy(wt.path, pending.lossy);
  }
  const admin = adminDir(ctx, wt.path);
  const adminScan = admin ? scan(admin) : { links: [], foreign: [] };
  const adminLink = adminScan.links[0]?.path ?? adminScan.foreign[0];
  if (adminLink) refuse(`the admin directory ${admin}, which git deletes with the worktree, holds a link or mount at ${adminLink}. Remove it by hand, then run remove again. Nothing was touched.`);
  say(`${dryRun ? 'would remove' : 'removing'} ${wt.path}`);
  say(`  ${label} at ${short(wt.head)}: contained in ${MAIN}`);
  say(`  git status: ${pending ? pending.summary : 'directory already gone'}${pending?.lossy.length ? ' (--discard-changes: the other changes will be lost)' : ''}`);
  say(`  admin directory ${admin ?? '(none found)'}: no reparse point`);
  say(`  reparse points: ${found.links.length}`);
  if (dryRun) {
    for (const l of found.links) say(`    would unlink ${relative(wt.path, l.path)} -> ${l.target}`);
    const refusedByGit = pending && (pending.deleted.length || pending.lossy.length);
    say(`  would run: git worktree remove "${wt.path}"${refusedByGit ? ', which refuses the changes; then --force, after a fresh scan finds no link' : ''}`);
    if (wt.branch) say(`  would delete branch ${wt.branch} (${short(wt.head)}) if it is still contained in ${MAIN}`);
    return;
  }
  const before = new Map();
  for (const l of found.links) if (!before.has(norm(l.target))) before.set(norm(l.target), { target: l.target, count: census(l.target) });
  for (const l of found.links) {
    unlinkOne(l.path);
    say(`    unlinked ${relative(wt.path, l.path)} -> ${l.target}`);
  }
  proveNoLinks(wt.path, 'after unlinking');
  let r = git(['worktree', 'remove', wt.path], ctx.main, { allowFail: true });
  if (r.status !== 0) {
    say(`  git worktree remove refused: ${firstLine(r.err)}`);
    proveNoLinks(wt.path, 'before --force');
    if (!worktrees(ctx.main).some((w) => samePath(w.path, wt.path))) {
      refuse(`git's plain remove failed partway and has already unregistered ${wt.path}, so --force was not run. The directory is ${present(wt.path) ? 'partly still on disk and held no link at the last scan: find what blocked git (an open file, a path over 260 characters) and delete the rest by hand' : 'gone'}.`);
    }
    if (present(wt.path)) {
      const again = changes(wt.path, []);
      if (again.lossy.length && !discard) refuseLossy(wt.path, again.lossy);
    }
    say(`  retrying with --force: the scan found no link, and every change is a deletion${discard ? ' or was released by --discard-changes' : ''}`);
    r = git(['worktree', 'remove', '--force', wt.path], ctx.main, { allowFail: true });
    if (r.status !== 0) refuse(`\`git worktree remove --force\` failed too (exit ${r.status}): ${firstLine(r.err)}. The tree held no link when git ran, so git deleted nothing outside it.`);
  }
  if (present(wt.path)) refuse(`git reported success but ${wt.path} is still on disk; inspect it before running anything else`);
  if (worktrees(ctx.main).some((w) => samePath(w.path, wt.path))) refuse(`${wt.path} is still listed by \`git worktree list\` after git reported success`);
  say('  worktree removed');
  if (samePath(dirname(wt.path), ctx.home)) {
    try {
      rmdirSync(ctx.home);
      say(`  removed the now-empty ${ctx.home}`);
    } catch {
      // Not empty: other worktrees still live there. rmdirSync never removes a non-empty directory.
    }
  }
  checkTargets(before);
  if (wt.branch) dropBranch(ctx, wt.branch, wt.head);
}

function run(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const args = argv.filter((a) => !a.startsWith('--'));
  const unknown = [...flags].filter((f) => !FLAGS.has(f));
  const [command, target, base, ...extra] = args;
  const maxArgs = new Map([['create', 3], ['remove', 2], ['delete-branch', 2]]).get(command);
  if (unknown.length || !maxArgs || !target || args.length > maxArgs || extra.length) {
    process.stderr.write(`${unknown.length ? `unknown option ${unknown.join(' ')}\n` : ''}${USAGE}\n`);
    return 2;
  }
  if (flags.has('--discard-changes') && command !== 'remove') refuse('--discard-changes applies only to remove');
  const ctx = context();
  const dryRun = flags.has('--dry-run');
  if (command === 'create') create(ctx, target, base ?? MAIN, { dryRun });
  else if (command === 'remove') remove(ctx, target, { dryRun, discard: flags.has('--discard-changes') });
  else dropBranch(ctx, target, null, { dryRun });
  return 0;
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(error instanceof Refusal ? `controlWorktree: ${error.message}\n` : `controlWorktree: unexpected error\n${error.stack}\n`);
  process.exitCode = 1;
}
