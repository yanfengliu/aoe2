#!/usr/bin/env node
// Phase 4.B: capture deterministic-AI playtest screenshots at fixed
// tick checkpoints. The visual-regression oracle compares run-time
// screenshots against these committed baselines (per DESIGN.md §4 +
// impl-1 H3 visibility scoping).
//
// Run via `tsx scripts/capture-baselines.mjs` (set up by
// `npm run capture-baselines`).
//
// CLI:
//   --seed <s>                  default 'aoe2-prototype'
//   --max-ticks <n>             default 5000
//   --baseline-every <ticks>    default 1000
//   --out <dir>                 default tests/playtest/baselines/<seed>/
//   --use-dev-server            opt-in to vite dev (default uses vite preview)

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

function parseArgs(argv) {
  const args = {
    seed: 'aoe2-prototype',
    maxTicks: 5000,
    baselineEvery: 1000,
    out: null,
    useDevServer: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed') args.seed = argv[++i];
    else if (a === '--max-ticks') args.maxTicks = Number(argv[++i]);
    else if (a === '--baseline-every') args.baselineEvery = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--use-dev-server') args.useDevServer = true;
    else if (a.startsWith('--')) {
      console.error(`capture-baselines: unknown argument '${a}'`);
      process.exit(2);
    }
  }
  if (!args.out) args.out = `tests/playtest/baselines/${args.seed}`;
  return args;
}

const useShell = process.platform === 'win32';
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const PORT = 5174;

async function buildIfNeeded() {
  console.log('[capture-baselines] running npm run build…');
  await new Promise((resolve, reject) => {
    const p = spawn(npmBin, ['run', 'build'], { stdio: 'inherit', shell: useShell });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build exit ${code}`))));
  });
}

async function startServer(useDev) {
  const cmd = useDev
    ? [npmBin, ['run', 'dev']]
    : [npmBin, ['run', 'preview', '--', '--port', String(PORT)]];
  console.log(
    `[capture-baselines] starting ${useDev ? 'vite dev' : `vite preview on :${PORT}`}…`,
  );
  const p = spawn(cmd[0], cmd[1], { stdio: 'pipe', shell: useShell });
  let stderr = '';
  p.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  const url = `http://localhost:${PORT}/`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) {
        console.log(`[capture-baselines] server up at ${url}`);
        return p;
      }
    } catch {
      /* not ready yet */
    }
  }
  p.kill();
  throw new Error(`Server never started.\nstderr:\n${stderr}`);
}

async function main() {
  const args = parseArgs(process.argv);
  console.log('[capture-baselines] args:', args);

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
    // No ?disableAi= — this is deterministic-AI baseline capture.
    await page.goto(`http://localhost:${PORT}/?seed=${encodeURIComponent(args.seed)}`);
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, undefined, {
      timeout: 60_000,
    });

    mkdirSync(args.out, { recursive: true });

    // Advance and capture at each baseline tick.
    let captured = 0;
    let tick = 0;
    while (tick < args.maxTicks) {
      const advance = Math.min(args.baselineEvery, args.maxTicks - tick);
      await page.evaluate((n) => window.__AOE2_TEST__.advanceTicks(n), advance);
      tick += advance;
      const bbox = await page.evaluate(() =>
        window.__AOE2_TEST__.agent.getCanvasBboxForScreenshot(),
      );
      const buffer = await page.screenshot({ clip: bbox });
      const filename = `${args.out}/${tick}.png`;
      writeFileSync(filename, buffer);
      captured += 1;
      console.log(`[capture-baselines] tick ${tick} → ${filename} (${buffer.length} bytes)`);
    }

    console.log(`[capture-baselines] captured ${captured} baselines under ${args.out}`);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[capture-baselines] fatal:', err);
  process.exit(1);
});
