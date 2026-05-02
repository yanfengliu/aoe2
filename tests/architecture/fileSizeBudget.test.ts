// User memory rule (2026-05-01): every file must stay under 500 LOC. Hard
// rule, not soft target. This test fails when ANY file under `src/` or
// `tests/` exceeds the cap.
//
// To prevent the suite from going red while we work through the existing
// backlog, the current violators are listed in `LEGACY_VIOLATIONS` below
// — these are *known* over-budget files that are tracked toward 0. Adding
// a new file >500 LOC is always a failure; growing an existing exempted
// file past its current size is also a failure (the cap shrinks
// monotonically toward 500).
//
// **Removing entries from the exemption list is a one-way ratchet.** When
// a file lands under 500 LOC it should be deleted from this map; if it
// regresses, that's a hard test failure (not auto-re-added). The list
// must reach 0 before the budget test becomes a strict ≤500-everywhere
// gate; until then the legacy entries pin a deteriorating cap.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const HARD_LIMIT = 500;

const ROOTS = ['src', 'tests'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'generated', 'coverage']);
const FILE_EXTS = ['.ts', '.tsx'];

// Current known-over-budget files keyed by repo-relative POSIX path.
// Each entry is the file's CURRENT line count — the test fails if the
// file exceeds this. To shrink: split the file, drop the entry. To
// regress: the test fails (do not raise the entry).
const LEGACY_VIOLATIONS: Record<string, number> = {
  'src/phaser/scenes/GameScene.ts': 1018,
  'src/game/simulation/bridge/systems/aiSystem.ts': 788,
  'src/game/recording/IndexedDBMirror.ts': 698,
  'src/game/simulation/bridge/wireBridgeOps.ts': 605,
  'src/game/simulation/bridge/unitCommandOps.ts': 588,
  'tests/browser/game-selection.spec.ts': 572,
  'src/game/simulation/fixtures/ai.ts': 565,
  'src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts': 545,
  'tests/browser/game-combat-and-meta.spec.ts': 543,
  'tests/browser/game-simulation-and-exploration.spec.ts': 522,
  'tests/browser/game-hud-and-camera.spec.ts': 506,
  'src/game/simulation/fixtures/combatMatchups/infantryAndCavalry.ts': 505,
  'src/game/simulation/fixtures/ageProgression/imperial/upgrades.ts': 504,
};

function walk(root: string, base = root): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(base)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(base, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(root, full));
    } else if (FILE_EXTS.some((ext) => entry.endsWith(ext))) {
      found.push(full);
    }
  }
  return found;
}

function repoRelative(p: string): string {
  return relative(process.cwd(), p).split('\\').join('/');
}

function lineCount(p: string): number {
  // Count line terminators; final-line-without-newline still counts as a
  // line via the +1 adjustment. Matches `wc -l` semantics for files that
  // end with a newline (the dominant case in this repo).
  const content = readFileSync(p, 'utf8');
  if (content.length === 0) return 0;
  let lines = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') lines += 1;
  }
  if (!content.endsWith('\n')) lines += 1;
  return lines;
}

describe('file-size budget — every file ≤ 500 LOC (user-memory rule)', () => {
  it('no file exceeds the hard limit unless on the legacy list', () => {
    const offenders: Array<{ path: string; lines: number; cap: number }> = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const rel = repoRelative(file);
        const lines = lineCount(file);
        const cap = LEGACY_VIOLATIONS[rel] ?? HARD_LIMIT;
        if (lines > cap) {
          offenders.push({ path: rel, lines, cap });
        }
      }
    }
    if (offenders.length > 0) {
      const lines = offenders
        .sort((a, b) => b.lines - a.lines)
        .map((o) => {
          const reason = o.cap === HARD_LIMIT
            ? `> ${HARD_LIMIT} hard limit`
            : `> ${o.cap} legacy cap (regressed; do not raise)`;
          return `  ${o.path} (${o.lines} lines, ${reason})`;
        })
        .join('\n');
      throw new Error(
        `File-size budget violated:\n${lines}\n\n` +
          'Either split the file under 500 LOC and delete the legacy entry, ' +
          'or shrink it under its existing legacy cap. Legacy caps only ratchet downward.',
      );
    }
    expect(offenders.length).toBe(0);
  });

  it('legacy violations list shrinks toward 0 (no entries above current size)', () => {
    // Catches the inverse: a legacy entry was set higher than the file's
    // ACTUAL current size (someone took the cap UP without thinking). The
    // legacy cap should always be ≥ HARD_LIMIT (otherwise just remove
    // it) AND ≥ actual file size (otherwise the first test would fail
    // anyway, but this gives a clearer signal).
    const inflated: Array<{ path: string; entry: number; actual: number }> = [];
    for (const [rel, entry] of Object.entries(LEGACY_VIOLATIONS)) {
      let actual = 0;
      try {
        actual = lineCount(rel);
      } catch {
        // File deleted but still in list — surface that too.
        inflated.push({ path: rel, entry, actual: -1 });
        continue;
      }
      if (entry > actual + 50 /* slack for tiny growth */) {
        inflated.push({ path: rel, entry, actual });
      }
    }
    if (inflated.length > 0) {
      const lines = inflated
        .map((o) =>
          o.actual === -1
            ? `  ${o.path}: in list but file is gone — remove the entry`
            : `  ${o.path}: cap ${o.entry} >> actual ${o.actual} — lower the cap`,
        )
        .join('\n');
      throw new Error(`Legacy budget entries are inflated:\n${lines}`);
    }
    expect(inflated.length).toBe(0);
  });
});
