// Folds a CPU profile that scripts/saveFrameRate.mjs --profile recorded into the frame's phases, again, without
// measuring again: for reading an old profile against a changed phase table, or for finding what the table misses.
//
//   node scripts/foldFrameProfile.mjs <file.cpuprofile> [--tree <checkout>] [--heaviest 40]
//
// --tree is the checkout whose build was profiled (default: this one): its dist/assets/*.js.map name the minified
// code, so that build must still be the one in its dist/. --heaviest lists the functions with the most self time
// and the most time with their callees, each by where it was written, which is how a phase is found. The table is
// frameProfileTable.mjs's, which says how to read it.
//
// A command only: nothing imports this file, so it has no guard against being imported (run-directly.mjs is for
// the scripts that are both).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { heaviestFunctions } from './cpuProfileFold.mjs';
import { buildFrameResolver, foldProfileOfBuild, formatPhaseTable } from './frameProfileTable.mjs';

function main() {
  const [file, ...rest] = process.argv.slice(2);
  if (!file || file.startsWith('--')) {
    throw new Error('Usage: node scripts/foldFrameProfile.mjs <file.cpuprofile> [--tree <checkout>] [--heaviest <count>]');
  }
  const valueOf = (flag) => (rest.includes(flag) ? rest[rest.indexOf(flag) + 1] : undefined);
  const tree = resolve(valueOf('--tree') ?? '.');
  const profile = JSON.parse(readFileSync(file, 'utf8'));
  const rowPath = `${file}.row.json`;
  const row = existsSync(rowPath) ? JSON.parse(readFileSync(rowPath, 'utf8')) : null;
  console.log(formatPhaseTable(foldProfileOfBuild(profile, tree), row));
  const heaviest = valueOf('--heaviest');
  if (heaviest !== undefined) {
    const count = Number(heaviest);
    if (!Number.isInteger(count) || count <= 0) throw new Error(`--heaviest is how many functions to list; got "${heaviest}".`);
    const { resolveFrame } = buildFrameResolver(tree);
    const { totalMs, self, inclusive } = heaviestFunctions(profile, resolveFrame, count);
    const print = (title, entries) => {
      console.log(`\n${title} (of ${totalMs.toFixed(0)} ms):`);
      for (const entry of entries) console.log(`  ${(entry.share * 100).toFixed(2).padStart(6)}%  ${entry.label}`);
    };
    print('most self time', self);
    print('most time with callees', inclusive);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
