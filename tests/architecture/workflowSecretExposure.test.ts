// A key-bearing workflow has no pull-request trigger, and no workflow at all
// has `pull_request_target` — the gate for the 2026-09-05 register entry.
//
// What happened. The repository went public on 2026-09-05 while
// `.github/workflows/playtest-llm.yml` triggered on `pull_request` and ran a
// contributor's own install scripts and package script with
// `secrets.ANTHROPIC_API_KEY` in the environment. Three things were keeping
// that key safe and NOT ONE of them was visible in the file as a protection:
// GitHub's read-only token default for a fork's pull request, a maintainer's
// `llm-playtest` label, and the second half of the job's `if:` —
// `vars.ANTHROPIC_KEY_AVAILABLE == 'true'`, which was false for every event
// that ever reached it in 120 workflow runs only because this repository has no
// Actions variables at all. Setting that variable to `true` — the obvious move
// if you want LLM playtests on pull requests — re-arms the whole path in one
// click from the web UI, with no commit and no review. So this gate reads the
// one part of the arrangement that lives in the repository: the trigger list.
//
// Four checks.
// (1) The scan actually read something: `.github/workflows` exists, holds at
//     least one workflow, and every one parses to a mapping with a `jobs:`
//     block and a non-empty `on:` block. A broken reader would otherwise make
//     (3) and (4) pass over zero files and report that as green.
// (2) The classifier is self-tested against six in-file fixtures, both
//     directions — see FIXTURES. Without these, gutting `secretReferences` to
//     return `[]` leaves every other check green.
// (3) No workflow that references a secret carries ANY trigger key beginning
//     `pull_request` (`pull_request`, `pull_request_target`,
//     `pull_request_review`, `pull_request_review_comment`).
// (4) No workflow carries `pull_request_target`, secret-bearing or not. It is
//     the trigger that hands contributor-controlled code both the secrets and
//     a write-scoped token against the base repository. It has never appeared
//     in this repository's history.
//
// How a secret reference is detected, and why it is sound against comments.
// Detection reads the PARSED document, never the file's raw text, because
// js-yaml discards comments while loading — so a comment cannot be mistaken for
// a use. This is not hypothetical: the reviewer's throwaway raw-text checker
// reported `playtest-llm.yml`'s comment "Do NOT add `pull_request_target`" as a
// USE of that trigger, and `ci.yml`'s comment "This workflow uses no secrets."
// matches a raw `secrets\.` scan (measured 2026-09-06: raw text of ci.yml
// contains `secrets.`, parsed JSON does not) — which would paint ci.yml, a
// genuinely secret-free workflow that DOES run on `pull_request`, red on day
// one. A gate that cannot tell a warning from a use gets deleted by the next
// person it annoys. Within the parsed tree a workflow is secret-bearing when
// either a string node (value or mapping key) contains a GitHub expression
// referencing the `secrets` context — `${{ ... secrets.X ... }}`,
// `${{ secrets['X'] }}`, `${{ toJSON(secrets) }}`, but not `${{ x.secrets }}` —
// or a mapping key is exactly `secrets`, which in the Actions schema is either
// a reusable-workflow call passing secrets or a `workflow_call` declaring them.
//
// Bounds — what a green run does NOT prove.
// * It sees `.github/workflows/*.yml` and `*.yaml` and nothing else. A secret
//   reaching pull-request code through a composite action under
//   `.github/actions/`, through the body of a reusable workflow this repo calls
//   (the caller's `secrets:` key is read, the callee's file never is), or
//   through an environment-scoped secret would all pass. There is nothing to
//   miss today: `.github/` holds `voxel-commit` and three workflow files, and
//   no `.github/actions/` exists.
// * It says nothing about the controls that live in GitHub's web UI rather
//   than in the repository — Actions variables, environment protection rules,
//   the default workflow token permission, "require approval for fork pull
//   requests". Those change without a commit, which is exactly why the
//   in-repository half is worth pinning.
// * It deliberately does not read `if:` conditions at all, and does not read
//   `permissions:`. The lesson of the incident is that a condition depending on
//   a value defined outside the file is not a protection you can verify, so a
//   key-bearing job guarded only by an `if:` counts as reachable here.
// * js-yaml is a declared devDependency (`^4.3.1`), added by the same commit as
//   this gate (52546080). Before that it reached this file only as a transitive
//   dependency of eslint's @eslint/eslintrc, which an eslint bump could have
//   taken away without touching anything here. Declaring it closes that one
//   route and not the class: a partial install, a hoisting change, or a
//   platform the package does not build on still leaves nothing to parse with.
//   So loadYaml() throws BY NAME rather than skipping — a gate that quietly
//   parses zero workflows would report "did not run" as "passed".

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const WORKFLOW_DIR = join(ROOT, '.github', 'workflows');
const WORKFLOW_EXTS = ['.yml', '.yaml'];

// From `${{` up to the `secrets` context, never crossing a closing `}}`, so a
// literal "secrets." elsewhere in a long `run:` block cannot be reached by an
// unrelated `${{` earlier in the same string. `(?<!\.)` rejects `x.secrets`.
const SECRET_EXPRESSION = /\$\{\{(?:[^}]|\}(?!\}))*?(?<!\.)\bsecrets\b/;
const PULL_REQUEST_PREFIX = 'pull_request';
const PR_TARGET = 'pull_request_target';

interface YamlLoader {
  load(source: string, options?: { filename?: string }): unknown;
}

function loadYaml(): YamlLoader {
  // Named `loadCjs` rather than `require` so @typescript-eslint/no-require-imports
  // does not read this as a CommonJS import; the specifier is a runtime string,
  // which is also what keeps `tsc` from demanding types js-yaml does not ship.
  const loadCjs = createRequire(import.meta.url);
  try {
    return loadCjs('js-yaml') as YamlLoader;
  } catch (error) {
    throw new Error(
      'js-yaml failed to load, so NO workflow was parsed and this gate checked nothing. '
        + 'It IS declared in devDependencies (js-yaml ^4.3.1), so this is a broken or '
        + 'incomplete install rather than a missing declaration: run `npm ci`, and if the '
        + 'declaration has since been removed from package.json, put it back. '
        + `Underlying error: ${String(error)}`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface Workflow {
  readonly file: string;
  readonly doc: unknown;
  readonly triggers: ReadonlySet<string>;
  readonly secrets: readonly string[];
}

function parse(source: string, label: string): unknown {
  try {
    return loadYaml().load(source, { filename: label });
  } catch (error) {
    throw new Error(`${label} is not valid YAML, so its triggers cannot be read: ${String(error)}`);
  }
}

// GitHub accepts three shapes: `on: push`, `on: [push, pull_request]` and a
// mapping. All three are read. A workflow with no readable `on:` is a hole, not
// a pass, so it throws.
function triggerNames(doc: unknown, label: string): Set<string> {
  if (!isRecord(doc)) {
    throw new Error(`${label} did not parse to a YAML mapping, so its \`on:\` block cannot be read; a workflow must be a mapping with \`on:\` and \`jobs:\` keys`);
  }
  // js-yaml 4 keeps the key as the string "on"; a YAML 1.1 reader folds a bare
  // `on` to boolean true, which lands as the property "true". Read both, so a
  // parser change cannot make a workflow silently look trigger-less.
  const on = 'on' in doc ? doc.on : doc.true;
  if (typeof on === 'string') return new Set([on]);
  if (Array.isArray(on)) return new Set(on.filter((v): v is string => typeof v === 'string'));
  if (isRecord(on)) return new Set(Object.keys(on));
  throw new Error(`${label} has no readable \`on:\` block (found ${JSON.stringify(on) ?? 'nothing'}); every workflow declares its triggers as a string, a list, or a mapping`);
}

function excerpt(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > 90 ? `${flat.slice(0, 87)}...` : flat;
}

function collectSecrets(node: unknown, path: string, out: string[]): void {
  if (typeof node === 'string') {
    if (SECRET_EXPRESSION.test(node)) out.push(`${path}: ${excerpt(node)}`);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectSecrets(item, `${path}[${index}]`, out));
    return;
  }
  if (!isRecord(node)) return;
  for (const [key, value] of Object.entries(node)) {
    const child = path === '' ? key : `${path}.${key}`;
    if (key === 'secrets') {
      out.push(`${child}: a \`secrets:\` mapping (a reusable-workflow call passing secrets, or a \`workflow_call\` declaring them)`);
    }
    if (SECRET_EXPRESSION.test(key)) out.push(`${child}: secret reference in a mapping KEY`);
    collectSecrets(value, child, out);
  }
}

function secretReferences(doc: unknown): string[] {
  const out: string[] = [];
  collectSecrets(doc, '', out);
  return out;
}

function classify(source: string, label: string): Workflow {
  const doc = parse(source, label);
  return { file: label, doc, triggers: triggerNames(doc, label), secrets: secretReferences(doc) };
}

let cached: Workflow[] | undefined;

function workflows(): Workflow[] {
  if (cached) return cached;
  if (!existsSync(WORKFLOW_DIR)) {
    throw new Error('.github/workflows does not exist, so this gate would check nothing; if the workflows moved, point WORKFLOW_DIR at their new home');
  }
  const names = readdirSync(WORKFLOW_DIR).filter((name) => WORKFLOW_EXTS.some((ext) => name.endsWith(ext)));
  cached = names.map((name) => classify(readFileSync(join(WORKFLOW_DIR, name), 'utf8'), `.github/workflows/${name}`));
  return cached;
}

// Six fixtures, run through the same classify() the real files use. The first
// is the false-positive control: its comments name both forbidden things and it
// must stay clean. `rawMustContain` pins that trap so a later edit cannot
// quietly remove it and leave a fixture that proves nothing.
const FIXTURES: ReadonlyArray<{
  readonly label: string;
  readonly yaml: string;
  readonly rawMustContain: readonly string[];
  readonly triggers: readonly string[];
  readonly secretBearing: boolean;
}> = [
  {
    label: 'a comment naming both forbidden things is not a use of either',
    yaml: `name: comment-only-control
# Do NOT add pull_request_target here. This workflow uses no secrets.
on:
  schedule:
    - cron: '17 4 * * *'
  workflow_dispatch:
jobs:
  noop:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
`,
    rawMustContain: [PR_TARGET, 'secrets.'],
    triggers: ['schedule', 'workflow_dispatch'],
    secretBearing: false,
  },
  {
    label: 'a secret in a step env under a mapping-form pull_request trigger',
    yaml: `name: secret-on-pull-request
on:
  pull_request:
    branches: [main]
jobs:
  leak:
    runs-on: ubuntu-latest
    steps:
      - env:
          KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: npm ci
`,
    rawMustContain: ['secrets.ANTHROPIC_API_KEY'],
    triggers: ['pull_request'],
    secretBearing: true,
  },
  {
    label: 'list-form triggers are read',
    yaml: `name: pr-target-list-form
on: [push, pull_request_target]
jobs:
  noop:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
`,
    rawMustContain: [PR_TARGET],
    triggers: ['push', PR_TARGET],
    secretBearing: false,
  },
  {
    label: 'string-form triggers are read',
    yaml: `name: pr-target-string-form
on: pull_request_target
jobs:
  noop:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
`,
    rawMustContain: [PR_TARGET],
    triggers: [PR_TARGET],
    secretBearing: false,
  },
  {
    label: '`secrets: inherit` on a reusable-workflow call is a secret reference',
    yaml: `name: inherit-secrets
on:
  pull_request_review_comment:
    types: [created]
jobs:
  call:
    uses: ./.github/workflows/other.yml
    secrets: inherit
`,
    rawMustContain: ['secrets: inherit'],
    triggers: ['pull_request_review_comment'],
    secretBearing: true,
  },
  {
    label: 'the bracket-index form of a secret reference is caught',
    yaml: `name: bracket-secret-index
on:
  workflow_dispatch:
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo "\${{ secrets['ANTHROPIC_API_KEY'] }}"
`,
    rawMustContain: ["secrets['ANTHROPIC_API_KEY']"],
    triggers: ['workflow_dispatch'],
    secretBearing: true,
  },
];

describe('workflow secret exposure', () => {
  it('the scan reads at least one workflow and every one has jobs and triggers', () => {
    const found = workflows();
    expect(
      found.length,
      `no workflow file was read from .github/workflows, so checks (3) and (4) would pass over nothing; expected at least one ${WORKFLOW_EXTS.join(' or ')} file`,
    ).toBeGreaterThan(0);
    const broken = found
      .filter((w) => !isRecord(w.doc) || !isRecord((w.doc as Record<string, unknown>).jobs) || w.triggers.size === 0)
      .map((w) => `${w.file} parsed, but not into a workflow (needs a \`jobs:\` mapping and a non-empty \`on:\` block)`);
    expect(broken, `the workflow scan is reading less than it claims:\n${broken.join('\n')}`).toEqual([]);
  });

  it('the classifier separates a comment from a use, in both directions', () => {
    const failures: string[] = [];
    for (const fixture of FIXTURES) {
      const missing = fixture.rawMustContain.filter((needle) => !fixture.yaml.includes(needle));
      if (missing.length > 0) {
        failures.push(`fixture "${fixture.label}" no longer contains ${missing.map((m) => `\`${m}\``).join(', ')}, so it stopped testing what it was written to test`);
        continue;
      }
      const got = classify(fixture.yaml, `fixture: ${fixture.label}`);
      const triggers = [...got.triggers].sort();
      const want = [...fixture.triggers].sort();
      if (JSON.stringify(triggers) !== JSON.stringify(want)) {
        failures.push(`fixture "${fixture.label}": triggers read as ${JSON.stringify(triggers)}, expected ${JSON.stringify(want)} — triggerNames() is not reading the \`on:\` block correctly`);
      }
      const bearing = got.secrets.length > 0;
      if (bearing !== fixture.secretBearing) {
        const detail = bearing ? `flagged: ${got.secrets.join('; ')}` : 'flagged nothing';
        failures.push(`fixture "${fixture.label}": secretReferences() ${detail}, expected secret-bearing=${fixture.secretBearing}`);
      }
    }
    expect(
      failures,
      `the secret/trigger classifier is wrong, so the checks below prove nothing about the real workflows:\n${failures.join('\n')}`,
    ).toEqual([]);
  });

  it('no workflow that references a secret runs on any pull_request trigger', () => {
    const failures: string[] = [];
    for (const workflow of workflows()) {
      if (workflow.secrets.length === 0) continue;
      const pr = [...workflow.triggers].filter((name) => name.startsWith(PULL_REQUEST_PREFIX)).sort();
      if (pr.length === 0) continue;
      failures.push(
        `${workflow.file} references a secret and triggers on ${pr.map((name) => `\`${name}\``).join(', ')}. `
          + `A pull request from a fork runs the contributor's own code — npm install scripts included — so the secret is theirs. `
          + `Secret references: ${workflow.secrets.join('; ')}. `
          + `To satisfy this: remove the ${pr.map((name) => `\`${name}\``).join('/')} trigger (leave \`schedule\`/\`workflow_dispatch\`/\`push\`, which run code already on a branch of this repository), or remove the secret from this workflow. `
          + `An \`if:\` guard does not satisfy it — that is what failed on 2026-09-05.`,
      );
    }
    expect(
      failures,
      `a key-bearing workflow is reachable from a pull request:\n${failures.join('\n')}`,
    ).toEqual([]);
  });

  it('no workflow uses the pull_request_target trigger at all', () => {
    const failures = workflows()
      .filter((workflow) => workflow.triggers.has(PR_TARGET))
      .map(
        (workflow) =>
          `${workflow.file} declares \`${PR_TARGET}\`. It runs in the context of the BASE repository, so it hands contributor-controlled code a write-scoped token and access to every secret, and it is banned here whether or not this workflow references one today. `
          + `To satisfy this: use \`pull_request\` (fork code, no secrets, read-only token) instead.`,
      );
    expect(
      failures,
      `banned trigger:\n${failures.join('\n')}`,
    ).toEqual([]);
  });
});
