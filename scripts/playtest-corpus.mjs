#!/usr/bin/env node
// Loops `playtest` + `run-oracles` over playtest-corpus.json; aggregates a
// SUMMARY.md; exits non-zero on any HIGH oracle violation across the corpus.
// Run via `tsx scripts/playtest-corpus.mjs` (set up by `npm run playtest:corpus`).

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseCorpusFile } from '../src/game/playtest/corpusSchema.ts';

// Resolve npm shim explicitly per platform. On Windows we MUST set
// shell: true: CVE-2024-27980's mitigation (Node 18.20.2 / 20.12.2 /
// 22.0.0+) refuses to spawn .cmd / .bat files without a shell and returns
// EINVAL. cmd.exe does not glob-expand `[]` so the bracketed model name in
// propose-fix is safe; per-row thresholds are still passed via tempfile +
// `--thresholds-file` rather than inline JSON to avoid any cmd.exe quoting
// quirks. On Linux/macOS we keep shell: false so bash's glob-expansion of
// `[1m]` cannot bite us.
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const useShell = process.platform === 'win32';

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
  // Score-timer game length (spec §4.3): when set, the match ends on score at
  // this tick so the match-completion oracle can require a real conclusion.
  if (run.gameLength !== undefined) {
    playArgs.push('--game-length', String(run.gameLength));
  }
  // Headless AI-vs-AI: force an AI onto the human slot so the run is competitive.
  if (run.allAi) {
    playArgs.push('--all-ai');
  }
  const playR = spawnSync(npmBin, playArgs, { encoding: 'utf8', shell: useShell });
  if (playR.status !== 0) {
    const why = playR.error?.message ?? playR.stderr ?? `exit ${playR.status}`;
    console.error(`corpus: run ${run.name} failed:\n${why}`);
    rows.push(
      `| ${run.name} | ${run.seed} | ${run.maxTicks} | spawn-failed | — | — | — | — |`,
    );
    writeFileSync(`${corpusDir}/SUMMARY.md`, rows.join('\n'));
    process.exit(1);
  }
  const oracleArgs = ['run', 'run-oracles', '--', '--in', out];
  // Per-row thresholds via tempfile to avoid shell-quoting JSON braces/commas.
  if (run.thresholds) {
    const thresholdsPath = `${out}.thresholds.json`;
    writeFileSync(thresholdsPath, JSON.stringify(run.thresholds));
    oracleArgs.push('--thresholds-file', thresholdsPath);
  }
  const oracleR = spawnSync(npmBin, oracleArgs, { encoding: 'utf8', shell: useShell });
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
