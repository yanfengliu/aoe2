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
    '--limit', String(limit), '--json', 'conclusion,displayTitle,createdAt',
  ], { encoding: 'utf8' });
  return JSON.parse(out);
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
  if (!green) anyRed = true;
  const tail = streak === finished.length ? `${streak}+` : String(streak);
  console.log(
    `${workflow}: ${green ? 'GREEN' : `RED (${latest.conclusion})`}`
    + ` — ${tail} consecutive, latest "${latest.displayTitle}" at ${latest.createdAt}`,
  );
}

if (anyRed) {
  console.log('\nA red remote gate is the next task, ahead of whatever was planned.');
}
process.exit(anyRed ? 1 : 0);
