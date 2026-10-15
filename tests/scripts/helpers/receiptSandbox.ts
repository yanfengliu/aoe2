// The sandboxes tests/scripts/verifyReceipt.test.ts and verifyReceiptEvidence.test.ts drive the real
// `scripts/verify-receipt.mjs` against: SACRIFICIAL repositories only. Each is a fresh `git init` under the OS temp
// directory, git runs with every GIT_* variable scrubbed, an empty global config and no system config, and each
// sandbox checks that git sees it as its own top level before any test uses it, so no test can reach this checkout
// or its receipt. The npm lifecycle variables are scrubbed too, and set only where a test plays a step of
// `npm run verify`. A test file registers `cleanupSandboxes` with afterEach.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';

export const SCRIPT = fileURLToPath(new URL('../../../scripts/verify-receipt.mjs', import.meta.url));
export const RECEIPT = 'tmp/verify-receipt.json';
export const START_RECORD = 'tmp/verify-receipt.start.json';
export const REPORTS = { vitest: 'tmp/test-times/vitest.json', playwright: 'tmp/test-times/playwright.json' } as const;

export interface Sandbox { root: string; repo: string; env: NodeJS.ProcessEnv }
export interface Run { status: number | null; out: string; err: string }

const same = (a: string, b: string) => {
  const norm = (p: string) => resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return norm(a) === norm(b);
};

function hermeticEnv(root: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    const upper = key.toUpperCase();
    if (upper.startsWith('GIT_') && upper !== 'GIT_EXEC_PATH') continue;
    if (upper.startsWith('NPM_LIFECYCLE_')) continue;
    env[key] = value;
  }
  const globalConfig = join(root, 'empty-global.gitconfig');
  writeFileSync(globalConfig, '');
  return {
    ...env,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'sandbox',
    GIT_AUTHOR_EMAIL: 'sandbox@example.invalid',
    GIT_COMMITTER_NAME: 'sandbox',
    GIT_COMMITTER_EMAIL: 'sandbox@example.invalid',
  };
}

export function git(sb: Sandbox, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd: sb.repo, env: sb.env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${sb.repo} (exit ${String(r.status)}): ${r.stderr}`);
  return r.stdout.trim();
}

export function put(sb: Sandbox, path: string, text: string) {
  const file = join(sb.repo, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

export function commit(sb: Sandbox, message: string, files: Record<string, string>) {
  for (const [path, text] of Object.entries(files)) put(sb, path, text);
  git(sb, 'add', '--', ...Object.keys(files));
  git(sb, 'commit', '-q', '-m', message);
}

const live: string[] = [];
export function cleanupSandboxes() {
  while (live.length) rmSync(live.pop()!, { recursive: true, force: true, maxRetries: 3 });
}

export function sandbox(): Sandbox {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'verify-receipt-test-')));
  live.push(root);
  const repo = join(root, 'repo');
  mkdirSync(repo);
  const sb: Sandbox = { root, repo, env: hermeticEnv(root) };
  git(sb, 'init', '-q', '-b', 'main');
  if (!same(git(sb, 'rev-parse', '--show-toplevel'), repo)) {
    throw new Error(`SAFETY: git in ${repo} did not see the sandbox as its own repository; refusing to go on`);
  }
  commit(sb, 'init', {
    '.gitignore': 'tmp/\ndist/\n',
    'src/a.ts': 'export const a = 1;\n',
    'docs/notes.md': '# Notes\n',
    'design/spec-final.md': '# Spec\n',
    'design/stats/units.csv': 'unit,hp\nmilitia,40\n',
  });
  return sb;
}

// `asVerifyStep` plays the environment npm gives a step of `npm run verify`.
export function run(sb: Sandbox, args: string[], { asVerifyStep = false, cwd = sb.repo } = {}): Run {
  const env = asVerifyStep
    ? { ...sb.env, npm_lifecycle_event: 'verify', npm_lifecycle_script: 'node scripts/verify-receipt.mjs start && (the stages) && node scripts/verify-receipt.mjs write' }
    : sb.env;
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env, encoding: 'utf8', timeout: 30_000 });
  if (r.error) throw r.error;
  return { status: r.status, out: r.stdout, err: r.stderr };
}

export const start = (sb: Sandbox) => run(sb, ['start'], { asVerifyStep: true });
export const write = (sb: Sandbox) => run(sb, ['write'], { asVerifyStep: true });
export const check = (sb: Sandbox, ...rev: string[]) => run(sb, ['check', ...rev]);

type Report = Record<string, unknown>;

/** The report each suite's reporter writes at its own end, for a whole, passing run of the full suite. */
export function passingReport(runner: keyof typeof REPORTS): Report {
  return {
    runner,
    writtenAt: new Date().toISOString(),
    argv: runner === 'vitest' ? ['run'] : ['test'],
    outcome: runner === 'vitest' ? { status: 'passed', unhandledErrors: 0 } : { status: 'passed' },
    tests: [
      { file: 'tests/a.test.ts', line: 3, title: 'a', state: 'passed', durationMs: 120, timeoutMs: 30_000 },
      { file: 'tests/a.test.ts', line: 9, title: 'b', state: 'skipped', durationMs: 0, timeoutMs: 30_000 },
    ],
  };
}

/**
 * Plays the two suites' reporters. Each runner gets the passing report, merged with its override; `null` writes
 * nothing, as a suite ended from outside writes nothing.
 */
export function suitesReport(sb: Sandbox, overrides: Partial<Record<keyof typeof REPORTS, Report | null>> = {}) {
  for (const runner of ['vitest', 'playwright'] as const) {
    const override = overrides[runner];
    if (override === null) continue;
    put(sb, REPORTS[runner], JSON.stringify({ ...passingReport(runner), ...override }, null, 1));
  }
}

// A whole gate run as the verify chain plays it: `start`, every stage passing with its reports, `write`.
export function gatedRun(sb: Sandbox) {
  const begun = start(sb);
  expect(begun.status, begun.err).toBe(0);
  suitesReport(sb);
  const ended = write(sb);
  expect(ended.status, ended.err).toBe(0);
  expect(ended.err, 'the control certifies').toBe('');
}

export const receiptExists = (sb: Sandbox) => existsSync(join(sb.repo, RECEIPT));
export const readReceipt = (sb: Sandbox) => JSON.parse(readFileSync(join(sb.repo, RECEIPT), 'utf8')) as Record<string, unknown> & { tree: string; commit: string };
export const short = (hash: string) => hash.slice(0, 12);
