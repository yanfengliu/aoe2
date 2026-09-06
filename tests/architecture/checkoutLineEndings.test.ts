// Every checkout of this repository gets LF, on every platform — the gate for
// the 2026-09-06 register entry.
//
// What happened. The repository has no `.gitattributes` before this commit, and
// Git for Windows installs `core.autocrlf=true` in its SYSTEM config. The
// GitHub-hosted `windows-latest` image is that same install, so `actions/
// checkout` writes every tracked text file into the runner's working tree with
// CRLF while the index stays LF. On 2026-09-06 that turned main's Windows leg
// red with the Linux leg green: six of `tests/scripts/ciStatus.test.ts`'s eight
// cases failed on `SyntaxError: Invalid or unexpected token`, thrown by the
// `await import()` of `scripts/ci-status.mjs`. Vite's SSR transform picks the
// offset to inject its `__vite_ssr_import__` calls at with
// `hashbangRE = /^#!.*\n/` (vite 6.4.3, `dist/node/chunks/dep-Dm0c1Wj2.js`);
// a JavaScript `.` does not match `\r`, so under CRLF the regex misses, the
// offset falls back to 0, and the injected imports are written IN FRONT of
// `#!/usr/bin/env node` — leaving a bare `#` in the middle of the module.
//
// Why no local run caught it. A long-lived clone's working tree is a patchwork:
// a file written by an editor or an agent keeps LF, a file that was actually
// checked out under `core.autocrlf=true` holds CRLF, and git rewrites neither
// afterwards. Measured on the authoring machine the morning this was found:
// 1,766 tracked files LF in the index, and in the WORKING TREE 932 LF, 810
// CRLF, 24 mixed. `scripts/ci-status.mjs` had been written the previous day and
// was one of the 932, so the same suite that fails on a clean runner passes at
// home. That is why this gate reads what git will DO on checkout instead of
// what happens to be on this disk.
//
// Four checks.
// (1) The scan actually read something, and the attribute column really varies:
//     at least 1,500 rows, every row parses, three known paths are present, and
//     both a text row and a binary row appear. Without this a parser returning
//     nothing — or a constant — makes (2), (3) and (4) pass over air.
// (2) Every tracked text file resolves `eol=lf`. This is git's OWN evaluation
//     of `.gitattributes`, not a re-reading of the file, and it goes red on
//     every platform the moment that rule is deleted, narrowed or flipped to
//     `eol=crlf` — where the failure it stands for was visible only on Windows.
// (3) No tracked file is STORED with CRLF: `eol=lf` fixes what checkout writes,
//     and does nothing about a blob that already carries `\r` in the index.
// (4) The shebang scripts — the 18 files that carry the exact defect — are text
//     rows covered by (2) and (3), and there is at least one of them. A rule
//     marking `scripts/**` binary would otherwise let (2) skip the only files
//     that actually broke.
//
// Bounds — what a green run does NOT prove.
// * It speaks about TRACKED files and about what a fresh checkout produces. A
//   working tree that predates this commit keeps whatever line endings it
//   already had (810 files on the authoring machine); nothing here rewrites or
//   reports that, because such a tree cannot reach CI, which always checks out
//   fresh. Generated and ignored files are outside it entirely.
// * It says nothing about Vite's hashbang handling. If a future toolchain
//   mishandles LF instead, this gate stays green.
// * It reads git's attribute resolution, so it cannot see a per-clone override
//   applied outside the repository (`.git/info/attributes`, `core.eol`) — those
//   affect one machine, never the runner.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface Row {
  /** How the blob is stored in the index: `lf`, `crlf`, `mixed`, `-text`, `none`. */
  index: string;
  /** How the file currently sits on disk. Deliberately unasserted — see bounds. */
  worktree: string;
  /** Git's resolved attributes for the path, e.g. `text=auto eol=lf` or `-text`. */
  attrs: string;
  path: string;
}

const git = (args: string[]): string =>
  execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

// `--eol` prints `i/<eol> w/<eol> attr/<attrs> <TAB> <path>`; `-z` keeps paths
// raw rather than C-quoting anything unusual.
const ROW = /^i\/(\S+)\s+w\/(\S+)\s+attr\/(.*?)\s*\t(.*)$/;

function readRows(): { rows: Row[]; unparsed: string[] } {
  const raw = git(['ls-files', '--eol', '-z']).split('\0').filter(Boolean);
  const rows: Row[] = [];
  const unparsed: string[] = [];
  for (const line of raw) {
    const m = ROW.exec(line);
    if (!m) {
      unparsed.push(line);
      continue;
    }
    rows.push({ index: m[1], worktree: m[2], attrs: m[3], path: m[4] });
  }
  return { rows, unparsed };
}

const { rows, unparsed } = readRows();
// Read the INDEX column as well as the attributes: git reports `i/-text` from
// its own content sniffing whether or not `.gitattributes` exists. Classifying
// on the attributes alone would make the binary control below a restatement of
// the very file this suite is here to check, and it would go red for the wrong
// reason the moment that file is removed.
const isBinary = (row: Row) => row.attrs.split(/\s+/).includes('-text') || row.index === '-text';
// A symlink has no line endings to speak of; git reports `i/none w/none`.
const isSymlink = (row: Row) => row.index === 'none' && row.worktree === 'none';
const textRows = rows.filter((row) => !isBinary(row) && !isSymlink(row));

const listing = (paths: string[], cap = 12) =>
  paths.slice(0, cap).join(', ') + (paths.length > cap ? `, and ${paths.length - cap} more` : '');

describe('the instrument reads git, and reads more than nothing', () => {
  it('parses every row of `git ls-files --eol` and sees the whole repository', () => {
    expect(
      unparsed,
      `\`git ls-files --eol -z\` returned ${unparsed.length} line(s) this test could not parse,`
      + ` starting with ${JSON.stringify(unparsed[0] ?? '')}. Expected each line to match`
      + ' `i/<eol> w/<eol> attr/<attrs><TAB><path>`. Every check below reads that parse, so an'
      + ' unparsed row is a hole in all of them, not a cosmetic problem.',
    ).toEqual([]);
    expect(
      rows.length,
      `Only ${rows.length} tracked file(s) were listed. This repository has had well over 1,500`
      + ' for months, so a number this small means the command ran somewhere else or returned'
      + ' almost nothing — and a check over almost nothing passes.',
    ).toBeGreaterThan(1500);
    for (const known of ['package.json', 'scripts/ci-status.mjs', '.gitattributes']) {
      expect(
        rows.some((row) => row.path === known),
        `${known} is tracked but was not in the listing, so the scan is not seeing this`
        + ' repository. Run `git ls-files --eol -z` from the repository root to compare.',
      ).toBe(true);
    }
  });

  it('distinguishes a text file from a binary one, so the attribute column is really read', () => {
    // Two rows that must differ. A parser handing back a constant `attrs`
    // satisfies the eol check below without reading anything.
    expect(
      textRows.length,
      'No tracked file resolved as text. The attribute column is not being read.',
    ).toBeGreaterThan(1000);
    expect(
      rows.filter(isBinary).length,
      'No tracked file resolved as binary, yet 68 PNGs are tracked. Either `.gitattributes` no'
      + ' longer marks them `binary` and `text=auto` no longer detects them — in which case git'
      + ' may rewrite bytes inside an image — or this test is not reading the attribute column.',
    ).toBeGreaterThan(0);
  });
});

describe('a checkout of this repository gets LF, whatever platform runs it', () => {
  it('resolves `eol=lf` for every tracked text file', () => {
    const offenders = textRows.filter((row) => !/(^|\s)eol=lf(\s|$)/.test(row.attrs));
    expect(
      offenders.map((row) => `${row.path} (attr/${row.attrs || '<none>'})`),
      `${offenders.length} tracked text file(s) do not resolve \`eol=lf\`, so a checkout under`
      + ' Git for Windows\' default `core.autocrlf=true` — which is what the GitHub-hosted'
      + ' `windows-latest` runner uses — writes them with CRLF. That is what turned main red on'
      + ' 2026-09-06. Satisfy this by keeping `* text=auto eol=lf` in `.gitattributes` at the'
      + ' repository root, or by giving any path excluded from it its own `eol=lf` rule.'
      + ` Offenders: ${listing(offenders.map((row) => row.path))}.`,
    ).toEqual([]);
  });

  it('has no tracked file stored with CRLF in the index', () => {
    // `eol=lf` governs what checkout WRITES. A blob committed with `\r` in it
    // keeps the `\r` on every platform, and this is the only check on that.
    const stored = rows.filter((row) => row.index === 'crlf' || row.index === 'mixed');
    expect(
      stored.map((row) => `${row.path} (i/${row.index})`),
      `${stored.length} tracked file(s) are stored with CRLF in the index. \`eol=lf\` fixes what`
      + ' checkout writes and cannot fix a blob that already carries `\\r`, so these arrive with'
      + ' CRLF on Linux too. Satisfy this with `git add --renormalize <path> && git commit`.'
      + ` Offenders: ${listing(stored.map((row) => row.path))}.`,
    ).toEqual([]);
  });

  it('covers the shebang scripts, which are the files that actually broke', () => {
    const byPath = new Map(rows.map((row) => [row.path, row]));
    const shebangs = rows
      .filter((row) => /\.(mjs|cjs|js|sh)$/.test(row.path) && !isBinary(row) && !isSymlink(row))
      .filter((row) => {
        try {
          return readFileSync(`${REPO_ROOT}${row.path}`).subarray(0, 2).toString('latin1') === '#!';
        } catch {
          return false;
        }
      })
      .map((row) => row.path);
    expect(
      shebangs.length,
      'No tracked script starts with `#!`. There were 18 on 2026-09-06, so either they were all'
      + ' renamed — in which case update this check — or the enumeration is broken and the'
      + ' assertion below is passing over an empty list.',
    ).toBeGreaterThan(0);
    const unguarded = shebangs.filter((path) => {
      const row = byPath.get(path);
      return !row || isBinary(row) || !/(^|\s)eol=lf(\s|$)/.test(row.attrs) || row.index !== 'lf';
    });
    expect(
      unguarded,
      `${unguarded.length} script(s) that begin with \`#!\` are not covered by the LF guarantee.`
      + ' A CRLF shebang is the exact defect: Vite\'s SSR transform locates its import injection'
      + ' with `/^#!.*\\n/`, `.` does not match `\\r`, and the injected code lands in front of the'
      + ' `#!` line — `SyntaxError: Invalid or unexpected token`. Satisfy this by leaving these'
      + ' paths inside `* text=auto eol=lf` rather than marking them binary or excluding them.'
      + ` Offenders: ${listing(unguarded)}.`,
    ).toEqual([]);
  });
});
