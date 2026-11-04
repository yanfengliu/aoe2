// Sandboxed repositories for the leftover-worktree check in `npm run ci:status` (scripts/ci-status-worktrees.mjs),
// driven by real git. tests/scripts/ciStatusWorktrees.test.ts plants worktrees in them; the harness
// (ciStatusHarness.ts) runs the check's git calls inside them with `sandboxGitEnv`.
//
// Layout, as scripts/controlWorktree.mjs makes it: a primary checkout `<root>/aoe2` and worktrees under
// `<root>/aoe2-worktrees/<name>`, each on a new branch `<name>` from main.
//
// SAFETY. Everything is under one fresh folder in the OS temp directory. Nothing here makes a link, and every
// recursive delete first scans its tree and refuses if it finds one. This module never imports node:child_process
// itself: the test files route that module to the harness, so the real execFileSync is passed in.

import type { ExecFileSyncOptions } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

export const HOUR = 3_600_000;

export type RealExec = (bin: string, args: string[], options: ExecFileSyncOptions) => string | Buffer;

// No repository above the sandbox answers for it, and neither the machine's nor the user's git config applies:
// Git for Windows' system config sets core.autocrlf, which would change what `git status` counts.
export function sandboxGitEnv(root: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith('GIT_') || key.toUpperCase() === 'GIT_EXEC_PATH') env[key] = value;
  }
  env.GIT_CEILING_DIRECTORIES = dirname(root);
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = join(root, 'no-global-gitconfig');
  return env;
}

function walk(root: string, visit: (path: string, isDirectory: boolean) => void): void {
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    visit(dir, true);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink() || lstatSync(path).isSymbolicLink()) {
        throw new Error(`SAFETY: ${path} is a link, and a sandbox never holds one; refusing to go on`);
      }
      if (entry.isDirectory()) stack.push(path);
      else visit(path, false);
    }
  }
}

function deleteTree(root: string): void {
  walk(root, () => undefined); // throws on a link
  rmSync(root, { recursive: true, force: true, maxRetries: 3 });
}

function newRoot(label: string): string {
  return realpathSync.native(mkdtempSync(join(tmpdir(), `ci-status-worktrees-${label}-`)));
}

const git = (exec: RealExec, root: string, dir: string, args: string[]): string =>
  String(exec('git', ['-C', dir, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: sandboxGitEnv(root),
  }));

/** A primary checkout with one commit on main, made once and copied into each sandbox. */
export function makeTemplate(exec: RealExec): string {
  const root = newRoot('template');
  const primary = join(root, 'aoe2');
  mkdirSync(join(primary, 'docs'), { recursive: true });
  git(exec, root, primary, ['init', '-q', '-b', 'main']);
  for (const [key, value] of [['user.name', 'sandbox'], ['user.email', 'sandbox@example.invalid'],
    ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) {
    git(exec, root, primary, ['config', key, value]);
  }
  writeFileSync(join(primary, '.gitignore'), 'tmp/\n');
  writeFileSync(join(primary, 'README.md'), 'sandbox\n');
  writeFileSync(join(primary, 'docs', 'notes.md'), 'notes\n');
  git(exec, root, primary, ['add', '-A']);
  git(exec, root, primary, ['commit', '-q', '-m', 'base']);
  return root;
}

export const disposeTemplate = (root: string): void => {
  if (root) deleteTree(root);
};

export interface Sandbox {
  root: string;
  primary: string;
  /** `<root>/aoe2-worktrees`, where controlWorktree.mjs puts worktrees. */
  home: string;
  git(dir: string, ...args: string[]): string;
  /** Adds `<home>/<name>` on a new branch `<name>` from main, with an ignored `tmp/run.log` in it. */
  worktree(name: string): string;
  /** A path as `git worktree list` prints it. */
  shown(path: string): string;
  adminDir(worktree: string): string;
  commonDir(): string;
  /** Sets the mtime of the worktree's every file and folder, its admin folder and its branch's ref and reflog. */
  backdate(worktree: string, hours: number): void;
  /** Sets one path's mtime. */
  setTime(path: string, hoursAgo: number): void;
  /** Each path `backdate` touches with its mtime, and each file's size and SHA-256. */
  stamps(worktree: string): string[];
  removeFolder(path: string): void;
  dispose(): void;
}

export function openSandbox(exec: RealExec, template: string): Sandbox {
  const root = newRoot('case');
  const primary = join(root, 'aoe2');
  const home = join(root, 'aoe2-worktrees');
  cpSync(join(template, 'aoe2'), primary, { recursive: true });
  mkdirSync(home);
  const run = (dir: string, ...args: string[]) => git(exec, root, dir, args);
  const adminDir = (worktree: string) => run(worktree, 'rev-parse', '--absolute-git-dir').trim();
  const commonDir = () => join(primary, '.git');
  const branchOf = (worktree: string) => {
    try {
      return run(worktree, 'symbolic-ref', '--short', '-q', 'HEAD').trim() || null;
    } catch {
      return null;
    }
  };
  // Everything whose time is activity, by the check's own definition, plus the rest of the admin folder.
  const touched = (worktree: string) => {
    const admin = adminDir(worktree);
    const branch = branchOf(worktree);
    const paths: string[] = [];
    walk(worktree, (path) => paths.push(path));
    walk(admin, (path) => paths.push(path));
    if (branch) {
      for (const path of [join(commonDir(), 'logs', 'refs', 'heads', branch), join(commonDir(), 'refs', 'heads', branch)]) {
        try {
          lstatSync(path);
          paths.push(path);
        } catch { /* a packed ref has no file */ }
      }
    }
    return { admin, paths };
  };
  const setTime = (path: string, hoursAgo: number) => {
    const when = new Date(Date.now() - hoursAgo * HOUR);
    utimesSync(path, when, when);
  };
  return {
    root,
    primary,
    home,
    git: run,
    worktree(name) {
      const path = join(home, name);
      run(primary, 'worktree', 'add', '-q', '-b', name, path, 'main');
      mkdirSync(join(path, 'tmp'));
      writeFileSync(join(path, 'tmp', 'run.log'), 'ignored\n');
      return path;
    },
    shown: (path) => path.replace(/\\/g, '/'),
    adminDir,
    commonDir,
    backdate(worktree, hours) {
      // Setting a file's time does not change its folder's, so the order does not matter.
      for (const path of touched(worktree).paths) setTime(path, hours);
    },
    setTime,
    stamps(worktree) {
      return touched(worktree).paths.map((path) => {
        const stat = lstatSync(path);
        const what = stat.isDirectory() ? 'dir'
          : `${stat.size} ${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
        return `${relative(root, path).replace(/\\/g, '/')} ${what} ${stat.mtimeMs}`;
      }).sort();
    },
    removeFolder: deleteTree,
    dispose: () => deleteTree(root),
  };
}
