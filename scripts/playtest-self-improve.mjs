#!/usr/bin/env node
// Build a self-improvement ledger from recorded playtest artifacts.
//
// Usage:
//   npm run playtest:self-improve -- --current output/playtests-llm/campaign-11 --baseline output/playtests-llm/campaign-10 --out output/self-improvement/campaign-11.json
//   npm run playtest:self-improve -- --current output/playtests/run --oracles

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

import { SessionReplayer } from 'civ-engine';

import { repairBundleEndTick } from '../src/game/playtest/bundleEndTick.ts';
import { runOracles } from '../src/game/playtest/oracles.ts';
import {
  buildSelfImprovementLedger,
  formatSelfImprovementLedgerMarkdown,
  replaySelfCheckEvidenceFromResult,
} from '../src/game/playtest/selfImprovementLoop.ts';
import { createReplayWorldOnly } from '../src/game/simulation/replay/createReplayWorldOnly.ts';

function parseArgs(argv) {
  const args = {
    current: null,
    baseline: null,
    out: null,
    oracles: false,
    thresholds: {},
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--current') args.current = argv[++i];
    else if (a === '--baseline') args.baseline = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--oracles') args.oracles = true;
    else if (a === '--thresholds') args.thresholds = JSON.parse(argv[++i]);
    else if (a === '--thresholds-file') args.thresholds = readJson(argv[++i]);
    else if (a.startsWith('--')) {
      console.error(`playtest-self-improve: unknown argument '${a}'`);
      process.exit(2);
    } else {
      console.error(`playtest-self-improve: unexpected argument '${a}'`);
      process.exit(2);
    }
  }
  if (!args.current) {
    console.error(
      'usage: playtest-self-improve --current <prefix> [--baseline <prefix>] [--out <path.json>] '
        + '[--oracles] [--thresholds <json>|--thresholds-file <path>]',
    );
    process.exit(2);
  }
  return args;
}

function readJson(path) {
  if (!existsSync(path)) {
    throw new Error(`missing required artifact: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readTrace(path, { required }) {
  if (!existsSync(path)) {
    if (required) throw new Error(`missing required artifact: ${path}`);
    return [];
  }
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function readRun(prefix, id = basename(prefix), options = { oracles: false, thresholds: {} }) {
  const bundle = readJson(`${prefix}.json`);
  repairBundleEndTick(bundle);
  const envelope = readJson(`${prefix}.envelope.json`);
  const traceRows = readTrace(`${prefix}.llm-trace.jsonl`, { required: !options.oracles });
  const oracleViolations = options.oracles
    ? runOracles(bundle, envelope, options.thresholds ?? {})
    : [];
  return {
    id,
    prefix,
    bundle,
    envelope,
    traceRows,
    ...(oracleViolations.length > 0 ? { oracleViolations } : {}),
  };
}



function verifyBundleWithReplaySelfCheck(bundle) {
  const md = bundle.metadata ?? {};
  const endTick = md.endTick ?? 0;
  const startTick = md.startTick ?? 0;
  if ((bundle.commands?.length ?? 0) === 0 && endTick > startTick) {
    return {
      kind: 'replay-self-check',
      ok: false,
      checkedSegments: 0,
      skippedSegments: 0,
      stateDivergences: 0,
      eventDivergences: 0,
      executionDivergences: 0,
      error: 'bundle has no command payloads; replay self-check would be a no-op',
    };
  }

  try {
    const replayer = SessionReplayer.fromBundle(bundle, {
      worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
      skipRegistrationCheck: true,
    });
    const result = replayer.selfCheck({ stopOnFirstDivergence: true });
    return replaySelfCheckEvidenceFromResult(result);
  } catch (err) {
    return {
      kind: 'replay-self-check',
      ok: false,
      checkedSegments: 0,
      skippedSegments: 0,
      stateDivergences: 0,
      eventDivergences: 0,
      executionDivergences: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function normalizeOutPath(path) {
  if (path) return path.endsWith('.json') ? path : `${path}.json`;
  const now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `output/self-improvement/${now}.json`;
}

async function main() {
  const args = parseArgs(process.argv);
  const runOptions = { oracles: args.oracles, thresholds: args.thresholds };
  const current = readRun(args.current, basename(args.current), runOptions);
  const baseline = args.baseline ? readRun(args.baseline, basename(args.baseline), runOptions) : undefined;
  const outJson = normalizeOutPath(args.out);
  const outMd = outJson.replace(/\.json$/i, '.md');

  const ledger = buildSelfImprovementLedger({
    generatedAt: new Date().toISOString(),
    current,
    ...(baseline ? { baseline } : {}),
    verification: {
      current: verifyBundleWithReplaySelfCheck(current.bundle),
      ...(baseline ? { baseline: verifyBundleWithReplaySelfCheck(baseline.bundle) } : {}),
    },
  });

  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify(ledger, null, 2));
  writeFileSync(outMd, formatSelfImprovementLedgerMarkdown(ledger));

  console.log(`[playtest-self-improve] wrote ${outJson}`);
  console.log(`[playtest-self-improve] wrote ${outMd}`);
  console.log(
    `[playtest-self-improve] findings=${ledger.current.standardizedFindingCount} `
      + `selfCheck=${ledger.verification.current.ok ? 'ok' : 'failed'} `
      + `comparison=${ledger.comparison ? 'yes' : 'no'} `
      + `oracles=${args.oracles ? 'yes' : 'no'}`,
  );
}

main().catch((err) => {
  console.error('[playtest-self-improve] fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
