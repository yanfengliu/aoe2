// `npm run ci:status` is the instrument AGENTS.md points a session at before it
// does anything else, and on 2026-09-05 it had the very failure it was built to
// stop inside it: it read the workflow RUN LIST and reported on whichever run
// was newest, so a commit that produced NO run at all was invisible. It
// described an earlier commit's run and gave no hint the tip was ungated.
//
// This holds the reporting logic to the five answers it has to keep apart for a
// commit: UNGATED (a run was due and none exists), NEVER ASKED (none was due —
// both watched workflows filter `on.push.paths`), COULD NOT RUN (created, never
// started — the account block), GREEN, and RED. Plus CARRIED, the over-fix
// guard: an interior commit of a multi-commit push has no run of its own and is
// still covered by the run at the tip, and calling that UNGATED would make the
// command cry wolf on every commit but the last.
//
// BOUND, stated plainly: FIXTURES ARE NOT THE API. Every response here was
// captured from the real repo with `gh` on 2026-09-05 (the ids and shas are in
// each fixture's name), but they are the PROJECTIONS the script's own `--jq`
// asks for, not raw payloads. So this proves the reporting logic and the exit
// codes; it proves NOTHING about whether GitHub still returns these shapes, or
// whether `gh`'s flags still mean what they meant. A field rename on GitHub's
// side leaves this suite green. The only check on that is running
// `npm run ci:status` against the live repo.
//
// Second bound: the fake `gh`/`git` refuses any command it does not recognise.
// That is deliberate — a missing fixture must fail loudly, because a stub that
// silently returns "" is exactly how a check reports "did not run" as "passed".

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

type Exec = (bin: string, args: string[]) => string;

let handler: Exec = () => {
  throw new Error('ci-status called a subprocess before a scenario was installed');
};

vi.mock('node:child_process', () => ({
  execFileSync: (bin: string, args: string[]) => handler(bin, args),
}));

const SCRIPT = new URL('../../scripts/ci-status.mjs', import.meta.url).href;
const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

const TIP_BLOCKED = 'b1d0a0ff75c9aa77f8c9e84191b1b7e5b234d0df';
const TIP_GREEN = 'c538545865c3b2ee5b3ae3fee9351e48b2eccaf2';
const TIP_RED = '619e3994fd91178c1863257130616c88d6990966';
const TIP_DOCS = '3924431040fab4898add984f16af131de13022c3';

const WORKFLOW_FILES: Record<string, string> = {
  'ci.yml': fixture('workflow--ci.yml'),
  'playtest.yml': fixture('workflow--playtest.yml'),
  'playtest-llm.yml': fixture('workflow--playtest-llm.yml'),
};

const WORKFLOW_DIR = fileURLToPath(new URL('../../.github/workflows/', import.meta.url));
const realWorkflow = (name: string) => readFileSync(`${WORKFLOW_DIR}${name}`, 'utf8');

interface Scenario {
  tip: string;
  subject: string;
  runsForSha: string;
  history: Record<string, string>;
  jobs: Record<string, string>;
  annotations?: Record<string, string>;
  changed: string;
  /** A sha the tip is an ancestor OF — i.e. a later push that carried it. */
  descendant?: string;
}

function makeHandler(scenario: Scenario): Exec {
  const refuse = (bin: string, args: string[]) => {
    throw new Error(`unstubbed command: ${bin} ${args.join(' ')}`);
  };
  return (bin, args) => {
    if (bin === 'git') {
      // Every ref resolves to the commit under test: these scenarios put HEAD
      // and origin/main on the same commit, so the script reports one target.
      if (args[0] === 'rev-parse') return scenario.tip;
      if (args[0] === 'merge-base') {
        const [, , a, b] = args;
        const ancestorOfTip = b === scenario.tip && a !== scenario.tip && a !== scenario.descendant;
        const carried = a === scenario.tip && b === scenario.descendant;
        if (ancestorOfTip || carried) return '';
        throw Object.assign(new Error('Command failed'), { status: 1 });
      }
      if (args[0] === 'log') return scenario.subject;
      if (args[0] === 'ls-tree') return Object.keys(WORKFLOW_FILES).join('\n');
      if (args[0] === 'show') {
        const file = String(args[1]).split('/').pop() ?? '';
        return WORKFLOW_FILES[file] ?? refuse(bin, args);
      }
      if (args[0] === 'diff' || args[0] === 'diff-tree') return scenario.changed;
      return refuse(bin, args);
    }
    if (bin === 'gh') {
      if (args[0] === 'run') {
        const workflow = args[args.indexOf('--workflow') + 1];
        return scenario.history[workflow] ?? refuse(bin, args);
      }
      const path = String(args[1]);
      if (path.includes('actions/runs?head_sha=')) return scenario.runsForSha;
      const jobsAt = /actions\/runs\/(\d+)\/jobs/.exec(path);
      if (jobsAt) return scenario.jobs[jobsAt[1]] ?? refuse(bin, args);
      const annotationsAt = /check-runs\/(\d+)\/annotations/.exec(path);
      if (annotationsAt) return scenario.annotations?.[annotationsAt[1]] ?? '[]';
      return refuse(bin, args);
    }
    return refuse(bin, args);
  };
}

let caseId = 0;

async function runScript(scenario: Scenario): Promise<{ out: string; exitCode: number }> {
  handler = makeHandler(scenario);
  const logged: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    logged.push(parts.map(String).join(' '));
  });
  const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw Object.assign(new Error('process.exit'), { exitCode: code ?? 0 });
  }) as never);
  const savedArgv = process.argv;
  process.argv = [savedArgv[0], fileURLToPath(SCRIPT)];
  let exitCode = -1;
  try {
    caseId += 1;
    // A fresh evaluation per case. `main` is called only when it exists:
    // revisions of this script before the fix ran on import and had no export,
    // and that tolerance is what lets this same gate be pointed at the pre-fix
    // script to prove it red (docs/learning/gate-proofs.md).
    const module = (await import(`${SCRIPT}?case=${caseId}`)) as {
      main?: (argv: string[]) => number;
    };
    if (typeof module.main === 'function') exitCode = module.main([]);
  } catch (error) {
    const thrown = error as { exitCode?: number };
    if (typeof thrown.exitCode !== 'number') throw error;
    exitCode = thrown.exitCode;
  } finally {
    process.argv = savedArgv;
    log.mockRestore();
    exit.mockRestore();
  }
  return { out: logged.join('\n'), exitCode };
}

const BLOCKED_HISTORY = {
  CI: fixture('run-list--ci-blocked.json'),
  'playtest-corpus': fixture('run-list--playtest-corpus-blocked.json'),
};
const GREEN_HISTORY = {
  CI: fixture('run-list--ci-through-2026-09-03.json'),
  'playtest-corpus': fixture('run-list--playtest-corpus-through-2026-09-03.json'),
};
const RED_HISTORY = {
  CI: fixture('run-list--ci-through-2026-08-29.json'),
  'playtest-corpus': fixture('run-list--playtest-corpus-through-2026-08-29.json'),
};
const BLOCKED_JOBS = {
  34011049865: fixture('jobs--blocked-34011049865.json'),
  34011049840: fixture('jobs--blocked-34011049865.json'),
};
const BILLING = {
  101426824596: fixture('annotations--billing-101426824596.json'),
  101426824715: fixture('annotations--billing-101426824596.json'),
};

describe('ci:status reports on a commit, not on whatever run is newest', () => {
  // THE case. A pushed commit that changed `package.json` — which is in both
  // watched workflows' `on.push.paths` — and for which the runs API returns
  // nothing at all. Nothing checked this commit and the command has to say so.
  it('calls a pushed commit with no run UNGATED, names it, and exits 1', async () => {
    const { out, exitCode } = await runScript({
      tip: TIP_BLOCKED,
      subject: 'Clicking the command bar no longer sends your army into the fog (v0.3.209)',
      runsForSha: fixture('runs-for-sha--none-39244310.json'),
      history: GREEN_HISTORY,
      jobs: {},
      changed: fixture('changed--version-bump.txt'),
    });
    // The exit code IS the contract, so it is asserted first: an ungated commit
    // is not green, and 0 here is the whole defect.
    expect(exitCode).toBe(1);
    expect(out).toContain('b1d0a0ff');
    expect(out).toContain('UNGATED');
    expect(out).toContain('package.json');
    // Not a red gate and not a green one — the point is that no verdict exists.
    const ciLine = out.split('\n').find((line) => line.includes('CI @ b1d0a0ff')) ?? '';
    expect(ciLine).toContain('UNGATED');
    expect(ciLine).not.toMatch(/GREEN|COULD NOT RUN|NEVER ASKED|STILL RUNNING/);
    expect(out.split('\n').find((line) => line.includes('playtest-corpus @ b1d0a0ff')))
      .toContain('UNGATED');
  });

  // The other half of the same question, and the reason UNGATED can be trusted:
  // a docs-only push is MEANT to produce no run, and saying "never asked" out
  // loud is different from saying nothing.
  it('calls a commit that owed no run NEVER ASKED, and exits 0', async () => {
    const { out, exitCode } = await runScript({
      tip: TIP_DOCS,
      subject: 'Promote the final acceptance gate',
      runsForSha: fixture('runs-for-sha--none-39244310.json'),
      history: GREEN_HISTORY,
      jobs: {},
      changed: fixture('changed--docs-only.txt'),
    });
    expect(out).toContain('39244310');
    expect(out).toContain('NEVER ASKED');
    expect(out).toContain('on.push.paths');
    expect(out).not.toContain('UNGATED');
    expect(exitCode).toBe(0);
  });

  // The over-fix guard. Every commit but the tip of a multi-commit push has no
  // run of its own; a fix that shouted UNGATED at all of them would satisfy the
  // case above and be useless.
  it('calls an interior commit of a push CARRIED, not UNGATED', async () => {
    const { out, exitCode } = await runScript({
      tip: 'ad807d728b1f0dd73c621c92706e2bb9a43cb969', // v0.3.208, two pushes back
      subject: 'A villager sent to an unfinished building now builds it (v0.3.208)',
      runsForSha: fixture('runs-for-sha--none-39244310.json'),
      history: BLOCKED_HISTORY,
      jobs: BLOCKED_JOBS,
      annotations: BILLING,
      changed: fixture('changed--version-bump.txt'),
      descendant: TIP_BLOCKED,
    });
    expect(out).toContain('CARRIED');
    expect(out).toContain('b1d0a0ff');
    expect(out).not.toContain('UNGATED');
    expect(exitCode).toBe(0);
  });
});

describe('ci:status separates a gate that could not start from a gate that failed', () => {
  it('prints GitHub\'s own billing annotation verbatim when no runner was assigned', async () => {
    const { out, exitCode } = await runScript({
      tip: TIP_BLOCKED,
      subject: 'Clicking the command bar no longer sends your army into the fog (v0.3.209)',
      runsForSha: fixture('runs-for-sha--blocked-b1d0a0ff.json'),
      history: BLOCKED_HISTORY,
      jobs: BLOCKED_JOBS,
      annotations: BILLING,
      changed: fixture('changed--version-bump.txt'),
    });
    expect(out).toContain('COULD NOT RUN');
    // Verbatim, because "your payment failed" and "you are out of free minutes"
    // call for different actions and the inference cannot tell them apart.
    expect(out).toContain(
      'The job was not started because recent account payments have failed or your spending'
      + " limit needs to be increased. Please check the 'Billing & plans' section in your settings",
    );
    expect(out).toContain('is NOT a red gate');
    expect(out).not.toContain('UNGATED');
    expect(exitCode).toBe(0);
  });

  it('calls a successful run GREEN and exits 0', async () => {
    const { out, exitCode } = await runScript({
      tip: TIP_GREEN,
      subject: 'Merge: motion smoothing survives a slow machine (v0.3.192)',
      runsForSha: fixture('runs-for-sha--green-c5385458.json'),
      history: GREEN_HISTORY,
      jobs: {
        33713720750: fixture('jobs--green-33713720750.json'),
        33713720749: fixture('jobs--green-33713720750.json'),
      },
      changed: fixture('changed--version-bump.txt'),
    });
    expect(out).toContain('c5385458'); // named, not "whichever run is newest"
    expect(out).toContain('GREEN');
    expect(out).not.toMatch(/UNGATED|COULD NOT RUN|RED \(/);
    expect(exitCode).toBe(0);
  });

  // A run with steps and a runner is a verdict on the CODE, and stays red.
  it('calls a run that failed with steps and a runner RED, and exits 1', async () => {
    const { out, exitCode } = await runScript({
      tip: TIP_RED,
      subject: "Walk at AoE2's real speeds",
      runsForSha: fixture('runs-for-sha--red-619e3994.json'),
      history: RED_HISTORY,
      jobs: {
        33233227742: fixture('jobs--red-33233227742.json'),
        33233227739: fixture('jobs--red-33233227742.json'),
      },
      annotations: { 99049576048: fixture('annotations--red-99049576048.json') },
      changed: fixture('changed--version-bump.txt'),
    });
    expect(out).toContain('RED (failure)');
    expect(out).not.toContain('COULD NOT RUN');
    expect(out).toContain('A red or ungated remote gate is the next task');
    expect(exitCode).toBe(1);
  });
});

describe('the fixtures are wired the way the script asks for them', () => {
  // Controls, so "no leak" cannot quietly mean "did not run": if the fake
  // stopped answering, every case above would report a reassuring nothing.
  it('refuses a command it has no fixture for', () => {
    const strict = makeHandler({
      tip: TIP_BLOCKED,
      subject: 'x',
      runsForSha: '[]',
      history: {},
      jobs: {},
      changed: '',
    });
    expect(() => strict('gh', ['api', 'repos/{owner}/{repo}/issues'])).toThrow('unstubbed');
    expect(() => strict('git', ['bisect'])).toThrow('unstubbed');
    expect(() => strict('curl', ['https://example.com'])).toThrow('unstubbed');
  });

  it('recorded a real zero-run response and a real never-started jobs response', () => {
    expect(JSON.parse(fixture('runs-for-sha--none-39244310.json'))).toEqual([]);
    const blocked = JSON.parse(fixture('jobs--blocked-34011049865.json')) as Array<{
      steps: number; runner: string;
    }>;
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every((job) => job.steps === 0 && job.runner === '')).toBe(true);
    const green = JSON.parse(fixture('jobs--green-33713720750.json')) as Array<{
      steps: number; runner: string;
    }>;
    expect(green.every((job) => job.steps > 0 && job.runner !== '')).toBe(true);
  });
});

// The three `workflow--*.yml` fixtures are copies of `.github/workflows/*.yml`,
// and until 2026-09-06 nothing compared a copy to the file it stands for. That
// gap was not theoretical: the copies were captured at ca24709b, commit
// 52546080 then edited ci.yml and playtest-llm.yml, and the fixtures sat a day
// behind with nothing red. The drift happened to be inert — both edits landed
// outside `on.push` — but "inert" was nobody's finding, it was luck. The drift
// that is NOT inert is the one that moves a path filter, and it would leave
// every case above answering confidently for a filter main does not have.
//
// BOUND, in the same terms as the one at the top of this file: this compares
// the PARSED PUSH TRIGGER and nothing else, because that is the whole surface
// the script reads out of these files and the whole surface the cases above
// rest on. A fixture may differ from its workflow anywhere else — a comment, a
// step, a `permissions:` block — and this stays green. It is deliberately not a
// byte-for-byte check: a gate that goes red because someone reworded a comment
// is a gate the next person deletes.
describe('the workflow fixtures still stand for the workflows they copy', () => {
  type Trigger = { name: string | null; parsed: boolean };

  async function parser(): Promise<(text: string) => Trigger> {
    const module = (await import(`${SCRIPT}?parity`)) as {
      parsePushTrigger: (text: string) => Trigger;
    };
    return module.parsePushTrigger;
  }

  const PAIRS = [
    ['workflow--ci.yml', 'ci.yml'],
    ['workflow--playtest.yml', 'playtest.yml'],
    ['workflow--playtest-llm.yml', 'playtest-llm.yml'],
  ] as const;

  it.each(PAIRS)('%s parses to the same push trigger as %s', async (copy, real) => {
    const parsePushTrigger = await parser();
    const fromReal = parsePushTrigger(realWorkflow(real));
    // Controls first, so "they match" cannot quietly mean "neither parsed".
    // `{ parsed: false }` for both sides would otherwise satisfy the equality
    // below while proving nothing at all about either file.
    expect(fromReal.parsed, `${real} did not parse, so this comparison is vacuous`).toBe(true);
    expect(fromReal.name, `${real} has no readable \`name:\``).toBeTruthy();
    expect(
      parsePushTrigger(fixture(copy)),
      `tests/scripts/fixtures/${copy} no longer parses to the same push trigger as `
      + `.github/workflows/${real}. The fixture is a copy of that workflow and the cases `
      + 'above judge "was a run due?" against it, so a stale copy makes them answer for a '
      + `filter main does not have. Copy the workflow over the fixture and re-read the cases `
      + 'that assert UNGATED / NEVER ASKED, because a changed filter can move them.',
    ).toEqual(fromReal);
  });

  // The fake `git ls-tree` above answers with exactly the keys of
  // WORKFLOW_FILES, so a workflow added to `.github/workflows/` with no fixture
  // here is invisible to every scenario in this file: the script walks the tree
  // looking for a matching `name:` and would never be offered that file.
  it('has a fixture for every workflow in .github/workflows', () => {
    const real = readdirSync(WORKFLOW_DIR).filter((name) => /\.ya?ml$/.test(name)).sort();
    expect(real.length, '.github/workflows holds no workflow, so this check read nothing')
      .toBeGreaterThan(0);
    expect(
      Object.keys(WORKFLOW_FILES).sort(),
      'WORKFLOW_FILES and .github/workflows have diverged. Every workflow needs a fixture: '
      + 'the fake `git ls-tree` returns these keys and nothing else, so a workflow with no '
      + 'fixture is one no scenario in this file can see.',
    ).toEqual(real);
  });
});
