#!/usr/bin/env node
// Post-hoc conformance capture for an LLM playtest run. Reads the saved
// envelope + slim trace (+ the last checkpoint screenshot), computes
// OBJECTIVE metrics, optionally runs the advisory LLM conformance probe
// (grounded in real Age of Empires II), and writes <prefix>.findings.md
// + merges metrics/findings into <prefix>.envelope.json. Decoupled from
// the run, so it works on ANY past or future run and can be re-run for
// free with an improved probe — including runs captured WITHOUT an
// in-run oracle (e.g. campaign-4).
//
//   tsx scripts/playtest-findings.mjs <prefix> [--no-llm] [--model <m>] [--provider claude-code|api]
//
// Example:
//   npm run playtest:findings -- output/playtests-llm/campaign-4

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import {
  AnthropicProvider,
  ClaudeCodeProvider,
  RetryingProvider,
  resolveClaudeBinary,
} from '../src/game/playtest/llmProviders/index.ts';
import {
  buildConformanceDigest,
  computeRunMetrics,
  formatFindingsMarkdown,
  runConformanceProbe,
} from '../src/game/playtest/conformanceProbe.ts';

function parseArgs(argv) {
  const args = { prefix: null, noLlm: false, model: 'claude-opus-4-8', provider: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-llm') args.noLlm = true;
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--provider') {
      const v = argv[++i];
      if (v !== 'claude-code' && v !== 'api') {
        console.error(`playtest-findings: --provider must be 'claude-code' or 'api', got '${v}'`);
        process.exit(2);
      }
      args.provider = v;
    } else if (a.startsWith('--')) {
      console.error(`playtest-findings: unknown argument '${a}'`);
      process.exit(2);
    } else if (!args.prefix) args.prefix = a;
    else {
      console.error(`playtest-findings: unexpected argument '${a}'`);
      process.exit(2);
    }
  }
  if (!args.prefix) {
    console.error(
      'usage: playtest-findings <run-prefix> [--no-llm] [--model <m>] [--provider claude-code|api]',
    );
    process.exit(2);
  }
  return args;
}

function readTrace(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

// The last checkpoint screenshot (highest tick) gives the probe final
// visual context. Absent when the run captured no checkpoints.
function findLastScreenshot(prefix) {
  const dir = `${prefix}-screenshots`;
  if (!existsSync(dir)) return undefined;
  const ticks = readdirSync(dir)
    .map((f) => /^(\d+)\.png$/.exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  if (!ticks.length) return undefined;
  const maxTick = Math.max(...ticks);
  return new Uint8Array(readFileSync(`${dir}/${maxTick}.png`));
}

function canSpawnClaude() {
  const resolved = resolveClaudeBinary('claude');
  if (resolved === null) return false;
  try {
    return spawnSync(resolved, ['--version'], { stdio: 'pipe', shell: false, timeout: 5000 }).status === 0;
  } catch {
    return false;
  }
}

function selectProvider(args) {
  const apiKeySet = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '';
  const wantApi = args.provider === 'api' || (args.provider === null && !canSpawnClaude() && apiKeySet);
  if (wantApi) {
    if (!apiKeySet) {
      console.error('playtest-findings: --provider=api requires ANTHROPIC_API_KEY.');
      process.exit(2);
    }
    console.log('[playtest-findings] provider: api (Anthropic SDK)');
    return new AnthropicProvider();
  }
  if (!canSpawnClaude()) {
    console.error(
      'playtest-findings: no LLM provider available. Install Claude Code (`claude` on PATH), '
        + 'set ANTHROPIC_API_KEY, or pass --no-llm for metrics only.',
    );
    process.exit(2);
  }
  console.log('[playtest-findings] provider: claude-code (subscription auth)');
  return new ClaudeCodeProvider();
}

async function main() {
  const args = parseArgs(process.argv);
  const envelopePath = `${args.prefix}.envelope.json`;
  const tracePath = `${args.prefix}.llm-trace.jsonl`;
  if (!existsSync(envelopePath)) {
    console.error(`playtest-findings: envelope not found: ${envelopePath}`);
    process.exit(2);
  }
  const envelope = JSON.parse(readFileSync(envelopePath, 'utf8'));
  // The trace is the hard signal for command/rejection/stall metrics — a
  // missing trace (e.g. a typoed prefix) must fail loud, not silently
  // produce a misleading "0 commands / 0 rejections" record that then
  // overwrites the envelope (Codex conformance iter-2).
  if (!existsSync(tracePath)) {
    console.error(
      `playtest-findings: trace not found: ${tracePath}. The trace is required for metrics; `
        + 'aborting rather than writing a misleading empty conformance record.',
    );
    process.exit(2);
  }
  const rows = readTrace(tracePath);
  const metrics = computeRunMetrics(envelope, rows);
  console.log(
    `[playtest-findings] ${args.prefix}: ${metrics.decisionsRun} decisions, ${metrics.ticksRun} ticks, `
      + `${metrics.commandsAttempted} commands (${metrics.commandsRejected} rejected), `
      + `${metrics.distinctCommandTypes.length} distinct command types, ${metrics.stallDecisions} stalls`,
  );

  let findings = [];
  let model;
  let note;
  if (!args.noLlm) {
    const provider = new RetryingProvider(selectProvider(args), { maxRetries: 2, backoffMs: 3000 });
    const digest = buildConformanceDigest(metrics, rows);
    const screenshot = findLastScreenshot(args.prefix);
    console.log(
      `[playtest-findings] running conformance probe (${args.model}${screenshot ? ' + final screenshot' : ''})…`,
    );
    const result = await runConformanceProbe({
      provider,
      model: args.model,
      digest,
      finalScreenshotPng: screenshot,
    });
    findings = result.findings;
    note = result.note;
    model = args.model;
    if (result.note) console.warn(`[playtest-findings] probe note: ${result.note}`);
    console.log(`[playtest-findings] ${findings.length} findings (cost $${result.costUsd.toFixed(4)})`);
  }

  const label = args.prefix.split(/[\\/]/).pop();
  const md = formatFindingsMarkdown(metrics, findings, { prefix: label, model, note });
  const findingsPath = `${args.prefix}.findings.md`;
  writeFileSync(findingsPath, md);
  envelope.metrics = metrics;
  envelope.findings = findings;
  // Persist the probe note onto the envelope too, so the saved artifacts
  // (not just stderr) reflect a malformed/all-invalid model turn. ALWAYS
  // reflect THIS run: set it when present, else delete any stale note from
  // a prior bad probe — the script is re-runnable on the same envelope, so
  // a leftover note would make the envelope disagree with the regenerated
  // markdown (Codex conformance iter-3).
  if (note) envelope.findingsNote = note;
  else delete envelope.findingsNote;
  writeFileSync(envelopePath, JSON.stringify(envelope, null, 2));
  console.log(`[playtest-findings] wrote ${findingsPath} + merged metrics/findings into ${envelopePath}`);
}

main().catch((err) => {
  console.error('[playtest-findings] fatal:', err);
  process.exit(1);
});
