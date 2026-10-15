// The two test suites' own evidence that they finished, read by scripts/verify-receipt.mjs's `write` (work 124 M2).
//
// WHY. A stage's own process ended through WMI's `Win32_Process.Terminate` exits 0, so its parent sees a pass and
// the verify chain goes on to `write`: measured on 2026-10-12 by ending a scratch chain's long step, which never
// finished, yet the chain wrote a receipt that `check` accepted. No exit code can tell that stage from one that
// passed. What a stage ended that way cannot do is reach its own end, and each test suite's reporter writes a report
// only there: tests/helpers/vitestTestTimeReporter.ts and tests/browser/helpers/durationBudgetReporter.ts, at the
// paths in scripts/test-time-headroom.mjs's REPORT_PATHS, each with `runner`, `writtenAt`, `argv`, `outcome` and
// `tests` (work 123). Playwright calls the reporters' end hooks in the order playwright.config.ts lists them, so this
// reads the reports after the run, from the chain's last step.
//
// A report counts only if it names its runner, was written inside this run (after `start`), comes from the full
// suite (the command line `npm run verify` gives it, no filter, shard or file), says the run passed (and, for Vitest,
// no unhandled error), and lists at least one passing test and no failed or timed-out one. A `.only` cannot narrow
// either suite: vitest.config.ts sets `allowOnly: false` and playwright.config.ts `forbidOnly: true`, so it fails
// the run instead.
//
// The browser report vouches only for a bundle built in this run: `npm run test:browser` first runs `npm run build`,
// and `start` removes dist/, so a `vite build` ended from outside before it writes leaves the browser suite nothing to
// test, and it fails, rather than testing the last bundle.
//
// BOUND. Only the two suites leave such evidence: content:validate, typecheck, lint and build, ended from outside,
// still pass. A report is trusted for what it says: one written by hand passes, and so
// does one that another whole run of the suite wrote inside this run's window, such as a suite orphaned when a cut
// ended the process above it and left it running. A Playwright `test.fail()` that fails as expected is reported as
// failed (by durationBudgetReporter.ts's state map), so it would refuse the run; there is none today.

import { readFileSync } from 'node:fs';

import { REPORT_PATHS } from './test-time-headroom.mjs';

/** The suites `npm run verify` runs, each with the command line its full run carries in its report. */
export const SUITES = Object.freeze({
  vitest: Object.freeze({ path: REPORT_PATHS.vitest, argv: Object.freeze(['run']), stage: 'npm run test' }),
  playwright: Object.freeze({ path: REPORT_PATHS.playwright, argv: Object.freeze(['test']), stage: 'npm run test:browser' }),
});

const FAILED_STATES = new Set(['failed', 'timedOut']);

/**
 * Reads a suite's report. `missing` when there is no file; `unreadable` with the reason when it is not JSON.
 * @param {string} path
 * @returns {{ report?: unknown, missing?: true, unreadable?: string }}
 */
export function readSuiteReport(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { missing: true };
    return { unreadable: error instanceof Error ? error.message : String(error) };
  }
  try {
    return { report: JSON.parse(text) };
  } catch (error) {
    return { unreadable: `not valid JSON (${error instanceof Error ? error.message : String(error)})` };
  }
}

/**
 * Why a suite's report does not show a whole, passing run of the full suite inside this run; empty when it does.
 * @param {'vitest' | 'playwright'} runner
 * @param {{ report?: unknown, missing?: true, unreadable?: string }} read what readSuiteReport found
 * @param {{ startedAt: string, finishedAt: string }} run when `start` and `write` ran
 * @returns {string[]}
 */
export function suiteProblems(runner, read, { startedAt, finishedAt }) {
  const suite = SUITES[runner];
  const name = `${runner}'s report (${suite.path})`;
  if (read.missing) {
    return [`${name} is missing, so \`${suite.stage}\` did not reach its own end in this run (a suite ended from outside exits 0 and writes none)`];
  }
  if (read.unreadable) return [`${name} is ${read.unreadable}`];
  /** @type {any} */
  const report = read.report;
  const problems = [];
  if (report?.runner !== runner) {
    problems.push(`${name} names runner ${JSON.stringify(report?.runner ?? null)}, so it is not this suite's report`);
  }
  const written = Date.parse(String(report?.writtenAt ?? ''));
  if (!Number.isFinite(written)) {
    problems.push(`${name} has no valid writtenAt (${JSON.stringify(report?.writtenAt ?? null)}), so nothing shows it was written in this run`);
  } else if (written < Date.parse(startedAt) || written > Date.parse(finishedAt)) {
    problems.push(`${name} was written at ${String(report.writtenAt)}, outside this run (${startedAt} to ${finishedAt}), so another run wrote it`);
  }
  const argv = Array.isArray(report?.argv) ? report.argv.map(String) : null;
  if (!argv || argv.length !== suite.argv.length || argv.some((arg, i) => arg !== suite.argv[i])) {
    problems.push(`${name} is from \`${[runner, ...(argv ?? ['(no arguments recorded)'])].join(' ')}\`, not the full suite's `
      + `\`${[runner, ...suite.argv].join(' ')}\``);
  }
  const status = report?.outcome?.status;
  if (status !== 'passed') problems.push(`${name} says the run ended ${JSON.stringify(status ?? null)}, not "passed"`);
  if (runner === 'vitest') {
    const unhandled = report?.outcome?.unhandledErrors;
    if (unhandled !== 0) problems.push(`${name} counts ${JSON.stringify(unhandled ?? null)} unhandled errors, not 0`);
  }
  if (!Array.isArray(report?.tests)) {
    problems.push(`${name} has no list of tests`);
  } else {
    const failed = report.tests.filter((test) => FAILED_STATES.has(test?.state));
    if (failed.length) {
      const named = failed.slice(0, 5).map((test) => `${String(test.file)}:${String(test.line ?? '?')} › ${String(test.title)} (${String(test.state)})`);
      problems.push(`${name} lists ${String(failed.length)} failed or timed-out tests: ${named.join(', ')}${failed.length > 5 ? ' and more' : ''}`);
    }
    if (!report.tests.some((test) => test?.state === 'passed')) problems.push(`${name} lists no passing test`);
  }
  return problems;
}

/**
 * What the receipt keeps of a report: enough to say which run it was.
 * @param {{ report?: unknown }} read
 */
export function summarizeSuiteReport(read) {
  /** @type {any} */
  const report = read.report;
  if (!report || typeof report !== 'object') return null;
  const tests = Array.isArray(report.tests) ? report.tests : [];
  return {
    writtenAt: report.writtenAt ?? null,
    argv: Array.isArray(report.argv) ? report.argv : null,
    status: report.outcome?.status ?? null,
    tests: tests.length,
    passed: tests.filter((test) => test?.state === 'passed').length,
  };
}

/**
 * The counts a certified receipt's reports gave, for `check` to print beside the two summaries in the run's log. A
 * certified receipt's reports list no failed or timed-out test, so every test that did not pass was skipped.
 * @param {Record<string, { tests?: unknown, passed?: unknown } | null> | undefined} evidence the receipt's `evidence`
 * @returns {string}
 */
export function describeSuiteEvidence(evidence) {
  return Object.keys(SUITES).map((runner) => {
    const kept = evidence?.[runner];
    const tests = Number(kept?.tests);
    const passed = Number(kept?.passed);
    if (!Number.isInteger(tests) || !Number.isInteger(passed)) return `${runner} (no counts recorded)`;
    return `${runner} ${String(passed)} passed and ${String(tests - passed)} skipped`;
  }).join(', ');
}
