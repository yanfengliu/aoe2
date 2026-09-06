// The defect register's HEADING language, and the plan a rollover follows.
// Nothing here touches the filesystem: every function takes a heading string or
// a list of already-parsed entries, which is what lets the ordering cases be
// written against synthetic entries instead of against whatever the register
// happens to hold today. What the gate enforces, and what a green run does NOT
// prove, is documented in `tests/architecture/defectRegisterRollover.test.ts`.
//
// Split out of that file on 2026-09-06: fixing the overflow message's ordering
// pushed it past the repository's 500-line cap, so the pure heading logic moved
// here and the checks that read the two files stayed there.

export const ACTIVE = 'docs/learning/defect-register.md';
export const PAST = 'docs/learning/defect-register-past.md';

export const CLOSED_CAP = 12;

// The classifier. `isOpen` is case-insensitive because `(open)` and `(Open)`
// are the same statement as `(OPEN)`; SUSPECT_LIVE is the fail-loud branch for
// the spellings that mean the same and that `isOpen` cannot read; and
// SUSPECT_ARCHIVED is the archive-only branch for markers that describe a
// defect nobody has fixed.
const OPEN_MARKER = /\bopen\b/i;
const SUSPECT_LIVE = /\b(?:open|unfixed|reopen)\w*/i;
export const SUSPECT_ARCHIVED =
  /\blatent\b|\bunresolved\b|\bpending\b|\bpart(?:ly|ially)\s+fixed\b|\b(?:not|never)\s+(?:fixed|resolved|shipped|repaired)\b|\bwon'?t\s+fix\b/i;

export type Verdict = 'open' | 'ambiguous' | 'closed';

// What a rollover plan needs from an entry: where it is, what it says, and the
// marker already parsed out of it.
export interface RolloverCandidate {
  readonly heading: string;
  readonly line: number;
  readonly status: string;
}

export interface Entry extends RolloverCandidate {
  readonly verdict: Verdict;
  readonly open: boolean;
  readonly key: string;
}

// The status marker is the LAST balanced parenthesised group that ENDS the
// heading — `... (owner-reported, OPEN)` is open, `Villagers latch on an OPEN
// cell when buildings move (FIXED)` is closed, and a heading with no trailing
// group at all (several of the 2026-08-23 entries) has no marker.
export function statusMarker(heading: string): string {
  const text = heading.replace(/\s+$/, '');
  if (!text.endsWith(')')) return '';
  let depth = 0;
  for (let i = text.length - 1; i >= 0; i -= 1) {
    if (text[i] === ')') depth += 1;
    else if (text[i] === '(') {
      depth -= 1;
      if (depth === 0) return text.slice(i);
    }
  }
  return '';
}

// When there is no parseable marker the whole heading is the status region:
// that is the only way `(OPEN`, `[OPEN]`, `(OPEN).` and a trailing `— OPEN`
// can be seen at all. It is also why the three real entries titled "Villagers
// latch on an OPEN cell when buildings move" must keep a trailing group — they
// have one, so only their marker is read.
export function statusRegion(heading: string): string {
  return statusMarker(heading) || heading;
}

export function isOpen(heading: string): boolean {
  return OPEN_MARKER.test(statusMarker(heading));
}

export function classify(heading: string): Verdict {
  if (isOpen(heading)) return 'open';
  return SUSPECT_LIVE.test(statusRegion(heading)) ? 'ambiguous' : 'closed';
}

export function mayBeArchived(heading: string): boolean {
  return classify(heading) === 'closed' && !SUSPECT_ARCHIVED.test(statusRegion(heading));
}

// Two headings that differ only by case, a curly apostrophe, an en-dash for an
// em-dash, a trailing space or a run of spaces are the same entry (review
// finding F4).
export function entryKey(heading: string): string {
  return heading
    .normalize('NFC')
    .replace(/^\s*#+\s*/, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function headingDate(heading: string): string {
  return /^## (\d{4}-\d{2}-\d{2})/.exec(heading)?.[1] ?? '';
}

// The lines the cap check prints, empty exactly when the cap is met — so this
// function decides WHICH entries are named and in what order, and never whether
// the gate is red.
//
// ORDER. The register is written NEWEST-FIRST, so within one date the oldest
// entry is the BOTTOM-most one and carries the HIGHEST line number. Sorting
// same-date entries by ascending line number — what this did until 2026-09-06 —
// named the most recently written entry of that date, the exact opposite of
// what the reader has to move. It was found by an integrator doing a real
// rollover, who ignored the message and used the file's own ordering instead;
// the check only COUNTS closed entries, so it was green either way and nothing
// objected.
//
// PINNED. A closed entry whose marker the ARCHIVE check refuses (`mayBeArchived`
// false) can never leave the active file: moving it turns the archive check red.
// `(PROVEN, fix measured and NOT shipped)` is the standing example and is the
// oldest closed entry in the register today, so a plain oldest-first list names
// it first and sends the reader into a gate that then rejects the move. It is
// named as unmovable instead, and the next entry that IS archivable is named in
// its place. When nothing archivable is left the list still comes back
// non-empty, because the cap is still exceeded and this check must still fail.
export function rolloverMessage(closed: readonly RolloverCandidate[], cap: number): string[] {
  const overflow = Math.max(0, closed.length - cap);
  if (overflow === 0) return [];
  const oldestFirst = [...closed].sort((a, b) => {
    const byDate = headingDate(a.heading).localeCompare(headingDate(b.heading));
    return byDate !== 0 ? byDate : b.line - a.line;
  });
  const lines: string[] = [];
  let moving = 0;
  for (const entry of oldestFirst) {
    if (moving === overflow) break;
    if (mayBeArchived(entry.heading)) {
      moving += 1;
      lines.push(`${ACTIVE}:${entry.line} — MOVE — ${entry.heading.slice(3)}`);
    } else {
      lines.push(
        `${ACTIVE}:${entry.line} — PINNED, leave it where it is: the archive check refuses ${entry.status || 'this heading'} as a closure — ${entry.heading.slice(3)}`,
      );
    }
  }
  if (moving < overflow) {
    lines.push(
      `${ACTIVE} — ${overflow - moving} more closed ${overflow - moving === 1 ? 'entry has' : 'entries have'} to go and every remaining one is PINNED, so no move can meet the cap; close one of them properly, or raise CLOSED_CAP with a reason`,
    );
  }
  return lines;
}
