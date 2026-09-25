// Every CI job fails before its time limit cancels it, and the browser suite is
// split so that no spec goes unrun — the gate for the 2026-09-23 register entry.
//
// What happened. ci.yml's browser job ran its suite for 37.9-43.7 minutes of a
// 45-minute limit on every run from 2026-09-06 to 2026-09-23 but one, and said
// nothing about it until run 35896557214 was cancelled at the limit. The job is
// now four shards, and every job ends with scripts/ci-job-headroom.mjs, which
// fails a job that has used more than two thirds of its own limit.
//
// Three parts.
// (1) The verdict: `judgeHeadroom` on the numbers that were measured, both
//     sides of the ceiling, plus the CLI's exit code, including the case where
//     the job's start time never arrived (it must fail, not pass unmeasured).
// (2) The wiring, read from the PARSED ci.yml: every job exports the clock in
//     its first step, runs the check after every step that runs on success,
//     and passes the check the job's own `timeout-minutes`, so the two numbers
//     cannot drift apart.
// (3) The split: the browser job's shards are exactly 1..N, and the suite step
//     passes `--shard=<shard>/<strategy.job-total>`, so the matrix and the
//     split cannot disagree and no shard's specs are silently skipped.
//
// BOUND: this reads ci.yml only, not playtest.yml. It
// proves the check is wired and judges correctly; whether a real runner stays
// under the ceiling is only known from real runs (the numbers are in ci.yml's
// browser-job comment). It does not prove Playwright's `--shard` covers every
// test exactly once: that is Playwright's contract (runner/testGroups.js).

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
}

interface Job {
  readonly name?: string;
  readonly 'timeout-minutes'?: number;
  readonly strategy?: { readonly matrix?: Record<string, unknown> };
  readonly steps?: readonly Step[];
}

function ciJobs(): Record<string, Job> {
  const loadCjs = createRequire(import.meta.url);
  const yaml = loadCjs('js-yaml') as { load(source: string): unknown };
  const doc = yaml.load(readFileSync(`${ROOT}.github/workflows/ci.yml`, 'utf8')) as { jobs?: Record<string, Job> };
  const jobs = doc.jobs ?? {};
  // A reader that found nothing would make every check below vacuous.
  expect(Object.keys(jobs).sort(), 'ci.yml no longer has the jobs this gate was written for').toEqual(['browser', 'gates']);
  return jobs;
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

describe('ci.yml: the browser suite is split with nothing left over', () => {
  it('runs shards 1..N, each passing its own index over strategy.job-total', () => {
    const browser = ciJobs().browser!;
    const shards = browser.strategy?.matrix?.shard;
    expect(Array.isArray(shards), 'the browser job has no `matrix.shard` list').toBe(true);
    const list = shards as unknown[];
    expect(list.length, 'one shard is not a split').toBeGreaterThanOrEqual(2);
    expect(list, 'shard indices must be exactly 1..N, or a slice of the suite never runs').toEqual(
      Array.from({ length: list.length }, (_, index) => index + 1),
    );
    const suite = (browser.steps ?? []).filter((step) => /\bnpm run test:browser\b/.test(step.run ?? ''));
    expect(suite.map((step) => step.run?.trim())).toEqual([
      'npm run test:browser -- --shard=${{ matrix.shard }}/${{ strategy.job-total }}',
    ]);
  });
});
