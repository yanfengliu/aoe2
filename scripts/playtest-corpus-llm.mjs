#!/usr/bin/env node
// LLM-corpus runner. Loops `playtest:llm` over playtest-corpus-llm.json
// rows; aggregates SUMMARY-LLM.md with cost rollup; prunes old runs.
//
// Skipped cleanly (exit 0) when ANTHROPIC_API_KEY is absent — design
// Codex MED4. CI's playtest-llm.yml workflow guards at the job level
// too; this is a defense-in-depth runtime check.
//
// Run via `tsx scripts/playtest-corpus-llm.mjs` (set up by
// `npm run playtest:corpus-llm`).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseCorpusLlmFile } from '../src/game/playtest/corpusLlmSchema.ts';

if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === '') {
  console.log('[playtest-corpus-llm] skipped: ANTHROPIC_API_KEY env var is absent.');
  process.exit(0);
}

const useShell = process.platform === 'win32';
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const RETENTION_KEEP = 5; // most-recent runs to keep

// Retention pruning (Claude design-2 LOW 1). Sort output/playtests-llm/
// by mtime descending; remove all but the most recent N runs. Each
// run is one timestamped subdir.
function pruneOldRuns(rootDir) {
  if (!existsSync(rootDir)) return;
  const entries = readdirSync(rootDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({
      name: e.name,
      path: `${rootDir}/${e.name}`,
      mtime: statSync(`${rootDir}/${e.name}`).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (entries.length <= RETENTION_KEEP) return;
  for (const old of entries.slice(RETENTION_KEEP)) {
    console.log(`[playtest-corpus-llm] pruning old run: ${old.path}`);
    rmSync(old.path, { recursive: true, force: true });
  }
}

const corpus = parseCorpusLlmFile(readFileSync('playtest-corpus-llm.json', 'utf8'));
const date = new Date().toISOString().slice(0, 10);
const corpusDir = `output/corpus-llm/${date}`;
mkdirSync(corpusDir, { recursive: true });

const playtestsRoot = 'output/playtests-llm';
mkdirSync(playtestsRoot, { recursive: true });
pruneOldRuns(playtestsRoot);

const rows = [
  `# Playtest LLM corpus — ${date}`,
  '',
  '| Run | Seed | maxTicks | stopReason | ticksRun | decisions | totalCost |',
  '|---|---|---|---|---|---|---|',
];
let totalCost = 0;
let anyHigh = false;

for (const run of corpus.runs) {
  const out = `${playtestsRoot}/${date}-${run.name}`;
  const args = [
    'run', 'playtest:llm', '--',
    '--seed', run.seed,
    '--max-ticks', String(run.maxTicks),
    '--out', out,
  ];
  if (run.decisionInterval) args.push('--decision-interval', String(run.decisionInterval));
  if (run.owners) args.push('--owners', run.owners.join(','));
  if (run.costBudgetUsd) args.push('--cost-budget', String(run.costBudgetUsd));

  console.log(`[playtest-corpus-llm] running ${run.name}…`);
  const playR = spawnSync(npmBin, args, {
    encoding: 'utf8',
    shell: useShell,
    stdio: 'inherit',
  });
  if (playR.status !== 0) {
    const why = playR.error?.message ?? `exit ${playR.status}`;
    console.error(`[playtest-corpus-llm] run ${run.name} failed: ${why}`);
    rows.push(
      `| ${run.name} | ${run.seed} | ${run.maxTicks} | spawn-failed | — | — | — |`,
    );
    // Write partial summary before exit so CI can post it.
    writeFileSync(`${corpusDir}/SUMMARY-LLM.md`, rows.join('\n'));
    process.exit(1);
  }

  // Parse the envelope to extract trace summary.
  let env;
  try {
    env = JSON.parse(readFileSync(`${out}.envelope.json`, 'utf8'));
  } catch {
    rows.push(`| ${run.name} | ${run.seed} | ${run.maxTicks} | no-envelope | — | — | — |`);
    continue;
  }
  totalCost += env.totalCostUsd ?? 0;
  if (env.errorMessage) anyHigh = true;
  rows.push(
    `| ${run.name} | ${run.seed} | ${run.maxTicks} | ${env.stopReason} | ${env.ticksRun} | ${env.decisionsRun ?? '—'} | $${(env.totalCostUsd ?? 0).toFixed(4)} |`,
  );
}

rows.push('', `**Total cost across corpus: $${totalCost.toFixed(4)}**`);
writeFileSync(`${corpusDir}/SUMMARY-LLM.md`, rows.join('\n'));
console.log(`[playtest-corpus-llm] summary: ${corpusDir}/SUMMARY-LLM.md`);
process.exit(anyHigh ? 1 : 0);
