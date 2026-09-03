#!/usr/bin/env node
// One line telling you whether main's remote gate is green, for the start of a
// session. This exists because main's CI ran red for two months — 200 runs,
// zero green — while every local gate passed, and nobody looked. See the
// 2026-08-29 entry in docs/learning/defect-register.md.
//
// Exit code is the answer: 0 green, 1 red or unknown. `--limit N` widens the
// scan; the streak matters more than the last run, because a gate that is
// uniformly one colour is the shape this defect had.

import { execFileSync } from 'node:child_process';

const limitFlag = process.argv.indexOf('--limit');
const limit = limitFlag === -1 ? 20 : Number(process.argv[limitFlag + 1] ?? 20);

function runsForWorkflow(workflow) {
  const out = execFileSync('gh', [
    'run', 'list', '--branch', 'main', '--workflow', workflow,
    '--limit', String(limit), '--json', 'conclusion,displayTitle,createdAt,databaseId',
  ], { encoding: 'utf8' });
  return JSON.parse(out);
}

// A run that FAILED and a run that could never START look identical in the
// conclusion field — both say "failure". They mean opposite things: the first
// is a verdict on the code and is the next task; the second is a verdict on
// the ACCOUNT (Actions minutes exhausted or a spending limit reached) and says
// nothing about the code at all. The owner confirmed the quota runs out some
// weeks and told us to ignore it when it does (2026-09-03).
//
// The signature is unambiguous and comes from the jobs API rather than a
// guess: every job finished with ZERO steps executed and an empty runner_name,
// i.e. no runner was ever assigned. A real test failure always has steps and a
// runner. Measured on run 33729682386, which failed this way five times across
// push, rerun, rerun --failed and workflow_dispatch while GitHub itself
// reported all systems operational.
function neverGotARunner(runId) {
  let jobs;
  try {
    const out = execFileSync('gh', [
      'api', `repos/{owner}/{repo}/actions/runs/${String(runId)}/jobs`,
      '--jq', '[.jobs[] | {steps: (.steps | length), runner: (.runner_name // "")}]',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    jobs = JSON.parse(out);
  } catch {
    return false; // Can't tell — fall back to treating the red as real.
  }
  return jobs.length > 0 && jobs.every((job) => job.steps === 0 && job.runner === '');
}

let anyRed = false;
for (const workflow of ['CI', 'playtest-corpus']) {
  let runs;
  try {
    runs = runsForWorkflow(workflow);
  } catch (error) {
    console.log(`${workflow}: UNKNOWN — could not reach GitHub (${String(error.message).split('\n')[0]})`);
    anyRed = true;
    continue;
  }
  const finished = runs.filter((run) => run.conclusion);
  if (finished.length === 0) {
    console.log(`${workflow}: no finished runs in the last ${limit}`);
    continue;
  }
  const latest = finished[0];
  // How far back the current colour goes — a long red streak is the signal a
  // single "last run failed" line is too quiet to carry.
  let streak = 0;
  while (streak < finished.length && finished[streak].conclusion === latest.conclusion) streak += 1;
  const green = latest.conclusion === 'success';
  const tail = streak === finished.length ? `${streak}+` : String(streak);
  if (!green && neverGotARunner(latest.databaseId)) {
    console.log(
      `${workflow}: COULD NOT RUN — no runner was assigned to any job (every job`
      + ` finished with zero steps). This is the Actions quota, not the code, so`
      + ` it is NOT a red gate and NOT the next task. The local gate`
      + ` (\`npm run verify\`) is what carries the weight until the allowance`
      + ` resets. Latest "${latest.displayTitle}" at ${latest.createdAt}.`,
    );
    continue;
  }
  if (!green) anyRed = true;
  console.log(
    `${workflow}: ${green ? 'GREEN' : `RED (${latest.conclusion})`}`
    + ` — ${tail} consecutive, latest "${latest.displayTitle}" at ${latest.createdAt}`,
  );
}

if (anyRed) {
  console.log('\nA red remote gate is the next task, ahead of whatever was planned.');
}
process.exit(anyRed ? 1 : 0);
