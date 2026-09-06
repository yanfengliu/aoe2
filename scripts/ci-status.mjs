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
//   NEVER ASKED  No run was due. Both watched workflows filter `on.push.paths`,
//                so a docs-only push is MEANT to produce none. Saying so out
//                loud is the point: the local gate is all that covers it.
//   UNGATED      A run WAS due and none exists. Nothing checked this commit and
//                nothing said so. Exit 1 — this is the "did not run" case.
//
// The push filter is read out of the workflow file AS OF THE COMMIT being
// judged (`git show <sha>:.github/workflows/...`), because the filter that
// decided whether that push got a run is the one that commit carried, not the
// one in today's working tree.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const WATCHED = ['CI', 'playtest-corpus'];
const WORKFLOW_DIR = '.github/workflows';
const RUN_FIELDS = 'conclusion,displayTitle,createdAt,databaseId,headSha,status,event';

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
// Workflow push triggers
// ---------------------------------------------------------------------------

function yamlRows(text) {
  return text
    .split(/\r?\n/)
    .map((raw) => ({ indent: raw.length - raw.trimStart().length, text: raw.trim() }))
    .filter((row) => row.text && !row.text.startsWith('#'));
}

function blockRange(rows, headerIndex) {
  const base = rows[headerIndex].indent;
  let end = headerIndex + 1;
  while (end < rows.length && rows[end].indent > base) end += 1;
  return [headerIndex + 1, end];
}

function findChild(rows, headerIndex, key) {
  const [start, end] = blockRange(rows, headerIndex);
  if (start >= end) return -1;
  let childIndent = Infinity;
  for (let i = start; i < end; i += 1) childIndent = Math.min(childIndent, rows[i].indent);
  for (let i = start; i < end; i += 1) {
    if (rows[i].indent === childIndent && rows[i].text.replace(/:.*$/, '') === key) return i;
  }
  return -1;
}

// `{ parsed: false }` means we did not understand the file, and that is NOT the
// same as "no filter": an unparsed trigger makes a missing run UNGATED and
// loud, because a filter we half-understand would answer "never asked" for a
// commit that was in fact never checked.
export function parsePushTrigger(text) {
  const rows = yamlRows(text);
  const name = /^name:\s*(.+)$/m.exec(text)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? null;
  const onAt = rows.findIndex((row) => row.indent === 0 && row.text === 'on:');
  if (onAt === -1) return { name, parsed: false };
  const pushAt = findChild(rows, onAt, 'push');
  if (pushAt === -1) return { name, parsed: true, hasPush: false, paths: [] };
  if (rows[pushAt].text !== 'push:') return { name, parsed: false };
  const pathsAt = findChild(rows, pushAt, 'paths');
  if (pathsAt === -1) return { name, parsed: true, hasPush: true, paths: null };
  if (rows[pathsAt].text !== 'paths:') return { name, parsed: false };
  const [start, end] = blockRange(rows, pathsAt);
  const paths = [];
  for (let i = start; i < end; i += 1) {
    const item = /^-\s*(.+)$/.exec(rows[i].text);
    if (!item) return { name, parsed: false };
    paths.push(item[1].trim().replace(/^['"]|['"]$/g, ''));
  }
  return { name, parsed: true, hasPush: true, paths };
}

// GitHub's filter syntax minus the parts these workflows do not use. A pattern
// with `!`, a character class or a brace group is REFUSED (null) rather than
// approximated, for the reason above.
export function globToRegExp(pattern) {
  if (/[![\]{}+]/.test(pattern)) return null;
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i += 1;
    } else if (ch === '*') {
      out += '[^/]*';
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += ch.replace(/[.\\^$()|]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

export function matchesFilter(files, paths) {
  if (paths === null) return { due: true, matched: [] };
  const matched = [];
  for (const pattern of paths) {
    const re = globToRegExp(pattern);
    if (re === null) return { due: true, matched: [], unparsed: pattern };
    for (const file of files) if (re.test(file)) matched.push(`${file} (${pattern})`);
  }
  return { due: matched.length > 0, matched };
}

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
      + ' title: .display_title, event}]',
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

function describeRun(label, run, note = '') {
  const stamp = `run ${run.id} (${run.event}) at ${run.createdAt}`;
  if (run.status !== 'completed') {
    return { red: false, line: `${label}: STILL RUNNING (${run.status})${note} — ${stamp}.` };
  }
  if (run.conclusion === 'success') {
    return { red: false, line: `${label}: GREEN${note} — ${stamp}.` };
  }
  if (neverGotARunner(run.id)) {
    const notes = blockedReasons(run.id);
    const quoted = notes.length > 0
      ? ` GitHub's own annotation on the job, verbatim: ${notes.map((n) => `"${n}"`).join(' / ')}.`
      : '';
    return {
      red: false,
      line: `${label}: COULD NOT RUN${note} — no runner was assigned to any job (every job`
        + ` finished with zero steps).${quoted} ${QUOTA_TAIL} ${stamp}.`,
    };
  }
  return { red: true, line: `${label}: RED (${run.conclusion})${note} — ${stamp}.` };
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

function describeHistory(workflow, runs, limit) {
  const finished = runs.filter((run) => run.conclusion);
  if (finished.length === 0) {
    return { red: false, line: `${workflow} on main: no finished runs in the last ${limit}.` };
  }
  const latest = finished[0];
  let streak = 0;
  while (streak < finished.length && finished[streak].conclusion === latest.conclusion) streak += 1;
  const tail = streak === finished.length ? `${streak}+` : String(streak);
  const green = latest.conclusion === 'success';
  const blocked = !green && neverGotARunner(latest.databaseId);
  const state = green ? 'GREEN' : (blocked ? `COULD NOT RUN (${latest.conclusion})` : `RED (${latest.conclusion})`);
  return {
    red: !green && !blocked,
    line: `${workflow} on main: ${state} — ${tail} consecutive, latest "${latest.displayTitle}"`
      + ` (${String(latest.headSha).slice(0, 8)}) at ${latest.createdAt}.`,
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
  for (const workflow of WATCHED) {
    try {
      history.set(workflow, historyForWorkflow(workflow, limit));
    } catch (error) {
      lines.push(`${workflow}: UNKNOWN — could not reach GitHub (${reason(error)})`);
      anyRed = true;
    }
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
      const own = runs.find((candidate) => candidate.name === workflow);
      let verdict = own ? describeRun(label, own) : null;
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
    const verdict = describeHistory(workflow, history.get(workflow), limit);
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
