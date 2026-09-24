#!/usr/bin/env node
// One line telling you whether main's remote gate is green, for the start of a
// session. This exists because main's CI ran red for two months — 200 runs,
// zero green — while every local gate passed, and nobody looked. See the
// 2026-08-29 entry in docs/learning/defect-register.md.
//
// Exit code is the answer: 0 green, 1 red or unknown. `--limit N` widens the
// history scan; `--sha <ref>` judges one named commit instead of the default
// pair. The streak matters more than the last run, because a gate that is
// uniformly one colour is the shape that defect had.
//
// It reports on a SPECIFIC COMMIT — the local HEAD, and the pushed tip when
// they differ — not merely on whichever run is newest in the list. Reading the
// newest run is how a commit that produced NO run at all stayed invisible: on
// 2026-09-05 `actions/runs?head_sha=3924431040fab…` returned `total_count: 0`
// for a pushed commit and this command cheerfully described an EARLIER
// commit's run, with no hint that the tip had no run of its own. That
// particular commit turned out to owe none — it changed only `AGENTS.md` —
// but the command could not say that either. AGENTS.md names the principle
// that broke: a gate that cannot tell "passed" from "did not run" reports the
// second as the first.
//
// The answers it has to keep apart for a commit with no run of its own:
//
//   CARRIED      A later commit's run includes these changes. That is how
//                GitHub gates a push of several commits: one run, at the tip.
//   NEVER ASKED  No run was due: the workflow the commit carried filtered
//                `on.push.paths` and nothing it changed matched. Both watched
//                workflows did until 2026-09-24, when the filters were removed
//                so every push to main is gated; for a later commit a missing
//                run is UNGATED. For a commit from the filtered era, saying so
//                out loud is the point: the local gate is all that covered it.
//   UNGATED      A run WAS due and none exists. Nothing checked this commit and
//                nothing said so. Exit 1 — this is the "did not run" case.
//
// The push filter is read out of the workflow file AS OF THE COMMIT being
// judged (`git show <sha>:.github/workflows/...`), because the filter that
// decided whether that push got a run is the one that commit carried, not the
// one in today's working tree.
//
// A run's conclusion is its NEWEST attempt's, so a run whose first attempt
// failed and whose re-run passed says "success" everywhere GitHub lists it.
// Until 2026-09-24 this command called that GREEN, and a flaky spec stayed out
// of the defect register because of it (ci-status-attempts.mjs has the case).
// Now a commit's own run that passed only on a re-run is GREEN ONLY ON A
// RE-RUN, names the job and step that failed first, and exits 1; the history
// line names every run in its window that passed that way.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { attemptsForWorkflow, describeEarlierAttempts, laterRunVerdict } from './ci-status-attempts.mjs';
import { globToRegExp, matchesFilter, parsePushTrigger } from './ci-status-triggers.mjs';

export { globToRegExp, matchesFilter, parsePushTrigger };

export const WATCHED = ['CI', 'playtest-corpus'];
const WORKFLOW_DIR = '.github/workflows';
const RUN_FIELDS = 'conclusion,displayTitle,createdAt,databaseId,headSha,status,event,workflowDatabaseId';

function capture(bin, args) {
  return execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function reason(error) {
  const of = (value) => String(value ?? '').split('\n')[0].trim();
  return of(error?.stderr) || of(error?.message) || 'unknown error';
}

const git = (args) => capture('git', args).trim();
const gh = (args) => capture('gh', args);

function gitOrNull(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

const isAncestor = (a, b) => gitOrNull(['merge-base', '--is-ancestor', a, b]) !== null;

// ---------------------------------------------------------------------------
// Workflow push triggers (the pure parser lives in ci-status-triggers.mjs)
// ---------------------------------------------------------------------------

function triggerForCommit(sha, workflow) {
  let entries;
  try {
    entries = git(['ls-tree', '--name-only', `${sha}:${WORKFLOW_DIR}`]).split('\n').filter(Boolean);
  } catch {
    return { parsed: false };
  }
  for (const entry of entries) {
    if (!/\.ya?ml$/.test(entry)) continue;
    const text = gitOrNull(['show', `${sha}:${WORKFLOW_DIR}/${entry}`]);
    if (text === null) continue;
    const trigger = parsePushTrigger(text);
    if (trigger.name === workflow) return { ...trigger, file: `${WORKFLOW_DIR}/${entry}` };
  }
  return { parsed: false };
}

// The newest commit BEFORE `sha` that this workflow ran on. It has to be an
// ancestor: the newest run in the list is usually NEWER than the commit under
// judgement, and diffing against that runs the range backwards and reports
// every file in it as changed.
function lastGatedAncestor(runs, sha) {
  for (const run of runs) {
    if (run.headSha && run.headSha !== sha && isAncestor(run.headSha, sha)) return run.headSha;
  }
  return null;
}

// The earliest run on a DESCENDANT of `sha`. A push of several commits produces
// one run, at the tip, so an interior commit has no run of its own and is still
// covered. Without this the command cries wolf over every commit but the tip.
function carriedBy(runs, sha) {
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    const run = runs[i];
    if (run.headSha && run.headSha !== sha && isAncestor(sha, run.headSha)) return run;
  }
  return null;
}

// Every file changed between the last gated ancestor and the commit under
// judgement: GitHub evaluates the filter over a whole push, not one commit.
function filesSince(lastGatedSha, sha) {
  if (lastGatedSha && lastGatedSha !== sha) {
    const diff = gitOrNull(['diff', '--name-only', `${lastGatedSha}..${sha}`]);
    if (diff !== null) return diff.split('\n').filter(Boolean);
  }
  const own = gitOrNull(['diff-tree', '--no-commit-id', '--name-only', '-r', sha]);
  return own === null ? null : own.split('\n').filter(Boolean);
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

function historyForWorkflow(workflow, limit) {
  return JSON.parse(gh([
    'run', 'list', '--branch', 'main', '--workflow', workflow,
    '--limit', String(limit), '--json', RUN_FIELDS,
  ]));
}

function runsForCommit(sha) {
  return JSON.parse(gh([
    'api', `repos/{owner}/{repo}/actions/runs?head_sha=${sha}`,
    '--jq', '[.workflow_runs[] | {name, conclusion, status, id, createdAt: .created_at,'
      + ' title: .display_title, event, attempt: .run_attempt}]',
  ]));
}

const asRun = (workflow, entry) => ({
  name: workflow,
  conclusion: entry.conclusion,
  status: entry.status,
  id: entry.databaseId,
  createdAt: entry.createdAt,
  title: entry.displayTitle,
  event: entry.event,
  attempt: entry.attempt,
});

// A run that FAILED and a run that could never START look identical in the
// conclusion field — both say "failure". They mean opposite things: the first
// is a verdict on the code and is the next task; the second is a verdict on the
// ACCOUNT (Actions minutes exhausted, or a payment / spending-limit block) and
// says nothing about the code. The owner confirmed the quota runs out some
// weeks and told us to ignore it when it does (2026-09-03).
//
// The signature comes from the jobs API rather than a guess: every job finished
// with ZERO steps executed and an empty runner_name, i.e. no runner was ever
// assigned. A real test failure always has steps and a runner. Measured on run
// 33729682386, which failed this way five times across push, rerun,
// rerun --failed and workflow_dispatch while GitHub reported all systems
// operational.
const jobsCache = new Map();

function jobsFor(runId) {
  if (jobsCache.has(runId)) return jobsCache.get(runId);
  let jobs = null;
  try {
    jobs = JSON.parse(gh([
      'api', `repos/{owner}/{repo}/actions/runs/${String(runId)}/jobs`,
      '--jq', '[.jobs[] | {id, steps: (.steps | length), runner: (.runner_name // "")}]',
    ]));
  } catch {
    jobs = null; // Can't tell — the caller falls back to treating the red as real.
  }
  jobsCache.set(runId, jobs);
  return jobs;
}

function neverGotARunner(runId) {
  const jobs = jobsFor(runId);
  return Array.isArray(jobs) && jobs.length > 0
    && jobs.every((job) => job.steps === 0 && job.runner === '');
}

// When jobs exist but never start, GitHub says why in its own words, on the
// job's check-run annotations — and on 2026-09-05 that reason was not the one
// anyone assumed ("recent account payments have failed", not exhausted free
// minutes; those call for different actions). The inference above is sound but
// generic, so print GitHub's text verbatim when it is there. Failure-level
// only, and only on this path: a green run carries warning annotations too (the
// Node 20 deprecation notice) and echoing those would be noise.
function blockedReasons(runId) {
  const messages = [];
  for (const job of jobsFor(runId) ?? []) {
    let raw;
    try {
      raw = gh([
        'api', `repos/{owner}/{repo}/check-runs/${String(job.id)}/annotations`,
        '--jq', '[.[] | select(.annotation_level == "failure") | .message]',
      ]);
    } catch {
      continue;
    }
    for (const message of JSON.parse(raw)) {
      const text = String(message).trim();
      if (text && !messages.includes(text)) messages.push(text);
    }
  }
  return messages;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const QUOTA_TAIL = 'This is the ACCOUNT, not the code, so it is NOT a red gate and NOT the'
  + ' next task. The local gate (`npm run verify`) is what carries the weight until the'
  + ' allowance resets.';

// A run's conclusion is its NEWEST attempt's (see ci-status-attempts.mjs), so
// every verdict below also says what the attempts before it did.
function describeRun(label, run, note = '') {
  const again = describeEarlierAttempts(gh, run);
  const attempt = again && again.kind !== 'unnumbered' ? ` attempt ${String(run.attempt)}` : '';
  const stamp = `run ${run.id}${attempt} (${run.event}) at ${run.createdAt}`;
  const said = again ? `; ${again.text}` : '';
  if (run.status !== 'completed') {
    // A re-run still going does not clear the attempt before it that failed.
    const state = again?.red ? 'RED, RE-RUN STILL RUNNING' : 'STILL RUNNING';
    return { red: Boolean(again?.red), line: `${label}: ${state} (${run.status})${note}${said} — ${stamp}.` };
  }
  if (run.conclusion === 'success') {
    if (again?.red) {
      const state = again.kind === 'failed' ? 'GREEN ONLY ON A RE-RUN' : 'GREEN ON A RE-RUN, EARLIER ATTEMPT UNKNOWN';
      return {
        red: true,
        line: `${label}: ${state}${note} — ${again.text}.${again.tail ? ` ${again.tail}` : ''} ${stamp}.`,
      };
    }
    return { red: false, line: `${label}: GREEN${note}${again ? ` (${again.text})` : ''} — ${stamp}.` };
  }
  const noted = `${note}${said}`;
  if (neverGotARunner(run.id)) {
    // The newest attempt never ran, and one before it failed or cannot be read:
    // an attempt that could not start clears nothing.
    if (again?.red) {
      return {
        red: true,
        line: `${label}: RED${note} — ${again.text}; the newest attempt could not start (no runner`
          + ` was assigned to any job), and that clears nothing. ${stamp}.`,
      };
    }
    const notes = blockedReasons(run.id);
    const quoted = notes.length > 0
      ? ` GitHub's own annotation on the job, verbatim: ${notes.map((n) => `"${n}"`).join(' / ')}.`
      : '';
    return {
      red: false,
      line: `${label}: COULD NOT RUN${noted} — no runner was assigned to any job (every job`
        + ` finished with zero steps).${quoted} ${QUOTA_TAIL} ${stamp}.`,
    };
  }
  return { red: true, line: `${label}: RED (${run.conclusion})${noted} — ${stamp}.` };
}

function describeMissingRun(label, short, trigger, files) {
  const where = trigger.file ?? `${WORKFLOW_DIR}/*`;
  const ungated = (why) => ({
    red: true,
    line: `${label}: UNGATED — GitHub created NO run for ${short} and one WAS due (${why}).`
      + ' Nothing has checked this commit. That is not a red gate and not a green one;'
      + ' it is no gate at all, and it is the next thing to look at.',
  });
  const neverAsked = (why) => ({
    red: false,
    line: `${label}: NEVER ASKED — no run for ${short}, and none was due: ${why}.`
      + ' Only the local gate (`npm run verify`) covers this commit.',
  });
  if (!trigger.parsed) {
    return ungated(`this command could not read ${where} at that commit, so whether a run was`
      + ' due is unknown, and unknown is treated as ungated on purpose');
  }
  if (!trigger.hasPush) return neverAsked(`${where} has no \`on.push\` trigger at that commit`);
  if (trigger.paths === null) return ungated(`${where} runs on every push to main`);
  if (files === null) {
    return ungated("the commit's own file list could not be read, so whether a run was due is"
      + ' unknown, and unknown is treated as ungated on purpose');
  }
  const match = matchesFilter(files, trigger.paths);
  if (match.unparsed) return ungated(`this command does not understand '${match.unparsed}'`);
  if (match.due) return ungated(`it changed ${match.matched.slice(0, 3).join(', ')}`);
  return neverAsked(`none of the ${files.length} file(s) changed since the last run match`
    + ` ${where}'s \`on.push.paths\` (${(trigger.paths ?? []).join(', ')})`);
}

// Gives each run in a workflow's history window its attempt number, from one
// more call over the same window. Returns why it could not, or null.
function addAttempts(runs, limit) {
  const workflowId = runs.find((run) => run.workflowDatabaseId !== undefined)?.workflowDatabaseId;
  if (workflowId === undefined) return 'gh run list gave no workflow id to ask with';
  let attempts;
  try {
    attempts = attemptsForWorkflow(gh, workflowId, limit);
  } catch (error) {
    return reason(error);
  }
  for (const run of runs) run.attempt = attempts.has(run.databaseId) ? attempts.get(run.databaseId) : null;
  return null;
}

// A green streak is not a clean one if some of it passed only on a re-run:
// the streak counts final conclusions, and a re-run's final conclusion hides
// the red attempt before it. So the history line names every such run.
function rerunsIn(workflow, finished, unknownWhy) {
  if (unknownWhy !== null) return ` Whether any of them needed a re-run is unknown (${unknownWhy}).`;
  const hidden = [];
  const unread = [];
  let unnumbered = 0;
  for (const entry of finished) {
    if (entry.attempt === null) unnumbered += 1;
    if (entry.conclusion !== 'success' || !(entry.attempt > 1)) continue;
    const again = describeEarlierAttempts(gh, asRun(workflow, entry));
    const which = `run ${entry.databaseId} at ${String(entry.headSha).slice(0, 8)}`;
    if (again?.kind === 'failed') hidden.push(`${which}, ${again.text}`);
    if (again?.kind === 'unreadable') unread.push(which);
  }
  const missing = (unnumbered === 0 ? '' : ` ${unnumbered} of them had no attempt number.`)
    + (unread.length === 0 ? '' : ` The earlier attempts of ${unread.join(', ')} could not be read.`);
  if (hidden.length === 0) return missing;
  return ` ${hidden.length} of the last ${finished.length} passed only on a re-run: ${hidden.join('; ')}.${missing}`;
}

function describeHistory(workflow, runs, limit, unknownWhy) {
  const finished = runs.filter((run) => run.conclusion);
  if (finished.length === 0) {
    return { red: false, line: `${workflow} on main: no finished runs in the last ${limit}.` };
  }
  const latest = finished[0];
  let streak = 0;
  while (streak < finished.length && finished[streak].conclusion === latest.conclusion) streak += 1;
  const tail = streak === finished.length ? `${streak}+` : String(streak);
  const green = latest.conclusion === 'success';
  let blocked = !green && neverGotARunner(latest.databaseId);
  let state = green ? 'GREEN' : (blocked ? `COULD NOT RUN (${latest.conclusion})` : `RED (${latest.conclusion})`);
  // As for a commit's own run: a re-run that could not start does not clear
  // the attempt before it that failed.
  const again = blocked && unknownWhy === null ? describeEarlierAttempts(gh, asRun(workflow, latest)) : null;
  if (again?.red) {
    blocked = false;
    state = `RED (${again.text}; the re-run after it could not start)`;
  }
  return {
    red: !green && !blocked,
    line: `${workflow} on main: ${state} — ${tail} consecutive, latest "${latest.displayTitle}"`
      + ` (${String(latest.headSha).slice(0, 8)}) at ${latest.createdAt}.`
      + rerunsIn(workflow, finished, unknownWhy),
  };
}

function commitTargets(override) {
  const tip = gitOrNull(['rev-parse', 'origin/main']);
  const pushedTo = (sha) => tip !== null && (tip === sha || isAncestor(sha, tip));
  if (override) {
    const sha = gitOrNull(['rev-parse', override]);
    return sha === null ? [] : [{ sha, label: override, pushed: pushedTo(sha) }];
  }
  const head = gitOrNull(['rev-parse', 'HEAD']);
  if (head === null) return [];
  const targets = [{ sha: head, label: 'HEAD', pushed: pushedTo(head) }];
  if (tip !== null && tip !== head) targets.push({ sha: tip, label: 'origin/main', pushed: true });
  return targets;
}

export function report(argv = []) {
  const flag = (name, fallback) => {
    const at = argv.indexOf(name);
    return at === -1 ? fallback : argv[at + 1];
  };
  const limit = Number(flag('--limit', 20) ?? 20);
  const lines = [];
  let anyRed = false;

  const targets = commitTargets(flag('--sha', null));
  if (targets.length === 0) {
    return { lines: ['UNKNOWN — could not resolve the commit to report on.'], exitCode: 1 };
  }

  const history = new Map();
  const attemptsUnknown = new Map();
  for (const workflow of WATCHED) {
    try {
      history.set(workflow, historyForWorkflow(workflow, limit));
    } catch (error) {
      lines.push(`${workflow}: UNKNOWN — could not reach GitHub (${reason(error)})`);
      anyRed = true;
      continue;
    }
    attemptsUnknown.set(workflow, addAttempts(history.get(workflow), limit));
  }

  for (const target of targets) {
    const subject = gitOrNull(['log', '-1', '--format=%s', target.sha]) ?? '(no subject)';
    const short = target.sha.slice(0, 8);
    if (!target.pushed) {
      lines.push(`${target.label} ${short} "${subject}" — not on origin/main, so no remote`
        + ' gate can have run for it. Push it to have it gated.');
      continue;
    }
    lines.push(`${target.sha.startsWith(target.label) ? short : `${target.label} ${short}`}`
      + ` "${subject}":`);
    let runs;
    try {
      runs = runsForCommit(target.sha);
    } catch (error) {
      lines.push(`  UNKNOWN — could not ask GitHub for this commit's runs (${reason(error)})`);
      anyRed = true;
      continue;
    }
    for (const workflow of WATCHED) {
      if (!history.has(workflow)) continue;
      const label = `  ${workflow} @ ${short}`;
      // Newest first, and every run of this workflow on the commit is read: a
      // later run does not clear an earlier one that failed. A pull-request run
      // tests a merge of its branch, not this commit, so it is not read.
      const mine = runs.filter((c) => c.name === workflow && !String(c.event).startsWith('pull_request'))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const own = mine[0];
      let verdict = own ? describeRun(label, own) : null;
      if (verdict && !verdict.red) verdict = laterRunVerdict(gh, label, own, mine.slice(1), neverGotARunner) ?? verdict;
      if (verdict === null) {
        // Order matters. "No run was due" is the primary answer and is checked
        // FIRST; only a commit that did owe a run and has none falls through to
        // the carrier check, so CARRIED never masks NEVER ASKED.
        const runsList = history.get(workflow);
        verdict = describeMissingRun(label, short, triggerForCommit(target.sha, workflow),
          filesSince(lastGatedAncestor(runsList, target.sha), target.sha));
        const carrier = verdict.red ? carriedBy(runsList, target.sha) : null;
        if (carrier) {
          verdict = describeRun(label, asRun(workflow, carrier), ' (CARRIED — no run of its own;'
            + ` a later push gated it at ${String(carrier.headSha).slice(0, 8)})`);
        }
      }
      lines.push(verdict.line);
      if (verdict.red) anyRed = true;
    }
  }

  for (const workflow of WATCHED) {
    if (!history.has(workflow)) continue;
    const verdict = describeHistory(workflow, history.get(workflow), limit, attemptsUnknown.get(workflow));
    lines.push(verdict.line);
    if (verdict.red) anyRed = true;
  }

  if (anyRed) {
    lines.push('');
    lines.push('A red or ungated remote gate is the next task, ahead of whatever was planned.');
  }
  return { lines, exitCode: anyRed ? 1 : 0 };
}

export function main(argv = process.argv.slice(2)) {
  const { lines, exitCode } = report(argv);
  for (const line of lines) console.log(line);
  return exitCode;
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) process.exit(main());
