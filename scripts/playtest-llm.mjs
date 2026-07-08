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
//   --owners <csv>               default '1' — the LLM plays the HUMAN
//                                slot (player 1) so the in-game AI on
//                                player 2 is a real opponent. (disableAi=1
//                                is rejected by createApp — the human has
//                                no AI to disable — so P2's AI stays live.)
//   --cost-budget <usd>          default 5.0
//   --provider <claude-code|api> default 'claude-code' if `claude` CLI on
//                                PATH, else 'api' if ANTHROPIC_API_KEY
//                                set. Explicit value overrides detection.
//   --use-dev-server             dev mode (vite); default uses vite preview
//   --no-screenshot              disable screenshot capture (token-only mode)
//   --screenshot-every <ticks>   dashboard checkpoint screenshot cadence
//                                (default 1000; 0 disables; use multiples of
//                                --decision-interval so captures land)
//   --omniscient                 cheat-mode snapshot (Phase-6.B)
//
// Conformance capture (objective metrics + AoE2 gap critique) is a
// separate post-hoc step: `npm run playtest:findings -- <out-prefix>`.

import { spawn, execSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

import {
  AnthropicProvider,
  ClaudeCodeProvider,
  RetryingProvider,
  resolveClaudeBinary,
} from '../src/game/playtest/llmProviders/index.ts';
import { LlmAgent } from '../src/game/playtest/llmAgent.ts';
import { runLlmPlaytest } from '../src/game/playtest/llmRunner.ts';
import { selectKnownIssues } from '../src/game/playtest/knownIssues.ts';

function parseArgs(argv) {
  const args = {
    seed: 'aoe2-prototype',
    maxTicks: 5000,
    out: 'output/playtests-llm/run',
    decisionInterval: 250,
    strategyEvery: 10,
    // LLM plays player 1 (the human slot) so player 2's in-game AI is a
    // real opponent. campaign-1..5 used owners [2], which left the LLM in
    // the only AI slot and player 1 (human, no AI) inert — no opponent.
    owners: [1],
    costBudget: 5.0,
    provider: null, // null = auto-detect
    useDevServer: false,
    noScreenshot: false,
    // Dashboard checkpoint screenshots every N ticks (option C: no
    // baseline comparison — captures are for human eyeballing via the
    // corpus dashboard only). 0 disables.
    screenshotEvery: 1000,
    // Phase-6.B (impl-2 M7): default false → enemies are visibility-
    // filtered. Pass --omniscient to revert to cheat-mode global view.
    omniscient: false,
    // Episodic memory: path to a prior self-improvement ledger JSON whose
    // open findings are rendered into the agent prompts as known issues.
    knownFindings: null,
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
    else if (a === '--screenshot-every') args.screenshotEvery = Number(argv[++i]);
    else if (a === '--omniscient') args.omniscient = true;
    else if (a === '--known-findings') args.knownFindings = argv[++i];
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
  // Per-call cost shape: claude-code sessions carry ~15K-token
  // cache_creation prelude per spawned process. All playtest calls run
  // on claude-opus-4-8 ($5/$25 per MTok) while Fable 5 is banned
  // (2026-06-12 directive). The subscription per-call cost is
  // prelude-DOMINATED, not per-token-dominated, so it does NOT halve
  // when the rate halves: campaign-3 observed ~$0.67/decision on Opus,
  // essentially the same as Fable's ~$0.61. Strategy (every Kth
  // decision, default K=10) is similar.
  const tacticalCost = 0.65; // claude-opus-4-8, campaign-3 observed (prelude-dominated)
  const strategyCost = 0.65; // claude-opus-4-8 (same model, longer output)
  const blendedCost = tacticalCost + strategyCost / args.strategyEvery;
  const expectedDecisions = Math.floor(args.costBudget / blendedCost);
  console.log(
    `[playtest-llm] cost note: each claude-code call adds ~$${tacticalCost.toFixed(2)} (claude-opus-4-8; strategy refresh every `
      + `${args.strategyEvery}th decision) in notional API equivalent. With --cost-budget=$${args.costBudget.toFixed(2)} `
      + `expect roughly ${expectedDecisions} tactical decisions before the rolling-cost gate trips.`,
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
    ? [npmBin, ['run', 'dev', '--', '--port', String(PORT)]]
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
  // playtest-fixes iter-1 (Codex HIGH): the agent may only command its
  // own entities; the in-page dispatcher enforces it via expectedOwner.
  const expectedOwner = hostOptions.ownerId;
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
          && typeof window.__AOE2_TEST__?.agent?.getRecorderBundle === 'function'
          && typeof window.__AOE2_TEST__?.setPaused === 'function',
        undefined,
        { timeout: 60_000 },
      );
    },
    // playtest-fixes C: freeze/unfreeze the live sim. The runner pauses
    // once after boot so the game does NOT free-run during the agent's
    // ~10-100s LLM calls (the 2026-06-09 run drifted to bridge tick
    // 5413 on a maxTicks-2000 run, voiding checkpoint alignment).
    async setPaused(paused) {
      await page.evaluate((p) => window.__AOE2_TEST__.setPaused(p), paused);
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
        ([c, owner]) => window.__AOE2_TEST__.agent.dispatchAgentCommand(c, { expectedOwner: owner }),
        [cmd, expectedOwner],
      );
    },
    async advanceTicks(count) {
      // Atomic unpause → step N → repause inside ONE synchronous page
      // task: requestAnimationFrame can never interleave a synchronous
      // evaluate, so with the runner-held pause active, advanceTicks is
      // the ONLY way the bridge tick moves. tickAfter - tickBefore then
      // equals the requested count exactly and baseline checkpoints
      // (multiples of decisionIntervalTicks) land precisely.
      await page.evaluate((n) => {
        const api = window.__AOE2_TEST__;
        api.setPaused(false);
        try {
          api.advanceTicks(n);
        } finally {
          api.setPaused(true);
        }
      }, count);
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
      // playtest-fixes D: the previous blob-URL path was dead on
      // arrival — page.request.fetch is an HTTP client and rejects
      // blob: URLs ("Protocol 'blob:' not supported"), which engineHalt-
      // ed every real run at export time. Instead: stringify the bundle
      // into a page global once, pull it out in chunks that stay under
      // Playwright's JSON-RPC payload limit, and reassemble in Node.
      const CHUNK_BYTES = 4 * 1024 * 1024;
      const totalLength = await page.evaluate(() => {
        const bundle = window.__AOE2_TEST__.agent.getRecorderBundle();
        window.__AOE2_PLAYTEST_BUNDLE_TEXT__ = JSON.stringify(bundle);
        return window.__AOE2_PLAYTEST_BUNDLE_TEXT__.length;
      });
      console.log(`[playtest-llm] bundle JSON ready: ${totalLength} chars, pulling in ${Math.ceil(totalLength / CHUNK_BYTES)} chunks`);
      try {
        const parts = [];
        for (let offset = 0; offset < totalLength; offset += CHUNK_BYTES) {
          const part = await page.evaluate(
            ([start, len]) => window.__AOE2_PLAYTEST_BUNDLE_TEXT__.slice(start, start + len),
            [offset, CHUNK_BYTES],
          );
          parts.push(part);
        }
        return JSON.parse(parts.join(''));
      } finally {
        await page
          .evaluate(() => {
            delete window.__AOE2_PLAYTEST_BUNDLE_TEXT__;
          })
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

  // Validate episodic-memory input BEFORE any server/browser startup so a
  // bad ledger path cannot leak a Vite preview or Chromium process.
  let knownIssues;
  if (args.knownFindings) {
    try {
      const ledger = JSON.parse(readFileSync(args.knownFindings, 'utf8'));
      knownIssues = selectKnownIssues(ledger);
      console.log(`[playtest-llm] known issues from ${args.knownFindings}: ${knownIssues.length}`);
    } catch (error) {
      console.error(`playtest-llm: failed to read --known-findings ledger: ${error?.message ?? error}`);
      process.exit(2);
    }
  }
  console.log('[playtest-llm] args:', args);

  // Provider selection runs FIRST so an unconfigured environment fails
  // loud before we go through the multi-minute build + browser-launch.
  // provider-error-retry: wrap in RetryingProvider so a transient
  // `claude exit 1` / timeout / spawn blip retries with backoff in place
  // instead of killing the run; only on exhaustion does the runner stop
  // with stopReason=providerError (the game stays scored).
  const provider = new RetryingProvider(selectProvider(args), {
    maxRetries: 2,
    backoffMs: 3000,
  });

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
      strategyModel: 'claude-opus-4-8',
      tacticalModel: 'claude-opus-4-8',
      strategyEveryNDecisions: args.strategyEvery,
      maxOutputTokensTactical: 1024,
      maxOutputTokensStrategy: 2048,
      costBudgetUsd: args.costBudget,
      maxImageBytes: 1_048_576,
      historyWindow: 5,
      ...(knownIssues && knownIssues.length > 0 ? { knownIssues } : {}),
    });

    const host = await makePlaywrightHost(page, { omniscient: args.omniscient, ownerId: args.owners[0] });

    // Stream trace as we go so a crash mid-run still leaves partial data.
    const traceFilePath = `${args.out}.llm-trace.jsonl`;
    mkdirSync(dirname(traceFilePath), { recursive: true });
    if (existsSync(traceFilePath)) writeFileSync(traceFilePath, ''); // truncate

    // Dashboard checkpoint ticks: every --screenshot-every ticks up to
    // maxTicks (option C — captures feed the corpus dashboard only; no
    // baseline diffing, because a non-deterministic player has no
    // "correct" reference image).
    const screenshotCheckpointTicks = [];
    if (args.screenshotEvery > 0) {
      for (let t = args.screenshotEvery; t <= args.maxTicks; t += args.screenshotEvery) {
        screenshotCheckpointTicks.push(t);
      }
    }

    const result = await runLlmPlaytest({
      host,
      agent,
      config: {
        ownerId: args.owners[0],
        maxTicks: args.maxTicks,
        decisionIntervalTicks: args.decisionInterval,
        screenshotEnabled: !args.noScreenshot,
        screenshotCheckpointTicks,
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

    // Stamp seed + maxTicks on the envelope for the dashboard's run
    // table. The runner doesn't know these values; only the script does.
    result.envelope.seed = args.seed;
    result.envelope.maxTicks = args.maxTicks;

    // Persist checkpoint screenshots for the corpus dashboard
    // (${out}-screenshots/<tick>.png). Option C (2026-06-10): no
    // baseline comparison — see design/spec-final.md §15.7.
    if (result.checkpointScreenshots.length > 0) {
      const screenshotsDir = `${args.out}-screenshots`;
      mkdirSync(screenshotsDir, { recursive: true });
      for (const entry of result.checkpointScreenshots) {
        writeFileSync(`${screenshotsDir}/${entry.tick}.png`, entry.pngBytes);
      }
      console.log(
        `[playtest-llm] checkpoint screenshots: ${result.checkpointScreenshots.length} saved to ${screenshotsDir}`,
      );
    }

    // Conformance capture is a decoupled post-hoc pass (2026-06-13):
    // run `npm run playtest:findings -- ${args.out}` after this to get
    // objective metrics + an AoE2 conformance critique. It replaces the
    // removed "looked-fun" observation oracle, works on any saved run,
    // and can be re-run for free with an improved probe.

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
