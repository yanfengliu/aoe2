import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// GATE (register 2026-09-24, "an ally's base is lit but empty"): no
// human-perspective question — what is drawn, remembered, clickable, animated —
// is asked of the human's OWN vision alone. The human sees through its sight:
// its own vision plus every owner it shares vision with
// (`src/game/simulation/bridge/humanSight.ts`). The defect this retires was
// twelve call sites that each passed `humanPlayerId` straight to the visibility
// map; the frame's lit cells took the union while the entity filter did not,
// so an ally's base was lit and empty.
//
// Bound: this is LEXICAL. It refuses the shape the defect had — the human's id
// passed as the owner argument of `isVisible` / `isExplored` /
// `isFootprintVisible` / `isFootprintExplored` / `isVisibleToOwner` /
// `isCellVisibleToOwner` / `isCellVisibleForOwner`, or tested against a witness
// list — anywhere under `src/`. It does NOT see the same single owner reached
// through another name (`const me = humanPlayerId`, a `playerId` parameter, the
// id handed to a helper that asks for it), which is how the projector's
// animation filters were written. Those are held behaviourally:
// `tests/simulation/sharedVisionEntities.test.ts` (drawn, remembered,
// clickable, right-click), `tests/simulation/sharedSightAnimations.test.ts`
// (swings and deaths), `tests/replay/makeReplayBridge.sharedSight.test.ts`
// (replay), and the witness filters take a sight LIST, so a lone id does not
// typecheck.

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const HUMAN = String.raw`(?:humanPlayerId|HUMAN_PLAYER_ID)`;

const FORBIDDEN: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  {
    name: 'visibility map asked about the human alone',
    pattern: new RegExp(
      String.raw`\b(?:isVisible|isExplored|isVisibleToOwner|isCellVisibleToOwner|isCellVisibleForOwner)\(\s*${HUMAN}\b`,
      'g',
    ),
  },
  {
    name: 'footprint visibility asked about the human alone',
    pattern: new RegExp(
      String.raw`\b(?:isFootprintVisible|isFootprintExplored)\(\s*[\w.]+\s*,\s*${HUMAN}\b`,
      'g',
    ),
  },
  {
    name: 'witness list checked for the human alone',
    pattern: new RegExp(String.raw`\bwitnessedBy\.includes\(\s*${HUMAN}\b`, 'g'),
  },
];

// The first five are verbatim from the unfixed tree (5309eeaf); the rest are
// the shapes the widened patterns add (the owner-query helpers and a witness
// list checked for the human), which that tree did not contain. Each must be
// refused, or the scan below proves nothing.
const KNOWN_BAD: readonly string[] = [
  '&& visibility.isVisible(humanPlayerId, x, y)',
  'if (!visibility.isVisible(humanPlayerId, position.x, position.y)) {',
  '|| isFootprintVisible(\n      visibility,\n      humanPlayerId,\n      entity.x,',
  'const isExplored = isFootprintExplored(\n        visibility,\n        humanPlayerId,',
  'return owner === humanPlayerId || visibility.isVisible(humanPlayerId, position.x, position.y);',
  'if (!isVisibleToOwner(HUMAN_PLAYER_ID, x, y)) continue;',
  'isCellVisibleToOwner(humanPlayerId, x, y)',
  'bridge.isCellVisibleForOwner(HUMAN_PLAYER_ID, x, y)',
  '&& death.witnessedBy.includes(humanPlayerId)',
];

function offencesIn(text: string): Array<{ name: string; index: number; match: string }> {
  const found: Array<{ name: string; index: number; match: string }> = [];
  for (const { name, pattern } of FORBIDDEN) {
    for (const match of text.matchAll(pattern)) {
      found.push({ name, index: match.index ?? 0, match: match[0] });
    }
  }
  return found;
}

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(?:ts|tsx|mjs|js)$/.test(name)) files.push(path);
  }
  return files;
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

describe('human-perspective visibility goes through the human’s sight', () => {
  it('scans a real tree (non-vacuous)', () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(200);
    const sight = readFileSync(join(SRC, 'game/simulation/bridge/humanSight.ts'), 'utf8');
    expect(sight).toContain('export function isFootprintSeen');
  });

  it('refuses every known shape of the defect (positive control)', () => {
    const missed = KNOWN_BAD.filter((snippet) => offencesIn(snippet).length === 0);
    expect(missed).toEqual([]);
    // ...and does not refuse the shapes the fix uses.
    expect(offencesIn('isCellSeen(visibility, readSightOwners(accessor, humanPlayerId), x, y)')).toEqual([]);
    expect(offencesIn('return owner === humanPlayerId')).toEqual([]);
  });

  it('never asks the visibility map about the human’s own vision alone', () => {
    const offences: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const { name, index, match } of offencesIn(text)) {
        offences.push(
          `${relative(ROOT, file).replaceAll('\\', '/')}:${lineOf(text, index)} ${name}: `
          + `"${match.replace(/\s+/g, ' ')}" — ask through humanSight.ts `
          + '(isCellSeen / isFootprintSeen / isFootprintKnown / isWitnessedBySight with readSightOwners)',
        );
      }
    }
    expect(offences).toEqual([]);
  });
});
