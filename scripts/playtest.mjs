#!/usr/bin/env node
// Playtest CLI: runs runPlaytest with given args, writes bundle + envelope.
// Requires Node >=22.6.0 (uses --experimental-strip-types for .ts imports).

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
  }
  return args;
}

const args = parseArgs(process.argv);
const result = await runPlaytest({
  seed: args.seed,
  maxTicks: args.maxTicks,
  ...(args.scenario ? { scenario: args.scenario } : {}),
});

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(`${args.out}.json`, JSON.stringify(result.bundle, null, 2));
writeFileSync(`${args.out}.envelope.json`, JSON.stringify(result.envelope, null, 2));

console.log(`stopReason=${result.envelope.stopReason} ticks=${result.envelope.ticksRun}`);
console.log(`bundle: ${args.out}.json`);
console.log(`envelope: ${args.out}.envelope.json`);
