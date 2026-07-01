#!/usr/bin/env node
// Playtest CLI: runs runPlaytest with given args, writes bundle + envelope.
// Run via `tsx scripts/playtest.mjs` (set up by the `npm run playtest` script
// in package.json). tsx handles TypeScript module resolution at runtime so
// this .mjs file can import .ts modules directly.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runPlaytest } from '../src/game/playtest/runPlaytest.ts';

function parseArgs(argv) {
  const args = { seed: 'default-seed', maxTicks: 30000, out: 'output/playtests/run' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed') args.seed = argv[++i];
    else if (a === '--max-ticks') args.maxTicks = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--scenario') args.scenario = argv[++i];
    else if (a === '--game-length') args.gameLength = Number(argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv);
// Reject malformed numeric flags early: `Number('abc')` is NaN, which would
// otherwise flow through as a bogus tick count (score timer silently off, or a
// zero-length run). Both must be positive integer tick counts.
for (const [flag, value] of [
  ['--max-ticks', args.maxTicks],
  ['--game-length', args.gameLength],
]) {
  if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
    throw new Error(`${flag} must be a positive integer, got ${value}`);
  }
}
const result = await runPlaytest({
  seed: args.seed,
  maxTicks: args.maxTicks,
  ...(args.scenario ? { scenario: args.scenario } : {}),
  ...(args.gameLength !== undefined ? { gameLength: args.gameLength } : {}),
});

mkdirSync(dirname(args.out), { recursive: true });
// Compact (no `null, 2`): the bundle is a machine-read artifact (SessionReplayer
// / replay:inspect parse it), and pretty-printing a long playtest's bundle
// inflates it ~40% — enough to blow past Node's max string length and throw
// `RangeError: Invalid string length` on JSON.stringify (the corpus smoke hit
// this on its full-length run). Compact keeps it serializable and ~half the size.
writeFileSync(`${args.out}.json`, JSON.stringify(result.bundle));
writeFileSync(`${args.out}.envelope.json`, JSON.stringify(result.envelope, null, 2));

console.log(`stopReason=${result.envelope.stopReason} ticks=${result.envelope.ticksRun}`);
console.log(`bundle: ${args.out}.json`);
console.log(`envelope: ${args.out}.envelope.json`);
