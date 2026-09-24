// Which ATTEMPT of a workflow run gave its verdict, and what the attempts
// before it did.
//
// GitHub re-runs a failed run in place: the run keeps its id, `run_attempt`
// goes up, and `conclusion` becomes the NEWEST attempt's. Both lists
// `ci:status` reads — `gh run list` and `actions/runs?head_sha=` — report that
// newest conclusion and nothing else, so a commit whose first attempt failed
// and whose re-run passed read GREEN. Run 36019109919 on `221329b4`
// (2026-09-24) is the case that made this file: attempt 1 failed
// `ubuntu-latest — browser suite 3/4` on `game-selection-click.spec.ts:110`,
// attempt 2 passed, and the command said GREEN. That is how a spec that had
// already failed on `f92c1157` the same morning stayed out of the defect
// register (docs/learning/defect-register.md, 2026-09-24).
//
// Every function takes `gh` as an argument, so this file runs no subprocess of
// its own and keeps nothing between calls. scripts/ci-status.mjs is the only
// caller; tests/scripts/ciStatusReruns.test.ts holds the verdicts.

// A job with any other conclusion — failure, cancelled, timed_out, or none at
// all in an attempt that has finished — counts as failed.
const PASSED = new Set(['success', 'skipped', 'neutral']);

const JOBS_JQ = '[.jobs[] | {name, conclusion, completedAt: .completed_at,'
  + ' runner: (.runner_name // ""), steps: (.steps | length),'
  + ' failedSteps: [.steps[] | select(.conclusion == "failure" or .conclusion == "timed_out"'
  + ' or .conclusion == "cancelled") | .name]}]';

const FLAKY_TAIL = 'The same commit went red and then green, so either a test or the product'
  + ' is flaky. Register it in docs/learning/defect-register.md and fix the cause.'
  + ' A re-run is not a fix.';

// A job ends "cancelled" when someone cancels it and when it hits its time
// limit. Its conclusion does not say which; its check-run annotation does (run
// 35896557214's said "The job has exceeded the maximum execution time of
// 45m0s"). So a cancelled job stays red, and is not called a flake.
const CANCELLED_TAIL = 'Every job that did not pass was cancelled, which is how a job that hits'
  + ' its time limit ends as well as one cancelled by hand; its check-run annotation says'
  + ' "exceeded the maximum execution time" when it was the limit.';

const tailFor = (jobs) => (jobs.length > 0 && jobs.every((job) => job.conclusion === 'cancelled')
  ? CANCELLED_TAIL
  : FLAKY_TAIL);

export function attemptJobsFor(gh, runId, attempt) {
  return JSON.parse(gh([
    'api', `repos/{owner}/{repo}/actions/runs/${String(runId)}/attempts/${String(attempt)}/jobs?per_page=100`,
    '--jq', JOBS_JQ,
  ]));
}

// `run_attempt` for every run in one workflow's history window: one call per
// workflow, over the same window `gh run list` returned (branch main, newest
// first). `gh run list --json` has no attempt field in the gh this repo runs
// (2.32.1: `Unknown JSON field: "attempt"`), so the window is asked twice.
export function attemptsForWorkflow(gh, workflowId, limit) {
  const list = JSON.parse(gh([
    'api', `repos/{owner}/{repo}/actions/workflows/${String(workflowId)}/runs?branch=main`
      + `&per_page=${String(Math.min(limit, 100))}`,
    '--jq', '[.workflow_runs[] | {id, attempt: .run_attempt}]',
  ]));
  return new Map(list.map((entry) => [entry.id, entry.attempt]));
}

// What the attempts before `attempt` did. The earliest one that FAILED wins,
// with its failed jobs in the order they finished. An attempt in which no job
// ever got a runner is the account (spending limit, exhausted minutes), not
// the code, exactly as `ci:status` already reads a run like that.
export function earlierAttempts(gh, runId, attempt) {
  let couldNotStart = null;
  for (let n = 1; n < attempt; n += 1) {
    let jobs;
    try {
      jobs = attemptJobsFor(gh, runId, n);
    } catch {
      return { kind: 'unreadable', attempt: n };
    }
    if (!Array.isArray(jobs) || jobs.length === 0) return { kind: 'unreadable', attempt: n };
    const failed = jobs.filter((job) => !PASSED.has(job.conclusion));
    if (failed.length === 0) continue;
    if (jobs.every((job) => job.steps === 0 && job.runner === '')) {
      couldNotStart ??= n;
      continue;
    }
    failed.sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
    return { kind: 'failed', attempt: n, jobs: failed };
  }
  return couldNotStart === null ? { kind: 'passed' } : { kind: 'could-not-start', attempt: couldNotStart };
}

function jobWords(job) {
  const step = job.failedSteps?.length > 0 ? `, at step "${job.failedSteps[0]}"` : '';
  return `"${job.name}" (${job.conclusion ?? 'unfinished'}${step})`;
}

// The words a run line gets about its earlier attempts, and whether they alone
// make the command exit 1. Null for a first attempt: there is nothing to say.
// A run whose attempt number is unknown says so rather than passing as a
// first attempt.
export function describeEarlierAttempts(gh, run) {
  if (run.attempt === null || run.attempt === undefined) {
    return { kind: 'unnumbered', red: false, text: 'whether it needed a re-run is unknown: GitHub gave no attempt number' };
  }
  if (!(run.attempt > 1)) return null;
  const total = run.attempt;
  const earlier = earlierAttempts(gh, run.id, total);
  if (earlier.kind === 'failed') {
    const ended = tailFor(earlier.jobs) === CANCELLED_TAIL ? 'was CANCELLED' : 'FAILED';
    return {
      kind: 'failed',
      red: true,
      text: `attempt ${earlier.attempt} of ${total} ${ended}: ${earlier.jobs.map(jobWords).join(', ')}`,
      tail: tailFor(earlier.jobs),
    };
  }
  if (earlier.kind === 'could-not-start') {
    return {
      kind: 'could-not-start',
      red: false,
      text: `attempt ${earlier.attempt} of ${total} could not start, because no runner was`
        + ' assigned to any job (the account, not the code)',
    };
  }
  if (earlier.kind === 'passed') {
    return { kind: 'passed', red: false, text: `attempt ${total} of ${total}; every earlier attempt passed` };
  }
  return {
    kind: 'unreadable',
    red: true,
    text: `attempt ${total} of ${total}, and attempt ${earlier.attempt}'s jobs could not be read, so`
      + ' whether it failed is unknown, and unknown is treated as red on purpose',
  };
}

// A commit can have more than one run of a workflow: a push, then a
// `workflow_dispatch` on the same commit after it failed. The commit's line
// reads the NEWEST run, so a red run before it would vanish exactly as a failed
// attempt did before a re-run. This answers the earliest older run on the
// commit that failed, or that passed only on a re-run, with the words to say
// about it, or null. A run whose newest attempt got no runner is the account,
// not the code, as it is everywhere else in `ci:status`, but an attempt
// before it may still have run and failed.
export function olderRedRun(gh, olderRuns, neverGotARunner) {
  const oldestFirst = [...olderRuns]
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  for (const run of oldestFirst) {
    const which = `run ${String(run.id)} (${run.event}) at ${run.createdAt}`;
    if (run.status !== 'completed') {
      // Being re-run in place: the attempt before it may already have failed.
      const again = describeEarlierAttempts(gh, run);
      if (again?.red) return { text: `${which}: ${again.text}, and its re-run is still going`, tail: again.tail ?? '' };
      continue;
    }
    if (run.conclusion === 'success') {
      const again = describeEarlierAttempts(gh, run);
      if (again?.red) return { text: `${which} passed only on a re-run: ${again.text}`, tail: again.tail ?? '' };
      continue;
    }
    if (neverGotARunner(run.id)) {
      const again = describeEarlierAttempts(gh, run);
      if (again?.red) return { text: `${which}: ${again.text}, and its re-run could not start`, tail: again.tail ?? '' };
      continue;
    }
    let failed = [];
    try {
      failed = attemptJobsFor(gh, run.id, run.attempt ?? 1).filter((job) => !PASSED.has(job.conclusion));
    } catch {
      return { text: `${which} ended ${String(run.conclusion)}, and its jobs could not be read`, tail: FLAKY_TAIL };
    }
    const jobs = failed.length > 0 ? `: ${failed.map(jobWords).join(', ')}` : '';
    return { text: `${which} ended ${String(run.conclusion)}${jobs}`, tail: tailFor(failed) };
  }
  return null;
}

// What a commit's line says instead of its newest run's verdict when an older
// run of the workflow on the commit was red, or null. A later run is not a fix
// however it ends, so this holds while the newest run is still going, too.
export function laterRunVerdict(gh, label, newest, older, neverGotARunner) {
  const red = olderRedRun(gh, older, neverGotARunner);
  if (!red) return null;
  const passed = newest.status === 'completed' && newest.conclusion === 'success';
  const how = newest.status !== 'completed' ? 'is still running' : (passed ? 'passed' : 'could not start');
  return {
    red: true,
    line: `${label}: ${passed ? 'GREEN ONLY ON A LATER RUN' : 'RED'} — ${red.text}; the newest run on this`
      + ` commit, ${String(newest.id)} (${newest.event}), ${how}. A later run is not a fix.`
      + (passed && red.tail ? ` ${red.tail}` : ''),
  };
}
