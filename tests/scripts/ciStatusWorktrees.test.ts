// `npm run ci:status` is the command every session runs first, and until 2026-11-04 it read only the remote gates. That
// day the coordinator's repo review found 18 worktrees of this repo on disk, every HEAD merged into main, idle for 4 to
// 34 days, 15 of them holding uncommitted work main lacked. Nothing had listed them (defect register, 2026-11-04;
// work 138). The command now reports them, through scripts/ci-status-worktrees.mjs, and this holds it to that.
//
// The contract. A LEFTOVER is a registered worktree, other than the primary checkout and the caller's own, whose HEAD
// main contains and that has had no activity for 24 hours. Activity is a change to a non-ignored file or a folder that
// holds one, to the worktree's index or HEAD, or to its HEAD or branch reflog. A leftover makes the command exit 2
// when the remote gates are not red, and the remote verdict keeps exit 1 when they are; either way the leftover is
// named with its path, branch, idle age and uncommitted counts, with the retirement step. Reported and never failing:
// an idle worktree whose HEAD main lacks, a worktree locked with a reason, a registered worktree whose folder is gone,
// a folder under ../aoe2-worktrees that git does not list, and each retained/* branch with the open plans naming it.
// The check reads and never writes: a plain `git status` would rewrite the index it reads and make the worktree look
// active for a day, as the coordinator's own audit did to two of the 18.
//
// How. Each case plants worktrees in a sandbox repository under the OS temp directory (helpers/worktreeSandbox.ts) and
// runs the whole script through the harness: `gh` is the captured green or red fixtures of ciStatus.test.ts, and the
// check's own git calls run for real inside the sandbox. Idle means mtimes set 50 or 72 hours back.
//
// BOUND. The sandbox is a small repository with one commit; the real repo's 2,700 files and its node_modules junction
// are met only by running the command on this machine (work 138's plan records that run). Mtimes are the evidence, so
// this proves the check reads the right times, not that every kind of work leaves one. The gh fixtures prove the exit
// code's combination with the remote verdict, not GitHub's shapes (see ciStatus.test.ts). Red proof:
// docs/learning/gate-proofs.md, "A worktree left behind after its work merged".

import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { fixture, runScript, type Scenario } from './helpers/ciStatusHarness';
import { disposeTemplate, makeTemplate, openSandbox, type RealExec, type Sandbox } from './helpers/worktreeSandbox';

vi.mock('node:child_process', async () => {
  const { exec } = await import('./helpers/ciStatusHarness');
  return { execFileSync: exec };
});

// The two captured remote answers of ciStatus.test.ts: a commit whose runs passed, and one whose CI failed.
const GREEN: Scenario = {
  tip: 'c538545865c3b2ee5b3ae3fee9351e48b2eccaf2',
  subject: 'Merge: motion smoothing survives a slow machine (v0.3.192)',
  runsForSha: fixture('runs-for-sha--green-c5385458.json'),
  history: {
    CI: fixture('run-list--ci-through-2026-09-03.json'),
    'playtest-corpus': fixture('run-list--playtest-corpus-through-2026-09-03.json'),
  },
  jobs: {
    33713720750: fixture('jobs--green-33713720750.json'),
    33713720749: fixture('jobs--green-33713720750.json'),
  },
  changed: fixture('changed--version-bump.txt'),
};
const RED: Scenario = {
  tip: '619e3994fd91178c1863257130616c88d6990966',
  subject: "Walk at AoE2's real speeds",
  runsForSha: fixture('runs-for-sha--red-619e3994.json'),
  history: {
    CI: fixture('run-list--ci-through-2026-08-29.json'),
    'playtest-corpus': fixture('run-list--playtest-corpus-through-2026-08-29.json'),
  },
  jobs: {
    33233227742: fixture('jobs--red-33233227742.json'),
    33233227739: fixture('jobs--red-33233227742.json'),
  },
  annotations: { 99049576048: fixture('annotations--red-99049576048.json') },
  changed: fixture('changed--version-bump.txt'),
};

let realExec: RealExec;
let template = '';
const boxes: Sandbox[] = [];

beforeAll(async () => {
  const real = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  realExec = real.execFileSync as RealExec;
  template = makeTemplate(realExec);
});

afterEach(() => {
  while (boxes.length > 0) boxes.pop()!.dispose();
});

afterAll(() => disposeTemplate(template));

function sandbox(): Sandbox {
  const box = openSandbox(realExec, template);
  boxes.push(box);
  return box;
}

const check = (box: Sandbox, remote: Scenario = GREEN, checkout: string = box.primary) =>
  runScript({ ...remote, sandbox: { root: box.root, checkout } });

const lineFor = (out: string, marker: string): string => out.split('\n').find((line) => line.includes(marker)) ?? '';

// A worktree whose HEAD is main's tip, holding one staged, one modified and one untracked file, idle for 72 hours.
function plantLeftover(box: Sandbox, name = 'stale-1104'): string {
  const wt = box.worktree(name);
  writeFileSync(join(wt, 'README.md'), 'changed\n');
  writeFileSync(join(wt, 'docs', 'staged.md'), 'staged\n');
  box.git(wt, 'add', 'docs/staged.md');
  writeFileSync(join(wt, 'notes.txt'), 'untracked\n');
  box.backdate(wt, 72);
  return wt;
}

describe('ci:status names a worktree left behind after its work merged', () => {
  // THE case: the shape of all 18 on 2026-11-04.
  it('exits 2 on an idle worktree whose HEAD main contains, with its path, branch, idle age and uncommitted counts', async () => {
    const box = sandbox();
    const wt = plantLeftover(box);
    const { out, exitCode } = await check(box);
    expect(exitCode, out).toBe(2);
    expect(out).toContain('Worktrees: 1 LEFTOVER');
    const line = lineFor(out, '  LEFTOVER ');
    expect(line).toContain(`${box.shown(wt)} [stale-1104]`);
    expect(line).toContain('idle 3 days');
    expect(line).toContain('1 staged, 1 modified, 1 untracked');
    expect(out).toMatch(/on a commit first.*controlWorktree\.mjs remove/);
    expect(out).toContain('Remote CI is not what failed');
    expect(out).not.toContain('A red or ungated remote gate is the next task');
  });

  it('still names the leftover when the remote gate is red, and exits 1 for the remote gate', async () => {
    const box = sandbox();
    plantLeftover(box);
    const { out, exitCode } = await check(box, RED);
    expect(exitCode, out).toBe(1);
    expect(lineFor(out, '  LEFTOVER ')).toContain('[stale-1104]');
    expect(out).toContain('A red or ungated remote gate is the next task');
    expect(out).not.toContain('Remote CI is not what failed');
  });

  it('exits 0 with only the primary checkout and an active worktree, and lists the active one', async () => {
    const box = sandbox();
    box.worktree('busy-1104');
    const { out, exitCode } = await check(box);
    expect(exitCode, out).toBe(0);
    expect(out).toContain('Worktrees: no leftover among 2 registered');
    expect(lineFor(out, 'active: ')).toContain('[busy-1104]');
    expect(out).not.toContain('LEFTOVER');
  });

  it('exits 0 for the harness checkout that holds only the primary, and says it looked', async () => {
    const { out, exitCode } = await runScript(GREEN);
    expect(exitCode, out).toBe(0);
    expect(out).toContain('Worktrees: no leftover among 1 registered');
  });

  it("does not count the caller's own checkout", async () => {
    const box = sandbox();
    const wt = plantLeftover(box);
    const { out, exitCode } = await check(box, GREEN, wt);
    expect(exitCode, out).toBe(0);
    expect(out).not.toContain('LEFTOVER');
    expect(out).toContain('this checkout');
  });

  it('exits 2 and says it could not look when the worktrees cannot be listed', async () => {
    const box = sandbox();
    const plain = join(box.root, 'not-a-repository');
    mkdirSync(plain);
    const { out, exitCode } = await check(box, GREEN, plain);
    expect(exitCode, out).toBe(2);
    expect(out).toContain('Worktrees: UNKNOWN');
    expect(out).toContain('Remote CI is not what failed');
  });
});

describe('activity is a change to a non-ignored file, the index, HEAD or a reflog in the last 24 hours', () => {
  // Each case changes exactly one of them on an otherwise idle worktree. `planted.txt` is untracked from the start.
  const SIGNALS: Array<[string, (box: Sandbox, wt: string) => void]> = [
    ['a tracked file written', (_, wt) => writeFileSync(join(wt, 'docs', 'notes.md'), 'edited\n')],
    ['an untracked file created', (box, wt) => {
      writeFileSync(join(wt, 'docs', 'new.md'), 'new\n');
      box.setTime(join(wt, 'docs'), 72); // only the file itself says so
    }],
    ['a tracked file deleted', (_, wt) => unlinkSync(join(wt, 'docs', 'notes.md'))], // only its folder says so
    ['the index, by staging', (box, wt) => box.git(wt, 'add', 'planted.txt')],
    ['HEAD', (box, wt) => box.setTime(join(box.adminDir(wt), 'HEAD'), 0)],
    ['the HEAD reflog', (box, wt) => box.setTime(join(box.adminDir(wt), 'logs', 'HEAD'), 0)],
    ['the branch reflog', (box) => box.setTime(join(box.commonDir(), 'logs', 'refs', 'heads', 'stale-1104'), 0)],
  ];

  it.each(SIGNALS)('counts %s as activity', async (_, act) => {
    const box = sandbox();
    const wt = box.worktree('stale-1104');
    writeFileSync(join(wt, 'planted.txt'), 'planted\n');
    box.backdate(wt, 72);
    act(box, wt);
    const { out, exitCode } = await check(box);
    expect(exitCode, out).toBe(0);
    expect(lineFor(out, 'active: ')).toContain('[stale-1104]');
  });

  it('does not count an ignored file, written or created', async () => {
    const box = sandbox();
    const wt = plantLeftover(box);
    writeFileSync(join(wt, 'tmp', 'run.log'), 'more\n');
    writeFileSync(join(wt, 'tmp', 'new.log'), 'new\n');
    const { out, exitCode } = await check(box);
    expect(exitCode, out).toBe(2);
    expect(lineFor(out, '  LEFTOVER ')).toContain('[stale-1104]');
  });

  it('reads without writing: two runs leave the worktree, its index and its reflogs as they were', async () => {
    const box = sandbox();
    const wt = plantLeftover(box);
    const before = box.stamps(wt);
    const first = await check(box);
    const second = await check(box);
    expect(box.stamps(wt)).toEqual(before);
    expect([first.exitCode, second.exitCode], second.out).toEqual([2, 2]);
  });
});

describe('what it reports without failing', () => {
  it('reports an idle worktree whose HEAD main lacks as unfinished work', async () => {
    const box = sandbox();
    const wt = box.worktree('unfinished-1104');
    writeFileSync(join(wt, 'docs', 'draft.md'), 'draft\n');
    box.git(wt, 'add', 'docs/draft.md');
    box.git(wt, 'commit', '-q', '-m', 'draft');
    writeFileSync(join(wt, 'notes.txt'), 'untracked\n');
    box.backdate(wt, 50);
    const { out, exitCode } = await check(box);
    expect(exitCode, out).toBe(0);
    const line = lineFor(out, '[unfinished-1104]');
    expect(line).toContain('not in main');
    expect(line).toContain('idle 2 days');
    expect(line).toContain('0 staged, 0 modified, 1 untracked');
    expect(out).not.toContain('LEFTOVER');
  });

  it('lists a worktree locked with a reason as exempt, with the reason', async () => {
    const box = sandbox();
    const wt = plantLeftover(box, 'kept-1104');
    box.git(box.primary, 'worktree', 'lock', '--reason', 'reusable checkout for the A/B tool', wt);
    const { out, exitCode } = await check(box);
    expect(exitCode, out).toBe(0);
    expect(lineFor(out, '[kept-1104]')).toMatch(/exempt.*reusable checkout for the A\/B tool/);
  });

  it('does not exempt a lock that gives no reason', async () => {
    const box = sandbox();
    const wt = plantLeftover(box, 'kept-1104');
    box.git(box.primary, 'worktree', 'lock', wt);
    const { out, exitCode } = await check(box);
    expect(exitCode, out).toBe(2);
    expect(lineFor(out, '  LEFTOVER ')).toContain('locked with no reason');
  });

  it('reports a registered worktree whose folder is gone', async () => {
    const box = sandbox();
    const wt = box.worktree('gone-1104');
    box.removeFolder(wt);
    const { out, exitCode } = await check(box);
    expect(exitCode, out).toBe(0);
    expect(lineFor(out, '[gone-1104]')).toContain('git worktree prune');
  });

  it('reports a folder under ../aoe2-worktrees that git does not list', async () => {
    const box = sandbox();
    mkdirSync(join(box.home, 'stray-copy'));
    writeFileSync(join(box.home, 'stray-copy', 'a.txt'), 'a\n');
    const { out, exitCode } = await check(box);
    expect(exitCode, out).toBe(0);
    expect(lineFor(out, 'stray-copy')).toContain('not a registered worktree');
  });

  it('lists every retained/* branch with the open plans that name it', async () => {
    const box = sandbox();
    for (const name of ['retained/named-1104', 'retained/named-1104-v2', 'retained/period-1104', 'retained/orphan-1104']) {
      box.git(box.primary, 'branch', name, 'main');
    }
    const plan = (folder: string, text: string) => {
      mkdirSync(join(box.primary, 'docs', 'work', folder), { recursive: true });
      writeFileSync(join(box.primary, 'docs', 'work', folder, 'plan.md'), text);
    };
    plan('7_demo', '# Demo\n\nStatus: active\n\nKeeps `retained/named-1104-v2` until the owner decides, and retained/period-1104.\n');
    plan('8_done', '# Done\n\nStatus: complete\n\nOnce kept retained/orphan-1104.\n');
    const { out, exitCode } = await check(box);
    expect(exitCode, out).toBe(0);
    const named = lineFor(out, 'named by an open plan');
    expect(named).toContain('retained/named-1104-v2 (7_demo)');
    expect(named, 'a sentence that ends with the name names it').toContain('retained/period-1104 (7_demo)');
    const unnamed = lineFor(out, 'no open plan names');
    expect(unnamed, 'a complete plan is not an open one').toContain('retained/orphan-1104');
    expect(unnamed, 'a plan naming retained/x-v2 does not name retained/x').toMatch(/retained\/named-1104(?!-)/);
  });
});
