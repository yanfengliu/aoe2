// Every curl in the workflows retries with one set of flags — the gate for the
// 2026-11-05 register entry.
//
// What happened. Main's tip 606ad92c went red twice at once, in CI run
// 42056978761 and playtest-corpus run 42056978614: GitHub answered the
// civ-engine release download with HTTP 504 after 11 s, and that curl had no
// `--retry`. The voxel download in the next step had carried `--retry 3` since
// 2026-07-12. On 2026-10-11 run 38153770319 had failed the same fetch on a
// reset TLS handshake, curl exit 35, which `--retry` alone does not retry.
//
// The policy is RETRY below on every curl, with `-f`, so that an HTTP error
// fails curl instead of saving the error page as the download. ci.yml's comment
// on the `gates` job's civ-engine fetch gives the reasons.
//
// Two parts. (1) The reader, on in-file fixtures both ways: a curl without the
// flags is refused, a flag after a `\` continuation counts, and a comment that
// names curl is no download. (2) Every workflow in .github/workflows, read
// PARSED, so a YAML comment is never a command: every curl in a `run:` script
// keeps the policy, and the scan found the civ-engine and voxel fetches of all
// three jobs, so a reader that finds nothing fails.
//
// BOUND. This proves the flags are written, not that a runner's curl honours
// them. That is curl's contract, probed on 2026-11-05 with these flags against
// a local server, on curl 8.2.1 and 8.22.0: an HTTP 504 and a reset handshake
// were each retried at 1, 3 and 7 s. Only `run:` scripts are read. Actions
// (checkout, setup-node, cache), npm and Playwright's browser download keep
// their own retries, and a download by any other command in a script is not
// seen. The historical-source `git fetch` in ci.yml has no retry, because git
// retries only HTTP 429.

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIR = fileURLToPath(new URL('../../.github/workflows/', import.meta.url));
const yaml = createRequire(import.meta.url)('js-yaml') as { load(source: string): unknown };

/** The retry options every curl carries, sorted, each with its value. */
const RETRY = ['--retry 3', '--retry-all-errors'];

/** curl's retry options that take a value. */
const VALUED = new Set(['--retry', '--retry-delay', '--retry-max-time']);

interface Curl { readonly where: string; readonly words: readonly string[] }

interface Workflow { readonly jobs?: Record<string, { readonly steps?: readonly { readonly name?: string; readonly run?: unknown }[] }> }

/**
 * Each curl command in one `run:` script, as its words after `curl`. Bash's
 * `\` continuations are joined, a line that starts with `#` is a comment, and
 * a command ends at `;`, `&&`, `||`, `|` or a parenthesis.
 */
function curlsIn(where: string, run: string): Curl[] {
  const curls: Curl[] = [];
  for (const line of run.replace(/\\\r?\n/g, ' ').split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    for (const command of line.split(/&&|\|\||[;|()]/)) {
      const words = command.trim().split(/\s+/).map((word) => word.replace(/^['"]|['"]$/g, ''));
      const at = words.findIndex((word) => /^curl(?:\.exe)?$/.test(word));
      if (at >= 0) curls.push({ where, words: words.slice(at + 1) });
    }
  }
  return curls;
}

/** Why a curl breaks the policy, or undefined when it keeps it. */
function breach(curl: Curl): string | undefined {
  const retry = curl.words
    .flatMap((word, index) => (word.startsWith('--retry') ? [VALUED.has(word) ? `${word} ${curl.words[index + 1] ?? ''}` : word] : []))
    .sort();
  const fails = curl.words.some((word) => /^--fail(?:-with-body)?$/.test(word) || /^-[A-Za-z]*f[A-Za-z]*$/.test(word));
  if (!fails) return 'has no -f, so a final HTTP error saves its error page as the download';
  if (retry.join(', ') !== RETRY.join(', ')) return `retries with [${retry.join(', ')}], not [${RETRY.join(', ')}]`;
  return undefined;
}

function workflowCurls(): Curl[] {
  return readdirSync(DIR).filter((file) => /\.ya?ml$/.test(file)).sort().flatMap((file) => {
    const doc = yaml.load(readFileSync(`${DIR}${file}`, 'utf8')) as Workflow;
    return Object.entries(doc.jobs ?? {}).flatMap(([key, job]) => (job.steps ?? []).flatMap((step) => (
      typeof step.run === 'string' ? curlsIn(`${file} › ${key} › ${step.name ?? '(unnamed step)'}`, step.run) : []
    )));
  });
}

const FIXTURES: readonly (readonly [string, string, boolean])[] = [
  ['refuses the civ-engine fetch as it was', 'curl -fsSL -o civ-engine.tgz https://example.invalid/civ-engine.tgz', false],
  ['keeps the policy split over `\\` continuations', 'curl -fsSL --retry 3 \\\n  --retry-all-errors \\\n  -o voxel.tgz \\\n  "https://example.invalid/voxel.tar.gz"', true],
  ['refuses `--retry 3` alone, which leaves a reset handshake unretried', 'curl -fsSL --retry 3 -o a.tgz https://example.invalid/a.tgz', false],
  ['refuses the flags without -f', 'curl -sSL --retry 3 --retry-all-errors -o a.tgz https://example.invalid/a.tgz', false],
  ['refuses a bare curl after `&&`', 'mkdir -p x && curl -fsSL -o x/a.tgz https://example.invalid/a.tgz', false],
];

describe('the curl reader', () => {
  it.each(FIXTURES)('%s', (_, run, keeps) => {
    const curls = curlsIn('fixture', run);
    expect(curls).toHaveLength(1);
    expect(breach(curls[0]!) === undefined, breach(curls[0]!)).toBe(keeps);
  });

  it('reads a comment line that names curl as no download', () => {
    expect(curlsIn('fixture', '# curl -fsSL -o a.tgz https://example.invalid/a.tgz\necho done')).toEqual([]);
  });
});

describe('every curl in .github/workflows retries with the one policy', () => {
  const curls = workflowCurls();
  const fetching = (url: RegExp) => curls.filter((curl) => curl.words.some((word) => url.test(word))).map((curl) => curl.where).sort();

  it('finds the civ-engine and voxel fetches of all three jobs, so the check below reads them', () => {
    const jobs = ['ci.yml › browser', 'ci.yml › gates', 'playtest.yml › corpus'];
    expect(fetching(/\/civ-engine\/releases\/download\/engine-dist\/civ-engine\.tgz$/)).toEqual(jobs.map((job) => `${job} › Fetch the prebuilt civ-engine`));
    expect(fetching(/\/voxel\/archive\//)).toEqual(jobs.map((job) => `${job} › Fetch pinned voxel source`));
  });

  it('gives every curl -f and the retry flags', () => {
    const offenders = curls.flatMap((curl) => {
      const why = breach(curl);
      return why === undefined ? [] : [`${curl.where}: curl ${why}`];
    });
    expect(offenders, `every curl takes -f and ${RETRY.join(' ')}; see ci.yml's civ-engine fetch in the gates job`).toEqual([]);
  });
});
