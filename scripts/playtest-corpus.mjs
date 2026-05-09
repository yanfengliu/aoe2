#!/usr/bin/env node
// Loops `playtest` + `run-oracles` over playtest-corpus.json; aggregates a
// SUMMARY.md; exits non-zero on any HIGH oracle violation across the corpus.
// Run via `tsx scripts/playtest-corpus.mjs` (set up by `npm run playtest:corpus`).

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseCorpusFile } from '../src/game/playtest/corpusSchema.ts';

// Resolve npm shim explicitly per platform. `shell: true` is unsafe — it
// re-parses every arg through cmd.exe / sh and mangles JSON or quoted args.
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const corpus = parseCorpusFile(readFileSync('playtest-corpus.json', 'utf8'));
const date = new Date().toISOString().slice(0, 10);
const corpusDir = `output/corpus/${date}`;
mkdirSync(corpusDir, { recursive: true });

const rows = [
  `# Playtest corpus — ${date}`,
  '',
  '| Run | Seed | maxTicks | stopReason | ticksRun | High | Medium | Low |',
  '|---|---|---|---|---|---|---|---|',
];
let totalHigh = 0;

for (const run of corpus.runs) {
  const out = `output/playtests/${date}-${run.name}`;
  const playArgs = [
    'run',
    'playtest',
    '--',
    '--seed',
    run.seed,
    '--max-ticks',
    String(run.maxTicks),
    '--out',
    out,
  ];
  const playR = spawnSync(npmBin, playArgs, { encoding: 'utf8' });
  if (playR.status !== 0) {
    console.error(`corpus: run ${run.name} failed:\n${playR.stderr}`);
    process.exit(1);
  }
  const oracleArgs = ['run', 'run-oracles', '--', '--in', out];
  // Per-row thresholds via tempfile to avoid shell-quoting JSON braces/commas.
  if (run.thresholds) {
    const thresholdsPath = `${out}.thresholds.json`;
    writeFileSync(thresholdsPath, JSON.stringify(run.thresholds));
    oracleArgs.push('--thresholds-file', thresholdsPath);
  }
  const oracleR = spawnSync(npmBin, oracleArgs, { encoding: 'utf8' });
  totalHigh += oracleR.status ?? 0;

  const env = JSON.parse(readFileSync(`${out}.envelope.json`, 'utf8'));
  const report = readFileSync(`${out}-report/REPORT.md`, 'utf8');
  const high = (report.match(/^\| \S+ \| high \| /gm) ?? []).length;
  const medium = (report.match(/^\| \S+ \| medium \| /gm) ?? []).length;
  const low = (report.match(/^\| \S+ \| low \| /gm) ?? []).length;
  rows.push(
    `| ${run.name} | ${run.seed} | ${run.maxTicks} | ${env.stopReason} | ${env.ticksRun} | ${high} | ${medium} | ${low} |`,
  );
}

writeFileSync(`${corpusDir}/SUMMARY.md`, rows.join('\n'));
console.log(`summary: ${corpusDir}/SUMMARY.md`);
// Non-zero exit on any HIGH oracle violation across the corpus, so CI fails
// loud rather than silently uploading a SUMMARY.md with red rows.
process.exit(totalHigh > 0 ? 1 : 0);
