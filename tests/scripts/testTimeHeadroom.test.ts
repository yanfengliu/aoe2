// Every gated test keeps headroom under its OWN time limit — the gate for the
// 2026-10-11 register entry (work 123).
//
// What happened. Main's CI went red on some runs and not others because single
// tests ran at or past their time limits on CI's runners: the 600-tick replay
// comparison (32.0 s of 30 s on Windows), the 700-tick lifecycle comparison
// (30.6-35.7 s of 30 s on Windows), and the 1920px resource readout spec (past
// 30 s on the SwiftShader browser shard). None of those runs said how close any
// OTHER test had come; the job logs held only file totals and five browser
// tests per shard. de-ground.spec.ts:139 had run at 89.8 s of its 90 s.
//
// Four parts.
// (1) The verdict: `judgeTestTimes` on the numbers CI measured that day, both
//     sides of the two-thirds ceiling, plus the CLI's exit codes, including the
//     cases where the report never arrived or measured nothing (they must fail,
//     not pass unmeasured).
// (2) The reporters: each turns its runner's results into the one record shape
//     the judge reads, timeout included, and writes it where the CI step reads.
// (3) The wiring, read from the PARSED ci.yml: each job judges its own suite's
//     report after the suite, before the job-level headroom check, and even when
//     the suite step failed.
// (4) The configs: vitest.config.ts and playwright.config.ts load the reporters.
//
// BOUND: this proves the judge, the record shape and the wiring. Whether every
// test stays under the ceiling on a real runner is only known from real runs,
// and the gate sees only CI's runners: the local GPU browser run and a loaded
// development machine are not judged (see the script's header for why).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  describeTestTime, judgeTestTimes, MAX_SHARE, readTestTimes, REPORT_PATHS,
} from '../../scripts/test-time-headroom.mjs';
import VitestTestTimeReporter from '../helpers/vitestTestTimeReporter';
import DurationBudgetReporter from '../browser/helpers/durationBudgetReporter';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../../scripts/test-time-headroom.mjs', import.meta.url));

type State = 'passed' | 'failed' | 'timedOut' | 'skipped';
const record = (title: string, durationMs: number, timeoutMs: number, state: State = 'passed', file = 'tests/x.test.ts') => (
  { file, title, state, durationMs, timeoutMs }
);

// CI, 2026-10-11, read from each job's own log (gh api actions/jobs/<id>/logs).
const MEASURED_2026_10_11 = [
  // windows-latest job 114524147023 (run 38157759348, 5329e4dc): timed out.
  { file: 'tests/replay/resourceWorkerOccupation.test.ts', title: 'resource worker occupation in saves and replay > keeps full non-cosmetic default-map state identical through a 600-tick commanded-worker prefix and real gather', state: 'timedOut' as const, durationMs: 32_003, timeoutMs: 30_000 },
  // windows-latest job 114428411250 (run 38125336663, 7294d0c6): timed out.
  { file: 'tests/replay/resourceWorkerOccupationLifecycle.test.ts', title: 'keeps full modern and legacy state identical through real wood gathering, full carry and deposit', state: 'timedOut' as const, durationMs: 35_690, timeoutMs: 30_000 },
  // browser shard 4/4 job 114524146925 (run 38157759348): timed out, and the passing test beside it at 91%.
  { file: 'tests/browser/resource-workers.spec.ts', line: 113, title: 'large resource readouts stay inside fixed chips at 1920px', state: 'timedOut' as const, durationMs: 30_000, timeoutMs: 30_000 },
  { file: 'tests/browser/selection-panel-height.spec.ts', line: 233, title: 'the command bar keeps one height at 1920x1080', state: 'passed' as const, durationMs: 27_200, timeoutMs: 30_000 },
  // browser shard 2/4 job 114518528177 (run 38155841333): passed, at 89.8 s of 90 s.
  { file: 'tests/browser/de-ground.spec.ts', line: 139, title: 'dims explored-but-unseen ground to about half the brightness of visible ground', state: 'passed' as const, durationMs: 89_800, timeoutMs: 90_000 },
  // the same shard's quick neighbour, well inside the ceiling.
  { file: 'tests/browser/de-ground.spec.ts', line: 173, title: 'draws again after the WebGL context is lost and restored', state: 'passed' as const, durationMs: 12_900, timeoutMs: 30_000 },
];

describe('test-time-headroom: the verdict', () => {
  it('fails every test CI ran past two thirds of its own limit on 2026-10-11, and names each', () => {
    const verdict = judgeTestTimes(MEASURED_2026_10_11);
    expect(verdict.ok).toBe(false);
    expect(verdict.offenders.map((test) => test.file)).toEqual([
      'tests/replay/resourceWorkerOccupationLifecycle.test.ts',
      'tests/replay/resourceWorkerOccupation.test.ts',
      'tests/browser/resource-workers.spec.ts',
      'tests/browser/de-ground.spec.ts',
      'tests/browser/selection-panel-height.spec.ts',
    ]);
    expect(verdict.message).toContain('5 of 6 tests used more than 67% of their own time limit');
    expect(verdict.message).toContain('119% of 30s (35.7s) tests/replay/resourceWorkerOccupationLifecycle.test.ts');
    expect(verdict.message).toContain('timed out');
    expect(verdict.message).toContain('100% of 90s (89.8s) tests/browser/de-ground.spec.ts:139');
    expect(verdict.message).toContain('a runner 1.5x slower');
    expect(verdict.message).toContain('raising a time limit');
  });

  it('puts the ceiling at two thirds of each test\'s own limit, inclusive', () => {
    expect(MAX_SHARE).toBeCloseTo(2 / 3, 10);
    expect(judgeTestTimes([record('at the line', 20_000, 30_000)]).ok).toBe(true);
    expect(judgeTestTimes([record('past the line', 20_001, 30_000)]).ok).toBe(false);
    expect(judgeTestTimes([record('a slow test with a 90 s limit', 60_000, 90_000)]).ok).toBe(true);
    expect(judgeTestTimes([record('a quick test with a 5 s limit', 3_400, 5_000)]).ok).toBe(false);
  });

  it('judges failed tests by their duration too, and a timed-out test whatever its clock says', () => {
    expect(judgeTestTimes([record('failed early', 2_000, 30_000, 'failed')]).ok).toBe(true);
    expect(judgeTestTimes([record('failed late', 25_000, 30_000, 'failed')]).ok).toBe(false);
    expect(judgeTestTimes([record('timed out at a short reading', 1_000, 30_000, 'timedOut')]).ok).toBe(false);
  });

  it('ignores skipped tests and counts tests with no limit without judging them', () => {
    const verdict = judgeTestTimes([
      record('skipped', 0, 30_000, 'skipped'),
      record('no limit', 500_000, 0),
      record('fine', 1_000, 30_000),
    ]);
    expect(verdict.ok).toBe(true);
    expect(verdict.judged).toBe(1);
    expect(verdict.unlimited).toBe(1);
  });

  it('fails when nothing was measured, rather than passing an empty report', () => {
    const verdict = judgeTestTimes([record('skipped', 0, 30_000, 'skipped')]);
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain('No test was measured');
  });

  it('judges only the states it knows were measured, so an unrun test cannot pass as 0%', () => {
    // A reporter that one day files an unrun test as, say, 'pending' must not
    // turn it into a measured 0% that gets a report past the guard above.
    const unrun = { ...record('never ran', 0, 30_000), state: 'pending' as unknown as State };
    const verdict = judgeTestTimes([unrun]);
    expect(verdict.ok).toBe(false);
    expect(verdict.judged).toBe(0);
    expect(verdict.message).toContain('No test was measured');
  });

  it('describes a test the way the browser reporter always has, with its line when known', () => {
    expect(describeTestTime({ ...MEASURED_2026_10_11[3]!, share: 27_200 / 30_000 }))
      .toBe('91% of 30s (27.2s) tests/browser/selection-panel-height.spec.ts:233 › the command bar keeps one height at 1920x1080');
  });
});

describe('test-time-headroom: the command line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-time-headroom-'));
  const write = (name: string, tests: unknown) => {
    const path = join(dir, name);
    writeFileSync(path, JSON.stringify({ runner: 'vitest', writtenAt: '2026-10-11T00:00:00Z', tests }));
    return path;
  };
  const run = (...paths: string[]) => spawnSync(process.execPath, [SCRIPT, ...paths], { encoding: 'utf8' });

  it('exits 0 inside the ceiling and 1 past it, printing the closest tests either way', () => {
    const inside = run(write('inside.json', [record('quick', 5_000, 30_000)]));
    expect(inside.status, inside.stderr).toBe(0);
    expect(inside.stdout).toContain('17% of 30s (5.0s) tests/x.test.ts › quick');
    const past = run(write('past.json', MEASURED_2026_10_11));
    expect(past.status).toBe(1);
    expect(past.stderr).toContain('5 of 6 tests used more than 67%');
  });

  it('judges several reports together', () => {
    const both = run(write('a.json', [record('quick', 5_000, 30_000)]), write('b.json', [record('slow', 29_000, 30_000)]));
    expect(both.status).toBe(1);
    expect(both.stderr).toContain('1 of 2 tests');
  });

  it('fails, naming the file, when a report is missing or not a report', () => {
    const missing = run(join(dir, 'never-written.json'));
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('never-written.json');
    expect(missing.stderr).toContain('reporter');
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, '{"runner":"vitest"}');
    const notReport = run(bad);
    expect(notReport.status).toBe(1);
    expect(notReport.stderr).toContain('has no "tests" list');
    const none = run();
    expect(none.status).toBe(1);
    expect(none.stderr).toContain('Usage');
  });
});

describe('test-time-headroom: the reporters write what the judge reads', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-time-reporters-'));

  it('the vitest reporter records each test with its own timeout, state and duration', async () => {
    const outputFile = join(dir, 'vitest.json');
    const reporter = new VitestTestTimeReporter({ outputFile, rootDir: 'C:/repo', print: false });
    const testCase = (name: string, timeout: number, state: string, duration: number, errors: unknown[] = []) => ({
      fullName: `suite > ${name}`,
      location: { line: 7, column: 3 },
      task: { timeout },
      result: () => ({ state, errors }),
      diagnostic: () => (state === 'skipped' ? undefined : { duration }),
    });
    const module = {
      moduleId: 'C:/repo/tests/replay/x.test.ts',
      children: {
        *allTests() {
          yield testCase('quick', 30_000, 'passed', 1_200);
          yield testCase('slow', 30_000, 'failed', 30_004, [{ message: 'Test timed out in 30000ms.\nIf this is a long-running test, ...' }]);
          yield testCase('long limit', 600_000, 'passed', 312_848);
          yield testCase('not run', 30_000, 'skipped', 0);
        },
      },
    };
    await reporter.onTestRunEnd([module as never], [], 'passed');
    const report = readTestTimes(outputFile);
    expect(report.runner).toBe('vitest');
    expect(report.outcome).toEqual({ status: 'passed', unhandledErrors: 0 });
    expect(report.argv).toEqual(process.argv.slice(2));
    expect(report.tests).toEqual([
      { file: 'tests/replay/x.test.ts', line: 7, title: 'suite > quick', state: 'passed', durationMs: 1_200, timeoutMs: 30_000 },
      { file: 'tests/replay/x.test.ts', line: 7, title: 'suite > slow', state: 'timedOut', durationMs: 30_004, timeoutMs: 30_000 },
      { file: 'tests/replay/x.test.ts', line: 7, title: 'suite > long limit', state: 'passed', durationMs: 312_848, timeoutMs: 600_000 },
      { file: 'tests/replay/x.test.ts', line: 7, title: 'suite > not run', state: 'skipped', durationMs: 0, timeoutMs: 30_000 },
    ]);
  });

  it('the vitest reporter records a run that failed on an unhandled error, or was interrupted, as such', async () => {
    const outputFile = join(dir, 'vitest-outcome.json');
    const reporter = new VitestTestTimeReporter({ outputFile, rootDir: 'C:/repo', print: false });
    const module = {
      moduleId: 'C:/repo/tests/a.test.ts',
      children: { *allTests() { yield { fullName: 'a', location: undefined, task: { timeout: 30_000 }, result: () => ({ state: 'passed', errors: undefined }), diagnostic: () => ({ duration: 1 }) }; } },
    };
    // Every test passed, so only the outcome says the run did not.
    await reporter.onTestRunEnd([module as never], [{ message: 'unhandled rejection' }] as never, 'failed');
    expect(readTestTimes(outputFile).outcome).toEqual({ status: 'failed', unhandledErrors: 1 });
    await reporter.onTestRunEnd([module as never], [], 'interrupted');
    expect(readTestTimes(outputFile).outcome).toEqual({ status: 'interrupted', unhandledErrors: 0 });
  });

  it('the vitest reporter refuses a test whose timeout it cannot read, rather than writing a report that passes', async () => {
    const reporter = new VitestTestTimeReporter({ outputFile: join(dir, 'unread.json'), rootDir: 'C:/repo', print: false });
    const module = {
      moduleId: 'C:/repo/tests/a.test.ts',
      children: { *allTests() { yield { fullName: 'a', location: undefined, task: {}, result: () => ({ state: 'passed', errors: undefined }), diagnostic: () => ({ duration: 1 }) }; } },
    };
    await expect(reporter.onTestRunEnd([module as never])).rejects.toThrow('could not read the time limit of tests/a.test.ts › a');
  });

  it('the browser reporter records every finished test, a timed-out one included, with its own timeout', async () => {
    const outputFile = join(dir, 'playwright.json');
    const reporter = new DurationBudgetReporter({ outputFile });
    // Paths are taken relative to the config file's folder, not config.rootDir,
    // which Playwright sets to the test directory (CI run 38181131359 printed
    // `resource-workers.spec.ts:113` with no `tests/browser/` until this).
    reporter.onBegin({ configFile: 'C:/repo/playwright.config.ts', rootDir: 'C:/repo/tests/browser' } as never);
    const test = (title: string, line: number, timeout: number) => ({
      title,
      timeout,
      location: { file: 'C:\\repo\\tests\\browser\\resource-workers.spec.ts', line, column: 3 },
      titlePath: () => ['', 'chromium', 'resource-workers.spec.ts', title],
    });
    const log = console.log;
    console.log = () => undefined;
    try {
      reporter.onTestEnd(test('large resource readouts stay inside fixed chips at 1920px', 113, 30_000) as never, { status: 'timedOut', duration: 30_012 } as never);
      reporter.onTestEnd(test('resource occupations stay readable and follow real orders at 800px', 70, 60_000) as never, { status: 'passed', duration: 19_300 } as never);
      reporter.onTestEnd(test('skipped one', 140, 30_000) as never, { status: 'skipped', duration: 0 } as never);
      await reporter.onEnd({ status: 'failed' } as never);
    } finally {
      console.log = log;
    }
    expect(readTestTimes(outputFile).outcome).toEqual({ status: 'failed' });
    expect(readTestTimes(outputFile).argv).toEqual(process.argv.slice(2));
    expect(readTestTimes(outputFile).tests).toEqual([
      { file: 'tests/browser/resource-workers.spec.ts', line: 113, title: 'large resource readouts stay inside fixed chips at 1920px', state: 'timedOut', durationMs: 30_012, timeoutMs: 30_000 },
      { file: 'tests/browser/resource-workers.spec.ts', line: 70, title: 'resource occupations stay readable and follow real orders at 800px', state: 'passed', durationMs: 19_300, timeoutMs: 60_000 },
      { file: 'tests/browser/resource-workers.spec.ts', line: 140, title: 'skipped one', state: 'skipped', durationMs: 0, timeoutMs: 30_000 },
    ]);
  });

  it('both reporters default to the paths the CI steps judge', () => {
    expect(REPORT_PATHS).toEqual({ vitest: 'tmp/test-times/vitest.json', playwright: 'tmp/test-times/playwright.json' });
    expect(new VitestTestTimeReporter().outputFile).toBe(REPORT_PATHS.vitest);
    expect(new DurationBudgetReporter().outputFile).toBe(REPORT_PATHS.playwright);
  });
});

interface Step { readonly id?: string; readonly name?: string; readonly run?: string; readonly if?: string }
interface Job { readonly steps?: readonly Step[] }

function ciJobs(): Record<string, Job> {
  const yaml = createRequire(import.meta.url)('js-yaml') as { load(source: string): unknown };
  const doc = yaml.load(readFileSync(`${ROOT}.github/workflows/ci.yml`, 'utf8')) as { jobs?: Record<string, Job> };
  const jobs = doc.jobs ?? {};
  expect(Object.keys(jobs).sort(), 'ci.yml no longer has the jobs this gate was written for').toEqual(['browser', 'gates']);
  return jobs;
}

describe('ci.yml: each job judges its own tests against their own limits', () => {
  it.each([
    ['gates', /^npm test$/, REPORT_PATHS.vitest],
    ['browser', /^npm run test:browser\b/, REPORT_PATHS.playwright],
  ] as const)('%s judges %s\'s report after the suite and before the job headroom check, whenever the suite ran', (key, suite, report) => {
    const steps = ciJobs()[key]!.steps ?? [];
    const suiteAt = steps.findIndex((step) => suite.test(step.run?.trim() ?? ''));
    expect(suiteAt, `${key} has no suite step`).toBeGreaterThan(0);
    const suiteId = steps[suiteAt]!.id ?? '';
    expect(suiteId, `${key}'s suite step needs an id, which the verdict's condition names`).toMatch(/^[a-z][a-z-]*$/);
    const judgeAt = steps.findIndex((step) => step.run?.trim() === `node scripts/test-time-headroom.mjs ${report}`);
    expect(judgeAt, `${key} never runs scripts/test-time-headroom.mjs on ${report}`).toBeGreaterThan(suiteAt);
    // After a failed suite too, to print the ranking beside the failure; but
    // not when an earlier step failed and the suite never ran, where it would
    // only add a "no test-time report" error that says nothing about tests.
    expect(steps[judgeAt]!.if, 'the verdict should print whenever the suite ran, and only then')
      .toBe('${{ !cancelled() && steps.' + suiteId + ".outcome != 'skipped' }}");
    const jobCheckAt = steps.findIndex((step) => /^node scripts\/ci-job-headroom\.mjs\b/.test(step.run?.trim() ?? ''));
    expect(judgeAt, `${key} judges its tests after the job-level check, which must stay the last step`).toBeLessThan(jobCheckAt);
    expect(steps[jobCheckAt]!.if, 'a red per-test verdict must not skip the job-level check').toBe('${{ !cancelled() }}');
  });
});

// Each check asks for the reporter it needs and nothing more, so another
// reporter can join either list (work 124 adds one) without touching this file.
describe('the configs load the reporters', () => {
  it('vitest.config.ts keeps the default reporter and loads the test-time reporter', async () => {
    const { default: config } = await import('../../vitest.config');
    const reporters = (config.test?.reporters ?? []) as readonly unknown[];
    const names = reporters.map((entry) => (Array.isArray(entry) ? entry[0] as unknown : entry));
    expect(names).toContain('default');
    expect(names).toContain('./tests/helpers/vitestTestTimeReporter.ts');
  });

  it('playwright.config.ts loads the duration reporter, which writes the browser report', () => {
    const source = readFileSync(`${ROOT}playwright.config.ts`, 'utf8');
    // The entry, with or without an options object after the path.
    expect(source).toMatch(/\[\s*'\.\/tests\/browser\/helpers\/durationBudgetReporter\.ts'\s*[,\]]/);
  });
});
