// Every CI job fails before its time limit cancels it, and the browser suite is
// split so that no spec goes unrun — the gate for the 2026-09-23 register entry.
//
// What happened. ci.yml's browser job ran its suite for 37.9-43.7 minutes of a
// 45-minute limit on every run from 2026-09-06 to 2026-09-23 but one, and said
// nothing about it until run 35896557214 was cancelled at the limit. The job is
// now four shards, and every job ends with scripts/ci-job-headroom.mjs, which
// fails a job that has used more than two thirds of its own limit.
//
// Four parts.
// (1) The verdict: `judgeHeadroom` on the numbers that were measured, both
//     sides of the ceiling, plus the CLI's exit code, including the case where
//     the job's start time never arrived (it must fail, not pass unmeasured).
// (2) The wiring, read from the PARSED ci.yml: every job exports the clock in
//     its first step, runs the check after every step that runs on success,
//     and passes the check the job's own `timeout-minutes`, so the two numbers
//     cannot drift apart.
// (3) The split: the browser job's shards are exactly 1..N, and the suite step
//     passes `--shard=<shard>/<strategy.job-total>`, so the matrix and the
//     split cannot disagree and no shard's specs are silently skipped. The
//     unit suite's shards (2026-11-05, work 143) are held the same way on
//     both runners, against a count written out in the step and the job name.
// (4) The argument reaches the script: no npm or npx command that a Windows
//     job runs under PowerShell has a bare `--`, which PowerShell drops.
//
// BOUND: this reads ci.yml only, not playtest.yml. It
// proves the check is wired and judges correctly; whether a real runner stays
// under the ceiling is only known from real runs (the numbers are in ci.yml's
// comments on each job). It does not prove that `--shard` covers every test
// exactly once: that is each runner's contract (Playwright's
// runner/testGroups.js, vitest's BaseSequencer.shard).

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { judgeHeadroom, MAX_SHARE } from '../../scripts/ci-job-headroom.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../../scripts/ci-job-headroom.mjs', import.meta.url));
const MINUTE = 60_000;

describe('ci-job-headroom: the verdict', () => {
  it('passes a browser shard at the slowest measured runner, 13.3 of 45 minutes', () => {
    const verdict = judgeHeadroom({ startedAtMs: 0, nowMs: 13.3 * MINUTE, limitMinutes: 45 });
    expect(verdict.ok).toBe(true);
    expect(verdict.message).toContain('13.3 of its 45-minute limit (30%');
  });

  it('fails the old single browser job, 44.7 of 45 minutes, and says what to do', () => {
    const verdict = judgeHeadroom({ startedAtMs: 0, nowMs: 44.7 * MINUTE, limitMinutes: 45 });
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain('44.7 of its 45-minute limit (99%; the ceiling is 67%)');
    expect(verdict.message).toContain('Raising timeout-minutes hides the same problem');
  });

  it('puts the ceiling at two thirds of the limit, inclusive', () => {
    expect(MAX_SHARE).toBeCloseTo(2 / 3, 10);
    expect(judgeHeadroom({ startedAtMs: 0, nowMs: 30 * MINUTE, limitMinutes: 45 }).ok).toBe(true);
    expect(judgeHeadroom({ startedAtMs: 0, nowMs: 30.1 * MINUTE, limitMinutes: 45 }).ok).toBe(false);
  });

  function run(env: Record<string, string | undefined>, limit = '45') {
    const childEnv: Record<string, string | undefined> = { ...process.env, ...env };
    if (env.JOB_STARTED_AT === undefined) delete childEnv.JOB_STARTED_AT;
    return spawnSync(process.execPath, [SCRIPT, '--limit-minutes', limit], {
      encoding: 'utf8',
      env: childEnv,
    });
  }

  it('exits 0 for a job inside the ceiling and 1 for a job past it', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const inside = run({ JOB_STARTED_AT: String(nowSeconds - 10 * 60) });
    expect(inside.status, inside.stderr).toBe(0);
    expect(inside.stdout).toContain('of its 45-minute limit');
    const past = run({ JOB_STARTED_AT: String(nowSeconds - 40 * 60) });
    expect(past.status).toBe(1);
    expect(past.stderr).toContain('so a runner 1.5x slower would be cancelled at the limit');
  });

  it('fails, naming the variable, when the job never started its clock', () => {
    const unmeasured = run({ JOB_STARTED_AT: undefined });
    expect(unmeasured.status).toBe(1);
    expect(unmeasured.stderr).toContain('JOB_STARTED_AT must be the job\'s start time');
    const badLimit = run({ JOB_STARTED_AT: String(Math.floor(Date.now() / 1000)) }, 'soon');
    expect(badLimit.status).toBe(1);
    expect(badLimit.stderr).toContain('--limit-minutes must be the job\'s timeout-minutes');
  });
});

interface Step {
  readonly name?: string;
  readonly run?: string;
  readonly if?: string;
  readonly shell?: string;
  readonly 'continue-on-error'?: unknown;
}

interface RunDefaults { readonly defaults?: { readonly run?: { readonly shell?: string } } }

interface Job extends RunDefaults {
  readonly name?: string;
  readonly if?: string;
  readonly 'continue-on-error'?: unknown;
  readonly 'runs-on'?: string;
  readonly 'timeout-minutes'?: number;
  readonly strategy?: { readonly matrix?: Record<string, unknown> };
  readonly steps?: readonly Step[];
}

interface Workflow extends RunDefaults { readonly jobs?: Record<string, Job> }

function ciWorkflow(): Workflow {
  const loadCjs = createRequire(import.meta.url);
  const yaml = loadCjs('js-yaml') as { load(source: string): unknown };
  const doc = yaml.load(readFileSync(`${ROOT}.github/workflows/ci.yml`, 'utf8')) as Workflow;
  // A reader that found nothing would make every check below vacuous.
  expect(Object.keys(doc.jobs ?? {}).sort(), 'ci.yml no longer has the jobs this gate was written for').toEqual(['browser', 'gates']);
  return doc;
}

function ciJobs(): Record<string, Job> {
  return ciWorkflow().jobs ?? {};
}

const CLOCK = /^echo "JOB_STARTED_AT=\$\(date \+%s\)" >> "\$GITHUB_ENV"$/;
const CHECK = /^node scripts\/ci-job-headroom\.mjs --limit-minutes (\d+)$/;

describe('ci.yml: every job measures itself against its own limit', () => {
  it.each(['gates', 'browser'])('%s starts the clock first and checks it after every step that runs on success', (key) => {
    const job = ciJobs()[key]!;
    const steps = job.steps ?? [];
    expect(steps[0]?.run?.trim(), `${key}'s first step must start the headroom clock`).toMatch(CLOCK);
    const checkAt = steps.findIndex((step) => CHECK.test(step.run?.trim() ?? ''));
    expect(checkAt, `${key} has no step running scripts/ci-job-headroom.mjs`).toBeGreaterThan(0);
    const after = steps.slice(checkAt + 1).filter((step) => step.if !== 'failure()');
    expect(
      after.map((step) => step.name),
      `${key} runs steps on success after its headroom check, so the check does not measure them`,
    ).toEqual([]);
    const limit = Number(CHECK.exec(steps[checkAt]!.run!.trim())![1]);
    expect(
      limit,
      `${key} checks its headroom against ${String(limit)} minutes, but its timeout-minutes is ${String(job['timeout-minutes'])}`,
    ).toBe(job['timeout-minutes']);
  });
});

/** The job's `matrix.shard` list, held to exactly 1..N with N of at least two. */
function shardList(key: string, job: Job): number[] {
  const shards = job.strategy?.matrix?.shard;
  expect(Array.isArray(shards), `the ${key} job has no \`matrix.shard\` list`).toBe(true);
  const list = shards as number[];
  expect(list.length, 'one shard is not a split').toBeGreaterThanOrEqual(2);
  expect(list, 'shard indices must be exactly 1..N, or a slice of the suite never runs').toEqual(
    Array.from({ length: list.length }, (_, index) => index + 1),
  );
  return list;
}

describe('ci.yml: the browser suite is split with nothing left over', () => {
  it('runs shards 1..N, each passing its own index over strategy.job-total', () => {
    const browser = ciJobs().browser!;
    shardList('browser', browser);
    const suite = (browser.steps ?? []).filter((step) => /\bnpm run test:browser\b/.test(step.run ?? ''));
    expect(suite.map((step) => step.run?.trim())).toEqual([
      'npm run test:browser -- --shard=${{ matrix.shard }}/${{ strategy.job-total }}',
    ]);
  });
});

// The 2026-11-05 entry: unsharded, the unit suite's job reached 40.2 of its 60
// minutes on windows-latest (run 41990047794). Its matrix crosses the runners
// with the shards, so `strategy.job-total` counts both and cannot be the
// count: the count is written out, and held here to the list's length.
describe('ci.yml: the unit suite is split with nothing left over, on both runners', () => {
  it('crosses both runners with shards 1..N and nothing else, so no runner and no slice drops out', () => {
    const gates = ciJobs().gates!;
    const matrix = gates.strategy?.matrix ?? {};
    // An `include` or `exclude` could add or drop single combinations.
    expect(Object.keys(matrix).sort(), 'the unit matrix is the runners crossed with the shards').toEqual(['os', 'shard']);
    expect(matrix.os, 'the unit suite runs on both runners; windows-latest is there for Windows-only defects')
      .toEqual(['ubuntu-latest', 'windows-latest']);
    expect(gates['runs-on'], 'each job runs on the runner its matrix entry names').toBe('${{ matrix.os }}');
  });

  it('passes each job its own index over the list\'s length, names the slice, and runs it unconditionally', () => {
    const gates = ciJobs().gates!;
    const total = shardList('gates', gates).length;
    const suite = (gates.steps ?? []).filter((step) => /\bnpm (?:run )?test\b(?!:)/.test(step.run ?? ''));
    // The `--` is quoted for PowerShell; the describe below says why.
    expect(suite.map((step) => step.run?.trim())).toEqual([`npm test '--' --shard=\${{ matrix.shard }}/${String(total)}`]);
    expect(gates.name, 'the job name says which slice it ran').toContain(`test \${{ matrix.shard }}/${String(total)}`);
    // A condition could skip a slice, its per-test check with it, and
    // continue-on-error could pass a red one (review round 0, F0).
    for (const [what, holder] of [['the job', gates], ['the suite step', suite[0]!]] as const) {
      expect(holder.if, `${what} carries a condition, which could skip a slice`).toBeUndefined();
      expect(holder['continue-on-error'], `${what} may continue on error, which would pass a red slice`).toBeUndefined();
    }
  });
});

/**
 * Whether a PowerShell `run:` block names npm or npx anywhere and holds a bare
 * `--` anywhere. The whole block is the unit, not a line or a parsed command:
 * PowerShell lets one command span lines in more ways than a pattern follows
 * (a backtick, an open `$(` or `(`, a call operator on its own line), and
 * three rounds of review each found one (rounds 0-2, F1). And a bare `--` is
 * found by its characters, not by the whitespace around it, since a bracket
 * also ends a PowerShell token (`--('...')`, `$(...)--`; round 3): two hyphens
 * that no word character, hyphen or quote touches. `--shard`, `'--'` and
 * `$i--` are not bare. The price is that a bare `--` in such a block fails
 * even when it belongs to another command, a comment or a string: quote it, or
 * give that command a step of its own. An npm the block never names (an alias,
 * a script that calls it) is not seen.
 */
function holdsBareDoubleDashNpm(run: string): boolean {
  return /\b(?:npm|npx)\b/i.test(run) && /(?<![\w'"-])--(?![\w'"-])/.test(run);
}

// Found 2026-11-05, before the split first ran: an npm.ps1 that hands node its
// $args, as npm 10.8.2's does, never sees a bare `--` under PowerShell, the
// default shell on windows-latest, and npm then keeps `--shard` for itself, so
// every file would run in every Windows shard. On windows-latest today
// PowerShell finds npm.cmd instead and keeps a bare `--` (run 42009011415);
// quoted, the slice reaches vitest through either shim, and under bash. The
// rule covers every npm or npx command a Windows job runs under PowerShell.
describe('ci.yml: what follows `--` reaches the npm script on windows-latest too', () => {
  it('quotes the `--` of every npm or npx command that a Windows job runs under PowerShell', () => {
    const workflow = ciWorkflow();
    const offenders: string[] = [];
    let read = 0;
    for (const [key, job] of Object.entries(workflow.jobs ?? {})) {
      const os = job.strategy?.matrix?.os;
      const runners = [job['runs-on'], ...(Array.isArray(os) ? os : [])].map(String);
      if (!runners.some((runner) => runner.startsWith('windows'))) continue;
      for (const step of job.steps ?? []) {
        // GitHub's default shell on Windows is pwsh.
        const shell = step.shell ?? job.defaults?.run?.shell ?? workflow.defaults?.run?.shell ?? 'pwsh';
        if (step.run === undefined || !/^(?:pwsh|powershell)\b/.test(shell)) continue;
        read += 1;
        if (holdsBareDoubleDashNpm(step.run)) offenders.push(`${key} › ${step.name ?? '(unnamed step)'}: ${step.run.trim()}`);
      }
    }
    expect(read, 'no Windows step runs under PowerShell, so this check read nothing').toBeGreaterThan(0);
    expect(offenders, 'PowerShell drops a bare `--` before npm.ps1 sees it: write it quoted, as \'--\'').toEqual([]);
  });
});
