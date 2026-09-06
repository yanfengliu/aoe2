// Defect-register rollover — the mechanical half of the rule "the register
// rolls over in the task that overflows it" (docs/policies/local-rules.md,
// 2026-09-05). The register reached 1,437 lines and 58 entries before anything
// split it, while every other long-lived doc here already rolls over: the
// devlog archives its detailed file past 500 lines, engine-feedback splits
// current/past, threads split current/done. Its value is that it stays
// readable, so it is capped. Five checks plus an instrument check.
//
// (1) Instrument. The scan finds at least as many entries as both files are
//     known to hold — the ACTIVE floor is the closed cap itself, because the
//     cap check reads the active file and a floor of one would let a parser
//     that sees two entries pass a file holding twenty (review finding F1).
//     The strict `## ` parser is cross-checked against a deliberately looser
//     one, `/^\s{0,3}#{2}\s/`: CommonMark accepts up to three leading spaces,
//     so an indented heading is a real heading that the strict parser cannot
//     see, and `read` refuses to return a parse the two disagree on. The
//     classifier is pinned on verbatim headings that must still exist in one
//     of the two files, plus labelled synthetic near misses.
// (2) `docs/learning/defect-register.md` holds at most CLOSED_CAP closed
//     entries. Open entries do not count against the cap and never roll over.
//     Its message names the entries a reader must actually move — OLDEST
//     first, which in a newest-first file means the bottom-most entry of the
//     oldest date, and never an entry the archive check (3) would then refuse.
//     Both halves are pinned by `rolloverMessage`'s own cases below, on
//     synthetic entries, because the register's real contents change weekly.
// (3) No OPEN entry is in `docs/learning/defect-register-past.md`, and no
//     archived entry carries a marker that leaves the defect live —
//     "(LATENT, not fixed)", "(PARTLY FIXED: ...)", "(... NOT shipped)". An
//     entry leaves the active register by being closed, not by ageing, and on
//     2026-09-05 three live defects were archived under exactly those three
//     spellings. The gate refuses to guess what an archived marker means.
// (4) No entry in EITHER file carries a marker the classifier calls closed
//     while its own text says open, unfixed or reopened — `(OPEN` unclosed,
//     `[OPEN]`, `(OPEN).`, `— OPEN`, `(UNFIXED)`, `(REOPENED)`. Reading these
//     as closed fails in the unsafe direction: it both passes (3) and makes
//     the entry eligible to roll over.
// (5) No entry appears twice — across the split or inside one file — compared
//     on a key that folds case, curly quotes, dash width and whitespace, so a
//     copy that differs by a trailing space is still a copy.
// (6) Every path a register header points at resolves on disk with its exact
//     casing and is a file, and each file points at the other. A rename that
//     leaves the pointer behind is the same class as the stale thread
//     pointers of 2026-09-05.
//
// Bounds — what a green run does NOT prove. Nothing here reads the entries'
// CONTENT: an entry moved with its wording mangled, summarised, or with a body
// silently truncated passes, because the only record of what the text was is
// git history and this gate deliberately does not shell out to it. Nothing
// checks ORDER: an active file shuffled out of newest-first order passes, and
// (2)'s message ASSUMES that order — it reads "older" off the date in the
// heading and, within one date, off the line number, so an entry filed in the
// wrong place is named in the wrong place too.
// Nothing checks that the twelve kept entries are the twelve NEWEST — keeping
// any twelve closed entries and archiving the rest passes. Nothing checks that
// a closed entry ever reaches the archive: deleting one outright passes every
// check here, and the floors only ever become more slack because entries are
// never deleted. The status marker is a text convention: (3) and (4) read
// words, so a marker that describes a live defect in words none of their
// patterns carry still reads as closed. (3) is deliberately ARCHIVE-ONLY — an
// unfixed-sounding marker in the ACTIVE file is in front of the reader and is
// allowed (`(PROVEN, fix measured and NOT shipped)` stands there today); it
// counts against the cap and can roll over, and the gate catches it at the
// moment it is buried, not before. (6) sees each file's header region, which
// is every line above its first heading — the loose/strict cross-check is what
// keeps an indented first heading from moving that boundary down into an entry
// body and blaming a filename ten lines from the real defect (review finding
// F3); pointers written inside entry bodies are not checked at all, and
// `threadHygiene` covers `docs/threads/` paths everywhere in `docs/learning/`.
// The parser skips fenced blocks, so a `## ` line inside a code fence is not
// an entry; an unterminated fence swallows the rest of the file and is caught
// by the floors, not by a message about the fence.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  ACTIVE,
  CLOSED_CAP,
  type Entry,
  PAST,
  SUSPECT_ARCHIVED,
  type Verdict,
  classify,
  entryKey,
  isOpen,
  mayBeArchived,
  rolloverMessage,
  statusMarker,
  statusRegion,
} from './helpers/defectRegisterHeadings';

const ROOT = realpathSync.native(fileURLToPath(new URL('../../', import.meta.url)));

// Floors that a broken heading regex or a wrong path must trip. Entries are
// never deleted from the register, so these only ever become more slack. The
// ACTIVE floor is the cap itself: the cap check reads that file, and a floor
// below the cap protects the wrong side of the comparison.
const MIN_ACTIVE_ENTRIES = CLOSED_CAP;
const MIN_ARCHIVE_ENTRIES = 20;
const MIN_TOTAL_ENTRIES = 50;

// A code span or link target that names a file. Anything else in the header
// prose (quoted entry titles, ordinary words) is not a pointer.
const POINTER = /\[[^\]]*\]\(([^)\s]+)\)|`([^`\s]+\.(?:md|ts|tsx|mjs|cjs|js|json))`/g;
// `#anchor`, `https://...`, `mailto:...`, `//host/share` — a link target that
// is not a repository path. Treating one as a path turns the gate red with a
// message nobody can act on (review finding F7).
const NOT_A_PATH = /^(?:#|\/\/|[A-Za-z][A-Za-z0-9+.-]*:)/;

const LOOSE_HEADING = /^\s{0,3}#{2}\s/;
const FENCE = /^\s{0,3}(?:`{3,}|~{3,})/;

interface Register {
  readonly path: string;
  readonly header: string;
  readonly entries: readonly Entry[];
}

function scanHeadings(lines: readonly string[]): { strict: number[]; loose: number[] } {
  const strict: number[] = [];
  const loose: number[] = [];
  let fenced = false;
  lines.forEach((line, index) => {
    if (FENCE.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    if (line.startsWith('## ')) strict.push(index);
    if (LOOSE_HEADING.test(line)) loose.push(index);
  });
  return { strict, loose };
}

function read(path: string): Register {
  const abs = join(ROOT, path);
  if (!existsSync(abs)) {
    throw new Error(
      `${path} does not exist, so the rollover gate would pass on a register that is not there; both halves of the register are tracked files`,
    );
  }
  const lines = readFileSync(abs, 'utf8').split(/\r?\n/);
  const { strict, loose } = scanHeadings(lines);
  const strictSet = new Set(strict);
  const looseSet = new Set(loose);
  const differ = [...new Set([...strict, ...loose])]
    .filter((index) => strictSet.has(index) !== looseSet.has(index))
    .sort((a, b) => a - b)
    .map(
      (index) =>
        `${path}:${index + 1} — the strict \`## \` parser ${strictSet.has(index) ? 'sees' : 'does NOT see'} it and the loose /^\\s{0,3}#{2}\\s/ probe ${looseSet.has(index) ? 'does' : 'does not'}: ${JSON.stringify(lines[index])}`,
    );
  if (differ.length > 0) {
    throw new Error(
      `the two heading parsers disagree, so every count below this line would be a number about the parser rather than about the register. CommonMark accepts up to three leading spaces before a \`##\`, and a tab after it, so an indented or tab-separated heading renders as an entry and hides from the cap check. Write each entry heading flush left, exactly \`## \`:\n${differ.join('\n')}`,
    );
  }
  const entries: Entry[] = strict.map((index) => {
    const heading = lines[index];
    return {
      heading,
      line: index + 1,
      status: statusMarker(heading),
      verdict: classify(heading),
      open: isOpen(heading),
      key: entryKey(heading),
    };
  });
  const firstHeading = strict.length === 0 ? lines.length : strict[0];
  return { path, header: lines.slice(0, firstHeading).join('\n'), entries };
}

function pointersIn(register: Register): { raw: string; line: number }[] {
  const found: { raw: string; line: number }[] = [];
  register.header.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(POINTER)) {
      const raw = match[1] ?? match[2];
      if (raw !== undefined && !NOT_A_PATH.test(raw)) found.push({ raw, line: index + 1 });
    }
  });
  return found;
}

type PathStatus = 'ok' | 'wrong-case' | 'not-a-file' | 'missing';

function posix(path: string): string {
  return path.replace(/\\/g, '/');
}

// Exact-case existence, the way threadHygiene check (1) does it: Windows
// resolves `Defect-Register.md` to `defect-register.md` and Linux CI does not,
// and `existsSync` accepts a directory (review finding F8).
function classifyPath(rel: string): { status: PathStatus; real?: string } {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return { status: 'missing' };
  if (!statSync(abs).isFile()) return { status: 'not-a-file' };
  const real = posix(relative(ROOT, realpathSync.native(abs)));
  return real === rel ? { status: 'ok', real } : { status: 'wrong-case', real };
}

// A pointer resolves either beside the file that wrote it or from the repo
// root: `defect-register-past.md` is a sibling, `tests/architecture/...` is
// repo-relative. Both forms are in the headers today.
function resolvePointer(register: Register, raw: string): { rel: string; status: PathStatus; real?: string } {
  const candidates = [
    posix(relative(ROOT, join(ROOT, dirname(register.path), raw))),
    posix(relative(ROOT, join(ROOT, raw))),
  ];
  let fallback: { rel: string; status: PathStatus; real?: string } | undefined;
  for (const rel of candidates) {
    const result = classifyPath(rel);
    if (result.status === 'ok') return { rel, ...result };
    if (fallback === undefined || (fallback.status === 'missing' && result.status !== 'missing')) {
      fallback = { rel, ...result };
    }
  }
  return fallback ?? { rel: candidates[0], status: 'missing' };
}

// Pinned classifier cases. `real: true` rows are copied verbatim out of the
// register and are asserted to still exist there, so a paraphrase or a curly
// apostrophe that the register does not have cannot masquerade as coverage
// (three of the first seven pins did exactly that). `real: false` rows are
// deliberate near misses that must be CAUGHT — never read as an archivable
// closed entry.
const PINS: ReadonlyArray<{
  readonly heading: string;
  readonly verdict: Verdict;
  readonly archivable: boolean;
  readonly real: boolean;
}> = [
  { heading: '## 2026-09-05 — A green browser-suite run can leave a headless Chrome burning cores for hours (OPEN)', verdict: 'open', archivable: false, real: true },
  { heading: "## 2026-09-04 — A unit's shadow does not turn when the unit turns (owner-reported, OPEN)", verdict: 'open', archivable: false, real: true },
  { heading: '## 2026-09-03 — The AI hoards the resource it cannot spend and starves on the one that gates every unit (SUPERSEDED THE SAME DAY as the cause of the empty army — see the unit-line entry below, which is the real one. What is recorded here is still TRUE and still unfixed, but it is not what was stopping the army. OPEN)', verdict: 'open', archivable: false, real: true },
  { heading: '## 2026-09-03 — A decided match never ends, because the AI can only aim at a Town Center (PARTLY FIXED: 1 of 4 seeds resolved then; 3 of 4 after the 2026-09-04 garrison entry above, OPEN)', verdict: 'open', archivable: false, real: true },
  { heading: "## 2026-08-30 — Gather over-subscription counts EVERY owner's villagers (LATENT, not fixed, OPEN)", verdict: 'open', archivable: false, real: true },
  // The title says OPEN and the marker says otherwise; three real entries share
  // this title, and reading OPEN from the title pins all three in the active
  // file forever and quietly makes the cap unsatisfiable.
  { heading: '## 2026-09-01 — Villagers latch on an OPEN cell when buildings move (FIXED)', verdict: 'closed', archivable: true, real: true },
  { heading: '## 2026-09-01 — Villagers latch on an OPEN cell when buildings move (root-cause record)', verdict: 'closed', archivable: true, real: true },
  { heading: '## 2026-09-01 — Villagers latch on an OPEN cell when buildings move (superseded framing, kept for provenance)', verdict: 'closed', archivable: true, real: true },
  { heading: '## 2026-08-24 — A stray arrow ended the match', verdict: 'closed', archivable: true, real: true },
  // Closed, and NOT archivable: this is the active file's standing example of a
  // marker that describes a live defect. It is allowed where it is and would
  // go red the moment it rolled over.
  { heading: "## 2026-09-03 — The AI's build order stalls on the first thing it cannot afford, so no seed has ever built a Siege Workshop (PROVEN, fix measured and NOT shipped)", verdict: 'closed', archivable: false, real: true },
  // Synthetic near misses. Every one of these was read as an archivable closed
  // entry by the 2026-09-05 classifier.
  { heading: '## 2026-01-01 — SYNTHETIC near miss, unclosed group (owner-reported, OPEN', verdict: 'ambiguous', archivable: false, real: false },
  { heading: '## 2026-01-01 — SYNTHETIC near miss, lower case (open)', verdict: 'open', archivable: false, real: false },
  { heading: '## 2026-01-01 — SYNTHETIC near miss, title case (Open)', verdict: 'open', archivable: false, real: false },
  { heading: '## 2026-01-01 — SYNTHETIC near miss, square brackets [OPEN]', verdict: 'ambiguous', archivable: false, real: false },
  { heading: '## 2026-01-01 — SYNTHETIC near miss, a full stop after the group (OPEN).', verdict: 'ambiguous', archivable: false, real: false },
  { heading: '## 2026-01-01 — SYNTHETIC near miss, a sentence (still open)', verdict: 'open', archivable: false, real: false },
  { heading: '## 2026-01-01 — SYNTHETIC near miss, another word for it (UNFIXED)', verdict: 'ambiguous', archivable: false, real: false },
  { heading: '## 2026-01-01 — SYNTHETIC near miss, live again (REOPENED)', verdict: 'ambiguous', archivable: false, real: false },
  { heading: '## 2026-01-01 — SYNTHETIC near miss, no parentheses at all — OPEN', verdict: 'ambiguous', archivable: false, real: false },
  { heading: '## 2026-01-01 — SYNTHETIC near miss, closed-sounding but live (LATENT, not fixed)', verdict: 'closed', archivable: false, real: false },
  { heading: '## 2026-01-01 — SYNTHETIC near miss, half a fix (PARTLY FIXED: 1 of 4 seeds)', verdict: 'closed', archivable: false, real: false },
  { heading: '## 2026-01-01 — SYNTHETIC control, plainly closed (FIXED v0.0.0)', verdict: 'closed', archivable: true, real: false },
];

describe('defect register rollover', () => {
  it('the parser reads both halves of the register, and reads the status from the trailing marker', () => {
    const active = read(ACTIVE);
    const past = read(PAST);
    const total = active.entries.length + past.entries.length;
    const thin: string[] = [];
    if (active.entries.length < MIN_ACTIVE_ENTRIES) {
      thin.push(`${ACTIVE}: ${active.entries.length} entries parsed, at least ${MIN_ACTIVE_ENTRIES} exist (the cap check reads THIS file)`);
    }
    if (past.entries.length < MIN_ARCHIVE_ENTRIES) {
      thin.push(`${PAST}: ${past.entries.length} entries parsed, at least ${MIN_ARCHIVE_ENTRIES} exist`);
    }
    if (total < MIN_TOTAL_ENTRIES) {
      thin.push(`both files: ${total} entries parsed, at least ${MIN_TOTAL_ENTRIES} exist (entries are never deleted)`);
    }
    expect(
      thin,
      `the register scan is reading less than it claims — a broken \`## \` heading match or a wrong path makes every other check in this file pass on nothing:\n${thin.join('\n')}`,
    ).toEqual([]);

    const known = new Set([...active.entries, ...past.entries].map((entry) => entry.heading));
    const missing = PINS.filter((pin) => pin.real && !known.has(pin.heading)).map(
      (pin) => `pinned as a real heading but no entry in either file has this exact text: ${pin.heading}`,
    );
    expect(
      missing,
      `a pin that no longer matches a real heading tests a string nobody maintains — a curly apostrophe where the register has a straight one, or a paraphrase, reads as coverage and is none. Copy the heading out of the register, or mark the case synthetic:\n${missing.join('\n')}`,
    ).toEqual([]);

    const wrong = PINS.filter(
      (pin) => classify(pin.heading) !== pin.verdict || mayBeArchived(pin.heading) !== pin.archivable,
    ).map(
      (pin) =>
        `read as ${classify(pin.heading)}/${mayBeArchived(pin.heading) ? 'archivable' : 'not archivable'}, should be ${pin.verdict}/${pin.archivable ? 'archivable' : 'not archivable'}: ${pin.heading}`,
    );
    expect(
      wrong,
      `the classifier moved. OPEN is read from the heading's trailing (status) group, case-insensitively; a marker that says open, unfixed or reopened in any other spelling is AMBIGUOUS, never closed; and a marker that leaves the defect live is not archivable:\n${wrong.join('\n')}`,
    ).toEqual([]);
  });

  it(`the active register holds at most ${CLOSED_CAP} closed entries`, () => {
    const active = read(ACTIVE);
    const closed = active.entries.filter((entry) => !entry.open);
    const overflow = rolloverMessage(closed, CLOSED_CAP);
    expect(
      overflow,
      `${ACTIVE} holds ${closed.length} closed entries and the cap is ${CLOSED_CAP} (${active.entries.length - closed.length} open entries do not count). The task whose entry overflowed the file does the rollover in its own commit — never a later sweep: move the entries marked MOVE verbatim to ${PAST}, in the order given (oldest first), and change no wording. An entry marked PINNED stays where it is — the archive check refuses its marker, so moving it turns this suite red a different way:\n${overflow.join('\n')}`,
    ).toEqual([]);
  });

  // The message's own cases. They are built from synthetic entries rather than
  // from the register, because what has to hold is the RULE — the register's
  // contents change every few days, and a case that read them would be pinning
  // this week's file. The one real-file case below asks only for the property.
  const fake = (date: string, note: string, line: number): Entry => {
    const heading = `## ${date} — SYNTHETIC ${note}`;
    return { heading, line, status: statusMarker(heading), verdict: classify(heading), open: isOpen(heading), key: entryKey(heading) };
  };

  it('names the oldest closed entries first, and for one date the BOTTOM-most of them', () => {
    // File order, so a lower line number is a NEWER entry. Three entries share
    // 2026-09-06 and two share 2026-09-05: the shape that exposed the defect,
    // because with one entry per date a line-number tie-break never runs.
    const closed = [
      fake('2026-09-06', 'newest of 09-06 (FIXED)', 10),
      fake('2026-09-06', 'middle of 09-06 (FIXED)', 20),
      fake('2026-09-06', 'oldest of 09-06 (FIXED)', 30),
      fake('2026-09-05', 'newer of 09-05 (FIXED)', 40),
      fake('2026-09-05', 'oldest of them all (FIXED)', 50),
    ];
    expect(rolloverMessage(closed, 5), 'the cap is met, so nothing is named').toEqual([]);
    expect(rolloverMessage(closed, 4)).toEqual([
      `${ACTIVE}:50 — MOVE — 2026-09-05 — SYNTHETIC oldest of them all (FIXED)`,
    ]);
    expect(rolloverMessage(closed, 2)).toEqual([
      `${ACTIVE}:50 — MOVE — 2026-09-05 — SYNTHETIC oldest of them all (FIXED)`,
      `${ACTIVE}:40 — MOVE — 2026-09-05 — SYNTHETIC newer of 09-05 (FIXED)`,
      `${ACTIVE}:30 — MOVE — 2026-09-06 — SYNTHETIC oldest of 09-06 (FIXED)`,
    ]);
  });

  it('never tells the reader to move an entry the archive check would refuse', () => {
    const pinned = fake('2026-09-03', 'pinned (PROVEN, fix measured and NOT shipped)', 100);
    const closed = [fake('2026-09-05', 'newest (FIXED)', 10), fake('2026-09-04', 'the movable one (FIXED)', 50), pinned];
    expect(rolloverMessage(closed, 2)).toEqual([
      `${ACTIVE}:100 — PINNED, leave it where it is: the archive check refuses (PROVEN, fix measured and NOT shipped) as a closure — 2026-09-03 — SYNTHETIC pinned (PROVEN, fix measured and NOT shipped)`,
      `${ACTIVE}:50 — MOVE — 2026-09-04 — SYNTHETIC the movable one (FIXED)`,
    ]);
    // Nothing archivable left. The cap is still exceeded, so the list must NOT
    // come back empty and let the check pass — it says the cap is unreachable.
    const allPinned = rolloverMessage([pinned, fake('2026-09-02', 'also pinned (LATENT, not fixed)', 200)], 1);
    expect(allPinned).toHaveLength(3);
    expect(allPinned[2]).toContain('1 more closed entry has to go and every remaining one is PINNED');
  });

  it('on the real register, an entry it names to MOVE is one the archive would accept', () => {
    const closed = read(ACTIVE).entries.filter((entry) => !entry.open);
    // The premise, so a register with nothing closed fails saying that rather
    // than blaming the entry it could not find.
    expect(closed.length, `${ACTIVE} holds no closed entry, so nothing could ever be asked to roll`).toBeGreaterThan(0);
    const named = rolloverMessage(closed, closed.length - 1);
    const moving = named.filter((line) => line.includes(' — MOVE — '));
    expect(moving, `one entry over the cap must name exactly one MOVE:\n${named.join('\n')}`).toHaveLength(1);
    const heading = `## ${moving[0].slice(moving[0].indexOf(' — MOVE — ') + 10)}`;
    expect(
      mayBeArchived(heading),
      `the cap check named an entry that check (3) would then refuse in the archive: ${heading}`,
    ).toBe(true);
  });

  it('the archive holds no OPEN entry, and no marker that leaves the defect live', () => {
    const past = read(PAST);
    const stranded = past.entries
      .filter((entry) => entry.open)
      .map((entry) => `${PAST}:${entry.line} — status ${entry.status} — OPEN — ${entry.heading.slice(3)}`);
    const unfixed = past.entries
      .filter((entry) => !entry.open && SUSPECT_ARCHIVED.test(statusRegion(entry.heading)))
      .map((entry) => `${PAST}:${entry.line} — status ${entry.status || '(none)'} — reads as closed but says the defect is live — ${entry.heading.slice(3)}`);
    expect(
      [...stranded, ...unfixed],
      `live defects buried in the archive. An entry leaves ${ACTIVE} by being CLOSED, not by ageing, and a marker like "(LATENT, not fixed)", "(PARTLY FIXED: ...)" or "(... NOT shipped)" is not a closure — on 2026-09-05 three live defects rolled over under exactly those spellings. For each of these: move it back to ${ACTIVE} and add OPEN to its trailing group, or, if it really is fixed, say so in the marker:\n${[...stranded, ...unfixed].join('\n')}`,
    ).toEqual([]);
  });

  it('no entry is classified closed while its own heading says it is live', () => {
    const ambiguous = [read(ACTIVE), read(PAST)].flatMap((register) =>
      register.entries
        .filter((entry) => entry.verdict === 'ambiguous')
        .map((entry) => `${register.path}:${entry.line} — status ${entry.status || '(none, so the whole heading was read)'} — ${entry.heading.slice(3)}`),
    );
    expect(
      ambiguous,
      `a heading that says open, unfixed or reopened but that the classifier reads as CLOSED. Reading it as closed fails in the unsafe direction: the entry counts against the cap and becomes eligible to roll over into the archive. Put OPEN inside the heading's trailing parenthesised group — \`(OPEN\` unclosed, \`[OPEN]\`, \`(OPEN).\` and a trailing \`— OPEN\` are all invisible to the marker parser:\n${ambiguous.join('\n')}`,
    ).toEqual([]);
  });

  it('no entry appears twice, across the split or within one file', () => {
    const seen = new Map<string, string[]>();
    for (const register of [read(ACTIVE), read(PAST)]) {
      for (const entry of register.entries) {
        const where = seen.get(entry.key) ?? [];
        where.push(`${register.path}:${entry.line} — ${entry.heading.slice(3)}`);
        seen.set(entry.key, where);
      }
    }
    const duplicated = [...seen.values()]
      .filter((where) => where.length > 1)
      .map((where) => where.join('\n    '));
    expect(
      duplicated,
      `the same entry appears more than once — a rollover MOVES an entry, it never copies it, so one of each group is a leftover and the register now reports the same defect twice. Headings are compared with case, curly quotes, dash width and runs of whitespace folded, so a copy that differs only in punctuation still counts. Delete the copy from ${ACTIVE} if the entry has rolled over, or from ${PAST} if it has not:\n${duplicated.join('\n\n')}`,
    ).toEqual([]);
  });

  it('each register header points at the other half, and every path it names resolves', () => {
    const failures: string[] = [];
    for (const register of [read(ACTIVE), read(PAST)]) {
      const other = register.path === ACTIVE ? PAST : ACTIVE;
      const pointers = pointersIn(register);
      if (pointers.length === 0) {
        failures.push(
          `${register.path}: its header (everything above the first \`## \` heading) names no file at all; it must point at ${other}`,
        );
      }
      let pointsAtOther = false;
      for (const { raw, line } of pointers) {
        const { rel, status, real } = resolvePointer(register, raw);
        if (status === 'missing') {
          failures.push(
            `${register.path}:${line} points at \`${raw}\`, which exists neither beside it (\`${dirname(register.path)}/${raw}\`) nor at the repo root; write the path the file actually has, or add the file`,
          );
        } else if (status === 'wrong-case') {
          failures.push(
            `${register.path}:${line} points at \`${raw}\`, whose real path is \`${real}\` and not \`${rel}\`; Windows resolves the wrong casing and Linux CI does not, so fix the case`,
          );
        } else if (status === 'not-a-file') {
          failures.push(`${register.path}:${line} points at \`${raw}\`, which is a directory, not a file; name the file inside it`);
        } else if (rel === other) {
          pointsAtOther = true;
        }
      }
      if (!pointsAtOther) {
        failures.push(
          `${register.path}: its header resolves no pointer to ${other}. The two halves of the register are only navigable if each names the other — add a link to \`${other.slice(other.lastIndexOf('/') + 1)}\``,
        );
      }
    }
    expect(
      failures,
      `broken pointers between the halves of the defect register — a rename that left its pointer behind is the class that stranded four thread pointers on 2026-09-05:\n${failures.join('\n')}`,
    ).toEqual([]);
  });
});
