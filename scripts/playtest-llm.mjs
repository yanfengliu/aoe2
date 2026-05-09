#!/usr/bin/env node
// LLM-agent playtest runner. Builds the bundle, serves via vite preview,
// boots Playwright Chromium, runs the LlmAgent's decide loop, writes
// bundle + envelope + trace + screenshots.
//
// Run via `tsx scripts/playtest-llm.mjs` (set up by `npm run playtest:llm`).
//
// CLI:
//   --seed <s>                   default 'aoe2-prototype'
//   --max-ticks <n>              default 5000
//   --out <path>                 default output/playtests-llm/run
//   --decision-interval <ticks>  default 250
//   --strategy-every <decisions> default 10
//   --owners <csv>               default '2'
//   --cost-budget <usd>          default 5.0
//   --provider <claude-code|api> default 'claude-code' if `claude` CLI on
//                                PATH, else 'api' if ANTHROPIC_API_KEY
//                                set. Explicit value overrides detection.
//   --use-dev-server             dev mode (vite); default uses vite preview
//   --no-screenshot              disable screenshot capture (token-only mode)
//   --omniscient                 cheat-mode snapshot (Phase-6.B)
//   --observation                run post-hoc observation oracle
//                                (Phase-6.C.2; adds ~$0.10 per run)

import { spawn, execSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

import {
  AnthropicProvider,
  ClaudeCodeProvider,
  resolveClaudeBinary,
} from '../src/game/playtest/llmProviders/index.ts';
import { LlmAgent } from '../src/game/playtest/llmAgent.ts';
import { runLlmPlaytest } from '../src/game/playtest/llmRunner.ts';
import {
  buildTraceSummary,
  runObservationOracle,
} from '../src/game/playtest/observationOracle.ts';

function parseArgs(argv) {
  const args = {
    seed: 'aoe2-prototype',
    maxTicks: 5000,
    out: 'output/playtests-llm/run',
    decisionInterval: 250,
    strategyEvery: 10,
    owners: [2],
    costBudget: 5.0,
    provider: null, // null = auto-detect
    useDevServer: false,
    noScreenshot: false,
    // Phase-6.B (impl-2 M7): default false → enemies are visibility-
    // filtered. Pass --omniscient to revert to cheat-mode global view
    // (the corpus's smoke baseline row sets this).
    omniscient: false,
    // Phase-6.C.2: post-hoc observation oracle. Single advisory LLM
    // call after the run (final-tick screenshot + trace summary).
    // Default off — adds ~$0.10 per run when enabled.
    observation: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed') args.seed = argv[++i];
    else if (a === '--max-ticks') args.maxTicks = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--decision-interval') args.decisionInterval = Number(argv[++i]);
    else if (a === '--strategy-every') args.strategyEvery = Number(argv[++i]);
    else if (a === '--owners') args.owners = argv[++i].split(',').map(Number);
    else if (a === '--cost-budget') args.costBudget = Number(argv[++i]);
    else if (a === '--provider') {
      const v = argv[++i];
      if (v !== 'claude-code' && v !== 'api') {
        console.error(`playtest-llm: --provider must be 'claude-code' or 'api', got '${v}'`);
        process.exit(2);
      }
      args.provider = v;
    }
    else if (a === '--use-dev-server') args.useDevServer = true;
    else if (a === '--no-screenshot') args.noScreenshot = true;
    else if (a === '--omniscient') args.omniscient = true;
    else if (a === '--observation') args.observation = true;
    else if (a.startsWith('--')) {
      console.error(`playtest-llm: unknown argument '${a}'`);
      process.exit(2);
    }
  }
  return args;
}

// Pick the provider. Explicit --provider wins. Otherwise:
//   - claude-code if `claude` is on PATH
//   - api if ANTHROPIC_API_KEY is set
//   - fail loud otherwise.
function selectProvider(args) {
  if (args.provider === 'api') return makeApiProvider();
  if (args.provider === 'claude-code') return makeClaudeCodeProvider(args);

  const claudeAvailable = canSpawnClaude();
  const apiKeySet = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '';

  if (claudeAvailable) return makeClaudeCodeProvider(args);
  if (apiKeySet) return makeApiProvider();

  console.error(
    "playtest-llm: no LLM provider available. Install Claude Code (`claude` on PATH) "
      + "or set ANTHROPIC_API_KEY for the API provider.",
  );
  process.exit(2);
}

function makeClaudeCodeProvider(args) {
  // Defense-in-depth (Codex impl-2 M3): even on explicit --provider=
  // claude-code, refuse early if the binary isn't actually spawnable
  // (e.g., Windows .cmd-only install). Without this, the first real
  // call falls through resolveClaudeBinary's null path and produces
  // an opaque spawn error after the multi-minute build + browser boot.
  if (!canSpawnClaude()) {
    console.error(
      'playtest-llm: --provider=claude-code requested, but `claude` is not spawnable from '
        + 'this Node process. On Windows, the .exe shim must be on PATH (npm-global '
        + '`.cmd` shims alone are insufficient because Node 22 rejects them via '
        + 'CVE-2024-27980 mitigation).',
    );
    process.exit(2);
  }
  console.log('[playtest-llm] provider: claude-code (subscription auth via `claude` CLI)');
  // Per-call cost shape (Claude impl-1 M1, Codex impl-2 M2):
  // claude-code sessions carry ~15K-token cache_creation prelude per
  // spawned process. Sonnet tactical calls: ~$0.10/call. Opus strategy
  // refreshes (every Kth decision, default K=10): ~$0.30+/call.
  // Effective per-decision cost ≈ tactical + (strategy / K) ≈ $0.13.
  const tacticalCost = 0.1; // Sonnet 4.6 with ~15K cache_creation
  const strategyCost = 0.3; // Opus 4.7 with ~15K cache_creation
  const blendedCost = tacticalCost + strategyCost / args.strategyEvery;
  const expectedDecisions = Math.floor(args.costBudget / blendedCost);
  console.log(
    `[playtest-llm] cost note: each claude-code call adds ~$${tacticalCost.toFixed(2)} (Sonnet tactical) or `
      + `~$${strategyCost.toFixed(2)} (Opus strategy refresh, every ${args.strategyEvery}th decision) `
      + `in notional API equivalent. With --cost-budget=$${args.costBudget.toFixed(2)} expect roughly `
      + `${expectedDecisions} tactical decisions before the rolling-cost gate trips.`,
  );
  return new ClaudeCodeProvider();
}

function makeApiProvider() {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === '') {
    console.error('playtest-llm: --provider=api requires ANTHROPIC_API_KEY env var.');
    process.exit(2);
  }
  console.log('[playtest-llm] provider: api (Anthropic SDK with API key)');
  return new AnthropicProvider();
}

// Detect whether the claude-code provider can actually spawn `claude`
// from this Node process. Per Codex impl-1 MED 3, the runner cannot
// rely on `claude --version` succeeding (which works via .cmd shims +
// shell:true), because the provider spawns the .exe directly with
// shell:false. We delegate to resolveClaudeBinary which returns null
// on Windows when no .exe is found.
function canSpawnClaude() {
  const resolved = resolveClaudeBinary('claude');
  if (resolved === null) return false;
  try {
    const r = spawnSync(resolved, ['--version'], {
      stdio: 'pipe',
      shell: false,
      timeout: 5000,
    });
    return r.status === 0;
  } catch {
    return false;
  }
}

const useShell = process.platform === 'win32';
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const PORT = 5174;

async function buildIfNeeded() {
  console.log('[playtest-llm] running npm run build…');
  await new Promise((resolve, reject) => {
    const p = spawn(npmBin, ['run', 'build'], { stdio: 'inherit', shell: useShell });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build exit ${code}`))));
  });
}

async function startServer(useDev) {
  // Verify the port is free BEFORE spawning the child, so an existing
  // listener (stale preview from a prior run) doesn't get mistaken for
  // our spawned child (Codex impl-345 M2).
  try {
    const res = await fetch(`http://localhost:${PORT}/`, { signal: AbortSignal.timeout(500) });
    throw new Error(
      `port ${PORT} is already in use (got HTTP ${res.status} before spawning new server). Kill the stale listener and retry.`,
    );
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('port ')) throw err;
    // Otherwise (connection refused / timeout) — port is free.
  }
  const cmd = useDev
    ? [npmBin, ['run', 'dev']]
    : [npmBin, ['run', 'preview', '--', '--port', String(PORT)]];
  console.log(`[playtest-llm] starting ${useDev ? 'vite dev' : `vite preview on :${PORT}`}…`);
  // detached: true on POSIX so killProcessTree can signal the whole
  // process group via process.kill(-pid). On Windows we taskkill /T
  // instead. (Claude impl-345 M2.)
  const p = spawn(cmd[0], cmd[1], {
    stdio: 'pipe',
    shell: useShell,
    detached: process.platform !== 'win32',
  });
  let stderr = '';
  let childExited = false;
  let childExitCode = null;
  p.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  p.on('exit', (code) => {
    childExited = true;
    childExitCode = code;
  });
  // Wait for server to respond on the port — but if the spawned child
  // exits early (e.g., EADDRINUSE despite the pre-flight check losing
  // the race with another process), bail rather than poll forever.
  const url = `http://localhost:${PORT}/`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (childExited) {
      throw new Error(
        `server child exited early (code=${childExitCode}) before becoming reachable.\nstderr:\n${stderr}`,
      );
    }
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) {
        console.log(`[playtest-llm] server is up at ${url}`);
        return p;
      }
    } catch {
      /* not ready yet */
    }
  }
  killProcessTree(p);
  throw new Error(`Server never started.\nstderr:\n${stderr}`);
}

async function makePlaywrightHost(page, hostOptions = {}) {
  const omniscient = !!hostOptions.omniscient;
  return {
    async waitForBoot() {
      // Assert both isBooted AND the agent sub-surface — defends
      // against a boot-vs-agent race where __AOE2_TEST__ exists but
      // the .agent methods aren't attached yet (HMR window with
      // --use-dev-server, late dynamic-import resolution). Without
      // this, the next host call hits a bare TypeError that the
      // operator can't decode from the envelope (Claude impl-345 M6).
      await page.waitForFunction(
        () =>
          window.__AOE2_TEST__?.isBooted() === true
          && typeof window.__AOE2_TEST__?.agent?.snapshotForAgent === 'function'
          && typeof window.__AOE2_TEST__?.agent?.dispatchAgentCommand === 'function'
          && typeof window.__AOE2_TEST__?.agent?.exportRecorderBundleToFile === 'function',
        undefined,
        { timeout: 60_000 },
      );
    },
    async getCurrentTick() {
      return await page.evaluate(() => window.__AOE2_TEST__.getRenderState().tick);
    },
    async snapshotForAgent(ownerId) {
      // Phase-6.B (impl-2 M7): forward host-level omniscient flag so
      // the snapshot honors visibility-gating per the corpus row /
      // CLI flag.
      return await page.evaluate(
        ([id, opts]) => window.__AOE2_TEST__.agent.snapshotForAgent(id, opts),
        [ownerId, { omniscient }],
      );
    },
    async captureScreenshot() {
      const bbox = await page.evaluate(() => window.__AOE2_TEST__.agent.getCanvasBboxForScreenshot());
      const buffer = await page.screenshot({ clip: bbox });
      return new Uint8Array(buffer);
    },
    async dispatchCommand(cmd) {
      return await page.evaluate(
        (c) => window.__AOE2_TEST__.agent.dispatchAgentCommand(c),
        cmd,
      );
    },
    async advanceTicks(count) {
      await page.evaluate((n) => window.__AOE2_TEST__.advanceTicks(n), count);
    },
    async drainDispatchLog() {
      return await page.evaluate(() => window.__AOE2_TEST__.agent.drainAgentDispatchLog());
    },
    async getEntityCountsByOwner() {
      return await page.evaluate(() =>
        window.__AOE2_TEST__.agent.getEntityCountsByOwner(),
      );
    },
    async exportBundle() {
      // Codex impl-345 M3: passing the bundle text back through
      // page.evaluate() defeats the purpose of the Blob URL. Use
      // page.request.fetch (which talks directly to the page's
      // origin without the JSON-RPC marshalling layer) and revoke the
      // blob URL after read so the page's heap doesn't keep the bytes
      // pinned for the lifetime of the browser context.
      const { blobUrl, size } = await page.evaluate(() =>
        window.__AOE2_TEST__.agent.exportRecorderBundleToFile(),
      );
      console.log(`[playtest-llm] bundle blob ready: ${size} bytes`);
      try {
        const response = await page.request.fetch(blobUrl);
        const text = await response.text();
        return JSON.parse(text);
      } finally {
        await page
          .evaluate((url) => URL.revokeObjectURL(url), blobUrl)
          .catch(() => {});
      }
    },
  };
}

// Kill the spawned npm/vite child AND its descendants. Plain p.kill()
// only signals the immediate child (`npm.cmd`); on Windows the
// grandchild `node.exe` running vite preview survives, holding
// port 5174 indefinitely. Use taskkill /T on Windows; on POSIX,
// SIGTERM to the process group via negative PID. (Claude impl-345 M2.)
function killProcessTree(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
    } catch {
      /* already gone */
    }
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        /* already gone */
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  console.log('[playtest-llm] args:', args);

  // Provider selection runs FIRST so an unconfigured environment fails
  // loud before we go through the multi-minute build + browser-launch.
  const provider = selectProvider(args);

  // Hoist server + browser + cleanup BEFORE startServer so a SIGINT
  // arriving during the 30-second startup poll doesn't leak the
  // spawned child (Claude impl-345 M2).
  let server = null;
  let browser = null;
  let serverKilled = false;
  let browserClosed = false;
  const cleanup = () => {
    if (server && !serverKilled) {
      killProcessTree(server);
      serverKilled = true;
    }
    if (browser && !browserClosed) {
      browser.close().catch(() => {});
      browserClosed = true;
    }
  };
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      cleanup();
      process.exit(sig === 'SIGINT' ? 130 : 143);
    });
  }

  if (!args.useDevServer) await buildIfNeeded();
  server = await startServer(args.useDevServer);

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const ownerCsv = args.owners.join(',');
    await page.goto(
      `http://localhost:${PORT}/?seed=${encodeURIComponent(args.seed)}&disableAi=${ownerCsv}`,
    );

    const agent = new LlmAgent({
      provider,
      ownerId: args.owners[0],
      strategyModel: 'claude-opus-4-7',
      tacticalModel: 'claude-sonnet-4-6',
      strategyEveryNDecisions: args.strategyEvery,
      maxOutputTokensTactical: 1024,
      maxOutputTokensStrategy: 2048,
      costBudgetUsd: args.costBudget,
      maxImageBytes: 1_048_576,
      historyWindow: 5,
    });

    const host = await makePlaywrightHost(page, { omniscient: args.omniscient });

    // Stream trace as we go so a crash mid-run still leaves partial data.
    const traceFilePath = `${args.out}.llm-trace.jsonl`;
    mkdirSync(dirname(traceFilePath), { recursive: true });
    if (existsSync(traceFilePath)) writeFileSync(traceFilePath, ''); // truncate

    const result = await runLlmPlaytest({
      host,
      agent,
      config: {
        ownerId: args.owners[0],
        maxTicks: args.maxTicks,
        decisionIntervalTicks: args.decisionInterval,
        screenshotEnabled: !args.noScreenshot,
        onDecision: (entry) => {
          // Drop heavy fields from streamed trace; the runner returns the
          // full structure separately if needed. Keep this row to ~1 KB.
          const slim = {
            decisionIndex: entry.decisionIndex,
            tickBefore: entry.tickBefore,
            tickAfter: entry.tickAfter,
            thought: entry.decision.thought.slice(0, 500),
            commands: entry.decision.commands.map((c) => ({ type: c.type })),
            costUsd: entry.decision.costUsd,
            stopReason: entry.decision.stopReason,
            dispatchEvents: entry.dispatchEvents,
          };
          writeFileSync(traceFilePath, JSON.stringify(slim) + '\n', { flag: 'a' });
        },
      },
    });

    // Phase-6.C.2: post-hoc observation oracle (advisory only). Skipped
    // when --observation isn't set, when the agent already hit its
    // cost budget (don't pay for advisory after operator cap), or
    // when no screenshot was captured. The verdict is appended to the
    // envelope for downstream tooling; CI exit codes are unchanged.
    if (
      args.observation
      && result.envelope.errorMessage !== 'cost-budget-exceeded'
    ) {
      try {
        const rejectionsCount = result.trace.reduce(
          (acc, entry) => acc + entry.dispatchEvents.filter((e) => !e.accepted).length,
          0,
        );
        const traceSummary = buildTraceSummary({
          ticksRun: result.envelope.ticksRun,
          decisionsRun: result.envelope.decisionsRun,
          totalCostUsd: result.envelope.totalCostUsd,
          stopReason: result.envelope.stopReason,
          errorMessage: result.envelope.errorMessage,
          rejectionsCount,
        });
        const verdict = await runObservationOracle({
          provider,
          model: 'claude-sonnet-4-6',
          finalScreenshotPng: result.finalScreenshotPng,
          traceSummary,
        });
        result.envelope.observation = verdict;
        // Codex impl-1 MED 3: roll the advisory oracle's cost into
        // totalCostUsd so the corpus SUMMARY-LLM.md table doesn't
        // under-report actual LLM spend. The verdict.costUsd field
        // remains for transparency (per-component breakdown).
        result.envelope.totalCostUsd += verdict.costUsd;
        console.log(
          `[playtest-llm] observation: ${verdict.verdict} (cost $${verdict.costUsd.toFixed(4)})`,
        );
      } catch (err) {
        console.warn(
          `[playtest-llm] observation oracle failed (advisory): ${err?.message ?? err}`,
        );
      }
    }

    writeFileSync(`${args.out}.json`, JSON.stringify(result.bundle));
    writeFileSync(`${args.out}.envelope.json`, JSON.stringify(result.envelope, null, 2));
    console.log(
      `[playtest-llm] done: ${result.envelope.decisionsRun} decisions / ${result.envelope.ticksRun} ticks / cost $${result.envelope.totalCostUsd.toFixed(4)} / stopReason=${result.envelope.stopReason}`,
    );
    if (result.envelope.errorMessage) {
      console.log(`[playtest-llm]   errorMessage: ${result.envelope.errorMessage}`);
    }
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[playtest-llm] fatal:', err);
  process.exit(1);
});
