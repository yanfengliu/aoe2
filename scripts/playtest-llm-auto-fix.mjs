#!/usr/bin/env node
// Phase-6.E (auto-apply + counterfactual fix-validation).
//
// Wraps `playtest:llm` with an auto-fix loop:
//   1. Run the playtest.
//   2. If the run halted (engineHalt),
//      prompt the configured LlmProvider for a unified-diff fix using
//      the bundle/envelope/trace as context.
//   3. Call `applyAndGate` to validate + apply the diff on a fresh
//      branch + run all 4 repository gates (typecheck / lint / build /
//      tests). On any gate failure, hard-revert the worktree.
//   4. On all-green gates, run an N=3 (default) counterfactual: re-run
//      the LLM playtest on the SAME seed N times. If any of N halts,
//      revert the branch (the fix didn't actually resolve the
//      regression). If all-green, leave the branch ready for manual
//      `git push origin auto-fix/<run-stamp>` + draft-PR creation.
//
// Off by default — operator must explicitly invoke
// `npm run playtest:llm-auto-fix`. Counterfactual sampling acknowledges
// LLM non-determinism (temperature 0 still drifts run-to-run); a
// single counterfactual halt is enough to reject the fix.
//
// Run via `tsx scripts/playtest-llm-auto-fix.mjs` (set up by
// `npm run playtest:llm-auto-fix`).
//
// CLI:
//   --seed <s>                  default 'aoe2-prototype'
//   --max-ticks <n>             default 5000
//   --counterfactual-samples N  default 3
//   --branch <name>             default 'auto-fix/<seed>-<HHMMSS>'
//   --skip-counterfactual       skip the N-sample re-run
//                               (useful for the propose-only flow)
//   (forwards remaining flags to playtest-llm.mjs)

import { writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { applyAndGate } from '../src/game/playtest/applyAndGate.ts';
import {
  AnthropicProvider,
  ClaudeCodeProvider,
  resolveClaudeBinary,
} from '../src/game/playtest/llmProviders/index.ts';

function parseArgs(argv) {
  const args = {
    seed: 'aoe2-prototype',
    maxTicks: 5000,
    counterfactualSamples: 3,
    branch: null,
    skipCounterfactual: false,
    extraFlags: [],
  };
  const known = new Set([
    '--seed',
    '--max-ticks',
    '--counterfactual-samples',
    '--branch',
    '--skip-counterfactual',
  ]);
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed') args.seed = argv[++i];
    else if (a === '--max-ticks') args.maxTicks = Number(argv[++i]);
    else if (a === '--counterfactual-samples') args.counterfactualSamples = Number(argv[++i]);
    else if (a === '--branch') args.branch = argv[++i];
    else if (a === '--skip-counterfactual') args.skipCounterfactual = true;
    else if (a.startsWith('--')) {
      // Forward the unknown flag (and its arg if there is one — best effort).
      args.extraFlags.push(a);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args.extraFlags.push(next);
        i += 1;
      }
    }
  }
  if (!args.branch) {
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 14); // YYYYMMDDHHMMSS
    args.branch = `auto-fix/${args.seed}-${stamp}`;
  }
  return args;
}

const useShell = process.platform === 'win32';
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// Provider precedence matches `playtest-llm.mjs` (Claude impl-1 H3):
// claude-code first, API second. Auto-fix runs the LLM 4× per
// invocation (baseline + 3 counterfactual + the diff proposal); the
// cost concern is identical to playtest-llm's. Subscription users
// should not get billed for auto-fix when their playtest:llm goes
// through claude-code.
function selectProvider() {
  const resolved = resolveClaudeBinary('claude');
  if (resolved !== null) {
    console.log('[auto-fix] provider: claude-code (subscription auth via `claude` CLI)');
    return new ClaudeCodeProvider();
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    console.log('[auto-fix] provider: api (Anthropic SDK with API key)');
    return new AnthropicProvider();
  }
  console.error('[auto-fix] no LLM provider available — install Claude Code or set ANTHROPIC_API_KEY');
  process.exit(2);
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: useShell,
    });
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

async function runPlaytestLlm(seed, maxTicks, outBase, extraFlags) {
  console.log(`[auto-fix] running playtest:llm — seed=${seed}, maxTicks=${maxTicks}`);
  // Codex impl-3 HIGH: delete any pre-existing envelope at this
  // outBase before invoking playtest:llm. If the child crashes before
  // writing a fresh envelope, readEnvelope will return null instead
  // of silently re-using a stale envelope from a previous invocation
  // (which would lead to false validation results in the
  // counterfactual loop).
  const envelopePath = `${outBase}.envelope.json`;
  if (existsSync(envelopePath)) {
    try {
      rmSync(envelopePath);
    } catch (err) {
      console.warn(`[auto-fix] failed to remove stale envelope ${envelopePath}: ${err?.message ?? err}`);
    }
  }
  const args = [
    'run', 'playtest:llm', '--',
    '--seed', seed,
    '--max-ticks', String(maxTicks),
    '--out', outBase,
    ...extraFlags,
  ];
  const r = await runCommand(npmBin, args);
  if (r.exitCode !== 0) {
    console.error(`[auto-fix] playtest:llm exit ${r.exitCode}: ${r.stderr.slice(0, 500)}`);
  }
  return r;
}

function readEnvelope(outBase) {
  const path = `${outBase}.envelope.json`;
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.warn(`[auto-fix] envelope parse failed: ${err?.message ?? err}`);
    return null;
  }
}

function detectRegression(envelope) {
  if (!envelope) return { regressed: true, reason: 'envelope missing' };
  if (envelope.stopReason === 'engineHalt') {
    return { regressed: true, reason: `engineHalt: ${envelope.errorMessage ?? ''}`.slice(0, 500) };
  }
  // Option C (2026-06-10): visual baselines removed — a stochastic
  // player has no "correct" reference image, so engineHalt (plus the
  // missing-envelope case above) is the sole regression trigger.
  return { regressed: false, reason: 'clean run' };
}

const FIX_PROPOSAL_SYSTEM_PROMPT = `You are an automated fix-bot for the AoE2 prototype playtest harness. A run halted with a regression. Your job: call \`submit_fix_diff\` with a unified-diff patch (paths relative to the repo root) that fixes the underlying bug. Constraints:
- Patch must apply cleanly via 'git apply --check'.
- Touch the minimum surface needed to fix the regression.
- Keep changes mechanical — no refactoring, no scope creep.
- If you cannot identify a fix from the provided context, call submit_fix_diff with an empty string for diff — the caller will surface that as "no proposal" rather than apply garbage.`;

// Codex impl-1 H3: use a tool, not free-form text. ClaudeCodeProvider
// schema-constrains the response to {thought, toolCalls[]}; raw-text
// diff output is impossible there. Anthropic SDK handles tool_use the
// same way. The tool keeps the surface uniform across providers.
async function proposeFix(provider, regressionContext) {
  const userText = `# Regression context\n\n${regressionContext}\n\nCall submit_fix_diff with the unified-diff patch that fixes this regression.`;
  const result = await provider.call({
    model: 'claude-opus-4-8',
    systemPrompt: FIX_PROPOSAL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
    tools: [
      {
        name: 'submit_fix_diff',
        description:
          'Submit a unified-diff patch that fixes the regression. The diff must apply cleanly via git apply.',
        inputSchema: {
          type: 'object',
          properties: {
            diff: {
              type: 'string',
              description:
                'Unified-diff text. Empty string indicates no fix could be identified from the available context.',
            },
          },
          required: ['diff'],
        },
      },
    ],
    maxOutputTokens: 4096,
  });
  let diff = '';
  for (const block of result.content) {
    if (block.type === 'tool_use' && block.toolName === 'submit_fix_diff') {
      const v = block.toolInput?.diff;
      if (typeof v === 'string') diff = v;
      break;
    }
  }
  return { diff: diff.trim(), tokensIn: result.tokensIn, tokensOut: result.tokensOut, costUsd: result.costUsd };
}

// Codex impl-1 M2: guard against a null/missing envelope. The
// orchestrator's regression path can be hit when the playtest crashes
// before writing the envelope; building context from null would throw
// and the operator never sees the actual triage data.
function buildRegressionContext(envelope) {
  if (envelope == null) {
    return 'No envelope was written by playtest:llm; the harness crashed before scoring. Manual triage required — check the script stderr/process output for the underlying cause.';
  }
  const lines = [
    `Seed: ${envelope.seed ?? '(unknown)'}`,
    `Stop reason: ${envelope.stopReason}`,
    `Ticks run: ${envelope.ticksRun ?? 0}`,
    `Decisions: ${envelope.decisionsRun ?? 0}`,
    `Total cost: $${(envelope.totalCostUsd ?? 0).toFixed(4)}`,
  ];
  if (envelope.errorMessage) lines.push(`Error: ${envelope.errorMessage}`);
  return lines.join('\n');
}

// Claude impl-1 H1 + Codex impl-2 H1/H2: unified cleanup that returns
// the worktree to its pre-auto-fix state. Used on every error path.
//
// Branch ownership: only delete the auto-fix branch if HEAD is
// currently ON it (we created it via `git checkout -b`). If branch
// creation failed (e.g. "branch already exists"), HEAD never moved
// and `git branch -D` would delete a pre-existing branch we don't
// own — so we skip the deletion.
//
// Index/worktree reset: `git reset --hard HEAD` resets BOTH the index
// AND the worktree to HEAD. Without `--hard`, a staged-but-not-
// committed patch (the post-`git add -A`-pre-commit-failure case)
// would survive checkout and be carried back to baseBranch. Plus
// `git clean -fd` for any untracked files the patch added before
// staging.
async function cleanupBranch(branchName, baseBranch) {
  const currentRef = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const currentBranch = currentRef.stdout.trim();
  if (currentBranch !== branchName) {
    console.log(
      `[auto-fix] cleanup: HEAD is on '${currentBranch}', not '${branchName}'; `
        + `leaving any pre-existing branch with that name alone.`,
    );
    // Still discard any in-progress staging/worktree state from the
    // failed attempt, since something might have run before the
    // branch creation failed.
    await runCommand('git', ['reset', '--hard', 'HEAD']);
    await runCommand('git', ['clean', '-fd']);
    return;
  }
  console.log(`[auto-fix] cleaning up branch ${branchName} (returning to ${baseBranch})…`);
  // Reset BOTH index and worktree to HEAD before switching, so any
  // staged patch from a failed commit doesn't bleed onto baseBranch.
  await runCommand('git', ['reset', '--hard', 'HEAD']);
  await runCommand('git', ['clean', '-fd']);
  const back = await runCommand('git', ['checkout', baseBranch]);
  if (back.exitCode !== 0) {
    console.warn(`[auto-fix] failed to return to ${baseBranch}: ${back.stderr.trim()}`);
    return;
  }
  // Drop the auto-fix branch. -D forces delete even if not merged.
  const drop = await runCommand('git', ['branch', '-D', branchName]);
  if (drop.exitCode !== 0) {
    console.warn(`[auto-fix] failed to drop ${branchName}: ${drop.stderr.trim()}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  console.log('[auto-fix] args:', args);
  // Verify clean tree before starting — applyAndGate will recheck, but
  // failing here gives the operator a clean error before the multi-min
  // first run.
  const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  if (status.status !== 0) {
    console.error('[auto-fix] git status failed; aborting.');
    process.exit(2);
  }
  if (status.stdout.trim().length > 0) {
    console.error('[auto-fix] working tree is dirty; commit or stash before invoking auto-fix.');
    process.exit(2);
  }

  // Codex impl-1 M1: enforce HEAD on main before branching. The spec
  // says "branches off main"; without the check, an operator on a
  // feature branch would get an auto-fix branch carrying their unrelated
  // committed work. Capture the actual current branch (not assumed
  // 'main') so cleanup returns to the right place.
  const headRef = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
  if (headRef.status !== 0) {
    console.error('[auto-fix] git rev-parse failed; aborting.');
    process.exit(2);
  }
  const baseBranch = headRef.stdout.trim();
  if (baseBranch !== 'main') {
    console.error(
      `[auto-fix] current branch is '${baseBranch}', not 'main'. Auto-fix forks from main per spec §15.7. `
        + `Run 'git checkout main' first.`,
    );
    process.exit(2);
  }

  const provider = selectProvider();
  const outBase = 'output/playtests-llm/auto-fix-baseline';
  mkdirSync('output/playtests-llm', { recursive: true });

  // Step 1: baseline run.
  await runPlaytestLlm(args.seed, args.maxTicks, outBase, args.extraFlags);
  const baselineEnv = readEnvelope(outBase);
  const baseline = detectRegression(baselineEnv);
  if (!baseline.regressed) {
    console.log(`[auto-fix] baseline run was clean (${baseline.reason}); nothing to fix.`);
    process.exit(0);
  }
  console.log(`[auto-fix] regression detected: ${baseline.reason}`);

  // Step 2: prompt LLM for a fix.
  const regressionContext = buildRegressionContext(baselineEnv);
  console.log('[auto-fix] requesting fix proposal from LLM…');
  const proposal = await proposeFix(provider, regressionContext);
  if (!proposal.diff || proposal.diff.length < 10) {
    console.error('[auto-fix] LLM declined to propose a fix (empty diff). Manual triage required.');
    writeFileSync(`${outBase}.fix-proposal.txt`, '<empty proposal>');
    process.exit(1);
  }
  console.log(`[auto-fix] received ${proposal.diff.length} chars of diff (cost $${proposal.costUsd.toFixed(4)})`);
  writeFileSync(`${outBase}.fix-proposal.diff`, proposal.diff);

  // Step 3: apply + gate. Auto-commit the patch on success so the
  // branch is push-ready and counterfactual re-runs see a clean tree
  // with a committed fix (Codex impl-1 H1).
  console.log(`[auto-fix] applying patch on branch ${args.branch}`);
  const commitMessage =
    `auto-fix: regression on seed ${args.seed} (proposed by playtest:llm-auto-fix)\n\n`
    + `Regression context:\n${regressionContext}\n`;
  const gateResult = await applyAndGate({
    patch: proposal.diff,
    branchName: args.branch,
    commitMessage,
    runFn: runCommand,
    gates: [
      { cmd: npmBin, args: ['run', 'typecheck'] },
      { cmd: npmBin, args: ['run', 'lint'] },
      { cmd: npmBin, args: ['run', 'build'] },
      { cmd: npmBin, args: ['test'] },
    ],
  });
  if (gateResult.kind !== 'success') {
    console.error(`[auto-fix] apply+gate failed: kind=${gateResult.kind}`);
    if (gateResult.kind === 'apply-failed') {
      console.error(`[auto-fix] git apply rejected the patch:\n${gateResult.stderr.slice(0, 1000)}`);
      // Claude impl-1 H1: branch was already created; clean it up.
      await cleanupBranch(args.branch, baseBranch);
    } else if (gateResult.kind === 'gate-failed') {
      console.error(
        `[auto-fix] gate failed: ${gateResult.gateThatFailed.cmd} ${gateResult.gateThatFailed.args.join(' ')}`
          + `\n${gateResult.result.stderr.slice(0, 1000)}`,
      );
      console.error(`[auto-fix] reverted: ${gateResult.reverted}`);
      await cleanupBranch(args.branch, baseBranch);
    } else {
      // precondition-failed (could be: branch exists, dirty tree,
      // commit failed). Branch may or may not have been created;
      // cleanup is best-effort.
      console.error(`[auto-fix] precondition failed: ${gateResult.message}`);
      await cleanupBranch(args.branch, baseBranch);
    }
    process.exit(1);
  }
  console.log(`[auto-fix] apply+gate succeeded — sha ${gateResult.sha.slice(0, 8)}`);

  // Step 4: counterfactual sampling.
  if (args.skipCounterfactual) {
    console.log('[auto-fix] --skip-counterfactual set; leaving branch ready for manual review.');
    process.exit(0);
  }
  console.log(
    `[auto-fix] running ${args.counterfactualSamples}-sample counterfactual on the patched build…`,
  );
  let allClean = true;
  for (let i = 0; i < args.counterfactualSamples; i++) {
    const cfBase = `output/playtests-llm/auto-fix-counterfactual-${i}`;
    await runPlaytestLlm(args.seed, args.maxTicks, cfBase, args.extraFlags);
    const cfEnv = readEnvelope(cfBase);
    const cfResult = detectRegression(cfEnv);
    if (cfResult.regressed) {
      console.error(
        `[auto-fix] counterfactual sample ${i + 1}/${args.counterfactualSamples} REGRESSED: ${cfResult.reason}`,
      );
      allClean = false;
      break;
    }
    console.log(`[auto-fix] counterfactual sample ${i + 1}/${args.counterfactualSamples} clean.`);
  }
  if (!allClean) {
    console.error('[auto-fix] counterfactual rejected the fix. Reverting branch.');
    await cleanupBranch(args.branch, baseBranch);
    process.exit(1);
  }

  console.log(`[auto-fix] all green. Branch ${args.branch} is ready for manual push + PR.`);
  console.log(`[auto-fix] git push origin ${args.branch}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[auto-fix] fatal:', err);
  process.exit(1);
});
