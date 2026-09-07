// How close each browser spec is running to its OWN timeout, printed at the end
// of every run from `playwright.config.ts`.
//
// It REPORTS and does not fail, and that is a finding rather than a soft option.
// It was written to be the gate for the lessons-queue entry "a browser spec
// whose duration is within a few seconds of the timeout is already red on
// somebody's machine", and the measurement that entry asked for is what refused
// it. Both halves are below; the failing mode is still one env var away for
// anyone who wants to re-open the question.
//
// WHY A FRACTION of each test's own timeout rather than a number of seconds: the
// timeouts here are not uniform. Most tests take the 30s default, about twenty
// raise it to 90s with `test.slow()`, `game-progression-ageup` configures 60s,
// and `play-opening` sets 240s. One flat second count would be far too tight for
// the first group and meaningless for the last.
//
// THE MEASUREMENT, 2026-09-06, this machine, the same bundle both times
// (dist/index.html md5 46404a14…), 205 passing tests. Five closest to their own
// timeout:
//   run 1 (20.2 min)   95%  59%  46%  40%  39%
//   run 2 (19.8 min)   48%  47%  44%  41%  38%
// WHY NO THRESHOLD SURVIVES IT: those are the same tests. `runs the baseline AI
// barracks rush` went 28.4s -> 14.3s, a factor of 2.0. `voxel-unit-motion:7`
// went 17.8s (59%) to under 11.5s. And the Monk-and-relic test moved the OTHER
// way in the same pair, 11.8s -> 14.2s, so this is not one load factor scaling
// every test — it is per-test and it points both ways. A threshold above the
// worst observation (59%) with room for a 2x swing lands past 100%, which is the
// timeout that already exists; a threshold below it fails on a busy machine, and
// a gate that goes red because a peer was compiling teaches its reader to
// discount red (local rules, "Several workers in one checkout"). Duration on
// this machine is not a stable enough signal to gate on.
//
// WHAT IT IS GOOD FOR ANYWAY: the printed list is the early warning the entry
// wanted, at no risk. `keeps top status-bar chip positions stable` at 29.8s of
// 30s would have stood at the top of it, in every run, for as long as it took
// anyone to look. And it makes the next attempt at this gate cheap, because the
// data is now on the end of every run instead of behind a 20-minute measurement.
//
// TO FAIL ON IT: `BROWSER_DURATION_BUDGET=0.8 npm run test:browser` fails the
// run when a passing test exceeds that fraction of its own timeout. Read the
// paragraph above before wiring that into anything: on the data measured here it
// would have failed run 1 and passed run 2 on identical bytes.
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/** Report-only. See the header: no threshold survived the measurement. */
const BUDGET_FRACTION: number | 'off' = 'off';

// Tests already KNOWN to sit near their timeout, marked `[EXEMPT]` in the list
// so a reader can tell "this one has an owner" from "this one is new". They are
// also the tests an opted-in `BROWSER_DURATION_BUDGET` will not fail on.
//
// The one below advances up to 2,000 single-tick steps and serialises a full
// snapshot on every one of them. Measured at 95% of its 30s timeout (28.4s) in
// one full-suite run and 48% (14.3s) in the next — it is the widest swing in the
// suite and the reason no threshold shipped. It is the open risk already
// recorded in `docs/learning/defect-register.md` (2026-09-06, "both were
// measuring the host instead of the game"), and it is closed by making the test
// cheaper — deliberately NOT by raising its timeout, and not by chunking the
// loop, which would let owner 1's Town Centre train a replacement villager
// inside a chunk and quietly change what the test asserts.
//
// Keys are printed verbatim by `BROWSER_DURATION_BUDGET_KEYS=1`. Copy one from
// there; the first entry written here was guessed, did not match, and exempted
// nothing — an exemption that silently matches no test looks exactly like one
// that works.
const EXEMPT = new Set<string>([
  'game-combat-and-meta-meta.spec.ts › browser gameplay smoke tests - game-combat-and-meta (meta) '
  + '› runs the baseline AI barracks rush through the live game loop',
]);

// BOUNDS, and they are wide.
//   * It measures DURATION, not the reason for it. It cannot tell a test that is
//     slow because the game got slower from one that waits on a fixed sleep.
//   * Duration is NOISY here, by up to 2x per test between two runs of the same
//     bundle. Read a single number as a hint, and a number that stays high
//     across runs as a finding.
//   * A single run's list says nothing about CI. The runner is about 2.8x slower
//     on whole-suite wall time (41 min against 14), but per-test scaling has
//     never been checked and the two local runs above show that per-test time
//     does not follow the suite's.
//   * A test that FAILED, timed out, or was skipped is not measured at all: its
//     duration belongs to the failure, not to the test.
//   * It says nothing about the SUITE's total wall time, which is a separate
//     limit and the one CI actually pays.
//   * Only the five closest are printed. A test sitting sixth is invisible here.

interface Measured {
  readonly key: string;
  readonly label: string;
  readonly durationMs: number;
  readonly timeoutMs: number;
  readonly fraction: number;
}

/** The report always prints; this is only whether a run FAILS on it. */
const configuredFraction = (): number | 'off' => {
  const raw = process.env.BROWSER_DURATION_BUDGET;
  if (raw === undefined || raw === '') return BUDGET_FRACTION;
  if (raw === 'off') return 'off';
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error(
      'BROWSER_DURATION_BUDGET must be "off", or a fraction of each test\'s own timeout above 0 and '
      + `at most 1 — "0.8" fails a run where a passing test took more than 80% of its timeout. Got `
      + `"${raw}". The shipped default is report-only; read this file's header before turning it `
      + 'into a gate.',
    );
  }
  return parsed;
};

/** File path onward, so the key survives a line move and stays unique across
 *  describes that repeat a title (`command-deck-fits` repeats every card title
 *  at three viewports). */
const keyOf = (test: TestCase): string => {
  const parts = test.titlePath().filter((part) => part.length > 0);
  const fileIndex = parts.findIndex((part) => part.endsWith('.spec.ts'));
  return (fileIndex >= 0 ? parts.slice(fileIndex) : parts).join(' › ').replace(/\\/g, '/');
};

export default class DurationBudgetReporter implements Reporter {
  private readonly measured: Measured[] = [];

  private readonly budget = configuredFraction();

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'passed') return;
    const timeoutMs = test.timeout;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return;
    this.measured.push({
      key: keyOf(test),
      label: `${test.location.file.split(/[\\/]/).pop()}:${test.location.line} › ${test.title}`,
      durationMs: result.duration,
      timeoutMs,
      fraction: result.duration / timeoutMs,
    });
  }

  // `async` because Reporter.onEnd is typed to return void or a Promise; a bare
  // object is a type error even though Playwright awaits it happily at runtime.
  async onEnd(result: FullResult): Promise<{ status: FullResult['status'] } | void> {
    if (this.measured.length === 0) return;
    const ranked = [...this.measured].sort((a, b) => b.fraction - a.fraction);
    const show = (entry: Measured): string => `${(entry.fraction * 100).toFixed(0)}% of `
      + `${(entry.timeoutMs / 1000).toFixed(0)}s (${(entry.durationMs / 1000).toFixed(1)}s) `
      + `${entry.label}`;

    console.log(
      `\nHow close the browser suite ran to its timeouts — closest five of ${this.measured.length} `
      + 'passing tests, as a share of each one\'s OWN timeout:',
    );
    for (const entry of ranked.slice(0, 5)) {
      console.log(`  ${show(entry)}${EXEMPT.has(entry.key) ? '   [EXEMPT]' : ''}`);
      // An EXEMPT entry has to be the key VERBATIM, and the first one written
      // here was guessed and did not match — an exemption that silently matches
      // nothing is the failure mode this prints its way out of.
      if (process.env.BROWSER_DURATION_BUDGET_KEYS) console.log(`      key: ${entry.key}`);
    }

    const budget = this.budget;
    if (budget === 'off') {
      console.log(
        '  (report only — no run fails on duration. Set BROWSER_DURATION_BUDGET=0.8 to fail on it, '
        + 'after reading why no threshold shipped: tests/browser/helpers/durationBudgetReporter.ts)',
      );
      return;
    }
    const over = ranked.filter((entry) => entry.fraction > budget && !EXEMPT.has(entry.key));
    if (over.length === 0) return;
    console.error(
      `\n${over.length} test(s) used more than ${(budget * 100).toFixed(0)}% of their own timeout. `
      + 'A test this close to its wall is already red on a slower machine, and every runner this '
      + 'repo has is slower than the one it is authored on. Make the test cheaper or split it — '
      + 'raising its timeout only moves the wall, and adding it to EXEMPT in this file to get a '
      + 'green run is the move this budget exists to prevent:',
    );
    for (const entry of over) console.error(`  ${show(entry)}`);
    return { status: result.status === 'passed' ? 'failed' : result.status };
  }
}
