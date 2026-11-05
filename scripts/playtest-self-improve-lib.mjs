// The work of `npm run playtest:self-improve` (scripts/playtest-self-improve.mjs, which only runs `main` and turns a
// rejection into exit 1): build a self-improvement ledger from recorded playtest artifacts. Usage is in that file.
//
// WHY A SEPARATE FILE. Importing this runs nothing, so tests/playtest/playtestSelfImproveScript.test.ts calls `main` in
// its own process. It used to run the script through npm, which started npm, a shell, tsx's CLI and a node child that
// compiled the 521 modules this file loads (an emptied tsx cache held 521 files after one run). On a Windows runner on
// 2026-11-05 the first of its two cases took 28.9 s of its 30 s limit (CI run 42105898172).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

import { SessionReplayer } from 'civ-engine';

import { readBundleFile } from '../src/game/playtest/bundleIo.ts';
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

function requireArtifact(path) {
  if (!existsSync(path)) {
    throw new Error(`missing required artifact: ${path}`);
  }
  return path;
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
  // The bundle is the one artifact here `readJson` cannot handle: a full-length
  // run's JSON is past V8's max string length, so `JSON.parse(readFileSync(…))`
  // throws `RangeError: Invalid string length` on exactly the long runs this
  // ledger is built for. Streamed instead — and called by name, because a
  // wrapper is what hid this read from the call-site gate in the first place.
  const bundle = readBundleFile(requireArtifact(`${prefix}.json`));
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

/**
 * Builds the ledger that `argv` asks for and writes its JSON and Markdown. A usage error exits the process with
 * status 2, as the script does; any other failure rejects.
 * @param {string[]} argv the process's arguments: node, the script, then the script's own
 */
export async function main(argv) {
  const args = parseArgs(argv);
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
