// `scripts/verify-receipt.mjs` makes a landing prove that its gate reached its last step on the tree it pushes. On
// 2026-10-11 a run of `npm run verify` that stopped in the browser suite wrote 0 to its exit file: a chain ended
// through WMI's `Win32_Process.Terminate` exits 0, so the exit file could not tell a pass from a run that never
// finished (docs/learning/defect-register.md, 2026-10-11). The verify chain now begins with `start`, which removes
// the last receipt and the suites' last reports, and ends with `write`, which certifies the run only if both suites
// left a report of a whole, passing run (verifyReceiptEvidence.test.ts), the checkout matched HEAD (no changed,
// staged or untracked file outside the ignored ones) when the gate started and when it finished, and HEAD's tree did
// not move between. `check` accepts a receipt only for the tree being pushed, or for one that differs from it only in
// docs/ and design/spec-final.md.
//
// The sandboxes, and why no test here can reach this checkout, are in helpers/receiptSandbox.ts. The command run
// through a junction is tests/scripts/runDirectly.test.ts's.
//
// BOUND. A cut chain is played as `start` with no `write` after it. That a real chain whose sequencer is cut by WMI
// never reaches its last step is a property of `&&` and of where `write` sits in package.json: the last case here
// holds the second, and the first was measured on a real npm chain and on the real gate (docs/learning/gate-proofs.md).
// Nothing here checks what the receipt does not bind: ../civ-engine, ../voxel, node_modules, the machine.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { isDocsOnlyPath } from '../../scripts/verify-receipt-lib.mjs';
import {
  check, cleanupSandboxes, commit, gatedRun, git, put, readReceipt, RECEIPT, receiptExists, run, type Run, sandbox,
  short, start, START_RECORD, suitesReport, write,
} from './helpers/receiptSandbox';

const PACKAGE_JSON = fileURLToPath(new URL('../../package.json', import.meta.url));

afterEach(cleanupSandboxes);

// write does not certify such a run, and still exits 0, so the exit code of `npm run verify` keeps saying whether
// every stage passed; `check` is what refuses it.
function uncertified(ended: Run) {
  expect(ended.status, 'write exits 0, so the verdict on the stages stands').toBe(0);
  expect(ended.err).toContain('NOT CERTIFIED');
}

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
    suitesReport(sb);
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
    suitesReport(sb);
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
    suitesReport(sb);
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
    suitesReport(sb);
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
    suitesReport(sb);
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

  it('check refuses a receipt it cannot read, one of an older format, and an unknown mode is a usage error', () => {
    const sb = sandbox();
    mkdirSync(join(sb.repo, 'tmp'), { recursive: true });
    writeFileSync(join(sb.repo, RECEIPT), '{"format": 2, "tree": ');
    const garbled = check(sb);
    expect(garbled.status).toBe(1);
    expect(garbled.err).toContain('not valid JSON');
    // A format-1 receipt, as work 124 M1 wrote them: certified, for HEAD's tree, and silent on the suites' reports.
    gatedRun(sb);
    const { format: _format, suiteProblems: _problems, evidence: _evidence, ...m1 } = readReceipt(sb);
    writeFileSync(join(sb.repo, RECEIPT), JSON.stringify({ ...m1, format: 1 }));
    const older = check(sb);
    expect(older.status, 'a receipt from before the suites\' reports were required').toBe(1);
    expect(older.err).toContain('format 1');
    expect(older.err).toContain('test suites');
    expect(older.err).toContain('npm run verify');
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
