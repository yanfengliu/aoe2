// playtest-recursive: one bounded pass of the recursive self-improvement loop.
//
//   run (playtest:llm) -> ledger (playtest:self-improve --oracles)
//     -> select fix candidate -> propose (propose-fix --ledger)
//     -> [--apply] applyAndGate on a branch -> rerun -> rerun ledger
//     -> prove-fixed (candidate identity resolved?) -> pass manifest
//
// The FULL loop is the default (2.0 mandatory behavior): propose -> apply +
// gate on a branch -> rerun -> prove. A proven fix leaves a gated branch
// push-ready (never merged automatically) with HEAD left ON that branch for
// inspection/push; an unproven fix reverts the branch and returns to main.
// If the worktree is dirty or off main, the default degrades to proposal-only
// with a warning; explicit --apply hard-fails instead. --propose-only stops
// after the proposal — that outcome is a handoff, not an end state: the
// driving agent then fixes, reruns, and proves the bug class resolved before
// the pass counts as complete.
// Episodic memory: --known-findings defaults to the newest prior ledger.json
// under --out-root when present.
//
// Usage:
//   npm run playtest:recursive -- [--seed s] [--max-ticks n] [--cost-budget usd]
//     [--baseline <run-prefix>] [--known-findings <ledger.json>]
//     [--apply | --propose-only]
//     [--out-root output/self-improvement/recursive] [--reviewer claude|codex]
//
// Outcomes (also the manifest stopReason): no-fix-candidate | proposal-only |
// proposal-failed | apply-failed | gate-failed | fixed-proven | fix-unproven.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { applyAndGate } from '../src/game/playtest/applyAndGate.ts';
import { selectLedgerFixCandidate } from '../src/game/playtest/fixProposalInput.ts';
import { oracleViolationsToImprovementFindings, slugIdPart } from '../src/game/playtest/oracleImprovementFindings.ts';
import { runOracles } from '../src/game/playtest/oracles.ts';
import { repairBundleEndTick } from '../src/game/playtest/bundleEndTick.ts';
import {
  buildRecursivePassManifest,
  proveFixOutcome,
} from '../src/game/playtest/recursivePass.ts';

const useShell = process.platform === 'win32';
const npmBin = useShell ? 'npm.cmd' : 'npm';

export function parseArgs(argv) {
  const args = {
    seed: 'aoe2-prototype',
    maxTicks: 3000,
    costBudget: 5.0,
    baseline: null,
    knownFindings: null,
    // 'auto' = full loop unless the worktree can't take it (degrade to
    // proposal-only with a warning); true = strict --apply (hard-fail);
    // false = --propose-only.
    apply: 'auto',
    outRoot: 'output/self-improvement/recursive',
    reviewer: 'claude',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed') args.seed = argv[++i];
    else if (a === '--max-ticks') args.maxTicks = Number(argv[++i]);
    else if (a === '--cost-budget') args.costBudget = Number(argv[++i]);
    else if (a === '--baseline') args.baseline = argv[++i];
    else if (a === '--known-findings') args.knownFindings = argv[++i];
    else if (a === '--apply') args.apply = true;
    else if (a === '--propose-only') args.apply = false;
    else if (a === '--out-root') args.outRoot = argv[++i];
    else if (a === '--reviewer') args.reviewer = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('playtest-recursive: one bounded recursive self-improvement pass (see file header for flags)');
      process.exit(0);
    } else {
      console.error(`playtest-recursive: unknown argument '${a}'`);
      process.exit(2);
    }
  }
  if (!Number.isInteger(args.maxTicks) || args.maxTicks < 1) {
    console.error(`playtest-recursive: --max-ticks must be a positive integer`);
    process.exit(2);
  }
  return args;
}

// Episodic memory default: the newest prior pass's ledger under outRoot.
// Stamp dirs sort lexicographically (YYYYMMDDHHMMSS-pid); pick the newest
// one that actually produced a ledger.json.
export function defaultKnownFindings(outRoot) {
  let entries;
  try {
    entries = readdirSync(outRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  const stamps = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const stamp of stamps) {
    const ledgerPath = join(outRoot, stamp, 'ledger.json');
    if (existsSync(ledgerPath)) return ledgerPath;
  }
  return null;
}

// The prove rerun spends only what the run left unspent — a pass never
// exceeds --cost-budget. Below the viability floor the rerun is refused:
// an underfunded rerun produces a near-empty bundle with no findings, which
// would false-prove any candidate.
const RERUN_VIABILITY_FLOOR_USD = 0.5;
export function planRerunBudget(costBudgetUsd, runSpendUsd) {
  const remaining = costBudgetUsd - runSpendUsd;
  return remaining >= RERUN_VIABILITY_FLOOR_USD ? remaining : null;
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['pipe', 'inherit', 'pipe'], shell: useShell });
    let stderr = '';
    proc.stderr.on('data', (c) => {
      stderr += c.toString('utf8');
      process.stderr.write(c);
    });
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ exitCode: code ?? -1, stdout: '', stderr }));
    if (options.stdin !== undefined) proc.stdin.write(options.stdin, 'utf8');
    proc.stdin.end();
  });
}

// applyAndGate needs captured stdout for gate diagnostics.
function runCommandCaptured(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], shell: useShell });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => (stdout += c.toString('utf8')));
    proc.stderr.on('data', (c) => (stderr += c.toString('utf8')));
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
    if (options.stdin !== undefined) proc.stdin.write(options.stdin, 'utf8');
    proc.stdin.end();
  });
}

async function gitStdout(args) {
  const r = await runCommandCaptured('git', args);
  return r.exitCode === 0 ? r.stdout.trim() : '';
}

async function cleanupBranch(branchName, baseBranch) {
  const currentBranch = await gitStdout(['rev-parse', '--abbrev-ref', 'HEAD']);
  await runCommandCaptured('git', ['reset', '--hard', 'HEAD']);
  await runCommandCaptured('git', ['clean', '-fd']);
  if (currentBranch !== branchName) return;
  const back = await runCommandCaptured('git', ['checkout', baseBranch]);
  if (back.exitCode !== 0) {
    console.warn(`[recursive] failed to return to ${baseBranch}: ${back.stderr.trim()}`);
    return;
  }
  const drop = await runCommandCaptured('git', ['branch', '-D', branchName]);
  if (drop.exitCode !== 0) {
    console.warn(`[recursive] failed to drop ${branchName}: ${drop.stderr.trim()}`);
  }
}

function readJson(path, label) {
  if (!existsSync(path)) {
    console.error(`[recursive] missing ${label}: ${path}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`[recursive] failed to parse ${label} ${path}: ${err?.message ?? err}`);
    return null;
  }
}

function envelopeCost(prefix) {
  // Silent probe — cost accounting must not print error noise on passes
  // that never produced this envelope (for example proposal-only passes).
  const path = `${prefix}.envelope.json`;
  if (!existsSync(path)) return 0;
  try {
    const cost = JSON.parse(readFileSync(path, 'utf8'))?.totalCostUsd;
    return typeof cost === 'number' && Number.isFinite(cost) ? cost : 0;
  } catch {
    return 0;
  }
}

function rerunOracles(rerunBase) {
  const bundle = readJson(`${rerunBase}.json`, 'rerun bundle');
  const envelope = readJson(`${rerunBase}.envelope.json`, 'rerun envelope');
  if (!bundle || !envelope) return null;
  try {
    repairBundleEndTick(bundle);
    const violations = runOracles(bundle, envelope, {});
    return oracleViolationsToImprovementFindings({ id: 'rerun', bundle, oracleViolations: violations });
  } catch (err) {
    console.warn(`[recursive] oracle evaluation over the rerun failed: ${err?.message ?? err}`);
    return null;
  }
}

// costBudgetUsd is the per-invocation LLM budget: the pass splits its total
// --cost-budget between the run and the rerun so one pass cannot spend 2x.
async function runPlaytest(args, outBase, costBudgetUsd, extraFlags = []) {
  const envelopePath = `${outBase}.envelope.json`;
  if (existsSync(envelopePath)) rmSync(envelopePath, { force: true });
  const r = await runCommand(npmBin, [
    'run', 'playtest:llm', '--',
    '--seed', args.seed,
    '--max-ticks', String(args.maxTicks),
    '--cost-budget', costBudgetUsd.toFixed(2),
    '--out', outBase,
    ...extraFlags,
  ]);
  return r.exitCode === 0 && existsSync(envelopePath);
}

async function buildLedger(currentPrefix, baselinePrefix, outPath) {
  const flags = ['run', 'playtest:self-improve', '--', '--current', currentPrefix, '--oracles', '--out', outPath];
  if (baselinePrefix) flags.push('--baseline', baselinePrefix);
  const r = await runCommand(npmBin, flags);
  return r.exitCode === 0 ? readJson(outPath, 'ledger') : null;
}

async function main() {
  const args = parseArgs(process.argv);
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const safeSeed = args.seed.replace(/[^A-Za-z0-9._-]+/g, '-');
  const stamp = `${startedAt.replace(/[-:TZ.]/g, '').slice(0, 14)}-${process.pid}`;
  const passId = `recursive-${safeSeed}-${stamp}`;
  const passDir = join(args.outRoot, stamp);
  const runBase = join(passDir, 'run');
  const rerunBase = join(passDir, 'rerun');
  const ledgerPath = join(passDir, 'ledger.json');
  const rerunLedgerPath = join(passDir, 'rerun-ledger.json');
  const proposalRoot = join(passDir, 'fix-proposals');
  mkdirSync(passDir, { recursive: true });

  const artifacts = [];
  const gates = [];
  let branchName;
  let candidate = null;

  const finish = async (outcome, exitCode) => {
    const completedAtMs = Date.now();
    const manifest = buildRecursivePassManifest({
      id: passId,
      seed: args.seed,
      startedAt,
      completedAt: new Date(completedAtMs).toISOString(),
      gitCommit: await gitStdout(['rev-parse', '--short', 'HEAD']),
      reviewer: args.reviewer,
      // Envelope-metered playtest cost only — the propose-fix CLI call runs
      // on subscription auth and is not metered here.
      costUsd: envelopeCost(runBase) + envelopeCost(rerunBase),
      durationMs: completedAtMs - startedAtMs,
      outcome,
      ...(candidate ? { candidateFindingId: candidate.findingId } : {}),
      ...(branchName !== undefined ? { branchName } : {}),
      artifacts,
      ...(gates.length > 0 ? { gates } : {}),
    });
    const manifestPath = join(passDir, 'pass-manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    // Fleet convention: one compact row per pass appends to <outRoot>/passes.jsonl
    // (same object as the per-pass manifest) so cross-repo tooling and the
    // loop-ops shift runner read aoe2 like every other repo.
    appendFileSync(join(args.outRoot, 'passes.jsonl'), `${JSON.stringify(manifest)}\n`);
    console.log(`[recursive] outcome=${outcome} manifest=${manifestPath}`);
    process.exit(exitCode);
  };

  // 1. Current run (with episodic memory: explicit --known-findings, else the
  // newest prior ledger under outRoot). The pass budget covers run + rerun:
  // the run gets half up front, the rerun gets whatever the run left unspent.
  if (!args.knownFindings) {
    const priorLedger = defaultKnownFindings(args.outRoot);
    if (priorLedger) {
      args.knownFindings = priorLedger;
      console.log(`[recursive] episodic memory: ${priorLedger}`);
    }
  }
  const runBudget = args.apply !== false ? args.costBudget / 2 : args.costBudget;
  const knownFlags = args.knownFindings ? ['--known-findings', args.knownFindings] : [];
  if (!(await runPlaytest(args, runBase, runBudget, knownFlags))) {
    console.error('[recursive] playtest run failed or produced no envelope');
    return finish('proposal-failed', 1);
  }
  artifacts.push(
    { kind: 'bundle', path: `${runBase}.json` },
    { kind: 'envelope', path: `${runBase}.envelope.json` },
    { kind: 'trace', path: `${runBase}.llm-trace.jsonl` },
  );

  // 2. Ledger over the run (deterministic oracles + any marker findings).
  const ledger = await buildLedger(runBase, args.baseline, ledgerPath);
  if (!ledger) await finish('proposal-failed', 1);
  artifacts.push({ kind: 'ledger', path: ledgerPath });

  // 3. Fix candidate.
  candidate = selectLedgerFixCandidate(ledger);
  if (!candidate) {
    console.log('[recursive] no fix-classified finding in the ledger — nothing to fix this pass');
    return finish('no-fix-candidate', 0);
  }
  console.log(`[recursive] fix candidate: ${candidate.findingId} (${candidate.violation.oracle})`);

  // 4. Proposal.
  const propose = await runCommand(npmBin, [
    'run', 'propose-fix', '--',
    '--ledger', ledgerPath,
    '--finding-id', candidate.findingId,
    '--reviewer', args.reviewer,
    '--proposal-root', proposalRoot,
  ]);
  const proposalDiffPath = join(proposalRoot, basename(candidate.prefix), slugIdPart(candidate.violation.oracle), 'proposal.diff');
  if (propose.exitCode !== 0 || !existsSync(proposalDiffPath)) {
    console.error('[recursive] propose-fix produced no proposal.diff');
    return finish('proposal-failed', 1);
  }
  artifacts.push({ kind: 'proposal', path: proposalDiffPath });
  const patch = readFileSync(proposalDiffPath, 'utf8');
  if (patch.trim().length < 10) await finish('proposal-failed', 1);

  if (args.apply === false) {
    console.log('[recursive] proposal-only pass complete — this is a handoff: fix (or rerun without --propose-only), rerun, and prove before calling it done');
    return finish('proposal-only', 0);
  }

  // 5. Apply + gate on a branch (clean main worktree required, like auto-fix).
  // Under the full-loop default ('auto'), an unusable worktree degrades to
  // proposal-only with a warning; explicit --apply hard-fails instead.
  const dirty = await gitStdout(['status', '--porcelain']);
  const baseBranch = await gitStdout(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (dirty !== '' || baseBranch !== 'main') {
    if (args.apply === 'auto') {
      console.warn('[recursive] worktree dirty or off main — degrading to proposal-only (pass --apply to hard-fail instead)');
      return finish('proposal-only', 0);
    }
    console.error('[recursive] --apply requires a clean worktree on main');
    return finish('apply-failed', 1);
  }
  branchName = `recursive/${safeSeed}-${stamp}`;
  const gateSpecs = [
    { name: 'typecheck', cmd: npmBin, args: ['run', 'typecheck'] },
    { name: 'lint', cmd: npmBin, args: ['run', 'lint'] },
    { name: 'build', cmd: npmBin, args: ['run', 'build'] },
    { name: 'test', cmd: npmBin, args: ['test'] },
  ];
  const gateResult = await applyAndGate({
    patch,
    branchName,
    commitMessage: `recursive-fix: ${candidate.violation.oracle} (${candidate.findingId})`,
    runFn: runCommandCaptured,
    gates: gateSpecs.map(({ cmd, args: gateArgs }) => ({ cmd, args: gateArgs })),
  });
  if (gateResult.kind !== 'success') {
    const outcome = gateResult.kind === 'gate-failed' ? 'gate-failed' : 'apply-failed';
    if (gateResult.kind === 'gate-failed') {
      const failed = gateSpecs.find((g) => g.args.join(' ') === gateResult.gateThatFailed.args.join(' '));
      gates.push({ name: failed?.name ?? 'unknown', ok: false, detail: gateResult.result.stderr.slice(0, 300) });
    }
    console.error(`[recursive] ${gateResult.kind}: ${'message' in gateResult ? gateResult.message : ''}`);
    await cleanupBranch(branchName, baseBranch || 'main');
    return finish(outcome, 1);
  }
  gates.push(...gateSpecs.map(({ name }) => ({ name, ok: true })));
  console.log(`[recursive] fix applied and gated on ${branchName} (${gateResult.sha.slice(0, 8)})`);

  // 6. Rerun the same scenario on the fixed branch and prove the fix.
  const rerunBudget = planRerunBudget(args.costBudget, envelopeCost(runBase));
  if (rerunBudget === null) {
    console.error('[recursive] cost budget exhausted before the prove rerun — treating the fix as unproven');
    await cleanupBranch(branchName, baseBranch || 'main');
    return finish('fix-unproven', 1);
  }
  if (!(await runPlaytest(args, rerunBase, rerunBudget))) {
    console.error('[recursive] rerun failed — treating the fix as unproven');
    await cleanupBranch(branchName, baseBranch || 'main');
    return finish('fix-unproven', 1);
  }
  artifacts.push(
    { kind: 'rerun-bundle', path: `${rerunBase}.json` },
    { kind: 'rerun-envelope', path: `${rerunBase}.envelope.json` },
  );
  const rerunLedger = await buildLedger(rerunBase, runBase, rerunLedgerPath);
  if (!rerunLedger) {
    await cleanupBranch(branchName, baseBranch || 'main');
    return finish('fix-unproven', 1);
  }
  artifacts.push({ kind: 'rerun-ledger', path: rerunLedgerPath });

  // Prove-fixed must not trust the ledger's finding-source priority: when the
  // rerun's LLM emits marker findings, oracle violations are shadowed out of
  // the ledger and an oracle-identity candidate would look trivially resolved.
  // Re-run the oracles over the rerun bundle directly and judge the candidate
  // against the UNION of ledger findings and fresh oracle findings.
  const rerunOracleFindings = rerunOracles(rerunBase);
  if (rerunOracleFindings === null) {
    console.error('[recursive] could not evaluate oracles over the rerun — treating the fix as unproven');
    await cleanupBranch(branchName, baseBranch || 'main');
    return finish('fix-unproven', 1);
  }
  // M6-#6: a fix is only PROVEN if the rerun actually exercised the game — its
  // replay self-check passed AND it reached a genuine horizon (maxTicks/stopWhen,
  // not a costBudget/providerError/engineHalt early death). Otherwise the absence
  // of the candidate violation is meaningless (the rerun never reached the tick
  // where the bug manifests).
  const rerunVerified = rerunLedger.verification?.current?.ok === true;
  const rerunStopReason = rerunLedger.current?.stopReason;
  const rerunReachedHorizon =
    rerunStopReason === 'maxTicks' || rerunStopReason === 'stopWhen';
  if (!rerunVerified || !rerunReachedHorizon) {
    console.error(
      `[recursive] rerun did not qualify for prove-fixed `
        + `(verified=${rerunVerified}, stopReason=${rerunStopReason}) — treating as unproven`,
    );
    await cleanupBranch(branchName, baseBranch || 'main');
    return finish('fix-unproven', 1);
  }
  const outcome = proveFixOutcome({
    candidateOracle: candidate.violation.oracle,
    candidateFinding: candidate.finding.finding,
    ledgerFindings: (rerunLedger.findings ?? []).map((entry) => entry.finding),
    oracleFindings: rerunOracleFindings,
    rerunVerified,
    rerunReachedHorizon,
  });
  if (outcome === 'fixed-proven') {
    console.log(`[recursive] fix PROVEN — ${candidate.findingId} is resolved in the rerun ledger`);
    console.log(`[recursive] branch ${branchName} is push-ready: git push origin ${branchName}`);
    return finish('fixed-proven', 0);
  }
  console.log('[recursive] fix UNPROVEN — candidate identity persists in the rerun; reverting branch');
  await cleanupBranch(branchName, baseBranch || 'main');
  return finish('fix-unproven', 1);
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(`[recursive] fatal: ${err?.stack ?? err}`);
    process.exit(1);
  });
}
