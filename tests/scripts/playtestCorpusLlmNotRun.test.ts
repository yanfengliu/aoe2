// The nightly LLM playtest must never read green when it did not play. `scripts/playtest-corpus-llm.mjs` used to exit
// 0 when it found no LLM provider, and the nightly workflow has no provider secret, so playtest-llm.yml read green on
// 89 of its 138 scheduled nights, the last 19 in a row, with no artifact (audit 2026-09-23, register 2026-09-24). Now
// the script exits 2 and says NOT RUN, and the workflow's upload step fails when there is nothing to upload.
//
// The script runs for real, under tsx, with ANTHROPIC_API_KEY empty and a PATH that holds nothing but Windows'
// System32 (which `where` needs) or, elsewhere, one fresh empty directory. tsx starts its child through
// `process.execPath`, so node needs no PATH entry, and leaving node's own directory off keeps a globally installed
// `claude` shim there from reaching the script. The test still proves no `claude` is on that PATH before it starts,
// so a machine that has one there fails loudly instead of starting a paid playtest.
//
// BOUND. This proves the no-provider path is red. It does not prove a run WITH a provider is judged correctly, and it
// does not run the workflow: the upload step, `continue-on-error` and `|| true` are checked as YAML, not by GitHub.
// Whether the nightly should have a key or be retired is the owner's call and is untouched here.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = join(ROOT, 'scripts', 'playtest-corpus-llm.mjs');
const load = createRequire(import.meta.url);
const TSX = load.resolve('tsx/cli');
const WIN = process.platform === 'win32';

const emptyDirs: string[] = [];
afterEach(() => {
  while (emptyDirs.length) rmdirSync(emptyDirs.pop()!);
});

function strippedEnv(): NodeJS.ProcessEnv {
  if (WIN) {
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
    return {
      PATH: join(systemRoot, 'System32'), SystemRoot: systemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
      ANTHROPIC_API_KEY: '',
    };
  }
  const empty = mkdtempSync(join(tmpdir(), 'no-claude-'));
  emptyDirs.push(empty);
  return { PATH: empty, ANTHROPIC_API_KEY: '' };
}

function claudeOn(path: string): string[] {
  const names = WIN ? ['claude.exe', 'claude.cmd', 'claude'] : ['claude'];
  return path.split(delimiter).flatMap((dir) => names.map((name) => join(dir, name))).filter((file) => existsSync(file));
}

type Step = { run?: string; uses?: string; 'continue-on-error'?: unknown; with?: Record<string, unknown> };
type Job = { steps: Step[]; 'continue-on-error'?: unknown };

function nightly(): Record<string, Job> {
  const yaml = load('js-yaml') as { load(source: string): unknown };
  const doc = yaml.load(readFileSync(join(ROOT, '.github', 'workflows', 'playtest-llm.yml'), 'utf8')) as {
    jobs: Record<string, Job>;
  };
  return doc.jobs;
}

describe('the LLM corpus reads red when no provider lets it play', () => {
  it('exits 2 and says NOT RUN, naming what is missing', () => {
    const env = strippedEnv();
    expect(claudeOn(env.PATH!), 'a `claude` is reachable on the stripped PATH, so this would start a real playtest')
      .toEqual([]);
    const r = spawnSync(process.execPath, [TSX, SCRIPT], { cwd: ROOT, env, encoding: 'utf8', timeout: 20_000 });
    expect(r.error, `the script did not run to completion: ${r.error?.message}`).toBeUndefined();
    expect(r.stderr).toContain('NOT RUN');
    expect(r.stderr).toContain('ANTHROPIC_API_KEY');
    expect(r.stdout).not.toContain('running');
    expect(r.status).toBe(2);
  });

  it('the nightly fails its upload step when there is nothing to upload, and nothing swallows a red step', () => {
    const jobs = Object.entries(nightly());
    const steps = jobs.flatMap(([, job]) => job.steps);
    const uploads = steps.filter((step) => step.uses?.startsWith('actions/upload-artifact'));
    expect(uploads.length, 'playtest-llm.yml has no upload-artifact step, so this check read nothing').toBeGreaterThan(0);
    for (const step of uploads) {
      expect(step.with?.['if-no-files-found'], 'a night that uploads nothing played nothing and must fail').toBe('error');
    }
    const corpusSteps = steps.filter((step) => step.run?.includes('playtest:'));
    expect(corpusSteps.length, 'no step runs a playtest script, so the checks below read nothing').toBeGreaterThan(0);
    for (const [name, job] of jobs) {
      expect(job['continue-on-error'], `job ${name} has continue-on-error, so a red night reads green`).toBeUndefined();
    }
    for (const step of [...corpusSteps, ...uploads]) {
      expect(step['continue-on-error'], 'a playtest or upload step has continue-on-error').toBeUndefined();
    }
    for (const step of corpusSteps) {
      expect(step.run, 'a playtest step swallows its exit code with `|| true`').not.toMatch(/\|\|\s*(true|:|exit 0)/);
    }
  });
});
