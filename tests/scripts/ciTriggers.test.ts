// Every push to main runs every workflow `npm run ci:status` watches. Until 2026-09-24 both carried an
// `on.push.paths` filter (package.json, the lockfile, .gitattributes, .github/voxel-commit, the workflows, and for
// the corpus playtest-corpus.json), so only a version bump or a dependency change reached a runner: every test,
// tooling, script and docs commit landed on main with no remote gate at all (register, 2026-09-24). The filter was
// cost control from when Actions minutes were paid; the repository is public and they no longer are.
//
// The push trigger is read with js-yaml, NOT with `parsePushTrigger` from scripts/ci-status.mjs, so this check and
// the script it protects cannot agree with each other by sharing a parser bug. Only the list of watched workflow names
// comes from the script, so a workflow it starts watching is covered here without an edit.
//
// BOUND. This proves the trigger ASKS for a run on every push to main. It does not prove GitHub made one (a `[skip ci]`
// commit message, an Actions outage, or an exhausted queue still leave a commit without a run; `ci:status` reports
// those as UNGATED), and it says nothing about pull requests or schedules.

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WATCHED } from '../../scripts/ci-status.mjs';

const DIR = fileURLToPath(new URL('../../.github/workflows/', import.meta.url));
const yaml = createRequire(import.meta.url)('js-yaml') as { load(source: string): unknown };

type Workflow = { name?: string; on?: Record<string, unknown> | string | string[] };

const workflows = readdirSync(DIR)
  .filter((file) => /\.ya?ml$/.test(file))
  .map((file) => ({ file, doc: yaml.load(readFileSync(`${DIR}${file}`, 'utf8')) as Workflow }));

describe('every workflow ci:status watches runs on every push to main', () => {
  it('watches at least one workflow, so the cases below are not vacuous', () => {
    expect(WATCHED.length).toBeGreaterThan(0);
  });

  it.each(WATCHED.map((name: string) => [name]))('%s: push to main, with no path or branch filter beyond main', (name) => {
    const found = workflows.filter((w) => w.doc?.name === name);
    expect(found.map((w) => w.file), `expected exactly one workflow named "${name}" in .github/workflows`).toHaveLength(1);
    const { file, doc } = found[0];
    const on = doc.on;
    expect(on !== null && typeof on === 'object' && !Array.isArray(on), `${file}: \`on:\` is not a mapping`).toBe(true);
    const push = (on as Record<string, unknown>).push as Record<string, unknown> | null | undefined;
    expect(push, `${file} has no \`on.push\` trigger, so no push to main runs it`).toBeTruthy();
    expect(
      Object.keys(push!).sort(),
      `${file}: \`on.push\` may hold only \`branches\`. Any \`paths\`, \`paths-ignore\`, \`branches-ignore\` or \`tags\``
      + ' filter lets some pushes to main land with no run, which is the defect of 2026-09-24. Remove it; if the'
      + ' repository has become private and minutes cost money again, that is the owner\'s call, not a quiet filter.',
    ).toEqual(['branches']);
    expect(push!.branches, `${file}: \`on.push.branches\` must include main`).toContain('main');
  });
});
