// A script under scripts/ that can also be imported decides whether it was run directly through
// scripts/run-directly.mjs, never by comparing `import.meta.url` with `process.argv[1]` as written. That comparison
// pits the real path Node loaded the module from against the path as typed, so through a junction or a symlink the
// script exited 0 having done nothing: on 2026-10-14 `ci-status.mjs`, `ci-job-headroom.mjs` and
// `test-time-headroom.mjs`, run through a junction, each exited 0 with no output, where run directly each exited 1
// with its message (work 124 M2; register entry of 2026-10-11, whose class is a gate's pass recorded for a run that
// did not happen).
//
// Two checks. The census reads every script file under scripts/, at any depth, and refuses the old comparison in any
// of them; and it requires every script that imports the helper, in either quote and by any relative path, to have a
// junction run below. The junction runs copy the scripts tree into a sandbox, link a junction to the copy, and run
// each script both ways with arguments that make it answer at once, requiring the answer, so a script that exits 0
// having done nothing fails by name.
//
// SAFETY. The junction points at a copy inside this test's own sandbox under the OS temp directory, never at this
// checkout, and it is removed on its own, and checked gone, before the sandbox is deleted.
//
// BOUND. The census is a pattern: a guard written some other way would pass it. The junction runs cover the five
// scripts named below, each with plain node; `npm run ai:tick-ab` runs aiTickAb.mjs under tsx, whose guard reads the
// same (measured once, docs/learning/gate-proofs.md).

import { spawnSync } from 'node:child_process';
import {
  cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmdirSync, rmSync, symlinkSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPTS = fileURLToPath(new URL('../../scripts/', import.meta.url));

// The old guard, in any of the spellings seen and their near variants: the module's own location (`import.meta.url`,
// `import.meta.filename`) and the script path as typed (`process.argv[1]`, `process.argv.at(1)`) within one statement.
const SELF = String.raw`import\.meta\.(?:url|filename)`;
const TYPED = String.raw`process\.argv(?:\[\s*1\s*\]|\.at\(\s*1\s*\))`;
const OLD_GUARD = new RegExp(`${SELF}[^;]{0,200}${TYPED}|${TYPED}[^;]{0,200}${SELF}`);

// An import of the helper: static or dynamic, either quote, any relative path.
const USES_HELPER = /\b(?:from|import)\s*\(?\s*['"](?:\.{1,2}\/)+(?:[\w.-]+\/)*run-directly\.mjs['"]/;

// The scripts run through a junction below, by their path under scripts/: every user of the helper, and
// verify-receipt.mjs, which has no guard.
const JUNCTION_RUNS = ['aiTickAb.mjs', 'ci-job-headroom.mjs', 'ci-status.mjs', 'test-time-headroom.mjs', 'verify-receipt.mjs'];

function scriptFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...scriptFiles(path));
    else if (/\.(?:mjs|cjs|js|mts|ts)$/.test(entry.name)) found.push(path);
  }
  return found;
}

const relative = (path: string) => path.slice(SCRIPTS.length).replace(/\\/g, '/');

describe('the run-directly census', () => {
  it('no script under scripts/ compares import.meta.url with process.argv[1] itself', () => {
    const files = scriptFiles(SCRIPTS);
    expect(files.length, 'the premise: the census read the scripts').toBeGreaterThan(40);
    const offenders = files.filter((file) => !file.endsWith('run-directly.mjs') && OLD_GUARD.test(readFileSync(file, 'utf8')));
    expect(offenders.map(relative), 'decide with runDirectly(import.meta.url) from scripts/run-directly.mjs').toEqual([]);
    const users = files.filter((file) => USES_HELPER.test(readFileSync(file, 'utf8'))).map(relative).sort();
    expect(users, 'the scripts that can also be imported, each through the helper')
      .toEqual(['aiTickAb.mjs', 'ci-job-headroom.mjs', 'ci-status.mjs', 'test-time-headroom.mjs']);
    expect(users.filter((user) => !JUNCTION_RUNS.includes(user)), 'every user of the helper gets a junction run below').toEqual([]);
  });

  it('the census pattern sees every spelling of the old guard it claims to', () => {
    for (const guard of [
      "if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {",
      'if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {',
      'const invokedDirectly = process.argv[1]\n  && pathToFileURL(process.argv[1]).href === import.meta.url;',
      'if (fileURLToPath(import.meta.url) === resolve(process.argv.at(1))) main();',
      'if (import.meta.filename === process.argv[ 1 ]) main();',
    ]) {
      expect(OLD_GUARD.test(guard), guard).toBe(true);
    }
    expect(OLD_GUARD.test('if (runDirectly(import.meta.url)) process.exit(main());'), 'the helper\'s call').toBe(false);
    for (const use of [
      "import { runDirectly } from './run-directly.mjs';",
      'import { runDirectly } from "./run-directly.mjs";',
      "import { runDirectly } from '../run-directly.mjs';",
      "const { runDirectly } = await import('./run-directly.mjs');",
    ]) {
      expect(USES_HELPER.test(use), use).toBe(true);
    }
    expect(USES_HELPER.test('// see scripts/run-directly.mjs'), 'a mention in a comment').toBe(false);
  });
});

interface Probe { script: string; args: string[]; env?: NodeJS.ProcessEnv; status: number; says: RegExp }

describe('each gate script really runs when reached through a junction', () => {
  let root = '';
  let link = '';
  let tool = '';
  let empty = '';
  let env: NodeJS.ProcessEnv = {};

  beforeAll(() => {
    root = realpathSync.native(mkdtempSync(join(tmpdir(), 'run-directly-test-')));
    tool = join(root, 'tool');
    empty = join(root, 'empty');
    mkdirSync(empty);
    // The whole tree, so a script below the top level runs with its relative imports.
    cpSync(SCRIPTS, tool, { recursive: true });
    link = join(root, 'tool-link');
    symlinkSync(tool, link, 'junction');
    expect(lstatSync(link).isSymbolicLink(), 'the premise: the link is a link').toBe(true);
    env = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!key.toUpperCase().startsWith('GIT_') || key.toUpperCase() === 'GIT_EXEC_PATH') env[key] = value;
    }
    // ci-status must find no repository from the empty directory, whatever lies above the temp directory.
    env.GIT_CEILING_DIRECTORIES = dirname(root);
    writeFileSync(join(root, 'times.json'), JSON.stringify({
      runner: 'vitest', writtenAt: new Date().toISOString(), argv: ['run'], outcome: { status: 'passed', unhandledErrors: 0 },
      tests: [{ file: 'tests/a.test.ts', line: 1, title: 'a', state: 'passed', durationMs: 1_000, timeoutMs: 30_000 }],
    }));
  });

  afterAll(() => {
    if (!root) return;
    try {
      rmdirSync(link);
    } catch {
      unlinkSync(link);
    }
    let linked = false;
    try {
      lstatSync(link);
      linked = true;
    } catch { /* gone, as it should be */ }
    if (linked) throw new Error(`SAFETY: ${link} is still there; refusing to delete ${root} recursively`);
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  });

  const probes = (): Probe[] => [
    { script: 'ci-status.mjs', args: [], status: 1, says: /could not resolve the commit to report on/ },
    {
      script: 'ci-job-headroom.mjs',
      args: ['--limit-minutes', '60'],
      env: { JOB_STARTED_AT: String(Math.floor(Date.now() / 1000)) },
      status: 0,
      says: /This job used 0\.\d of its 60-minute limit/,
    },
    { script: 'test-time-headroom.mjs', args: [join(root, 'times.json')], status: 0, says: /1 tests measured/ },
    { script: 'verify-receipt.mjs', args: [], status: 2, says: /usage: node scripts\/verify-receipt\.mjs/ },
    { script: 'aiTickAb.mjs', args: [], status: 1, says: /usage: npm run ai:tick-ab/ },
  ];

  const run = (dir: string, probe: Probe) => {
    const r = spawnSync(process.execPath, [join(dir, probe.script), ...probe.args], {
      cwd: empty, env: { ...env, ...probe.env }, encoding: 'utf8', timeout: 30_000,
    });
    if (r.error) throw r.error;
    return { status: r.status, said: `${r.stdout}${r.stderr}` };
  };

  for (const name of JUNCTION_RUNS) {
    it(`${name} answers through the junction as it does directly`, () => {
      const probe = probes().find((p) => p.script === name)!;
      const direct = run(tool, probe);
      expect(direct.said, `the control: run directly, ${name} answers`).toMatch(probe.says);
      expect(direct.status, direct.said).toBe(probe.status);
      const linked = run(link, probe);
      expect(linked.said, `through the junction ${name} must answer, not exit having done nothing`).toMatch(probe.says);
      expect(linked.status, linked.said).toBe(probe.status);
    });
  }
});
