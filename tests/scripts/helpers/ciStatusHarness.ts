// The fake `gh` and `git` that tests/scripts/ciStatus.test.ts and
// tests/scripts/ciStatusReruns.test.ts run scripts/ci-status.mjs against. Moved
// here from ciStatus.test.ts on 2026-09-24, when the re-run cases needed it and
// that file had no room left under the 500-line budget.
//
// Each test file routes `node:child_process` to `exec` below:
//
//   vi.mock('node:child_process', async () => {
//     const { exec } = await import('./helpers/ciStatusHarness');
//     return { execFileSync: exec };
//   });
//
// The fake refuses any command it does not recognise. That is deliberate: a
// missing fixture must fail loudly, because a stub that silently returns ""
// is exactly how a check reports "did not run" as "passed".
//
// The leftover-worktree check (scripts/ci-status-worktrees.mjs, 2026-11-04)
// runs `git rev-parse --show-toplevel` and then `git -C <dir> ...`, each after
// `--no-optional-locks`, and nothing else in the script runs either form. They
// are routed by their form, not by that flag, so a check that dropped the flag
// would still run, and ciStatusWorktrees.test.ts's read-only case is what sees
// it rewrite an index. A scenario with a `sandbox` runs them for real, inside
// that sandbox repository only. A scenario without one gets the checkout below:
// the primary checkout alone, which is the caller's own, and no retained/*
// branch.

import type { ExecFileSyncOptions } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

import { type RealExec, sandboxGitEnv } from './worktreeSandbox';

export type Exec = (bin: string, args: string[], options?: ExecFileSyncOptions) => string;

let handler: Exec = () => {
  throw new Error('ci-status called a subprocess before a scenario was installed');
};

export const exec: Exec = (bin, args, options) => handler(bin, args, options);

// Must not exist: the check lists `<its parent>/aoe2-worktrees`, and a missing folder is what says "none".
const NO_SANDBOX_CHECKOUT = join(tmpdir(), 'ci-status-harness-has-no-such-folder', 'aoe2');

let realExecFileSync: RealExec | null = null;

const SCRIPT = new URL('../../../scripts/ci-status.mjs', import.meta.url).href;

export const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8');

// The workflows as they stood while both watched workflows filtered `on.push.paths`, last copied at `ecfaa3ff`
// (2026-09-06). The script reads the filter at the commit it judges (`git show <sha>:...`), so these are frozen on
// purpose: they stand for history, not for today's files, and are never refreshed from .github/workflows. They are
// not byte-for-byte what every scenario commit carried. Those commits run from 2026-08-28 (`619e3994`) to 2026-09-05,
// none of them had `.gitattributes` in the filter yet, and `619e3994` also lacked `.github/workflows/**`. Neither
// changed-files fixture names either path, so no outcome here depends on the difference. The case that judges a
// commit against TODAY's workflows reads the real files instead. `playtest-llm.yml` stays in this set after the
// workflow's deletion on 2026-09-25: the judged commits carried it, the script reads every workflow file at the
// commit, and its name, `playtest-corpus-llm`, begins with a watched one's.
export const FILTERED_WORKFLOWS: Record<string, string> = {
  'ci.yml': fixture('workflow--ci.yml'),
  'playtest.yml': fixture('workflow--playtest.yml'),
  'playtest-llm.yml': fixture('workflow--playtest-llm.yml'),
};

export interface Scenario {
  tip: string;
  subject: string;
  runsForSha: string;
  history: Record<string, string>;
  jobs: Record<string, string>;
  annotations?: Record<string, string>;
  changed: string;
  /** A sha the tip is an ancestor OF — i.e. a later push that carried it. */
  descendant?: string;
  /** The workflow files the commit carried; the frozen filtered set when omitted. */
  workflows?: Record<string, string>;
  /** `actions/workflows/<id>/runs`: each run's attempt number, keyed by workflow id. */
  attempts?: Record<string, string>;
  /** `actions/runs/<id>/attempts/<n>/jobs`, keyed `<id>-<n>`. */
  attemptJobs?: Record<string, string>;
  /** A real repository for the leftover-worktree check: its git calls run inside `root`, from `checkout`. */
  sandbox?: { root: string; checkout: string };
}

// Containment by real path where the path exists, so a link inside the sandbox cannot lead out of it.
const inside = (child: string, parent: string): boolean => {
  const norm = (path: string) => {
    let s = resolve(path);
    try {
      s = realpathSync.native(s);
    } catch { /* not there: compared as written */ }
    s = s.replace(/\\/g, '/').replace(/\/+$/, '');
    return process.platform === 'win32' ? s.toLowerCase() : s;
  };
  return norm(child) === norm(parent) || norm(child).startsWith(`${norm(parent)}/`);
};

// The leftover-worktree check's git: `rev-parse --show-toplevel` from the caller's directory, then `-C <dir> ...`.
const optionless = (args: string[]): string[] => (args[0] === '--no-optional-locks' ? args.slice(1) : args);

const isLeftoverGit = (args: string[]): boolean => {
  const [first, second] = optionless(args);
  return first === '-C' || (first === 'rev-parse' && second === '--show-toplevel');
};

// What a sandbox may run after `-C <dir>`: the check's own subcommands, each with only options the check passes (any
// of them, so a mutant that drops one still runs) and positional arguments of the check's own shapes. None of these
// options names a path, so git cannot be pointed at anything outside the sandbox. Work 138's review found a deny-list
// of redirecting options leaking twice: `-C <in> -C <out>` and `--git-dir=<out>` in round 0, then path-bearing options
// of the read-only subcommands, `rev-parse --resolve-git-dir <out>` and `ls-files --exclude-from=<out>`, in round 1.
const SHA = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const FORMS: Record<string, { options: string[]; positional: (args: string[]) => boolean }> = {
  'ls-files': { options: ['-z', '--cached', '--others', '--exclude-standard', '--directory'], positional: (a) => a.length === 0 },
  'rev-parse': { options: ['--absolute-git-dir', '--git-common-dir'], positional: (a) => a.length === 0 },
  status: { options: ['--porcelain=v1', '-z', '--untracked-files=all', '--no-renames'], positional: (a) => a.length === 0 },
  'merge-base': {
    options: ['--is-ancestor'],
    positional: (a) => a.length === 2 && SHA.test(a[0]) && a[1] === 'refs/heads/main',
  },
  'for-each-ref': {
    options: ['--format=%(refname:short)'],
    positional: (a) => a.length === 1 && a[0] === 'refs/heads/retained/',
  },
  worktree: { options: ['--porcelain', '-z'], positional: (a) => a.length === 1 && a[0] === 'list' },
};
const sandboxForm = ([command, ...rest]: string[]): boolean => {
  const form = Object.hasOwn(FORMS, command) ? FORMS[command] : undefined;
  if (!form) return false;
  const options = rest.filter((arg) => arg.startsWith('-'));
  return options.every((arg) => form.options.includes(arg)) && form.positional(rest.filter((arg) => !arg.startsWith('-')));
};

const sameArgs = (a: string[], b: string[]): boolean => a.length === b.length && a.every((arg, i) => arg === b[i]);

function leftoverGit(scenario: Scenario, args: string[], options: ExecFileSyncOptions | undefined,
  refuse: (bin: string, args: string[]) => never): string {
  const [first, dir, ...rest] = optionless(args);
  if (first === 'rev-parse' && dir === '--show-toplevel' && rest.length === 0) {
    return `${(scenario.sandbox?.checkout ?? NO_SANDBOX_CHECKOUT).replace(/\\/g, '/')}\n`;
  }
  if (first !== '-C' || !dir) return refuse('git', args);
  if (scenario.sandbox) {
    if (!inside(dir, scenario.sandbox.root) || !sandboxForm(rest)) return refuse('git', args);
    if (!realExecFileSync) throw new Error('the real execFileSync was not loaded; run the scenario through runScript');
    return String(realExecFileSync('git', args, { ...options, env: sandboxGitEnv(scenario.sandbox.root) }));
  }
  const harnessCheckout = (path: string) => inside(path, NO_SANDBOX_CHECKOUT) && inside(NO_SANDBOX_CHECKOUT, path);
  if (!harnessCheckout(dir) || existsSync(dirname(NO_SANDBOX_CHECKOUT))) return refuse('git', args);
  if (sameArgs(rest, ['worktree', 'list', '--porcelain', '-z'])) {
    return `worktree ${NO_SANDBOX_CHECKOUT.replace(/\\/g, '/')}\0HEAD ${'0'.repeat(40)}\0branch refs/heads/main\0\0`;
  }
  if (sameArgs(rest, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/retained/'])) return '';
  return refuse('git', args);
}

// A fixture is the projection the script's own `--jq` (or `--json` field list)
// asked for when it was captured. The fake hands it back whatever the script
// asks now, so a script that stopped ASKING for a field would still be fed it
// and pass. This refuses that: every field in the fixture must be named in the
// request. Without it, deleting `attempt: .run_attempt` from ci-status.mjs left
// the re-run cases green. A key counts as asked for only where it is a
// projection key: at the start of a `--json` list, or after `{` or `,` in a jq
// object. A word match was not enough, because `conclusion`, `name` and `steps`
// also appear inside the jobs jq's `failedSteps` filter, so a projection that
// dropped them still passed (review of 2026-09-24).
function askedFor(fixtureText: string, request: string): string {
  const rows = JSON.parse(fixtureText) as unknown;
  const keys = new Set<string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row && typeof row === 'object') for (const key of Object.keys(row)) keys.add(key);
  }
  const missing = [...keys].filter((key) => !new RegExp(`(^|[{,]\\s*)${key}\\s*([:,}]|$)`).test(request));
  if (missing.length > 0) {
    throw new Error(`the script no longer asks for ${missing.join(', ')}, which the fixture carries; request: ${request}`);
  }
  return fixtureText;
}

export function makeHandler(scenario: Scenario): Exec {
  const refuse = (bin: string, args: string[]): never => {
    throw new Error(`unstubbed command: ${bin} ${args.join(' ')}`);
  };
  const request = (args: string[]): string => {
    const at = args.findIndex((arg) => arg === '--jq' || arg === '--json');
    return at === -1 ? '' : String(args[at + 1]);
  };
  const workflowFiles = scenario.workflows ?? FILTERED_WORKFLOWS;
  return (bin, args, options) => {
    if (bin === 'git' && isLeftoverGit(args)) return leftoverGit(scenario, args, options, refuse);
    if (bin === 'git') {
      // Every ref resolves to the commit under test: these scenarios put HEAD
      // and origin/main on the same commit, so the script reports one target.
      if (args[0] === 'rev-parse') return scenario.tip;
      if (args[0] === 'merge-base') {
        const [, , a, b] = args;
        const ancestorOfTip = b === scenario.tip && a !== scenario.tip && a !== scenario.descendant;
        const carried = a === scenario.tip && b === scenario.descendant;
        if (ancestorOfTip || carried) return '';
        throw Object.assign(new Error('Command failed'), { status: 1 });
      }
      if (args[0] === 'log') return scenario.subject;
      if (args[0] === 'ls-tree') return Object.keys(workflowFiles).join('\n');
      if (args[0] === 'show') {
        const file = String(args[1]).split('/').pop() ?? '';
        return workflowFiles[file] ?? refuse(bin, args);
      }
      if (args[0] === 'diff' || args[0] === 'diff-tree') return scenario.changed;
      return refuse(bin, args);
    }
    if (bin === 'gh') {
      if (args[0] === 'run') {
        const workflow = args[args.indexOf('--workflow') + 1];
        const listed = scenario.history[workflow];
        return listed === undefined ? refuse(bin, args) : askedFor(listed, request(args));
      }
      const path = String(args[1]);
      if (path.includes('actions/runs?head_sha=')) return askedFor(scenario.runsForSha, request(args));
      const jobsAt = /actions\/runs\/(\d+)\/jobs/.exec(path);
      if (jobsAt) {
        const jobs = scenario.jobs[jobsAt[1]];
        return jobs === undefined ? refuse(bin, args) : askedFor(jobs, request(args));
      }
      const attemptAt = /actions\/runs\/(\d+)\/attempts\/(\d+)\/jobs/.exec(path);
      if (attemptAt) {
        const jobs = scenario.attemptJobs?.[`${attemptAt[1]}-${attemptAt[2]}`];
        return jobs === undefined ? refuse(bin, args) : askedFor(jobs, request(args));
      }
      const workflowRunsAt = /actions\/workflows\/(\d+)\/runs\?branch=main/.exec(path);
      if (workflowRunsAt) {
        const attempts = scenario.attempts?.[workflowRunsAt[1]];
        return attempts === undefined ? refuse(bin, args) : askedFor(attempts, request(args));
      }
      const annotationsAt = /check-runs\/(\d+)\/annotations/.exec(path);
      if (annotationsAt) return scenario.annotations?.[annotationsAt[1]] ?? '[]';
      return refuse(bin, args);
    }
    return refuse(bin, args);
  };
}

let caseId = 0;

export async function runScript(scenario: Scenario): Promise<{ out: string; exitCode: number }> {
  if (scenario.sandbox && !realExecFileSync) {
    // The test file routes node:child_process here, so the real one is reached around that mock.
    const real = await vi.importActual<typeof import('node:child_process')>('node:child_process');
    realExecFileSync = real.execFileSync as RealExec;
  }
  handler = makeHandler(scenario);
  const logged: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    logged.push(parts.map(String).join(' '));
  });
  const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw Object.assign(new Error('process.exit'), { exitCode: code ?? 0 });
  }) as never);
  const savedArgv = process.argv;
  process.argv = [savedArgv[0], fileURLToPath(SCRIPT)];
  let exitCode = -1;
  try {
    caseId += 1;
    // A fresh evaluation per case. `main` is called only when it exists:
    // revisions of this script before the fix ran on import and had no export,
    // and that tolerance is what lets this same gate be pointed at the pre-fix
    // script to prove it red (docs/learning/gate-proofs.md).
    const module = (await import(`${SCRIPT}?case=${caseId}`)) as {
      main?: (argv: string[]) => number;
    };
    if (typeof module.main === 'function') exitCode = module.main([]);
  } catch (error) {
    const thrown = error as { exitCode?: number };
    if (typeof thrown.exitCode !== 'number') throw error;
    exitCode = thrown.exitCode;
  } finally {
    process.argv = savedArgv;
    log.mockRestore();
    exit.mockRestore();
  }
  return { out: logged.join('\n'), exitCode };
}
