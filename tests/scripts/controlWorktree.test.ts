// `scripts/controlWorktree.mjs` is the only sanctioned way to create or remove a git worktree on this machine,
// because removing one has destroyed a sibling repo before: on 2026-09-03 `git worktree remove --force` followed a
// junction and emptied ../civ-engine/.git down to refs/ (docs/learning/defect-register-past.md, 2026-09-05). These
// tests hold the script to its four rules, against SACRIFICIAL trees only.
//
// SAFETY, which every test here obeys. All paths live under ONE mkdtemp directory per sandbox. Every junction a test
// makes, or asks the script to make, points inside that directory: `contained()` walks the sandbox after every
// script run and fails the test, removing the offending link on its own first, if any link leads out. The
// "node_modules" the script links a worktree to is the sandbox's own `<tmp>/repo/node_modules`, never this repo's.
// Cleanup removes every link by itself before the one recursive delete, and refuses to recurse if a link survives.
// git runs with every GIT_* variable scrubbed and an empty global config, and each sandbox checks that git sees the
// sandbox repo as its own top level, so no test can reach this repository through GIT_DIR or a user setting.
//
// The sandbox has the real shape: a worktree's node_modules is a junction to the main checkout's node_modules, and
// that holds a junction `civ-engine` to a sibling directory. Each end holds a canary file.
//
// BOUND. A canary can only fall where git follows a junction while deleting: Windows, with a Git for Windows whose
// lstat calls a junction a directory (measured with 2.42.0.windows.2). HAZARD measures that once at load, with a
// plain `git worktree remove` over a junction. On Linux the junctions are symlinks git never follows, so the canaries
// survive whatever the script does, and the mutant that proves a canary CAN fall is skipped rather than passed. What
// holds everywhere: exit codes, refusals, and that nothing is left behind. Symlinks proper (not junctions) are not
// exercised on Windows: creating one needs a privilege this machine does not grant (EPERM, measured 2026-09-22).
// Not tested at all: a worktree root that is itself a link, a directory on another device, a worktree whose
// directory is already gone, git's plain remove failing partway, and a junction created by another process between
// the script's last scan and git's delete.

import { spawnSync } from 'node:child_process';
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmdirSync,
  rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../scripts/controlWorktree.mjs', import.meta.url));
const WIN = process.platform === 'win32';

// The two statements the mutants cut out. Each must occur exactly once in the script, or the mutant refuses to build.
const UNLINK_STEP = '    unlinkOne(l.path);\n';
const RESCAN_STEP = "  proveNoLinks(wt.path, 'after unlinking');\n";

interface Sandbox { root: string; repo: string; modules: string; sibling: string; env: NodeJS.ProcessEnv }
interface Run { status: number | null; out: string; err: string; all: string }

const norm = (path: string) => {
  const s = resolve(path).replace(/\\/g, '/').replace(/\/+$/, '');
  return WIN ? s.toLowerCase() : s;
};
const within = (path: string, root: string) => norm(path) === norm(root) || norm(path).startsWith(`${norm(root)}/`);

// Every link under root, never descending one. Written apart from the script's own scan, so the two cannot agree
// with each other by sharing a bug.
function linksUnder(root: string): string[] {
  const found: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink() || lstatSync(path).isSymbolicLink()) found.push(path);
      else if (entry.isDirectory()) stack.push(path);
    }
  }
  return found;
}

// Removes the link itself. Neither call can recurse: a real directory answers ENOTEMPTY or EPERM.
function unlinkItself(path: string) {
  try {
    rmdirSync(path);
  } catch {
    unlinkSync(path);
  }
}

function contained(sb: Sandbox) {
  for (const link of linksUnder(sb.root)) {
    const target = resolve(dirname(link), readlinkSync(link));
    if (!within(target, sb.root)) {
      unlinkItself(link);
      throw new Error(`SAFETY: ${link} pointed OUTSIDE the sandbox, at ${target}; that link alone was removed`);
    }
  }
}

function destroy(root: string) {
  for (const link of linksUnder(root)) unlinkItself(link);
  const left = linksUnder(root);
  if (left.length) throw new Error(`sandbox cleanup refused to recurse: links remain at ${left.join(', ')}`);
  rmSync(root, { recursive: true, force: true, maxRetries: 3 });
}

function hermeticEnv(root: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith('GIT_') || key.toUpperCase() === 'GIT_EXEC_PATH') env[key] = value;
  }
  const globalConfig = join(root, 'empty-global.gitconfig');
  writeFileSync(globalConfig, '');
  return {
    ...env,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'sandbox',
    GIT_AUTHOR_EMAIL: 'sandbox@example.invalid',
    GIT_COMMITTER_NAME: 'sandbox',
    GIT_COMMITTER_EMAIL: 'sandbox@example.invalid',
  };
}

function git(sb: Sandbox, cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, env: sb.env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd} (exit ${r.status}): ${r.stderr}`);
  return r.stdout.trim();
}

function makeSandbox(register: string[]): Sandbox {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'cw-test-')));
  register.push(root);
  const repo = join(root, 'repo');
  const sb: Sandbox = { root, repo, modules: join(repo, 'node_modules'), sibling: join(root, 'sibling'), env: hermeticEnv(root) };
  mkdirSync(sb.sibling);
  writeFileSync(join(sb.sibling, 'CANARY'), 'the sibling repo');
  mkdirSync(repo);
  git(sb, repo, 'init', '-q', '-b', 'main');
  if (norm(git(sb, repo, 'rev-parse', '--show-toplevel')) !== norm(repo)) {
    throw new Error(`SAFETY: git in ${repo} did not see the sandbox as its own repo; refusing to go on`);
  }
  writeFileSync(join(repo, '.gitignore'), 'node_modules/\ntmp/\n');
  writeFileSync(join(repo, 'README.md'), 'sandbox\n');
  git(sb, repo, 'add', '.');
  git(sb, repo, 'commit', '-q', '-m', 'init');
  mkdirSync(sb.modules);
  writeFileSync(join(sb.modules, 'CANARY'), 'the main checkout node_modules');
  symlinkSync(sb.sibling, join(sb.modules, 'civ-engine'), 'junction');
  contained(sb);
  return sb;
}

// A worktree made with raw git and a junction the test makes itself, so `remove` is tested apart from `create`.
function rawWorktree(sb: Sandbox, name: string, gitArgs: string[] = ['-b', name]): string {
  const path = join(sb.root, 'wts', name);
  git(sb, sb.repo, 'worktree', 'add', '-q', ...gitArgs, path);
  symlinkSync(sb.modules, join(path, 'node_modules'), 'junction');
  contained(sb);
  return path;
}

function runScript(script: string, sb: Sandbox, ...args: string[]): Run {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: sb.repo, env: sb.env, encoding: 'utf8', timeout: 60_000 });
  contained(sb);
  return { status: r.status, out: r.stdout, err: r.stderr, all: `${r.stdout}${r.stderr}` };
}

// The script with some statements cut out, written inside the sandbox. A replacement that does not match exactly
// once fails loudly: a mutant that changed nothing would pass for a gate that cannot see the defect.
function mutant(sb: Sandbox, cuts: string[]): string {
  let source = readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n');
  for (const cut of cuts) {
    const count = source.split(cut).length - 1;
    if (count !== 1) throw new Error(`mutant target occurs ${count} times, not once: ${JSON.stringify(cut)}; update the mutant to match the script`);
    source = source.replace(cut, '  // MUTANT: statement cut\n');
  }
  const path = join(sb.root, 'mutant', 'controlWorktree.mjs');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
}

const canaries = (sb: Sandbox) => ({
  modules: existsSync(join(sb.modules, 'CANARY')),
  sibling: existsSync(join(sb.sibling, 'CANARY')),
});
const listed = (sb: Sandbox, path: string) => git(sb, sb.repo, 'worktree', 'list', '--porcelain')
  .split(/\r?\n/).some((line) => line.startsWith('worktree ') && norm(line.slice(9)) === norm(path));
const branchExists = (sb: Sandbox, branch: string) =>
  spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: sb.repo, env: sb.env }).status === 0;
const isLink = (path: string) => lstatSync(path).isSymbolicLink();

// Does a plain `git worktree remove` on THIS machine delete through a junction? Measured once, in its own sandbox.
const HAZARD = (() => {
  const roots: string[] = [];
  try {
    const sb = makeSandbox(roots);
    const wt = rawWorktree(sb, 'hazard');
    const r = spawnSync('git', ['worktree', 'remove', wt], { cwd: sb.repo, env: sb.env, encoding: 'utf8' });
    const live = !existsSync(join(sb.modules, 'CANARY'));
    return { live, detail: `plain \`git worktree remove\` exited ${r.status} and the canary behind the junction ${live ? 'was DELETED' : 'survived'}` };
  } finally {
    roots.forEach(destroy);
  }
})();

const live: string[] = [];
afterEach(() => {
  while (live.length) destroy(live.pop()!);
});
const sandbox = () => makeSandbox(live);
const script = (sb: Sandbox, ...args: string[]) => runScript(SCRIPT, sb, ...args);

describe(`controlWorktree.mjs — on this machine ${HAZARD.detail}`, () => {
  it('remove unlinks every junction before git deletes anything, so every canary survives', () => {
    const sb = sandbox();
    const wt = rawWorktree(sb, 'wt-canary');
    // The 2026-09-03 shape too: a real, copied modules directory that holds a junction to the sibling.
    mkdirSync(join(wt, 'tmp', 'copied_modules'), { recursive: true });
    symlinkSync(sb.sibling, join(wt, 'tmp', 'copied_modules', 'civ-engine'), 'junction');
    // And a dangling junction, whose target is already gone.
    const gone = join(sb.root, 'gone');
    mkdirSync(gone);
    symlinkSync(gone, join(wt, 'tmp', 'dangling'), 'junction');
    rmdirSync(gone);
    contained(sb);

    const r = script(sb, 'remove', wt);

    expect(canaries(sb), r.all).toEqual({ modules: true, sibling: true });
    expect(r.status, r.all).toBe(0);
    expect(r.out).toContain('reparse points: 3');
    // The admin directory git also deletes was found and scanned, not skipped as "(none found)".
    expect(r.out).toMatch(/admin directory .*[\\/]\.git[\\/]worktrees[\\/]wt-canary: no reparse point/);
    expect(r.out.match(/^ {4}unlinked /gm)?.length).toBe(3);
    expect(r.out).toContain('fresh scan after unlinking: no reparse point');
    expect(existsSync(wt)).toBe(false);
    expect(listed(sb, wt)).toBe(false);
    expect(branchExists(sb, 'wt-canary')).toBe(false);
  });

  it('with the unlink step cut out, the fresh scan refuses and git never runs (mutant 1)', () => {
    const sb = sandbox();
    const wt = rawWorktree(sb, 'wt-mutant-1');
    const r = runScript(mutant(sb, [UNLINK_STEP]), sb, 'remove', wt);
    expect(r.status, r.all).toBe(1);
    expect(r.err).toMatch(/a fresh scan of .* after unlinking still finds 1 link/);
    expect(canaries(sb)).toEqual({ modules: true, sibling: true });
    expect(isLink(join(wt, 'node_modules'))).toBe(true);
    expect(listed(sb, wt)).toBe(true);
  });

  it.runIf(HAZARD.live)('with the unlink step AND the fresh scan cut out, git deletes the canaries through the junction (mutant 2)', () => {
    const sb = sandbox();
    const wt = rawWorktree(sb, 'wt-mutant-2');
    const r = runScript(mutant(sb, [UNLINK_STEP, RESCAN_STEP]), sb, 'remove', wt);
    // The defect itself: git reached the main checkout's node_modules, and through its junction the sibling.
    expect(canaries(sb), r.all).toEqual({ modules: false, sibling: false });
    // And the script's own after-check saw the loss and said STOP rather than reporting success.
    expect(r.status, r.all).toBe(1);
    expect(r.err).toContain('STOP. A former link target lost entries');
  });

  it('refuses a worktree whose HEAD is not contained in main, names it, and touches nothing', () => {
    const sb = sandbox();
    const onBranch = rawWorktree(sb, 'wt-unmerged', ['-b', 'feature-unmerged']);
    const detached = rawWorktree(sb, 'wt-detached', ['--detach']);
    for (const wt of [onBranch, detached]) {
      writeFileSync(join(wt, 'work.txt'), `work only in ${wt}\n`);
      git(sb, wt, 'add', 'work.txt');
      git(sb, wt, 'commit', '-q', '-m', 'work that main does not have');
    }

    const b = script(sb, 'remove', onBranch);
    expect(b.status, b.all).toBe(1);
    expect(b.err).toContain('branch feature-unmerged');
    expect(b.err).toContain('NOT contained in main');
    const d = script(sb, 'remove', detached);
    expect(d.status, d.all).toBe(1);
    expect(d.err).toContain('detached HEAD');
    expect(d.err).toContain('NOT contained in main');

    for (const wt of [onBranch, detached]) {
      expect(isLink(join(wt, 'node_modules'))).toBe(true);
      expect(existsSync(join(wt, 'work.txt'))).toBe(true);
      expect(listed(sb, wt)).toBe(true);
    }
    expect(branchExists(sb, 'feature-unmerged')).toBe(true);
    expect(canaries(sb)).toEqual({ modules: true, sibling: true });
  });

  it('create then remove leaves no directory, no branch and no worktree entry behind', () => {
    const sb = sandbox();
    const wt = join(sb.root, 'repo-worktrees', 'wt-roundtrip');
    const c = script(sb, 'create', 'wt-roundtrip');
    expect(c.status, c.all).toBe(0);
    const printed = c.out.split(/\r?\n/).find((line) => line.startsWith('path   '));
    expect(norm(printed?.slice(7) ?? '')).toBe(norm(wt));
    expect(c.out).toContain('branch wt-roundtrip');
    expect(isLink(join(wt, 'node_modules'))).toBe(true);
    expect(norm(resolve(wt, readlinkSync(join(wt, 'node_modules'))))).toBe(norm(sb.modules));
    expect(listed(sb, wt)).toBe(true);
    expect(branchExists(sb, 'wt-roundtrip')).toBe(true);

    const r = script(sb, 'remove', 'wt-roundtrip');
    expect(canaries(sb), r.all).toEqual({ modules: true, sibling: true });
    expect(r.status, r.all).toBe(0);
    expect(existsSync(wt)).toBe(false);
    expect(existsSync(join(sb.root, 'repo-worktrees'))).toBe(false);
    expect(listed(sb, wt)).toBe(false);
    expect(git(sb, sb.repo, 'worktree', 'list', '--porcelain')).not.toContain('wt-roundtrip');
    expect(branchExists(sb, 'wt-roundtrip')).toBe(false);
  });

  it('--dry-run prints the plan for create and for remove, and changes nothing', () => {
    const sb = sandbox();
    const c = script(sb, 'create', 'wt-dry', '--dry-run');
    expect(c.status, c.all).toBe(0);
    expect(c.out).toContain('would create worktree');
    expect(c.out).toMatch(/would run: git worktree add -b wt-dry /);
    expect(c.out).toMatch(/would make: junction .*node_modules -> /);
    expect(existsSync(join(sb.root, 'repo-worktrees'))).toBe(false);
    expect(branchExists(sb, 'wt-dry')).toBe(false);

    const wt = rawWorktree(sb, 'wt-dry-remove');
    const r = script(sb, 'remove', wt, '--dry-run');
    expect(r.status, r.all).toBe(0);
    expect(r.out).toMatch(/would unlink node_modules -> /);
    expect(r.out).toContain('would run: git worktree remove');
    expect(r.out).toContain('would delete branch wt-dry-remove');
    expect(isLink(join(wt, 'node_modules'))).toBe(true);
    expect(listed(sb, wt)).toBe(true);
    expect(branchExists(sb, 'wt-dry-remove')).toBe(true);
  });

  it('refuses changes that exist nowhere else, and loses them only under --discard-changes', () => {
    const sb = sandbox();
    const wt = rawWorktree(sb, 'wt-dirty');
    writeFileSync(join(wt, 'untracked.txt'), 'exists only here\n');
    writeFileSync(join(wt, 'README.md'), 'an edit that exists only here\n');

    const r = script(sb, 'remove', wt);
    expect(r.status, r.all).toBe(1);
    expect(r.err).toContain('2 change(s) that exist nowhere else');
    expect(r.err).toContain('untracked.txt');
    expect(existsSync(join(wt, 'untracked.txt'))).toBe(true);
    expect(isLink(join(wt, 'node_modules'))).toBe(true);

    const d = script(sb, 'remove', wt, '--discard-changes');
    expect(canaries(sb), d.all).toEqual({ modules: true, sibling: true });
    expect(d.status, d.all).toBe(0);
    expect(d.out).toContain('fresh scan before --force: no reparse point');
    expect(d.out).toContain('retrying with --force');
    expect(existsSync(wt)).toBe(false);
  });

  it('a worktree whose tracked files were all deleted goes with --force, after a fresh scan finds no link', () => {
    const sb = sandbox();
    const wt = rawWorktree(sb, 'wt-skeleton');
    for (const file of ['README.md', '.gitignore']) unlinkSync(join(wt, file));

    const r = script(sb, 'remove', wt);
    expect(canaries(sb), r.all).toEqual({ modules: true, sibling: true });
    expect(r.status, r.all).toBe(0);
    // Two deletions. What git lists behind the now-unignored node_modules link is counted apart: on Windows git walks
    // INTO the junction and lists both canaries (measured), on Linux it lists the symlink itself.
    expect(r.out).toMatch(/git status: 2 deleted tracked file\(s\), 0 other change\(s\), [12] entry\(ies\) that are links or behind one/);
    expect(r.out).toContain('git worktree remove refused');
    expect(r.out).toContain('fresh scan before --force: no reparse point');
    expect(existsSync(wt)).toBe(false);
    expect(branchExists(sb, 'wt-skeleton')).toBe(false);
  });

  it('refuses a plain directory, the main checkout, a locked worktree and one that holds another, touching none', () => {
    const sb = sandbox();
    const plain = join(sb.root, 'plain');
    mkdirSync(plain);
    writeFileSync(join(plain, 'KEEP'), 'not a worktree');
    const p = script(sb, 'remove', plain);
    expect(p.status, p.all).toBe(1);
    expect(p.err).toContain('is not a registered worktree');
    expect(existsSync(join(plain, 'KEEP'))).toBe(true);

    const m = script(sb, 'remove', sb.repo);
    expect(m.status, m.all).toBe(1);
    expect(m.err).toContain('is the main checkout');

    const locked = rawWorktree(sb, 'wt-locked');
    git(sb, sb.repo, 'worktree', 'lock', '--reason', 'a peer is using it', locked);
    const l = script(sb, 'remove', locked);
    expect(l.status, l.all).toBe(1);
    expect(l.err).toContain('is locked (a peer is using it)');
    expect(isLink(join(locked, 'node_modules'))).toBe(true);

    const outer = rawWorktree(sb, 'wt-outer');
    const inner = join(outer, 'tmp', 'wt-inner');
    git(sb, sb.repo, 'worktree', 'add', '-q', '-b', 'wt-inner', inner);
    const o = script(sb, 'remove', outer);
    expect(o.status, o.all).toBe(1);
    expect(o.err).toContain('holds another worktree');
    expect(listed(sb, inner) && listed(sb, outer)).toBe(true);
    expect(canaries(sb)).toEqual({ modules: true, sibling: true });
  });

  it('refuses when the admin directory that git deletes with the worktree holds a junction', () => {
    const sb = sandbox();
    const wt = rawWorktree(sb, 'wt-admin');
    symlinkSync(sb.sibling, join(sb.repo, '.git', 'worktrees', 'wt-admin', 'planted'), 'junction');
    contained(sb);

    const r = script(sb, 'remove', wt);
    // git's delete of the admin directory follows a junction too (measured 2026-09-22: exit 0, canary gone).
    expect(canaries(sb), r.all).toEqual({ modules: true, sibling: true });
    expect(r.status, r.all).toBe(1);
    expect(r.err).toMatch(/the admin directory .*wt-admin, which git deletes with the worktree, holds a link or mount at .*planted/);
    expect(isLink(join(wt, 'node_modules'))).toBe(true);
    expect(listed(sb, wt)).toBe(true);
  });

  it('delete-branch judges a branch against main, not its upstream, and never deletes main or unmerged work', () => {
    const sb = sandbox();
    const origin = join(sb.root, 'origin.git');
    git(sb, sb.root, 'init', '-q', '--bare', origin);
    git(sb, sb.repo, 'remote', 'add', 'origin', origin);
    // `tracked` is pushed, then advanced; main takes the advance, its upstream never does (the shadow-silhouette case).
    git(sb, sb.repo, 'checkout', '-q', '-b', 'tracked');
    writeFileSync(join(sb.repo, 'a.txt'), 'a\n');
    git(sb, sb.repo, 'add', 'a.txt');
    git(sb, sb.repo, 'commit', '-q', '-m', 'a');
    git(sb, sb.repo, 'push', '-q', '-u', 'origin', 'tracked');
    writeFileSync(join(sb.repo, 'b.txt'), 'b\n');
    git(sb, sb.repo, 'add', 'b.txt');
    git(sb, sb.repo, 'commit', '-q', '-m', 'b');
    git(sb, sb.repo, 'checkout', '-q', 'main');
    git(sb, sb.repo, 'merge', '-q', '--ff-only', 'tracked');
    git(sb, sb.repo, 'checkout', '-q', '-b', 'unmerged');
    writeFileSync(join(sb.repo, 'c.txt'), 'c\n');
    git(sb, sb.repo, 'add', 'c.txt');
    git(sb, sb.repo, 'commit', '-q', '-m', 'c, which main never gets');
    git(sb, sb.repo, 'checkout', '-q', 'main');
    // The premise of rule 4: plain `git branch -d` judges `tracked` against its upstream, and refuses it.
    const plain = spawnSync('git', ['branch', '-d', 'tracked'], { cwd: sb.repo, env: sb.env, encoding: 'utf8' });
    expect(plain.status, plain.stderr).not.toBe(0);
    expect(branchExists(sb, 'tracked')).toBe(true);

    const u = script(sb, 'delete-branch', 'unmerged');
    expect(u.status, u.all).toBe(1);
    expect(u.err).toContain('NOT contained in main');
    expect(branchExists(sb, 'unmerged')).toBe(true);

    const t = script(sb, 'delete-branch', 'tracked');
    expect(t.status, t.all).toBe(0);
    expect(branchExists(sb, 'tracked')).toBe(false);
    expect(spawnSync('git', ['config', '--get', 'branch.tracked.remote'], { cwd: sb.repo, env: sb.env }).status).toBe(1);

    const m = script(sb, 'delete-branch', 'main');
    expect(m.status, m.all).toBe(1);
    expect(branchExists(sb, 'main')).toBe(true);
  });
});
