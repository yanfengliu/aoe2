#!/usr/bin/env node
// A CI job goes red once it has used more than two thirds of its own time
// limit, so a job creeping towards its `timeout-minutes` fails with its numbers
// BEFORE the limit cancels it with none.
//
// WHY (2026-09-23, defect register entry of that date). ci.yml's browser job
// ran its suite for 37.9-43.7 minutes against a 45-minute job limit on every
// run from 2026-09-06 to 2026-09-23 except one (33.9), while the workflow's own
// comment said the suite took 14-17 minutes. None of those runs said how close
// to the limit it had come. The first sign was run 35896557214, attempt 2,
// cancelled at 45 minutes.
//
// WHY TWO THIRDS. The same suite measured 33.6 and 43.3 minutes of tests on two
// runners (0d48f867 and 17ffb567, one spec apart), 1.29x. Every one of
// the 47 spec files ran slower, by 1.12x to 1.42x (median 1.28x), so it was
// the runner and not the suite. A job at two thirds of its limit still
// finishes on a runner 1.5x slower than the one it ran on.
//
// This is a JOB-level threshold, not the per-spec duration budget that
// docs/policies/local-rules.md refuses. A single spec's duration swings 2x in
// both directions between two runs of one bundle; the whole suite moved 1.29x
// between runners.
//
// USAGE (ci.yml). The job's first step exports JOB_STARTED_AT=$(date +%s), and
// its last step runs
//   node scripts/ci-job-headroom.mjs --limit-minutes <the job's timeout-minutes>
// tests/scripts/ciJobHeadroom.test.ts holds `--limit-minutes` equal to each
// job's `timeout-minutes`, so the two cannot drift apart.
//
// BOUND: it measures from the job's first step to its last, so it sees a job
// that finished, never one the limit cancelled, and a job that fails before
// its last step is not measured. It says nothing about workflows other than
// the jobs that call it.

import { pathToFileURL } from 'node:url';

export const MAX_SHARE = 2 / 3;

/**
 * @param {{ startedAtMs: number, nowMs: number, limitMinutes: number, maxShare?: number }} input
 * @returns {{ ok: boolean, elapsedMinutes: number, share: number, message: string }}
 */
export function judgeHeadroom({ startedAtMs, nowMs, limitMinutes, maxShare = MAX_SHARE }) {
  const elapsedMinutes = (nowMs - startedAtMs) / 60_000;
  const share = elapsedMinutes / limitMinutes;
  const used = `${elapsedMinutes.toFixed(1)} of its ${String(limitMinutes)}-minute limit `
    + `(${String(Math.round(share * 100))}%; the ceiling is ${String(Math.round(maxShare * 100))}%)`;
  if (share <= maxShare) {
    return { ok: true, elapsedMinutes, share, message: `This job used ${used}.` };
  }
  return {
    ok: false,
    elapsedMinutes,
    share,
    message: `This job used ${used}, so a runner 1.5x slower would be cancelled at the limit. `
      + 'Split the work across more jobs (the browser suite takes another shard in ci.yml) '
      + 'or make it faster. Raising timeout-minutes hides the same problem until it cancels a run.',
  };
}

function readArgs(argv) {
  const index = argv.indexOf('--limit-minutes');
  const limitMinutes = index >= 0 ? Number(argv[index + 1]) : Number.NaN;
  if (!Number.isFinite(limitMinutes) || limitMinutes <= 0) {
    throw new Error(
      `--limit-minutes must be the job's timeout-minutes, a positive number; got "${String(argv[index + 1])}".`,
    );
  }
  const started = process.env.JOB_STARTED_AT;
  const startedAtSeconds = Number(started);
  if (!started || !Number.isFinite(startedAtSeconds) || startedAtSeconds <= 0) {
    throw new Error(
      `JOB_STARTED_AT must be the job's start time in epoch seconds, exported by its first step `
      + `(echo "JOB_STARTED_AT=$(date +%s)" >> "$GITHUB_ENV"); got "${String(started)}". `
      + 'Without it this check cannot measure the job, and a check that cannot measure must not pass.',
    );
  }
  return { limitMinutes, startedAtMs: startedAtSeconds * 1000 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { limitMinutes, startedAtMs } = readArgs(process.argv.slice(2));
    const verdict = judgeHeadroom({ startedAtMs, nowMs: Date.now(), limitMinutes });
    if (verdict.ok) {
      console.log(verdict.message);
    } else {
      console.error(verdict.message);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
