// `npm run ci:status` read only a run's NEWEST attempt. GitHub re-runs a failed
// run in place — same id, `run_attempt` up by one, `conclusion` the newest
// attempt's — so a commit whose first attempt failed and whose re-run passed
// read GREEN. On 2026-09-24 that is how `game-selection-click.spec.ts:110`, red
// on attempt 1 of run 36019109919 (`221329b4`, browser shard 3/4), stayed out
// of the defect register: the command said GREEN and exited 0.
//
// This holds the command to four answers about a run's earlier attempts:
// FAILED (a flaky gate or a flaky product: exit 1, name the job and step that
// failed first), COULD NOT START (the account, not the code: not red), PASSED
// (someone re-ran a green run: not red), and UNREADABLE (unknown, so red). And
// it holds the history line to naming every run in its window that passed only
// on a re-run, without making the history itself red. The second describe
// holds three more ways a red verdict was read as something else: a re-run
// that could not start after a failed attempt, on the commit's line and on the
// history's, and a later run of the workflow on the same commit.
//
// BOUND: as in ciStatus.test.ts, the fixtures are the projections the script's
// own `--jq` asks for, captured from the live repo with `gh` on 2026-09-24 (ids
// and shas in each name). They prove the reporting logic and the exit codes,
// not that GitHub still returns these shapes. Every scenario that is
// CONSTRUCTED rather than captured says so where it is built.

import { describe, expect, it, vi } from 'vitest';

import { fixture, runScript, type Scenario } from './helpers/ciStatusHarness';

vi.mock('node:child_process', async () => {
  const { exec } = await import('./helpers/ciStatusHarness');
  return { execFileSync: exec };
});

const RERUN_TIP = '221329b4a6f403287ea81865405036231d05184d';
const CLEAN_TIP = '514f5b16'; // the push after it, green on its first attempt
const BLOCKED_TIP = '6c990f1a2d3f8e8dbd41e660d489c8ab934d7c79';

const CI_WORKFLOW_ID = '270039102';
const CORPUS_WORKFLOW_ID = '273584341';

// Main's windows as they stood at 16:5x UTC on 2026-09-24, with each run's
// attempt number asked of the same window a moment later (every id matched).
// Four CI runs in it had a second attempt; two of those finished green.
const HISTORY_2026_09_24 = {
  CI: fixture('run-list--ci-through-2026-09-24.json'),
  'playtest-corpus': fixture('run-list--playtest-corpus-through-2026-09-24.json'),
};
const ATTEMPTS_2026_09_24 = {
  [CI_WORKFLOW_ID]: fixture('attempts--ci-through-2026-09-24.json'),
  [CORPUS_WORKFLOW_ID]: fixture('attempts--playtest-corpus-through-2026-09-24.json'),
};
// Attempt 1 of each run in that window that finished green on attempt 2.
const FAILED_FIRST_ATTEMPTS = {
  '36019109919-1': fixture('attempt-jobs--36019109919-1.json'),
  '34079856007-1': fixture('attempt-jobs--34079856007-1.json'),
};

function rerunScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    tip: RERUN_TIP,
    subject: 'Docs for the verification-plumbing fixes: register, gate proofs, local rules, spec and devlog',
    runsForSha: fixture('runs-for-sha--rerun-221329b4.json'),
    history: HISTORY_2026_09_24,
    attempts: ATTEMPTS_2026_09_24,
    attemptJobs: FAILED_FIRST_ATTEMPTS,
    jobs: {},
    changed: '',
    ...overrides,
  };
}

const lineFor = (out: string, marker: string): string =>
  out.split('\n').find((line) => line.includes(marker)) ?? '';

describe('ci:status reads every attempt of a run, not only the newest', () => {
  // THE case, from the real run. Attempt 1 failed browser shard 3/4, attempt 2
  // passed, and the command must neither call it GREEN nor exit 0.
  it('calls a run that passed only on a re-run GREEN ONLY ON A RE-RUN, names what failed first, and exits 1', async () => {
    const { out, exitCode } = await runScript(rerunScenario());
    expect(exitCode).toBe(1);
    const ciLine = lineFor(out, 'CI @ 221329b4');
    expect(ciLine).toContain('GREEN ONLY ON A RE-RUN');
    expect(ciLine).toContain('attempt 1 of 2 FAILED');
    expect(ciLine).toContain('"ubuntu-latest — browser suite 3/4" (failure, at step "Browser suite")');
    expect(ciLine).toContain('run 36019109919 attempt 2');
    expect(ciLine).toContain('A re-run is not a fix');
    expect(ciLine).not.toMatch(/: GREEN —/);
    // The job that failed is the only one named: the five that passed are not.
    expect(ciLine).not.toContain('browser suite 1/4');
    // The workflow that did not need a re-run stays plain GREEN.
    const corpusLine = lineFor(out, 'playtest-corpus @ 221329b4');
    expect(corpusLine).toMatch(/: GREEN —/);
    expect(corpusLine).not.toContain('RE-RUN');
  });

  // The control, and the history half. A commit whose own run passed first
  // time is GREEN and exits 0, while the history line still names every run in
  // its window that passed only on a re-run: an older flake is reported, but it
  // is not the next task by itself.
  it('keeps a first-attempt run GREEN and names the window\'s re-run greens on the history line', async () => {
    const { out, exitCode } = await runScript(rerunScenario({
      tip: CLEAN_TIP,
      subject: 'A player under attack cannot miss it: words, a mark that holds, and a…',
      runsForSha: fixture('runs-for-sha--green-514f5b16.json'),
    }));
    expect(exitCode).toBe(0);
    expect(lineFor(out, 'CI @ 514f5b16')).toMatch(/: GREEN — run 36025433688 \(push\)/);
    const history = lineFor(out, 'CI on main:');
    expect(history).toContain('GREEN');
    expect(history).toContain('2 of the last 19 passed only on a re-run');
    expect(history).toContain('run 36019109919 at 221329b4, attempt 1 of 2 FAILED');
    expect(history).toContain('run 34079856007 at 143ad511, attempt 1 of 2 FAILED: "ubuntu-latest — browser suite"');
    // The two runs whose re-run did not pass (35896557214, cancelled at the
    // job's time limit, and 34041883943, failed) are already red in the streak;
    // they are not described as greens.
    expect(history).not.toContain('35896557214');
    expect(history).not.toContain('34041883943');
    expect(lineFor(out, 'playtest-corpus on main:')).not.toContain('re-run');
  });

  // The over-fix guard from the other side: a re-run after an ACCOUNT block
  // (no job got a runner) is not a flake. Run 33729682386 was blocked on all
  // three attempts. The capture holds a workflow_dispatch run on the same sha
  // as well; this keeps the push runs only, so that it asserts on the push
  // run's own attempts. The full capture, dispatch run included, is the last
  // describe's "two runs on one commit" case.
  it('reads earlier attempts that never got a runner as the account, not as a flake', async () => {
    const pushRuns = (JSON.parse(fixture('runs-for-sha--blocked-rerun-6c990f1a.json')) as Array<{ event: string }>)
      .filter((run) => run.event === 'push');
    const { out, exitCode } = await runScript({
      tip: BLOCKED_TIP,
      subject: 'Merge: sun-cast shadows (v0.3.193)',
      runsForSha: JSON.stringify(pushRuns),
      history: {
        CI: fixture('run-list--ci-blocked.json'),
        'playtest-corpus': fixture('run-list--playtest-corpus-blocked.json'),
      },
      jobs: {
        33729682386: fixture('jobs--blocked-33729682386.json'),
        33729682387: fixture('jobs--blocked-33729682387.json'),
        34011049865: fixture('jobs--blocked-34011049865.json'),
        34011049840: fixture('jobs--blocked-34011049865.json'),
      },
      attemptJobs: {
        '33729682386-1': fixture('attempt-jobs--33729682386-1.json'),
        '33729682386-2': fixture('attempt-jobs--33729682386-2.json'),
      },
      changed: '',
    });
    const ciLine = lineFor(out, 'CI @ 6c990f1a');
    expect(ciLine).toContain('COULD NOT RUN');
    expect(ciLine).toContain('attempt 1 of 3 could not start');
    expect(ciLine).not.toContain('FAILED');
    expect(ciLine).not.toContain('RE-RUN');
    expect(exitCode).toBe(0);
  });

  // Unknown is red, never green: if attempt 1's jobs cannot be read, nothing
  // says whether the re-run hid a failure.
  it('treats an earlier attempt it cannot read as unknown and red, not as a pass', async () => {
    const { out, exitCode } = await runScript(rerunScenario({ attemptJobs: {} }));
    expect(exitCode).toBe(1);
    const ciLine = lineFor(out, 'CI @ 221329b4');
    expect(ciLine).toContain('GREEN ON A RE-RUN, EARLIER ATTEMPT UNKNOWN');
    expect(ciLine).toContain("attempt 1's jobs could not be read");
    expect(lineFor(out, 'CI on main:')).toContain('could not be read');
  });

  // CONSTRUCTED: no run on main was ever re-run after a green attempt, so this
  // one feeds attempt 2's real jobs (all green) in as attempt 1. A re-run of a
  // green run hid nothing and must not be reported as a flake.
  it('does not call a re-run of a green attempt a flake', async () => {
    const { out, exitCode } = await runScript(rerunScenario({
      attemptJobs: {
        ...FAILED_FIRST_ATTEMPTS,
        '36019109919-1': fixture('attempt-jobs--36019109919-2.json'),
      },
    }));
    const ciLine = lineFor(out, 'CI @ 221329b4');
    expect(ciLine).toMatch(/: GREEN \(attempt 2 of 2; every earlier attempt passed\) —/);
    expect(exitCode).toBe(0);
  });
});

// Three holes the review of 2026-09-24 found by probe, each a way for a red
// verdict on the commit to be read as something else. Every scenario here is
// CONSTRUCTED from captured parts (named where each is built): no commit on
// main had these shapes when this was written.
describe('ci:status does not let a later attempt or a later run clear an earlier red one', () => {
  const RERUN_RUNS = JSON.parse(fixture('runs-for-sha--rerun-221329b4.json')) as Array<Record<string, unknown>>;
  const withCiRun = (patch: Record<string, unknown>): string => JSON.stringify(
    RERUN_RUNS.map((run) => (run.name === 'CI' ? { ...run, ...patch } : run)),
  );

  // Attempt 1 is the real failed attempt of run 36019109919; attempt 2 is
  // given the jobs of a run no runner ever took (run 33729682386's).
  it('reads RED when an attempt failed and the re-run after it could not start', async () => {
    const { out, exitCode } = await runScript(rerunScenario({
      runsForSha: withCiRun({ conclusion: 'failure' }),
      jobs: { 36019109919: fixture('jobs--blocked-33729682386.json') },
    }));
    expect(exitCode).toBe(1);
    const ciLine = lineFor(out, 'CI @ 221329b4');
    expect(ciLine).toMatch(/: RED — attempt 1 of 2 FAILED: "ubuntu-latest — browser suite 3\/4"/);
    expect(ciLine).toContain('the newest attempt could not start');
    expect(ciLine).not.toContain('COULD NOT RUN');
  });

  // The history line holds the same rule. Main's latest finished CI run in the
  // captured window (36025433688 on 514f5b16) is given a failed attempt 1 (the
  // real one of 36019109919) and an attempt 2 no runner took. The commit's own
  // run stays green, so the exit code can only come from the history.
  it('reads the history RED when its latest run failed and the re-run after it could not start', async () => {
    const history = (JSON.parse(fixture('run-list--ci-through-2026-09-24.json')) as Array<Record<string, unknown>>)
      .map((run) => (run.databaseId === 36025433688 ? { ...run, conclusion: 'failure' } : run));
    const attempts = (JSON.parse(fixture('attempts--ci-through-2026-09-24.json')) as Array<Record<string, unknown>>)
      .map((entry) => (entry.id === 36025433688 ? { ...entry, attempt: 2 } : entry));
    const { out, exitCode } = await runScript(rerunScenario({
      tip: CLEAN_TIP,
      subject: 'A player under attack cannot miss it: words, a mark that holds, and a…',
      runsForSha: fixture('runs-for-sha--green-514f5b16.json'),
      history: { ...HISTORY_2026_09_24, CI: JSON.stringify(history) },
      attempts: { ...ATTEMPTS_2026_09_24, [CI_WORKFLOW_ID]: JSON.stringify(attempts) },
      jobs: { 36025433688: fixture('jobs--blocked-33729682386.json') },
      attemptJobs: { ...FAILED_FIRST_ATTEMPTS, '36025433688-1': fixture('attempt-jobs--36019109919-1.json') },
    }));
    expect(lineFor(out, 'CI @ 514f5b16')).toMatch(/: GREEN — /);
    expect(lineFor(out, 'CI on main:')).toMatch(
      /: RED \(attempt 1 of 2 FAILED: .*"ubuntu-latest — browser suite 3\/4".*; the re-run after it could not start\)/,
    );
    expect(exitCode).toBe(1);
  });

  // The push run is the real run 36019109919 as if it had failed and never
  // been re-run (its attempt 1, and the runner-assigned jobs of red run
  // 33233227742); a workflow_dispatch run on the same commit an hour later
  // passed.
  it('reads GREEN ONLY ON A LATER RUN when a later run of the workflow passed after one that failed', async () => {
    const dispatch = { attempt: 1, conclusion: 'success', createdAt: '2026-09-24T16:30:00Z', event: 'workflow_dispatch',
      id: 36019999999, name: 'CI', status: 'completed', title: 'CI' };
    const runs = [dispatch, ...JSON.parse(withCiRun({ attempt: 1, conclusion: 'failure' })) as unknown[]];
    const { out, exitCode } = await runScript(rerunScenario({
      runsForSha: JSON.stringify(runs),
      jobs: { 36019109919: fixture('jobs--red-33233227742.json') },
    }));
    expect(exitCode).toBe(1);
    const ciLine = lineFor(out, 'CI @ 221329b4');
    expect(ciLine).toContain('GREEN ONLY ON A LATER RUN');
    expect(ciLine).toContain('run 36019109919 (push) at 2026-09-24T15:17:41Z ended failure');
    expect(ciLine).toContain('"ubuntu-latest — browser suite 3/4" (failure, at step "Browser suite")');
    expect(ciLine).toContain('the newest run on this commit, 36019999999 (workflow_dispatch), passed');
    expect(lineFor(out, 'playtest-corpus @ 221329b4')).toMatch(/: GREEN —/);
  });

  // The over-fix guard for the case above, on the real capture of `6c990f1a`:
  // a push run no runner took, then a workflow_dispatch run no runner took
  // either (given the same blocked jobs). The account, twice; not red.
  it('keeps two runs on one commit that could not start at COULD NOT RUN', async () => {
    const { out, exitCode } = await runScript({
      tip: BLOCKED_TIP,
      subject: 'Merge: sun-cast shadows (v0.3.193)',
      runsForSha: fixture('runs-for-sha--blocked-rerun-6c990f1a.json'),
      history: {
        CI: fixture('run-list--ci-blocked.json'),
        'playtest-corpus': fixture('run-list--playtest-corpus-blocked.json'),
      },
      jobs: {
        33729682386: fixture('jobs--blocked-33729682386.json'),
        33729682387: fixture('jobs--blocked-33729682387.json'),
        33730423849: fixture('jobs--blocked-33729682386.json'),
        34011049865: fixture('jobs--blocked-34011049865.json'),
        34011049840: fixture('jobs--blocked-34011049865.json'),
      },
      attemptJobs: {
        '33729682386-1': fixture('attempt-jobs--33729682386-1.json'),
        '33729682386-2': fixture('attempt-jobs--33729682386-2.json'),
      },
      changed: '',
    });
    const ciLine = lineFor(out, 'CI @ 6c990f1a');
    expect(ciLine).toContain('COULD NOT RUN');
    expect(ciLine).toContain('run 33730423849');
    expect(ciLine).not.toContain('LATER RUN');
    expect(exitCode).toBe(0);
  });

  // A job ends "cancelled" by hand and at its time limit alike, so a cancelled
  // earlier attempt stays red, but it is not called a flake. Attempt 1 is the
  // real failed attempt with its failed job marked cancelled.
  it('keeps a cancelled earlier attempt red without calling it a flake', async () => {
    const cancelled = (JSON.parse(fixture('attempt-jobs--36019109919-1.json')) as Array<Record<string, unknown>>)
      .map((job) => (job.conclusion === 'failure' ? { ...job, conclusion: 'cancelled' } : job));
    const { out, exitCode } = await runScript(rerunScenario({
      attemptJobs: { '36019109919-1': JSON.stringify(cancelled) },
    }));
    expect(exitCode).toBe(1);
    const ciLine = lineFor(out, 'CI @ 221329b4');
    expect(ciLine).toContain('attempt 1 of 2 was CANCELLED: "ubuntu-latest — browser suite 3/4" (cancelled');
    expect(ciLine).toContain('cancelled by hand');
    expect(ciLine).not.toContain('flaky');
  });

  // Found by the second review: a run still going does not clear a red that is
  // already known, because every way it can end leaves the commit red.
  it('reads RED while an in-place re-run is still going after a failed attempt', async () => {
    const { out, exitCode } = await runScript(rerunScenario({
      runsForSha: withCiRun({ status: 'in_progress', conclusion: '' }),
    }));
    expect(exitCode).toBe(1);
    expect(lineFor(out, 'CI @ 221329b4')).toMatch(/: RED, RE-RUN STILL RUNNING \(in_progress\); attempt 1 of 2 FAILED/);
  });

  it('reads RED while a later run is still going after a run that failed', async () => {
    const dispatch = { attempt: 1, conclusion: '', createdAt: '2026-09-24T16:30:00Z', event: 'workflow_dispatch',
      id: 36019999999, name: 'CI', status: 'in_progress', title: 'CI' };
    const runs = [dispatch, ...JSON.parse(withCiRun({ attempt: 1, conclusion: 'failure' })) as unknown[]];
    const { out, exitCode } = await runScript(rerunScenario({
      runsForSha: JSON.stringify(runs),
      jobs: { 36019109919: fixture('jobs--red-33233227742.json') },
    }));
    expect(exitCode).toBe(1);
    const ciLine = lineFor(out, 'CI @ 221329b4');
    expect(ciLine).toMatch(/: RED — run 36019109919 \(push\) at 2026-09-24T15:17:41Z ended failure/);
    expect(ciLine).toContain('36019999999 (workflow_dispatch), is still running');
    expect(ciLine).not.toContain('flaky');
  });

  // The older run failed on attempt 1 and its re-run got no runner; a later
  // dispatch passed. The older run's own attempts are what say it was red.
  it('reads an older run whose re-run could not start by the attempt before it', async () => {
    const dispatch = { attempt: 1, conclusion: 'success', createdAt: '2026-09-24T16:30:00Z', event: 'workflow_dispatch',
      id: 36019999999, name: 'CI', status: 'completed', title: 'CI' };
    const runs = [dispatch, ...JSON.parse(withCiRun({ conclusion: 'failure' })) as unknown[]];
    const { out, exitCode } = await runScript(rerunScenario({
      runsForSha: JSON.stringify(runs),
      jobs: { 36019109919: fixture('jobs--blocked-33729682386.json') },
    }));
    expect(exitCode).toBe(1);
    const ciLine = lineFor(out, 'CI @ 221329b4');
    expect(ciLine).toContain('GREEN ONLY ON A LATER RUN');
    expect(ciLine).toContain('run 36019109919 (push) at 2026-09-24T15:17:41Z: attempt 1 of 2 FAILED');
    expect(ciLine).toContain('and its re-run could not start');
  });

  // Found by the third review: the older run is itself being re-run in place,
  // and its attempt 1 already failed; a later dispatch passed.
  it('reads an older run that is being re-run by the attempt before it', async () => {
    const dispatch = { attempt: 1, conclusion: 'success', createdAt: '2026-09-24T16:30:00Z', event: 'workflow_dispatch',
      id: 36019999999, name: 'CI', status: 'completed', title: 'CI' };
    const runs = [dispatch, ...JSON.parse(withCiRun({ status: 'in_progress', conclusion: '' })) as unknown[]];
    const { out, exitCode } = await runScript(rerunScenario({ runsForSha: JSON.stringify(runs) }));
    expect(exitCode).toBe(1);
    const ciLine = lineFor(out, 'CI @ 221329b4');
    expect(ciLine).toContain('GREEN ONLY ON A LATER RUN');
    expect(ciLine).toContain('run 36019109919 (push) at 2026-09-24T15:17:41Z: attempt 1 of 2 FAILED');
    expect(ciLine).toContain('and its re-run is still going');
  });

  // A pull-request run tests a merge of its branch into main, not the commit,
  // so a red one on the same head sha does not make the commit's line red.
  it('does not read a pull-request run on the commit', async () => {
    const pullRequest = { attempt: 1, conclusion: 'failure', createdAt: '2026-09-24T15:00:00Z', event: 'pull_request',
      id: 36018888888, name: 'CI', status: 'completed', title: 'CI' };
    const runs = [...JSON.parse(withCiRun({ attempt: 1 })) as unknown[], pullRequest];
    const { out, exitCode } = await runScript(rerunScenario({
      runsForSha: JSON.stringify(runs),
      jobs: { 36018888888: fixture('jobs--red-33233227742.json') },
    }));
    expect(lineFor(out, 'CI @ 221329b4')).toMatch(/: GREEN — run 36019109919 \(push\)/);
    expect(out).not.toContain('36018888888');
    expect(exitCode).toBe(0);
  });
});
