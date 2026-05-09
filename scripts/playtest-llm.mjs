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
//   --use-dev-server             dev mode (vite); default uses vite preview
//   --no-screenshot              disable screenshot capture (token-only mode)

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

import { AnthropicProvider } from '../src/game/playtest/llmProviders.ts';
import { LlmAgent } from '../src/game/playtest/llmAgent.ts';
import { runLlmPlaytest } from '../src/game/playtest/llmRunner.ts';

function parseArgs(argv) {
  const args = {
    seed: 'aoe2-prototype',
    maxTicks: 5000,
    out: 'output/playtests-llm/run',
    decisionInterval: 250,
    strategyEvery: 10,
    owners: [2],
    costBudget: 5.0,
    useDevServer: false,
    noScreenshot: false,
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
    else if (a === '--use-dev-server') args.useDevServer = true;
    else if (a === '--no-screenshot') args.noScreenshot = true;
    else if (a.startsWith('--')) {
      console.error(`playtest-llm: unknown argument '${a}'`);
      process.exit(2);
    }
  }
  return args;
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
  const p = spawn(cmd[0], cmd[1], { stdio: 'pipe', shell: useShell });
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
  p.kill();
  throw new Error(`Server never started.\nstderr:\n${stderr}`);
}

async function makePlaywrightHost(page) {
  return {
    async waitForBoot() {
      await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, undefined, {
        timeout: 60_000,
      });
    },
    async getCurrentTick() {
      return await page.evaluate(() => window.__AOE2_TEST__.getRenderState().tick);
    },
    async snapshotForAgent(ownerId) {
      return await page.evaluate((id) => window.__AOE2_TEST__.agent.snapshotForAgent(id), ownerId);
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

async function main() {
  const args = parseArgs(process.argv);
  console.log('[playtest-llm] args:', args);

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === '') {
    console.error('playtest-llm: ANTHROPIC_API_KEY env var is required.');
    process.exit(2);
  }

  if (!args.useDevServer) await buildIfNeeded();
  const server = await startServer(args.useDevServer);

  let browser;
  let serverKilled = false;
  const cleanup = () => {
    if (!serverKilled) {
      server.kill();
      serverKilled = true;
    }
    if (browser) browser.close().catch(() => {});
  };
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const ownerCsv = args.owners.join(',');
    await page.goto(
      `http://localhost:${PORT}/?seed=${encodeURIComponent(args.seed)}&disableAi=${ownerCsv}`,
    );

    const provider = new AnthropicProvider();
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

    const host = await makePlaywrightHost(page);

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
