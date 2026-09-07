// A comment that says how long something takes must agree with how long it
// takes — the gate for the 2026-09-06 register entry.
//
// WHAT HAPPENED. `ATTACK_WARNING_THROTTLE_TICKS = 400` in
// `src/ui/hud/attackWarning.ts` carried a comment claiming twenty seconds at
// twice this build's rate, and this build runs at ten ticks a second (`TPS` in
// `prototypeScenario.ts`). So the throttle was forty seconds, not twenty, from
// the day the horn shipped, and nothing could see it: a comment is a claim
// about a constant that lives on another line, and no gate read either. Its
// twin sat in a test TITLE, which is why this scans string literals as well as
// comments. A wrong tick rate is exactly the kind of thing that gets copied.
//
// WHAT IT CHECKS, over every `.ts`/`.tsx` file under `src/` and `tests/`:
//
//  1. RATE. Any stated ticks-per-second must be the real one. Shapes:
//     `<n> TPS`, `TPS <n>` / `TPS=<n>` / `TPS:<n>`, and `<n> ticks per second`
//     / `ticks a second` / `ticks/s` / `ticks/sec`.
//  2. TICK PERIOD. Any stated milliseconds-per-tick must be `1000 / TPS`.
//     Shapes: `ticks x <n> ms`, `<n> ms per tick`, `<n> ms a tick`, and
//     `one tick (<n> ms`.
//  3. ARITHMETIC. A text that states one duration AND one rate is read as a
//     claim about a tick count, and the tick count must equal
//     `round(seconds x TPS)`. The tick count is taken from the text itself
//     (`<n> ticks`) when it says one; failing that, from a SCREAMING_CASE
//     identifier the text names and a line below declares; failing that, from
//     the numeric literal on the same line (a trailing comment) or on the next
//     line or two. Bindable forms are `= <n>`, `: <n>` and `toBe(<n>)`.
//
// The rate comes from `TPS` itself, imported from the module that declares it,
// so this cannot drift into being one more comment; test (0) below asserts
// that exactly one file in `src/` declares it.
//
// BOUNDS — what a green run does NOT prove.
//  * It reads TEXT. It cannot tell a true comment from a stale one that names
//    no number, and it says nothing about whether 200 ticks is the right
//    spacing — only that the words and the number agree.
//  * The arithmetic check needs a rate spelled with `TPS` in the same text. A
//    bare duration beside a tick constant, with no rate named, is invisible to
//    it. So is a duration written in words ("twenty seconds").
//  * It skips any text with more than one duration, or with a slash list of
//    numbers before a unit, because the binding would be a guess. Three such
//    texts exist today (`garrisonHealSystem.ts`, and two rows of
//    `researchTables.ts`); they are unchecked, not checked-and-passing.
//  * It also skips a claim with no tick count to bind to — two today
//    (`stepReport.ts`, `bridge-additive-surfaces.test.ts`), where the rate is
//    still checked by (1) but the arithmetic has nothing to compare. Measured
//    on the final tree: 44 arithmetic pairs checked, 5 skipped.
//  * A ms-per-tick figure written with a SLASH is deliberately not checked:
//    in this repo that shape also means measured CPU cost per tick
//    (`spawnPassabilityMemo.ts`, `movementPlanOps.ts`), a different quantity.
//    `scripts/` is out of scope for the same reason — `aiTickRate.mjs` reports
//    wall-clock throughput in ticks/second.
//  * `TPS = <n>` written with spaces around the equals is not read as a rate,
//    because `... at 10 TPS = 4 HP/sec` is an equation, not an assignment.
//  * Comment extraction tracks string and template literals but NOT regex
//    literals, so a regex containing `//` could shift what is scanned. That
//    would show up as a spurious failure, never as a silent pass.
//  * Test (0) is the instrument check: it asserts the scan really read the
//    tree and really found live claims of each kind, so a broken extractor
//    reports red rather than a green over nothing.
//
// NOTE FOR EDITORS: this file's own comments and strings are scanned like
// every other file's — there is no exemption. Name a shape with a placeholder
// (`<n> TPS`), never with a wrong literal rate, or the gate fails on itself.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { TPS } from '../../src/game/simulation/prototypeScenario';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MS_PER_TICK = 1_000 / TPS;

interface Span {
  text: string;
  startLine: number;
  endLine: number;
  trailing: boolean;
  kind: 'line' | 'block' | 'string';
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Comment and string spans. Tracks quotes so a `//` inside a string is code. */
function scanSpans(src: string): Span[] {
  const found: Span[] = [];
  let i = 0;
  let line = 1;
  let codeOnLine = false;
  const n = src.length;
  while (i < n) {
    const c = src[i]!;
    if (c === '\n') { line += 1; codeOnLine = false; i += 1; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      const start = i;
      const startLine = line;
      i += 1;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '\n') { line += 1; if (quote !== '`') break; }
        if (src[i] === quote) { i += 1; break; }
        i += 1;
      }
      found.push({ kind: 'string', text: src.slice(start, i), startLine, endLine: line, trailing: codeOnLine });
      codeOnLine = true;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const start = i;
      while (i < n && src[i] !== '\n') i += 1;
      found.push({ kind: 'line', text: src.slice(start, i), startLine: line, endLine: line, trailing: codeOnLine });
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = i;
      const startLine = line;
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line += 1; i += 1; }
      i += 2;
      found.push({ kind: 'block', text: src.slice(start, Math.min(i, n)), startLine, endLine: line, trailing: codeOnLine });
      continue;
    }
    if (!/\s/.test(c)) codeOnLine = true;
    i += 1;
  }
  return found;
}

/** Consecutive standalone `//` lines are one claim, not several. */
function spans(src: string): Span[] {
  const merged: Span[] = [];
  for (const span of scanSpans(src)) {
    const prev = merged[merged.length - 1];
    if (
      prev && span.kind === 'line' && prev.kind === 'line'
      && !span.trailing && !prev.trailing && span.startLine === prev.endLine + 1
    ) {
      prev.text += ` ${span.text}`;
      prev.endLine = span.endLine;
      continue;
    }
    merged.push({ ...span });
  }
  return merged.map((span) => ({ ...span, text: span.text.replace(/\s+/g, ' ').trim() }));
}

const RATE_SHAPES = [
  /(\d+(?:\.\d+)?)\s*TPS\b/gi,
  /\bTPS\b(?:=|:|\s+)\s*(\d+(?:\.\d+)?)\b/gi,
  /(\d+(?:\.\d+)?)\s*ticks?\s*(?:per|a|\/)\s*(?:seconds?|secs?|s)\b/gi,
];
const PERIOD_SHAPES = [
  /\bticks?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*ms\b/gi,
  /(\d+(?:\.\d+)?)\s*ms\s+(?:per|a)\s+tick\b/gi,
  /\bone tick\s*\(\s*~?\s*(\d+(?:\.\d+)?)\s*ms/gi,
];
const NAMED_RATE = /(\d+(?:\.\d+)?)\s*TPS\b|\bTPS\b(?:=|:|\s+)\s*(\d+(?:\.\d+)?)\b/gi;
const DURATION = /(?<![\d./])(\d+(?:\.\d+)?)\s*(ms|s|secs?|seconds?|minutes?|mins?)(?!\w)/gi;
const SLASH_LIST = /\d+(?:\s*\/\s*\d+)+\s*(?:ms|s|secs?|seconds?)\b/i;
const STATED_TICKS = /(?<![\d.])(\d[\d_]*)\s*ticks?\b/gi;
const SCREAMING = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g;
const UNIT_SECONDS: Record<string, number> = {
  ms: 0.001, s: 1, sec: 1, secs: 1, second: 1, seconds: 1, min: 60, mins: 60, minute: 60, minutes: 60,
};

function declaredNumberOn(line: string): number | null {
  const match = /(?:=|:)\s*(\d[\d_]*)\s*(?:[;,)]|$)/.exec(line) ?? /\btoBe\(\s*(\d[\d_]*)\s*\)/.exec(line);
  return match ? Number(match[1]!.replace(/_/g, '')) : null;
}

interface Claim { where: string; message: string }
interface Report { rateClaims: number; periodClaims: number; checked: number; skipped: number; failures: Claim[] }

function bindTickCount(span: Span, lines: string[], durationAt: number): { value: number; via: string } | null {
  STATED_TICKS.lastIndex = 0;
  const stated = [...span.text.matchAll(STATED_TICKS)].map((m) => Number(m[1]!.replace(/_/g, '')));
  if (stated.length === 1) return { value: stated[0]!, via: 'the tick count stated in the text' };
  if (span.kind === 'string') return null;
  SCREAMING.lastIndex = 0;
  const named = [...span.text.matchAll(SCREAMING)]
    .map((m) => ({ id: m[1]!, at: m.index ?? 0 }))
    .sort((a, b) => (Number(/TICKS?$/.test(b.id)) - Number(/TICKS?$/.test(a.id)))
      || (Math.abs(a.at - durationAt) - Math.abs(b.at - durationAt)));
  for (const { id } of named) {
    for (let j = span.endLine; j < Math.min(lines.length, span.endLine + 8); j += 1) {
      if (!new RegExp(`\\b${id}\\b\\s*(?::[^=]*)?=`).test(lines[j]!)) continue;
      const value = declaredNumberOn(lines[j]!);
      return value === null ? null : { value, via: `${id} on line ${j + 1}` };
    }
  }
  if (span.trailing) {
    const value = declaredNumberOn(lines[span.startLine - 1]!);
    if (value !== null) return { value, via: 'the value on the same line' };
  }
  for (let j = span.endLine; j < Math.min(lines.length, span.endLine + 2); j += 1) {
    const value = declaredNumberOn(lines[j]!);
    if (value !== null) return { value, via: `the value on line ${j + 1}` };
  }
  return null;
}

function inspect(files: string[]): Report {
  const report: Report = { rateClaims: 0, periodClaims: 0, checked: 0, skipped: 0, failures: [] };
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const lines = src.split(/\r?\n/);
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    for (const span of spans(src)) {
      const where = `${rel}:${span.startLine}`;
      for (const shape of RATE_SHAPES) {
        shape.lastIndex = 0;
        let match;
        while ((match = shape.exec(span.text)) !== null) {
          report.rateClaims += 1;
          if (Number(match[1]) !== TPS) {
            report.failures.push({
              where,
              message: `says "${match[0]}", but this build runs at ${TPS} ticks per second`,
            });
          }
        }
      }
      for (const shape of PERIOD_SHAPES) {
        shape.lastIndex = 0;
        let match;
        while ((match = shape.exec(span.text)) !== null) {
          report.periodClaims += 1;
          if (Math.abs(Number(match[1]) - MS_PER_TICK) > 0.5) {
            report.failures.push({
              where,
              message: `says "${match[0]}", but one tick is ${MS_PER_TICK} ms at ${TPS} ticks per second`,
            });
          }
        }
      }
      NAMED_RATE.lastIndex = 0;
      DURATION.lastIndex = 0;
      const rates = [...span.text.matchAll(NAMED_RATE)];
      const durations = [...span.text.matchAll(DURATION)];
      if (rates.length !== 1 || durations.length !== 1 || SLASH_LIST.test(span.text)) {
        if (rates.length === 1 && durations.length >= 1) report.skipped += 1;
        continue;
      }
      const duration = durations[0]!;
      const seconds = Number(duration[1]) * UNIT_SECONDS[duration[2]!.toLowerCase()]!;
      const expected = Math.round(seconds * TPS);
      const bound = bindTickCount(span, lines, duration.index ?? 0);
      if (bound === null) { report.skipped += 1; continue; }
      report.checked += 1;
      if (bound.value !== expected) {
        report.failures.push({
          where,
          message: `says "${duration[0]}", which is ${expected} ticks at ${TPS} ticks per second, `
            + `but ${bound.via} is ${bound.value}`,
        });
      }
    }
  }
  return report;
}

const FILES = walk(join(ROOT, 'src')).concat(walk(join(ROOT, 'tests')));
const REPORT = inspect(FILES);

describe('a stated tick rate agrees with the real one', () => {
  it('(0) the scan read the tree and found live claims of every kind it checks', () => {
    // Without this, a broken extractor passes the three checks below over air.
    expect(FILES.length).toBeGreaterThan(900);
    expect(REPORT.rateClaims).toBeGreaterThan(50);
    expect(REPORT.periodClaims).toBeGreaterThan(0);
    expect(REPORT.checked).toBeGreaterThan(40);
  });

  it('(1) exactly one file declares the rate, so there is one thing to agree with', () => {
    const declaring = walk(join(ROOT, 'src')).filter(
      (file) => /^\s*export const TPS\s*=/m.test(readFileSync(file, 'utf8')),
    );
    expect(declaring.map((file) => relative(ROOT, file).replace(/\\/g, '/'))).toEqual([
      'src/game/simulation/prototypeScenario.ts',
    ]);
    const source = readFileSync(declaring[0]!, 'utf8');
    expect(Number(/export const TPS\s*=\s*(\d+)/.exec(source)![1])).toBe(TPS);
  });

  it('(2) no comment or string states a wrong rate, tick period, or duration', () => {
    const lines = REPORT.failures.map((failure) => `${failure.where}  ${failure.message}`);
    expect(lines, lines.length === 0 ? '' : `${lines.length} tick-rate claim(s) disagree with TPS=${TPS}`)
      .toEqual([]);
  });
});
