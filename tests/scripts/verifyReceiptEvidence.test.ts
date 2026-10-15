// `write` certifies a run of `npm run verify` only if both test suites left their own report of a whole, passing run
// of the full suite, written during this run (work 124 M2). A stage's process ended from outside through WMI's
// `Win32_Process.Terminate` exits 0, so the chain goes on to `write`; but a suite ended that way never reaches its
// reporter's end hook, so its report is missing. Work 123's reporters write them: tests/helpers/
// vitestTestTimeReporter.ts at tmp/test-times/vitest.json and tests/browser/helpers/durationBudgetReporter.ts at
// tmp/test-times/playwright.json, each with `writtenAt`, `argv`, `outcome` and `tests`. `start` deletes both, so a
// report from an earlier run cannot pass. A run that fails here is not a pass, so `write` exits 1 as well as leaving a
// record that `check` refuses.
//
// The reports in the sandboxes are written by the test, as the reporters would write them; the last cases feed the
// real reporters' own output to the same rules, and hold both configs to refusing a focused (`.only`) run. The cuts,
// real suites ended through WMI, one of them in a real `npm run verify`, are in docs/learning/gate-proofs.md. The
// sandboxes are helpers/receiptSandbox.ts's.
//
// BOUND. Only the two test suites leave evidence of their own: content:validate, typecheck, lint and build, ended
// from outside, still pass. A report is trusted for what it says about its own run; a report written by hand passes.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { readSuiteReport, SUITES, suiteProblems } from '../../scripts/verify-receipt-evidence.mjs';
import DurationBudgetReporter from '../browser/helpers/durationBudgetReporter';
import VitestTestTimeReporter from '../helpers/vitestTestTimeReporter';
import {
  check, cleanupSandboxes, gatedRun, put, readReceipt, receiptExists, REPORTS, type Sandbox, sandbox, start, START_RECORD,
  suitesReport, write,
} from './helpers/receiptSandbox';

const PACKAGE_JSON = fileURLToPath(new URL('../../package.json', import.meta.url));

afterEach(cleanupSandboxes);

// One run of the chain: `start`, the suites' reports as given, `write`. A run that the evidence refuses exits 1 at
// `write`, and `check` refuses its record, naming the same reason. The two verdicts are asserted before any message,
// so a rule that stops deciding fails on a verdict, not only on a message.
function refusedRun(sb: Sandbox, reports: Parameters<typeof suitesReport>[1], ...says: string[]) {
  expect(start(sb).status).toBe(0);
  suitesReport(sb, reports);
  const ended = write(sb);
  expect(ended.status, `write must fail the run: ${ended.err}`).toBe(1);
  const refused = check(sb);
  expect(refused.status, `check refuses the record: ${refused.out}`).toBe(1);
  expect(ended.err).toContain('NOT CERTIFIED');
  for (const text of says) {
    expect(ended.err).toContain(text);
    expect(refused.err).toContain(text);
  }
}

describe('write certifies a run only with both suites\' own reports of a whole, passing run', () => {
  it('certifies a run whose two reports are whole and passing, and keeps what each said', () => {
    const sb = sandbox();
    gatedRun(sb);
    const evidence = readReceipt(sb).evidence as Record<string, { passed: number; tests: number; argv: string[] }>;
    expect(evidence.vitest).toMatchObject({ passed: 1, tests: 2, argv: ['run'] });
    expect(evidence.playwright).toMatchObject({ passed: 1, tests: 2, argv: ['test'] });
    const accepted = check(sb);
    expect(accepted.status, accepted.err).toBe(0);
    // What a landing compares with the two summaries in its log.
    expect(accepted.out).toContain('vitest 1 passed and 1 skipped');
    expect(accepted.out).toContain('playwright 1 passed and 1 skipped');
  });

  it('package.json runs each suite with the command line the evidence takes for the whole suite', () => {
    const scripts = (JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { scripts: Record<string, string> }).scripts;
    expect(scripts.test.split(' '), '`npm run test`, whose report must carry the full suite\'s arguments')
      .toEqual(['vitest', ...SUITES.vitest.argv]);
    expect(scripts['test:browser'].split(' '), '`npm run test:browser`, likewise').toEqual(['playwright', ...SUITES.playwright.argv]);
  });

  it('fails a run whose unit suite left no report, as one ended from outside leaves none', () => {
    refusedRun(sandbox(), { vitest: null }, REPORTS.vitest, 'missing');
  });

  it('fails a run whose browser suite left no report', () => {
    refusedRun(sandbox(), { playwright: null }, REPORTS.playwright, 'missing');
  });

  it('fails a run whose report is from a filtered run, not the full suite', () => {
    const sb = sandbox();
    refusedRun(sb, { vitest: { argv: ['run', 'tests/scripts/one.test.ts'] } }, 'vitest run tests/scripts/one.test.ts', 'full suite');
    refusedRun(sb, { playwright: { argv: ['test', '--shard=1/4'] } }, 'playwright test --shard=1/4', 'full suite');
    refusedRun(sb, { vitest: { argv: [] } }, 'is from `vitest`,', 'full suite');
  });

  it('fails a run whose report says the run failed, or lists a failed test, though its other tests passed', () => {
    const sb = sandbox();
    // A test file that fails to import fails the run and lists no test of its own.
    refusedRun(sb, { vitest: { outcome: { status: 'failed', unhandledErrors: 0 } } }, '"failed", not "passed"');
    refusedRun(sb, {
      playwright: {
        tests: [
          { file: 'tests/browser/a.spec.ts', line: 3, title: 'a', state: 'passed', durationMs: 900, timeoutMs: 30_000 },
          { file: 'tests/browser/b.spec.ts', line: 8, title: 'b', state: 'failed', durationMs: 2_000, timeoutMs: 30_000 },
        ],
      },
    }, 'tests/browser/b.spec.ts:8', '(failed)');
  });

  it('fails a run whose report has no valid time, or one after the run ended', () => {
    const sb = sandbox();
    refusedRun(sb, { vitest: { writtenAt: 'yesterday' } }, 'no valid writtenAt ("yesterday")');
    refusedRun(sb, { playwright: { writtenAt: null } }, 'no valid writtenAt (null)');
    refusedRun(sb, { playwright: { writtenAt: new Date(Date.now() + 3_600_000).toISOString() } }, 'outside this run');
  });

  it('fails a run whose report shows a failure, an unhandled error or no passing test', () => {
    const sb = sandbox();
    refusedRun(sb, { playwright: { outcome: { status: 'interrupted' } } }, '"interrupted"');
    refusedRun(sb, { vitest: { outcome: { status: 'passed', unhandledErrors: 2 } } }, '2 unhandled errors');
    refusedRun(sb, {
      vitest: {
        tests: [
          { file: 'tests/a.test.ts', line: 3, title: 'a', state: 'passed', durationMs: 120, timeoutMs: 30_000 },
          { file: 'tests/b.test.ts', line: 7, title: 'b', state: 'timedOut', durationMs: 30_001, timeoutMs: 30_000 },
        ],
      },
    }, 'tests/b.test.ts');
    refusedRun(sb, { playwright: { tests: [] } }, 'no passing test');
  });

  it('fails a run whose report was written before the run began, or is not a report at all', () => {
    const sb = sandbox();
    refusedRun(sb, { vitest: { writtenAt: new Date(Date.now() - 3_600_000).toISOString() } }, 'outside this run');
    refusedRun(sb, { playwright: { runner: 'vitest' } }, 'runner');
    expect(start(sb).status).toBe(0);
    suitesReport(sb, { vitest: null });
    writeFileSync(join(sb.repo, REPORTS.vitest), '{"runner": "vitest", ');
    const ended = write(sb);
    expect(ended.status).toBe(1);
    expect(ended.err).toContain('not valid JSON');
  });

  it('write refuses a start record with no valid start time, which would let a report from any time pass', () => {
    const sb = sandbox();
    expect(start(sb).status).toBe(0);
    const record = join(sb.repo, START_RECORD);
    writeFileSync(record, JSON.stringify({ ...JSON.parse(readFileSync(record, 'utf8')) as object, startedAt: 'not a time' }));
    suitesReport(sb, { vitest: { writtenAt: new Date(Date.now() - 3_600_000).toISOString() } });
    const ended = write(sb);
    expect(ended.status, `write must refuse: ${ended.err}`).toBe(1);
    expect(ended.err).toContain('not a start record');
    expect(ended.err, 'the refusal names the field').toContain('startedAt "not a time"');
    expect(receiptExists(sb), 'no receipt').toBe(false);
  });

  it('start removes the last run\'s reports and bundle, so neither a report nor a bundle from an earlier run can stand in', () => {
    const sb = sandbox();
    suitesReport(sb);
    // The last build: `npm run test:browser` builds before it tests, and a build ended before it writes would leave
    // this bundle for the browser suite to test and its report to vouch for.
    put(sb, 'dist/index.html', '<script type="module" src="/assets/index-old.js"></script>\n');
    put(sb, 'dist/assets/index-old.js', 'export {};\n');
    expect(existsSync(join(sb.repo, REPORTS.vitest)) && existsSync(join(sb.repo, REPORTS.playwright)), 'the premise').toBe(true);
    expect(start(sb).status).toBe(0);
    expect(existsSync(join(sb.repo, REPORTS.vitest)), 'the unit report').toBe(false);
    expect(existsSync(join(sb.repo, REPORTS.playwright)), 'the browser report').toBe(false);
    expect(existsSync(join(sb.repo, 'dist')), 'the last bundle').toBe(false);
  });
});

// The two real reporters' own output, read by the rules `write` applies, so that a field renamed on either side fails
// here rather than at every landing after it. They are driven the way tests/scripts/testTimeHeadroom.test.ts drives them.
describe('the reports the real reporters write are the ones write reads', () => {
  // A reporter takes the run's command line from process.argv; here it is the whole suite's.
  async function asRunWith(argv: readonly string[], report: () => Promise<unknown>) {
    const saved = process.argv.splice(2, process.argv.length - 2, ...argv);
    try {
      await report();
    } finally {
      process.argv.splice(2, process.argv.length - 2, ...saved);
    }
  }

  it('a whole, passing run from each reporter shows no problem, and a failed one shows its failure', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'receipt-reporters-'));
    const log = console.log;
    try {
      const window = { startedAt: new Date(Date.now() - 60_000).toISOString(), finishedAt: '' };
      const vitestFile = join(dir, 'vitest.json');
      const unitCase = (title: string, line: number, state: string) => ({
        fullName: title,
        location: { line, column: 3 },
        task: { timeout: 30_000 },
        result: () => ({ state, errors: [] }),
        diagnostic: () => (state === 'skipped' ? undefined : { duration: 5 }),
      });
      const unit = (state: string) => ({
        moduleId: 'C:/repo/tests/a.test.ts',
        children: { *allTests() { yield unitCase('a', 3, state); yield unitCase('b', 9, 'skipped'); } },
      });
      const vitest = () => new VitestTestTimeReporter({ outputFile: vitestFile, rootDir: 'C:/repo', print: false });
      await asRunWith(SUITES.vitest.argv, () => vitest().onTestRunEnd([unit('passed') as never], [], 'passed'));
      const playwrightFile = join(dir, 'playwright.json');
      const browser = new DurationBudgetReporter({ outputFile: playwrightFile });
      browser.onBegin({ configFile: 'C:/repo/playwright.config.ts', rootDir: 'C:/repo/tests/browser' } as never);
      const spec = (title: string, line: number) => ({
        title,
        timeout: 30_000,
        location: { file: 'C:\\repo\\tests\\browser\\a.spec.ts', line, column: 3 },
        titlePath: () => ['', 'chromium', 'a.spec.ts', title],
      });
      console.log = () => undefined;
      browser.onTestEnd(spec('a', 3) as never, { status: 'passed', duration: 900 } as never);
      browser.onTestEnd(spec('b', 9) as never, { status: 'skipped', duration: 0 } as never);
      await asRunWith(SUITES.playwright.argv, () => browser.onEnd({ status: 'passed' } as never));
      window.finishedAt = new Date(Date.now() + 60_000).toISOString();
      expect(suiteProblems('vitest', readSuiteReport(vitestFile), window), 'the unit report').toEqual([]);
      expect(suiteProblems('playwright', readSuiteReport(playwrightFile), window), 'the browser report').toEqual([]);
      await asRunWith(SUITES.vitest.argv, () => vitest().onTestRunEnd([unit('failed') as never], [], 'failed'));
      const failed = suiteProblems('vitest', readSuiteReport(vitestFile), window).join(' ');
      expect(failed).toContain('"failed", not "passed"');
      expect(failed).toContain('tests/a.test.ts:3 › a (failed)');
    } finally {
      console.log = log;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('neither suite runs a focused subset as if it were the whole suite', () => {
  it('Vitest fails a run that meets a .only, and Playwright forbids one', async () => {
    const { default: vitestConfig } = await import('../../vitest.config');
    expect(vitestConfig.test?.allowOnly, 'vitest.config.ts: a .only must fail the run, not narrow it').toBe(false);
    // The loaded config's own top-level value, which is what Playwright reads: a line of text could be commented out
    // or nested in another block.
    const { default: playwrightConfig } = await import('../../playwright.config');
    expect(playwrightConfig.forbidOnly, 'playwright.config.ts: a .only must fail the run, not narrow it').toBe(true);
  });
});
