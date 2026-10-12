// `scripts/verify-receipt.mjs` makes a landing prove that its gate reached its last step on the tree it pushes. On
// 2026-10-11 a run of `npm run verify` that stopped in the browser suite wrote 0 to its exit file: a chain ended
// through WMI's `Win32_Process.Terminate` exits 0, so the exit file could not tell a pass from a run that never
// finished (docs/learning/defect-register.md, 2026-10-11). The verify chain now begins with `start`, which removes
// the last receipt, and ends with `write`, which certifies the run only if the checkout matched HEAD (no changed,
// staged or untracked file outside the ignored ones) when the gate started and when it finished, and HEAD's tree did
// not move between. `check` accepts a receipt only for the tree being pushed, or for one that differs from it only in
// docs/ and design/spec-final.md.
//
// These tests drive the real command, as a child process, against SACRIFICIAL repositories only: each sandbox is a
// fresh `git init` under the OS temp directory, git runs with every GIT_* variable scrubbed, an empty global config and
// no system config, and each sandbox checks that git sees it as its own top level before any test uses it, so no test
// can reach this checkout or its receipt. The npm lifecycle variables are scrubbed too, and set only where a test
// plays the verify chain's last step. The one junction a test makes points at a copy of the command inside its own
// sandbox, and is removed on its own before the sandbox is deleted.
//
// BOUND. A cut chain is played as `start` with no `write` after it. That a real chain whose sequencer is cut by WMI
// never reaches its last step is a property of `&&` and of where `write` sits in package.json: the last case here
// holds the second, and the first was measured once on a real npm chain (docs/learning/gate-proofs.md). A stage whose
// own process is ended through WMI exits 0 and the chain goes on, which no case here can see; docs/learning/lessons.md
// holds that. Nothing here checks what the receipt does not bind: ../civ-engine, ../voxel, node_modules, the machine.

import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmdirSync, rmSync, symlinkSync, unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { isDocsOnlyPath } from '../../scripts/verify-receipt-lib.mjs';

const SCRIPT = fileURLToPath(new URL('../../scripts/verify-receipt.mjs', import.meta.url));
const LIB = fileURLToPath(new URL('../../scripts/verify-receipt-lib.mjs', import.meta.url));
const PACKAGE_JSON = fileURLToPath(new URL('../../package.json', import.meta.url));
const RECEIPT = 'tmp/verify-receipt.json';
const START_RECORD = 'tmp/verify-receipt.start.json';

interface Sandbox { root: string; repo: string; env: NodeJS.ProcessEnv }
interface Run { status: number | null; out: string; err: string }

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

function git(sb: Sandbox, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd: sb.repo, env: sb.env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${sb.repo} (exit ${String(r.status)}): ${r.stderr}`);
  return r.stdout.trim();
}

function put(sb: Sandbox, path: string, text: string) {
  const file = join(sb.repo, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function commit(sb: Sandbox, message: string, files: Record<string, string>) {
  for (const [path, text] of Object.entries(files)) put(sb, path, text);
  git(sb, 'add', '--', ...Object.keys(files));
  git(sb, 'commit', '-q', '-m', message);
}

// Each sandbox root, and the links inside it, which are removed one by one before the root is.
const live: Array<{ root: string; links: string[] }> = [];
afterEach(() => {
  while (live.length) {
    const { root, links } = live.pop()!;
    for (const link of links) {
      try {
        rmdirSync(link);
      } catch {
        unlinkSync(link);
      }
    }
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

function sandbox(): Sandbox {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'verify-receipt-test-')));
  live.push({ root, links: [] });
  const repo = join(root, 'repo');
  mkdirSync(repo);
  const sb: Sandbox = { root, repo, env: hermeticEnv(root) };
  git(sb, 'init', '-q', '-b', 'main');
  if (!same(git(sb, 'rev-parse', '--show-toplevel'), repo)) {
    throw new Error(`SAFETY: git in ${repo} did not see the sandbox as its own repository; refusing to go on`);
  }
  commit(sb, 'init', {
    '.gitignore': 'tmp/\n',
    'src/a.ts': 'export const a = 1;\n',
    'docs/notes.md': '# Notes\n',
    'design/spec-final.md': '# Spec\n',
    'design/stats/units.csv': 'unit,hp\nmilitia,40\n',
  });
  return sb;
}

// `asVerifyStep` plays the environment npm gives a step of `npm run verify`.
function run(sb: Sandbox, args: string[], { asVerifyStep = false, cwd = sb.repo, script = SCRIPT } = {}): Run {
  const env = asVerifyStep
    ? { ...sb.env, npm_lifecycle_event: 'verify', npm_lifecycle_script: 'node scripts/verify-receipt.mjs start && (the stages) && node scripts/verify-receipt.mjs write' }
    : sb.env;
  const r = spawnSync(process.execPath, [script, ...args], { cwd, env, encoding: 'utf8', timeout: 30_000 });
  if (r.error) throw r.error;
  return { status: r.status, out: r.stdout, err: r.stderr };
}

const start = (sb: Sandbox) => run(sb, ['start'], { asVerifyStep: true });
const write = (sb: Sandbox) => run(sb, ['write'], { asVerifyStep: true });
const check = (sb: Sandbox, ...rev: string[]) => run(sb, ['check', ...rev]);

// A whole gate run as the verify chain plays it: `start`, every stage passing, `write`.
function gatedRun(sb: Sandbox) {
  const begun = start(sb);
  expect(begun.status, begun.err).toBe(0);
  const ended = write(sb);
  expect(ended.status, ended.err).toBe(0);
  expect(ended.err, 'the control certifies').toBe('');
}

// write does not certify such a run, and still exits 0, so the exit code of `npm run verify` keeps saying whether
// every stage exited 0; `check` is what refuses it.
function uncertified(ended: Run) {
  expect(ended.status, 'write exits 0, so the verdict on the stages stands').toBe(0);
  expect(ended.err).toContain('NOT CERTIFIED');
}

const receiptExists = (sb: Sandbox) => existsSync(join(sb.repo, RECEIPT));
const readReceipt = (sb: Sandbox) => JSON.parse(readFileSync(join(sb.repo, RECEIPT), 'utf8')) as { tree: string; commit: string };
const short = (hash: string) => hash.slice(0, 12);

describe('a gate run earns a receipt only by reaching its last step', () => {
  it('a run that reaches write earns a receipt that check accepts for HEAD', () => {
    const sb = sandbox();
    gatedRun(sb);
    const tree = git(sb, 'rev-parse', 'HEAD^{tree}');
    expect(readReceipt(sb).tree).toBe(tree);
    for (const accepted of [check(sb), check(sb, 'HEAD')]) {
      expect(accepted.status, accepted.err).toBe(0);
      expect(accepted.out).toContain(short(tree));
    }
  });

  it('a run cut before write leaves no receipt, even where the last good run left one', () => {
    const sb = sandbox();
    gatedRun(sb);
    expect(receiptExists(sb), 'the control: a complete run left a receipt').toBe(true);
    // The cut: the chain's first step runs, and the chain never reaches its last.
    expect(start(sb).status).toBe(0);
    expect(receiptExists(sb), 'start must remove the last good run\'s receipt').toBe(false);
    const refused = check(sb);
    expect(refused.status).toBe(1);
    expect(refused.err).toContain('No receipt');
    expect(refused.err).toContain('npm run verify');
  });

  it('the command does its work when reached through a junction, rather than exiting 0 having done nothing', () => {
    const sb = sandbox();
    const tool = join(sb.root, 'tool');
    mkdirSync(tool);
    copyFileSync(SCRIPT, join(tool, 'verify-receipt.mjs'));
    copyFileSync(LIB, join(tool, 'verify-receipt-lib.mjs'));
    const link = join(sb.root, 'tool-link');
    symlinkSync(tool, link, 'junction');
    live.at(-1)!.links.push(link);
    const refused = run(sb, ['check'], { script: join(link, 'verify-receipt.mjs') });
    expect(refused.status, 'no receipt exists, so check must refuse').toBe(1);
    expect(refused.err).toContain('No receipt');
  });
});

describe('check refuses a receipt that does not cover the tree being pushed', () => {
  it('refuses a receipt for another tree, naming every changed path outside docs/', () => {
    const sb = sandbox();
    gatedRun(sb);
    const gated = git(sb, 'rev-parse', 'HEAD^{tree}');
    commit(sb, 'code and data', { 'src/a.ts': 'export const a = 2;\n', 'design/stats/units.csv': 'unit,hp\nmilitia,45\n' });
    const refused = check(sb);
    expect(refused.status).toBe(1);
    expect(refused.err).toContain('src/a.ts');
    expect(refused.err).toContain('design/stats/units.csv');
    expect(refused.err).toContain(short(gated));
    expect(refused.err).toContain(short(git(sb, 'rev-parse', 'HEAD^{tree}')));
  });

  it('refuses another tree from a subdirectory, whatever diff settings the repository carries', () => {
    const sb = sandbox();
    gatedRun(sb);
    commit(sb, 'code', { 'src/a.ts': 'export const a = 6;\n' });
    git(sb, 'config', 'diff.relative', 'true');
    const refused = run(sb, ['check'], { cwd: join(sb.repo, 'docs') });
    expect(refused.status).toBe(1);
    expect(refused.err).toContain('src/a.ts');
  });

  it('refuses a run whose checkout did not match HEAD when the gate started, though it did when it finished', () => {
    const sb = sandbox();
    put(sb, 'src/a.ts', 'export const a = 3;\n');
    put(sb, 'src/new.ts', 'export const fresh = 1;\n');
    expect(start(sb).status).toBe(0);
    git(sb, 'checkout', '--', 'src/a.ts');
    rmSync(join(sb.repo, 'src/new.ts'));
    expect(git(sb, 'status', '--porcelain'), 'the premise: the checkout matches HEAD again before write').toBe('');
    const ended = write(sb);
    const refused = check(sb);
    expect(refused.status, 'check refuses the run').toBe(1);
    expect(refused.err).toContain('when the gate started');
    expect(refused.err).toContain('src/a.ts');
    expect(refused.err).toContain('src/new.ts (untracked)');
    uncertified(ended);
  });

  // An untracked file alone, so the verdict rests on untracked files counting: a new source file nobody added would
  // otherwise pass every stage and be certified for a HEAD that lacks it.
  it('refuses a run whose checkout held an untracked file when the gate finished', () => {
    const sb = sandbox();
    expect(start(sb).status).toBe(0);
    put(sb, 'src/new.ts', 'export const fresh = 2;\n');
    expect(git(sb, 'status', '--porcelain'), 'the premise: only the untracked file differs').toBe('?? src/new.ts');
    const ended = write(sb);
    const refused = check(sb);
    expect(refused.status, 'check refuses the run').toBe(1);
    expect(refused.err).toContain('when the gate finished');
    expect(refused.err).toContain('src/new.ts (untracked)');
    uncertified(ended);
  });

  it('refuses a run during which HEAD\'s tree moved, even by a docs-only commit', () => {
    const sb = sandbox();
    expect(start(sb).status).toBe(0);
    commit(sb, 'devlog while the gate runs', { 'docs/notes.md': '# Notes\n\nA line written mid-run.\n' });
    const ended = write(sb);
    const refused = check(sb);
    expect(refused.status, 'check refuses the run').toBe(1);
    expect(refused.err).toContain('moved while the gate ran');
    uncertified(ended);
    expect(ended.err).toContain('docs/notes.md');
  });

  it('certifies a run during which HEAD moved to a commit with the same tree', () => {
    const sb = sandbox();
    expect(start(sb).status).toBe(0);
    git(sb, 'commit', '-q', '--allow-empty', '-m', 'same tree');
    const ended = write(sb);
    expect(ended.status, ended.err).toBe(0);
    expect(check(sb).status).toBe(0);
  });
});

describe('check accepts a tree that differs from the gated one only in docs/ and design/spec-final.md', () => {
  it('accepts docs-only commits after the receipt, and refuses once a code commit follows them', () => {
    const sb = sandbox();
    gatedRun(sb);
    commit(sb, 'devlog', { 'docs/notes.md': '# Notes\n\nDevlog line.\n' });
    commit(sb, 'spec', { 'design/spec-final.md': '# Spec\n\nA rule.\n' });
    const accepted = check(sb);
    expect(accepted.status, accepted.err).toBe(0);
    expect(accepted.out).toContain('docs/notes.md');
    expect(accepted.out).toContain('design/spec-final.md');
    expect(accepted.out).toContain('tests/architecture');
    commit(sb, 'code', { 'src/a.ts': 'export const a = 5;\n' });
    const refused = check(sb);
    expect(refused.status).toBe(1);
    expect(refused.err).toContain('src/a.ts');
    expect(refused.err).not.toContain('docs/notes.md');
  });

  it('keeps a receipt across a rebase onto docs-only commits, and refuses one after a rebase onto code', () => {
    const sb = sandbox();
    git(sb, 'checkout', '-q', '-b', 'feature');
    commit(sb, 'feature code', { 'src/b.ts': 'export const b = 1;\n' });
    gatedRun(sb);
    const gatedCommit = readReceipt(sb).commit;
    git(sb, 'checkout', '-q', 'main');
    commit(sb, 'docs on main', { 'docs/main-notes.md': 'main\n' });
    git(sb, 'checkout', '-q', 'feature');
    git(sb, 'rebase', '-q', 'main');
    const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', gatedCommit, 'HEAD'], { cwd: sb.repo, env: sb.env });
    expect(ancestry.status, 'the premise: the gated commit is no longer in HEAD\'s history').toBe(1);
    const accepted = check(sb);
    expect(accepted.status, accepted.err).toBe(0);
    expect(accepted.out).toContain('docs/main-notes.md');
    git(sb, 'checkout', '-q', 'main');
    commit(sb, 'code on main', { 'src/k.ts': 'export const k = 1;\n' });
    git(sb, 'checkout', '-q', 'feature');
    git(sb, 'rebase', '-q', 'main');
    const refused = check(sb);
    expect(refused.status).toBe(1);
    expect(refused.err).toContain('src/k.ts');
  });

  it('counts a path as docs-only by its exact prefix, case and name', () => {
    for (const path of ['docs/notes.md', 'docs/work/124_verify-receipt/plan.md', 'design/spec-final.md']) {
      expect(isDocsOnlyPath(path), path).toBe(true);
    }
    for (const path of [
      'docs', 'Docs/notes.md', 'docs-old/notes.md', 'src/docs/notes.md', 'design/spec-final.md.bak',
      'design/spec-final.mdx', 'design/stats/units.csv', 'package.json', 'tests/architecture/threadHygiene.test.ts',
    ]) {
      expect(isDocsOnlyPath(path), path).toBe(false);
    }
  });
});

describe('write and check refuse what they cannot vouch for', () => {
  it('write refuses outside npm run verify, and without a start record', () => {
    const sb = sandbox();
    expect(start(sb).status).toBe(0);
    const alone = run(sb, ['write']);
    expect(alone.status).toBe(1);
    expect(alone.err).toContain('npm_lifecycle_event');
    expect(receiptExists(sb)).toBe(false);
    unlinkSync(join(sb.repo, START_RECORD));
    const unstarted = write(sb);
    expect(unstarted.status).toBe(1);
    expect(unstarted.err).toContain('start');
    expect(receiptExists(sb)).toBe(false);
  });

  it('check refuses a receipt it cannot read, and an unknown mode is a usage error', () => {
    const sb = sandbox();
    mkdirSync(join(sb.repo, 'tmp'), { recursive: true });
    writeFileSync(join(sb.repo, RECEIPT), '{"format": 1, "tree": ');
    const garbled = check(sb);
    expect(garbled.status).toBe(1);
    expect(garbled.err).toContain('not valid JSON');
    writeFileSync(join(sb.repo, RECEIPT), JSON.stringify({ format: 2 }));
    const foreign = check(sb);
    expect(foreign.status).toBe(1);
    expect(foreign.err).toContain('format');
    const usage = run(sb, ['bogus']);
    expect(usage.status).toBe(2);
    expect(usage.err).toContain('usage');
  });
});

describe('npm run verify', () => {
  it('begins with start, ends with write, and chains every stage between with &&', () => {
    const verify = (JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { scripts: Record<string, string> }).scripts.verify;
    const steps = verify.split(' && ');
    expect(steps[0], 'the first step removes the last receipt').toBe('node scripts/verify-receipt.mjs start');
    expect(steps.at(-1), 'the last step writes the receipt, so only a chain whose every stage exited 0 reaches it')
      .toBe('node scripts/verify-receipt.mjs write');
    const stages = steps.slice(1, -1);
    for (const stage of stages) {
      expect(stage, 'a stage is one npm script, joined to the next by && alone').toMatch(/^npm run [\w:-]+$/);
    }
    expect(stages.map((stage) => stage.slice('npm run '.length)), 'the six stages AGENTS.md names; a new one goes between start and write')
      .toEqual(['content:validate', 'test', 'typecheck', 'test:browser', 'lint', 'build']);
  });
});
