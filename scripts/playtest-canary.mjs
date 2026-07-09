// playtest-canary: prove the oracles still SEE. For each canary in
// canaries/manifest.json: run an unpatched LLM-free baseline (the declared
// oracle must NOT fire — an always-red oracle cannot measure sensitivity),
// apply the seeded-bug patch on a throwaway branch, rerun, and assert the
// oracle fires. Everything is deterministic and LLM-free (npm run playtest),
// so drills cost no provider quota.
//
// Outcomes per canary (also the manifest stopReason): canary-ok |
// canary-blind | canary-stale | canary-invalid | run-failed. Any non-ok
// outcome exits 1 — a blind or stale canary means the loop's senses degraded
// and fixing that IS the candidate. Rows append to
// output/self-improvement/recursive/passes.jsonl (fleet convention).
//
// Usage: npm run playtest:canary -- [--only <id>] [--seed s]
// Requires a clean worktree on main (patches mutate the tree).

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  assertCanaryManifest,
  buildCanaryManifest,
  canaryOutcome,
  ledgerFiresOracle,
} from '../src/game/playtest/canary.ts';

const useShell = process.platform === 'win32';
const npmBin = useShell ? 'npm.cmd' : 'npm';
const OUT_ROOT = 'output/self-improvement/recursive';

function parseArgs(argv) {
  const args = { only: null, seed: 'aoe2-canary' };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--only') args.only = argv[++i];
    else if (arg === '--seed') args.seed = argv[++i];
    else {
      console.error(`playtest-canary: unknown argument '${arg}'`);
      process.exit(2);
    }
  }
  return args;
}

function git(...gitArgs) {
  return spawnSync('git', gitArgs, { encoding: 'utf8', shell: false });
}

function runNpm(args) {
  const result = spawnSync(npmBin, args, { stdio: 'inherit', shell: useShell });
  return result.status ?? -1;
}

function readLedger(ledgerPath) {
  try {
    return JSON.parse(readFileSync(ledgerPath, 'utf8'));
  } catch {
    return null;
  }
}

// Run playtest + oracle sweep into <dir>; returns true/false for whether the
// expected oracle fired, or null when the run/ledger failed.
function oracleFired(dir, canary, seed) {
  const prefix = join(dir, 'run');
  const playtest = runNpm(['run', 'playtest', '--', '--seed', seed, '--out', prefix, ...(canary.playtestArgs ?? [])]);
  if (playtest !== 0) return null;
  const ledgerPath = join(dir, 'ledger.json');
  const sweep = runNpm(['run', 'playtest:self-improve', '--', '--current', prefix, '--oracles', '--out', ledgerPath]);
  if (sweep !== 0) return null;
  const ledger = readLedger(ledgerPath);
  if (!ledger) return null;
  return ledgerFiresOracle(ledger, canary.expectedOracle);
}

function main() {
  const args = parseArgs(process.argv);
  const manifest = JSON.parse(readFileSync('canaries/manifest.json', 'utf8'));
  assertCanaryManifest(manifest);
  const canaries = manifest.filter((canary) => !args.only || canary.id === args.only);
  if (canaries.length === 0) {
    console.error(`playtest-canary: no canary matches '${args.only}'`);
    process.exit(2);
  }

  const status = git('status', '--porcelain');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (status.stdout.trim() !== '' || branch.stdout.trim() !== 'main') {
    console.error('playtest-canary: requires a clean worktree on main (patches mutate the tree).');
    process.exit(2);
  }

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  let failed = false;

  for (const canary of canaries) {
    const startedAt = new Date().toISOString();
    const drillDir = join(OUT_ROOT, `canary-${canary.id}-${stamp}`);
    mkdirSync(join(drillDir, 'baseline'), { recursive: true });
    mkdirSync(join(drillDir, 'patched'), { recursive: true });

    console.log(`[canary] ${canary.id}: baseline run (unpatched, oracle must stay quiet)`);
    const baselineFired = oracleFired(join(drillDir, 'baseline'), canary, args.seed);

    let applied = false;
    let patchedFired = null;
    if (baselineFired === false) {
      const branchName = `canary/${canary.id}-${stamp}`;
      git('checkout', '-b', branchName);
      const apply = git('apply', canary.patch);
      applied = apply.status === 0;
      if (applied) {
        console.log(`[canary] ${canary.id}: patched run (seeded bug applied, oracle must fire)`);
        patchedFired = oracleFired(join(drillDir, 'patched'), canary, args.seed);
      } else {
        console.error(`[canary] ${canary.id}: patch failed to apply - stale against current source`);
      }
      git('checkout', '--', '.');
      git('checkout', 'main');
      git('branch', '-D', branchName);
    } else {
      // Baseline dirty or failed: outcome decided below; patch never applied.
      applied = true;
    }

    const outcome = canaryOutcome({ applied, baselineFired, patchedFired });
    if (outcome !== 'canary-ok') failed = true;
    console.log(`[canary] ${canary.id}: ${outcome}`);

    const manifestRow = buildCanaryManifest({
      id: `aoe2-canary-${canary.id}-${stamp}`,
      seed: args.seed,
      startedAt,
      completedAt: new Date().toISOString(),
      outcome,
      canaryId: canary.id,
      expectedOracle: canary.expectedOracle,
      baselineFired,
      patchedFired,
      note: canary.note,
      artifacts: [
        { kind: 'canary-baseline', path: join(drillDir, 'baseline', 'ledger.json') },
        { kind: 'canary-patched', path: join(drillDir, 'patched', 'ledger.json') },
        { kind: 'canary-patch', path: canary.patch },
      ].filter((artifact) => artifact.kind === 'canary-patch' || existsSync(artifact.path)),
    });
    appendFileSync(join(OUT_ROOT, 'passes.jsonl'), `${JSON.stringify(manifestRow)}\n`, 'utf8');
  }

  if (failed) {
    console.error('[canary] one or more canaries did not come back ok - the loop\'s senses need attention; fixing that IS the candidate.');
    process.exit(1);
  }
  console.log('[canary] all canaries ok - the oracles still see.');
}

main();
