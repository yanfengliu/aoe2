#!/usr/bin/env node
// A CI job goes red once any one of its tests has used more than two thirds of
// that test's OWN time limit, so a test creeping towards its timeout fails with
// its numbers BEFORE a slower runner times it out with none. This is
// scripts/ci-job-headroom.mjs's rule, applied to each test instead of the job.
//
// WHY (2026-10-11, defect register entry of that date; work 123). Main's CI was
// red on six of seven runs that day, each time because one test ran at or past
// its time limit on one runner and not on the others: the 600-tick replay
// comparison (32.0-35.1 s of 30 s on windows-latest), the 700-tick lifecycle
// comparison (30.6-35.7 s of 30 s on windows-latest), the 1920px resource
// readout spec (timed out at 30 s on the SwiftShader browser shard). The job
// logs held file totals and five browser tests per shard, so nothing said that
// de-ground.spec.ts:139 had passed at 89.8 s of 90 s, or that ten more browser
// tests had passed above two thirds of 30 s.
//
// WHY TWO THIRDS. Across 14 runs of that day, each CI job's runner ran its tests
// at 0.57x-1.32x of their median durations (one factor per job: the runner, not
// the test), so the slowest runner seen is about 1.3x the typical one and 2.3x
// the fastest. A test at two thirds of its limit still finishes on a runner 1.5x
// slower than the one it ran on; past that, a slow runner times it out.
//
// WHY CI ONLY, when docs/policies/local-rules.md refused a per-test budget on
// 2026-09-06. That refusal measured ONE development machine, shared by other
// sessions, where a single test's duration swung 2x in both directions between
// two runs of the same bundle. A CI job has its runner to itself, and its tests
// move together with the runner (the factor above). So this gate runs where the
// distribution was measured and nowhere else: `npm run verify` does not run it,
// and the reporters print the same ranking locally without failing.
//
// USAGE (ci.yml). The reporters write REPORT_PATHS below — the vitest one from
// vitest.config.ts, the browser one from playwright.config.ts — and each job's
// step after its suite runs
//   node scripts/test-time-headroom.mjs <report.json> [<report.json> ...]
// tests/scripts/testTimeHeadroom.test.ts holds the steps, the paths and the
// verdict together.
//
// BOUNDS. It sees what CI's runners measured and nothing else: the local GPU
// browser run (Windows, ANGLE Direct3D 11) and any development machine are
// unjudged, though their reporters print the ranking. It judges a test's
// duration as its runner reports it — vitest's covers the test body and its
// beforeEach/afterEach hooks against the test's own timeout, Playwright's the
// test with its hooks and fixtures, which is what its timeout covers. A beforeAll
// or afterAll hook, a whole file's total and the job itself are not judged here
// (the job is ci-job-headroom.mjs's). A test with no limit (timeout 0) is
// counted, not judged. A report from a run that crashed before its reporter's
// end hook is missing, and a missing report fails.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_SHARE = 2 / 3;

/** Where each reporter writes, relative to the directory the suite runs in. */
export const REPORT_PATHS = Object.freeze({
  vitest: 'tmp/test-times/vitest.json',
  playwright: 'tmp/test-times/playwright.json',
});

/**
 * @typedef {'passed' | 'failed' | 'timedOut' | 'skipped'} TestState
 * @typedef {{ file: string, line?: number, title: string, state: TestState, durationMs: number, timeoutMs: number }} TestTime
 * @typedef {TestTime & { share: number }} JudgedTestTime
 * @typedef {{ runner: string, writtenAt: string, tests: TestTime[] }} TestTimeReport
 */

/** @param {JudgedTestTime} test */
export function describeTestTime(test) {
  const where = test.line === undefined ? test.file : `${test.file}:${String(test.line)}`;
  return `${String(Math.round(test.share * 100))}% of ${(test.timeoutMs / 1000).toFixed(0)}s `
    + `(${(test.durationMs / 1000).toFixed(1)}s) ${where} › ${test.title}`
    + (test.state === 'timedOut' ? ' (timed out)' : '');
}

/**
 * @param {readonly TestTime[]} tests
 * @param {{ maxShare?: number, show?: number }} [options]
 * @returns {{ ok: boolean, judged: number, unlimited: number, offenders: JudgedTestTime[], closest: JudgedTestTime[], message: string }}
 */
export function judgeTestTimes(tests, { maxShare = MAX_SHARE, show = 10 } = {}) {
  const ran = tests.filter((test) => test.state !== 'skipped');
  const limited = ran.filter((test) => Number.isFinite(test.timeoutMs) && test.timeoutMs > 0);
  const unlimited = ran.length - limited.length;
  /** @type {JudgedTestTime[]} */
  const judged = limited
    .map((test) => ({ ...test, share: test.durationMs / test.timeoutMs }))
    .sort((a, b) => b.share - a.share);
  const ceiling = `${String(Math.round(maxShare * 100))}%`;
  if (judged.length === 0) {
    return {
      ok: false, judged: 0, unlimited, offenders: [], closest: [],
      message: `No test was measured against a time limit (${String(tests.length)} records, `
        + `${String(unlimited)} with no limit). A check that cannot measure must not pass: `
        + 'did the suite run, and did its reporter write the report?',
    };
  }
  const offenders = judged.filter((test) => test.state === 'timedOut' || test.share > maxShare);
  const closest = judged.slice(0, show);
  const ranking = closest.map((test) => `  ${describeTestTime(test)}`).join('\n');
  if (offenders.length === 0) {
    return {
      ok: true, judged: judged.length, unlimited, offenders, closest,
      message: `${String(judged.length)} tests measured; none used more than ${ceiling} of its own time limit`
        + `${unlimited ? ` (${String(unlimited)} with no limit, not judged)` : ''}. The closest:\n${ranking}`,
    };
  }
  return {
    ok: false, judged: judged.length, unlimited, offenders, closest,
    message: `${String(offenders.length)} of ${String(judged.length)} tests used more than ${ceiling} of their `
      + 'own time limit, so a runner 1.5x slower than this one would time them out:\n'
      + `${offenders.map((test) => `  ${describeTestTime(test)}`).join('\n')}\n`
      + 'Make the test cheaper, or split it into cases that keep the same checks. '
      + 'Weakening a check is not a fix, and raising a time limit is only for work proven irreducible, '
      + 'with the reason written where the limit is set.',
  };
}

/**
 * A test file's path relative to the repository, with forward slashes on every
 * platform (a Windows path read on Linux, as in this script's own tests, too).
 * @param {string} file @param {string} rootDir
 */
export function repoRelative(file, rootDir) {
  const normal = file.replace(/\\/g, '/');
  const root = rootDir.replace(/\\/g, '/').replace(/\/+$/, '');
  return normal.toLowerCase().startsWith(`${root.toLowerCase()}/`) ? normal.slice(root.length + 1) : normal;
}

/** @param {string} path @param {TestTimeReport} report */
export function writeTestTimes(path, report) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 1)}\n`);
}

/** @param {string} path @returns {TestTimeReport} */
export function readTestTimes(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(
      `${path}: no test-time report (${error instanceof Error ? error.message : String(error)}). `
      + 'Its reporter writes it at the end of the suite (tests/helpers/vitestTestTimeReporter.ts '
      + 'for vitest, tests/browser/helpers/durationBudgetReporter.ts for Playwright); a run that '
      + 'never reached that point has nothing to judge, and that must not pass.',
    );
  }
  const report = JSON.parse(text);
  if (!report || !Array.isArray(report.tests)) {
    throw new Error(`${path}: has no "tests" list, so it is not a test-time report.`);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = process.argv.slice(2);
  try {
    if (paths.length === 0) {
      throw new Error(`Usage: node scripts/test-time-headroom.mjs <report.json> [...], e.g. ${REPORT_PATHS.vitest}`);
    }
    const reports = paths.map((path) => readTestTimes(path));
    const tests = reports.flatMap((report) => report.tests);
    // Thirty, so a job's log carries the census of every test near its line,
    // not only the offenders (the coordinator reads named tests' times there).
    const verdict = judgeTestTimes(tests, { show: 30 });
    const header = `How close each test ran to its own time limit (${paths.join(', ')}):`;
    if (verdict.ok) {
      console.log(`${header}\n${verdict.message}`);
    } else {
      console.log(header);
      if (verdict.offenders.length > 0) console.log(`The closest:\n${verdict.closest.map((test) => `  ${describeTestTime(test)}`).join('\n')}`);
      console.error(verdict.message);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
