import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLACEMENT_REFUSAL_KINDS } from '../../src/game/simulation/handlers/building/placementRefusal';

// GATE (work 148 M3a, plan 148): every sentence that answers a refused
// placement or a cancelled building site is written by one module,
// src/game/simulation/handlers/building/placementRefusal.ts, which also reads
// its kind back. The HUD shows the player one short sentence per kind, and a
// sentence it cannot place falls back to "Building site obstructed.", so a
// refusal written anywhere else, or reworded where it is written, would read
// as that fallback and nobody would see it. Here it fails instead.
//
// Four checks. (1) No other file under src/ holds the words a refusal opens
// with or a cancellation turns on. (2) The three placement codes are returned
// by the validator alone, each with a message the module built. (3) The
// builders' cancellation queues nothing but the module's sentence. (4) Every
// kind the module lists is written by one of those two producers, so the
// list, the producers and the HUD's table (typed by kind) hold the same set.
//
// Bound: LEXICAL, comments stripped. A sentence assembled at run time from
// pieces, a refusal queued under a new code with words of its own, or a
// producer that reaches the toast queue by another route is not seen here;
// tests/simulation/placementRefusalKinds.test.ts reads what the live
// producers actually queue.

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const MODULE = 'src/game/simulation/handlers/building/placementRefusal.ts';
const VALIDATOR = 'src/game/simulation/handlers/building/buildingPlaceConfirmValidator.ts';
const CANCELLATION = 'src/game/simulation/bridge/foundationStart.ts';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Source text without its comments (strings holding `//` are rare enough here
 *  that a URL-shaped literal is kept by the lookbehind). */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(?<![:'"`])\/\/.*$/gm, '');
}

const files = sourceFiles(SRC).map((path) => ({
  name: relative(ROOT, path).replace(/\\/g, '/'),
  text: code(path),
}));
const textOf = (name: string): string => {
  const file = files.find((entry) => entry.name === name);
  if (!file) throw new Error(`${name} is gone: this gate reads it`);
  return file.text;
};

const builderCall = (kind: string): string => (
  /^[a-z]+$/.test(kind) ? `placementRefusalReason.${kind}(` : `placementRefusalReason['${kind}'](`
);

describe('placement refusals are written by one module (work 148 M3a)', () => {
  it('no other file writes how a refusal opens or a cancellation turns', () => {
    const writers = files
      .filter((file) => file.name !== MODULE)
      .filter((file) => /Placement blocked for|was cancelled: its builders/.test(file.text))
      .map((file) => file.name);
    expect(writers).toEqual([]);
    // The check is not vacuous: the module itself holds both.
    expect(textOf(MODULE)).toMatch(/Placement blocked for/);
    expect(textOf(MODULE)).toMatch(/was cancelled: its builders/);
  });

  it('the placement codes are returned by the validator alone, each with the module\'s sentence', () => {
    // Two patterns: a global one keeps its place between calls, so it counts and never tests.
    const returns = /code: 'placement_[a-z]+'/;
    const returned = /code: 'placement_[a-z]+'/g;
    const elsewhere = files
      .filter((file) => file.name !== VALIDATOR && returns.test(file.text))
      .map((file) => file.name);
    expect(elsewhere).toEqual([]);
    const validator = textOf(VALIDATOR);
    const codes = validator.match(returned) ?? [];
    const withSentence = validator.match(/code: 'placement_[a-z]+',\s*message: placementRefusalReason[.[]/g) ?? [];
    expect(codes.length).toBeGreaterThanOrEqual(5);
    expect(withSentence.length, 'a placement code is returned with a message the module did not build').toBe(codes.length);
  });

  it('the builders\' cancellation queues the module\'s sentence and no other', () => {
    const cancellation = textOf(CANCELLATION);
    const queued = cancellation.match(/enqueueRejection\(/g) ?? [];
    const fromModule = cancellation.match(/enqueueRejection\(placementRefusalReason\['site-cancelled'\]\(/g) ?? [];
    // One is the dependency's declaration, `enqueueRejection(message: string): void`.
    expect(queued.length).toBe(fromModule.length + 1);
    expect(fromModule.length).toBe(1);
  });

  it('every kind the module lists is written by a producer', () => {
    const producers = textOf(VALIDATOR) + textOf(CANCELLATION);
    const unwritten = PLACEMENT_REFUSAL_KINDS.filter((kind) => !producers.includes(builderCall(kind)));
    expect(unwritten).toEqual([]);
    // And the producers call no builder the list does not hold.
    const called = [...producers.matchAll(/placementRefusalReason(?:\.([a-z]+)|\['([a-z-]+)'\])\(/g)]
      .map((match) => match[1] ?? match[2]!);
    expect(called.filter((kind) => !(PLACEMENT_REFUSAL_KINDS as readonly string[]).includes(kind))).toEqual([]);
    expect(called).toHaveLength(PLACEMENT_REFUSAL_KINDS.length);
  });
});
