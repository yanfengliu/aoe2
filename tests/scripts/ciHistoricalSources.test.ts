// Bound: CI jobs that run the strict unit validators fetch their immutable
// historical source before the suite. A local depth-1 clone exercises the
// actual commands; GitHub transport/auth availability remains a remote gate.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { APPROVED_RAW_IMPORTS } from '../architecture/helpers/workDocsRawImports';

type Step = { uses?: string; run?: string; shell?: string; if?: string };
type Job = { steps?: Step[] };
type Workflow = { jobs?: Record<string, Job> };
const directory = fileURLToPath(new URL('../../.github/workflows/', import.meta.url));
const yaml = createRequire(import.meta.url)('js-yaml') as { load(source: string): unknown };
const source = '143ad5116f25393504328056764bcc8706917b9e';
const fetchCommand = `git fetch --no-tags --depth=1 origin ${source}`;
const verifyCommand = `git cat-file -e ${source}^{commit}`;
const owned: string[] = [];
const unitCommand = /\b(?:npm\s+(?:run\s+)?(?:test|verify)|(?:npx\s+)?vitest)(?:\s|$)/;
function workflows() {
  return readdirSync(directory).filter(name => /\.ya?ml$/.test(name)).map(name => ({
    name, doc: yaml.load(readFileSync(join(directory, name), 'utf8')) as Workflow,
  }));
}
function sourceStep(): Step {
  const ci = workflows().find(workflow => workflow.name === 'ci.yml');
  const step = ci?.doc.jobs?.gates.steps?.find(candidate => candidate.run?.includes(fetchCommand));
  if (!step) throw new Error('CI gates lack the exact historical-source fetch; a depth-1 checkout cannot run the strict import validators.');
  return step;
}
function git(root: string, args: string[]) {
  return execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`,
    '-c', 'user.name=Historical source test', '-c', 'user.email=historical-source-test@example.invalid',
    '-C', root, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
}
function fixture() {
  const parent = mkdtempSync(join(tmpdir(), 'aoe2-ci-source-'));
  owned.push(parent);
  const origin = join(parent, 'origin');
  execFileSync('git', ['init', '-q', origin], { stdio: ['ignore', 'pipe', 'pipe'] });
  writeFileSync(join(origin, 'historical.md'), 'Exact historical source bytes.\n');
  git(origin, ['add', '--', 'historical.md']);
  git(origin, ['commit', '-qm', 'Historical source']);
  const historical = git(origin, ['rev-parse', 'HEAD']).toString().trim();
  writeFileSync(join(origin, 'historical.md'), 'Current tip bytes.\n');
  git(origin, ['add', '--', 'historical.md']);
  git(origin, ['commit', '-qm', 'Current checkout']);
  const clone = join(parent, 'clone');
  execFileSync('git', ['clone', '--quiet', '--depth=1', '--no-tags', pathToFileURL(origin).href, clone], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { origin, clone, historical };
}
afterEach(() => {
  for (const path of owned.splice(0)) {
    if (!resolve(path).startsWith(resolve(tmpdir()) + '/aoe2-ci-source-')
      && !resolve(path).startsWith(resolve(tmpdir()) + '\\aoe2-ci-source-')) {
      throw new Error('Refusing cleanup outside an owned shallow-clone fixture');
    }
    rmSync(path, { recursive: true, force: true });
  }
});

describe('CI makes immutable historical inputs available without full history', () => {
  it('fetches the fixed seven-import source before every job that runs unit validators', () => {
    const identities = new Set(APPROVED_RAW_IMPORTS.map(binding => /^aoe2@([0-9a-f]{40}):/.exec(binding.source)?.[1]));
    expect(identities).toEqual(new Set([source]));
    let measured = 0;
    for (const workflow of workflows()) {
      for (const [name, job] of Object.entries(workflow.doc.jobs ?? {})) {
        const steps = job.steps ?? [];
        const unit = steps.findIndex(step => unitCommand.test(step.run ?? ''));
        if (unit < 0) continue;
        measured++;
        const checkout = steps.findIndex(step => step.uses === 'actions/checkout@v4');
        const fetch = steps.findIndex(step => step.run?.trim() === `${fetchCommand}\n${verifyCommand}`);
        expect(checkout, `${workflow.name}:${name} lacks checkout before its unit suite`).toBeGreaterThanOrEqual(0);
        expect(fetch, `${workflow.name}:${name} needs the immutable source in its shallow checkout`).toBeGreaterThan(checkout);
        expect(fetch).toBeLessThan(unit);
        expect(steps[fetch].shell).toBe('bash');
        expect(steps[fetch].if).toBeUndefined();
      }
    }
    expect(measured).toBeGreaterThan(0);
  });

  it('reproduces a missing old blob in a shallow clone, then runs the wired exact-source fetch', () => {
    const { origin, clone, historical } = fixture();
    const tip = git(clone, ['rev-parse', 'HEAD']).toString().trim();
    expect(git(clone, ['rev-parse', '--is-shallow-repository']).toString().trim()).toBe('true');
    expect(git(clone, ['rev-list', '--count', 'HEAD']).toString().trim()).toBe('1');
    expect(() => git(clone, ['show', `${historical}:historical.md`])).toThrow();
    const lines = sourceStep().run!.trim().split('\n');
    expect(lines).toEqual([fetchCommand, verifyCommand]);
    for (const line of lines) git(clone, line.replaceAll(source, historical).split(' ').slice(1));
    expect(git(clone, ['show', `${historical}:historical.md`])).toEqual(git(origin, ['show', `${historical}:historical.md`]));
    expect(git(clone, ['rev-parse', 'HEAD']).toString().trim()).toBe(tip);
    expect(git(clone, ['rev-list', '--count', 'HEAD']).toString().trim()).toBe('1');
    expect(git(clone, ['rev-parse', '--is-shallow-repository']).toString().trim()).toBe('true');
  });
});
