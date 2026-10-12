// Writes how long each unit test ran against its OWN time limit, for
// scripts/test-time-headroom.mjs to judge on CI, and prints the five closest at
// the end of every run. Locally it only reports; the reason, and what the gate
// can and cannot see, are in that script's header.
//
// The limit is the runner's own number for the test (`it(name, fn, 90_000)`, or
// testTimeout from vitest.config.ts), read from the test's task. Vitest 3's
// public TestCase does not expose it, so a vitest that stops carrying it makes
// this reporter throw, naming the test, rather than write a report the judge
// would pass with no limits in it.
import type { Reporter, TestModule } from 'vitest/node';

import {
  describeTestTime, judgeTestTimes, REPORT_PATHS, repoRelative, writeTestTimes,
} from '../../scripts/test-time-headroom.mjs';

type TestTime = Parameters<typeof judgeTestTimes>[0][number];

interface Options {
  /** Where to write the report; defaults to REPORT_PATHS.vitest under the run's root. */
  readonly outputFile?: string;
  /** What the report's file paths are relative to; defaults to the vitest root. */
  readonly rootDir?: string;
  /** Print the closest five at the end of the run (default true). */
  readonly print?: boolean;
}

/** The internal task behind a reported test; only its timeout is read. */
interface WithTask { readonly task?: { readonly timeout?: unknown } }

const TIMED_OUT = /\bTest timed out in \d+ms\b/;

export default class VitestTestTimeReporter implements Reporter {
  readonly outputFile: string;

  private rootDir: string | undefined;

  private readonly print: boolean;

  constructor(options: Options = {}) {
    this.outputFile = options.outputFile ?? REPORT_PATHS.vitest;
    this.rootDir = options.rootDir;
    this.print = options.print ?? true;
  }

  onInit(vitest: { config: { root: string } }): void {
    this.rootDir ??= vitest.config.root;
  }

  async onTestRunEnd(testModules: ReadonlyArray<TestModule>): Promise<void> {
    const rootDir = this.rootDir ?? process.cwd();
    const tests: TestTime[] = [];
    for (const testModule of testModules) {
      const file = repoRelative(testModule.moduleId, rootDir);
      for (const testCase of testModule.children.allTests()) {
        const timeout = (testCase as unknown as WithTask).task?.timeout;
        if (typeof timeout !== 'number' || Number.isNaN(timeout)) {
          throw new Error(
            `vitestTestTimeReporter could not read the time limit of ${file} › ${testCase.fullName} `
            + `(its task's timeout is ${String(timeout)}). Without it scripts/test-time-headroom.mjs cannot `
            + 'judge the run, and a report it cannot judge must not be written as if it could.',
          );
        }
        const result = testCase.result();
        const errors = (result.errors ?? []) as ReadonlyArray<{ readonly message?: string }>;
        const state: TestTime['state'] = result.state === 'skipped' || result.state === 'pending'
          ? 'skipped'
          : result.state === 'failed'
            ? (errors.some((error) => TIMED_OUT.test(error.message ?? '')) ? 'timedOut' : 'failed')
            : 'passed';
        tests.push({
          file,
          ...(testCase.location ? { line: testCase.location.line } : {}),
          title: testCase.fullName,
          state,
          durationMs: state === 'skipped' ? 0 : (testCase.diagnostic()?.duration ?? 0),
          timeoutMs: timeout,
        });
      }
    }
    writeTestTimes(this.outputFile, { runner: 'vitest', writtenAt: new Date().toISOString(), tests });
    if (!this.print || tests.length === 0) return;
    const verdict = judgeTestTimes(tests, { show: 5 });
    if (verdict.judged === 0) return;
    console.log(
      `\nHow close the unit tests ran to their own time limits — closest ${String(verdict.closest.length)} of `
      + `${String(verdict.judged)} (report only here; CI fails past two thirds, scripts/test-time-headroom.mjs):\n`
      + verdict.closest.map((test) => `  ${describeTestTime(test)}`).join('\n'),
    );
  }
}
