// Thread hygiene — the mechanical half of the rule "a thread is closed by the
// task that closes it" (docs/policies/local-rules.md, 2026-09-05; register
// entry of the same date). Three checks.
//
// (1) Every `docs/threads/{current,done}/...` path written into code, tests,
//     scripts, the spec, the architecture docs, the policies and the learning
//     docs resolves on disk with its exact casing (Windows accepts a wrong
//     case that Linux CI rejects). A thread move is a rename, and on
//     2026-09-05 four pointers named `current/` for threads moved months
//     earlier — one written six days after the 2026-06-09 housekeeping review
//     by the very commit that moved its thread.
// (2) No file under `docs/threads/current` carries a closure line, that is
//     `Closed YYYY-MM-DD:` at the start of a line. The closing ritual writes
//     that line and moves the folder in the same commit, so a closure line
//     still under `current/` is the move forgotten. Without this check the
//     closure line's own date would keep (3) green forever.
// (3) Every thread under `current/` carries a YYYY-MM-DD date, in a file or a
//     folder name, within MAX_STALE_DAYS of the reference clock — the newer of
//     HEAD's commit date and the newest date in docs/devlog/summary.md. Six
//     closed threads sat in `current/` for up to seven weeks because nothing
//     read the folder at the end of a task.
//
// Bounds — what a green run does NOT prove. (1) sees literal paths in the
// listed roots only: a template such as `docs/threads/current/<objective>/...`
// resolves to the folder, an elided `...` path is checked up to the elision,
// and history is exempt (the devlog, the changelog, the debugging logs, the
// threads themselves) because those narrate moves and pending states as they
// were. (2) catches only a thread closed by the ritual. (3) is a 30-day tail:
// a thread closed WITHOUT a closure line and left here is caught only after
// 30 days of commits, and a thread that quotes any recent date for any
// reason — a deadline, a version's date — counts as maintained; it reads
// dates as text, so a status line that is false but dated today passes. The
// clock is HEAD's date rather than the wall clock, so an idle repo never goes
// red on its own. Proofs, including the six-thread matrix: gate-proofs.md.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = realpathSync.native(fileURLToPath(new URL('../../', import.meta.url)));
const CURRENT_THREADS = join(ROOT, 'docs', 'threads', 'current');
const DEVLOG_SUMMARY = join(ROOT, 'docs', 'devlog', 'summary.md');

const POINTER_ROOTS = [
  'src',
  'tests',
  'scripts',
  'design',
  'docs/architecture',
  'docs/policies',
  'docs/learning',
  'docs/engine-feedback',
  'AGENTS.md',
  'README.md',
];
// The floor a broken regex, extension list or root entry must trip, per root.
// A floor on the total alone stayed green with `.ts` dropped from the
// extension list — which silences exactly the roots the 2026-09-05 pointers
// lived in (critic finding W3).
const MIN_REAL_POINTERS_PER_ROOT: Readonly<Record<string, number>> = {
  src: 3,
  tests: 3,
  design: 3,
  'docs/architecture': 3,
};
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'generated', 'coverage', 'tmp']);
const TEXT_EXTS = new Set(['.ts', '.tsx', '.mjs', '.cjs', '.js', '.md', '.json', '.yml', '.yaml', '.css', '.html', '.txt']);
const POINTER = /docs\/threads\/(?:current|done)\/[A-Za-z0-9_./-]*/g;
const VACUOUS = new Set(['docs/threads/current', 'docs/threads/done']);
// Lookahead rather than a trailing \b, so an ISO timestamp's date part counts.
const DATE = /\b(20\d\d)-(\d\d)-(\d\d)(?!\d)/g;
const CLOSURE_LINE = /^Closed \d{4}-\d{2}-\d{2}/;
const MAX_STALE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf('.');
      if (dot >= 0 && TEXT_EXTS.has(entry.name.slice(dot))) out.push(join(dir, entry.name));
    }
  }
}

function listFiles(root: string): string[] {
  const abs = join(ROOT, root);
  if (!existsSync(abs)) {
    throw new Error(`pointer root ${root} does not exist; the scan would silently cover less than it claims`);
  }
  if (statSync(abs).isFile()) return [abs];
  const out: string[] = [];
  walk(abs, out);
  return out;
}

function posix(file: string): string {
  return relative(ROOT, file).replace(/\\/g, '/');
}

// A sentence-final dot after `DESIGN.md`, a trailing slash on a folder, and an
// elided `<thread>/.../REVIEW.md` path all reduce to a path that must exist.
// (Spelling the full forms out here would make this file fail its own scan.)
function normalisePointer(raw: string): string {
  const elision = raw.indexOf('/...');
  const cut = elision >= 0 ? raw.slice(0, elision) : raw;
  return cut.replace(/[./]+$/, '');
}

// Exact-case existence: Windows resolves `Design.md` to `DESIGN.md`, Linux
// does not, and CI runs on Linux.
function existsExact(path: string): boolean {
  const abs = join(ROOT, path);
  if (!existsSync(abs)) return false;
  return posix(realpathSync.native(abs)) === path;
}

function datesIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(DATE)) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const utc = Date.UTC(year, month - 1, day);
    const d = new Date(utc);
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) out.push(utc);
  }
  return out;
}

function iso(utc: number): string {
  return new Date(utc).toISOString().slice(0, 10);
}

function headCommitDate(): number | undefined {
  const result = spawnSync('git', ['log', '-1', '--format=%cs'], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) return undefined;
  const dates = datesIn(result.stdout);
  return dates.length === 0 ? undefined : dates[0];
}

function referenceClock(): number {
  const candidates = [headCommitDate(), ...datesIn(readFileSync(DEVLOG_SUMMARY, 'utf8'))].filter(
    (d): d is number => d !== undefined,
  );
  if (candidates.length === 0) {
    throw new Error('neither `git log -1` nor docs/devlog/summary.md yields a YYYY-MM-DD date, so the staleness bound has no reference');
  }
  return Math.max(...candidates);
}

function threadFiles(dir: string): string[] {
  const out: string[] = [];
  const visit = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) out.push(full);
    }
  };
  visit(dir);
  return out;
}

function newestThreadDate(dir: string, name: string): number | undefined {
  const found = datesIn(name);
  for (const file of threadFiles(dir)) {
    found.push(...datesIn(posix(file)));
    found.push(...datesIn(readFileSync(file, 'utf8')));
  }
  return found.length === 0 ? undefined : Math.max(...found);
}

function currentThreads(): string[] {
  if (!existsSync(CURRENT_THREADS)) return [];
  return readdirSync(CURRENT_THREADS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

describe('thread hygiene', () => {
  it('every thread path written into a live surface exists on disk, exact case', () => {
    const failures: string[] = [];
    const realPerRoot = new Map<string, number>();
    for (const root of POINTER_ROOTS) {
      let real = 0;
      for (const file of listFiles(root)) {
        const lines = readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, index) => {
          for (const match of line.matchAll(POINTER)) {
            const path = normalisePointer(match[0]);
            if (!VACUOUS.has(path)) real += 1;
            if (!existsExact(path)) {
              failures.push(`${posix(file)}:${index + 1} names \`${match[0]}\` but \`${path}\` does not exist with that exact casing`);
            }
          }
        });
      }
      realPerRoot.set(root, real);
    }
    const thin = Object.entries(MIN_REAL_POINTERS_PER_ROOT)
      .filter(([root, floor]) => (realPerRoot.get(root) ?? 0) < floor)
      .map(([root, floor]) => `${root}: ${realPerRoot.get(root) ?? 0} real pointers found, at least ${floor} exist`);
    expect(thin, `the pointer scan is reading less than it claims — a broken regex, extension list or root entry:\n${thin.join('\n')}`).toEqual([]);
    expect(
      failures,
      `stale thread pointers — a moved thread lives under docs/threads/done/ now, so point at its new path:\n${failures.join('\n')}`,
    ).toEqual([]);
  });

  it('no thread in docs/threads/current carries a closure line', () => {
    const closed: string[] = [];
    for (const name of currentThreads()) {
      for (const file of threadFiles(join(CURRENT_THREADS, name))) {
        readFileSync(file, 'utf8')
          .split(/\r?\n/)
          .forEach((line, index) => {
            if (CLOSURE_LINE.test(line)) closed.push(`${posix(file)}:${index + 1} — ${line.slice(0, 80)}`);
          });
      }
    }
    expect(
      closed,
      `closed threads still under docs/threads/current — the commit that writes \`Closed YYYY-MM-DD:\` is the commit that moves the folder to docs/threads/done/:\n${closed.join('\n')}`,
    ).toEqual([]);
  });

  it(`every thread in docs/threads/current carries a date within ${MAX_STALE_DAYS} days of HEAD`, () => {
    const clock = referenceClock();
    const stale: string[] = [];
    for (const name of currentThreads()) {
      const newest = newestThreadDate(join(CURRENT_THREADS, name), name);
      const ageDays = newest === undefined ? Number.POSITIVE_INFINITY : Math.floor((clock - newest) / DAY_MS);
      if (ageDays > MAX_STALE_DAYS) {
        const have = newest === undefined ? 'carries no date at all' : `was last dated ${iso(newest)}, ${ageDays} days`;
        stale.push(`docs/threads/current/${name} ${have} behind the reference clock (${iso(clock)})`);
      }
    }
    expect(
      stale,
      `stale threads in docs/threads/current — each needs a dated status line (what moved, what is still open) or a git mv to docs/threads/done/:\n${stale.join('\n')}`,
    ).toEqual([]);
  });
});
