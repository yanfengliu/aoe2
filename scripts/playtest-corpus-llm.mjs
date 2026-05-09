#!/usr/bin/env node
// LLM-corpus runner. Loops `playtest:llm` over playtest-corpus-llm.json
// rows; aggregates SUMMARY-LLM.md with cost rollup; prunes old runs.
//
// Skipped cleanly (exit 0) when no LLM provider is reachable — neither
// the `claude` CLI (subscription auth) nor ANTHROPIC_API_KEY (API auth)
// is available. CI's playtest-llm.yml workflow guards at the job level
// too; this is a defense-in-depth runtime check.
//
// Run via `tsx scripts/playtest-corpus-llm.mjs` (set up by
// `npm run playtest:corpus-llm`).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseCorpusLlmFile } from '../src/game/playtest/corpusLlmSchema.ts';
import { resolveClaudeBinary } from '../src/game/playtest/llmProviders/index.ts';

const useShell = process.platform === 'win32';
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// Detect whether the claude-code provider can actually spawn claude
// from this Node process — Codex impl-1 MED 3. resolveClaudeBinary
// returns null on Windows if only the .cmd shim is on PATH (no .exe).
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

const apiKeySet = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '';
const claudeAvailable = canSpawnClaude();
if (!apiKeySet && !claudeAvailable) {
  console.log(
    '[playtest-corpus-llm] skipped: no LLM provider available '
      + '(install `claude` CLI or set ANTHROPIC_API_KEY).',
  );
  process.exit(0);
}
// Retention semantics: keep the most-recent N run-stems where one
// stem = "${date}-${hhmmss}-${row.name}" (Phase-6.A.3 timestamp added
// to prevent same-day clobber). For a corpus of K rows × M
// invocations-per-day, RETENTION_KEEP retains roughly N/(K*M)
// calendar days. The default suits the current 1-row corpus × 1
// invocation/day × 25 days; if you grow the corpus or run more
// frequently, proportionally raise this to keep the same calendar
// window. Operators who need stricter forensic history should bump
// this number rather than rely on the per-row count.
const RETENTION_KEEP = 25;

// Retention pruning (Claude design-2 LOW 1; Codex impl-345 M5).
// Each LLM playtest emits FLAT files at <rootDir>/<date>-<name>.json,
// .envelope.json, .llm-trace.jsonl, plus a sibling -screenshots/
// directory. Group these by stem (the "<date>-<name>" prefix), sort
// stems by newest-mtime across the group, keep the most recent N
// stems and delete every file/dir whose stem is older.
function pruneOldRuns(rootDir) {
  if (!existsSync(rootDir)) return;
  const entries = readdirSync(rootDir, { withFileTypes: true });
  // Map<stem, { paths: string[], maxMtime: number }>
  const stems = new Map();
  for (const entry of entries) {
    const path = `${rootDir}/${entry.name}`;
    // Stem = filename minus the first dot suffix and minus the
    // trailing "-screenshots" suffix. E.g. "2026-05-09-default-seed-llm-smoke.envelope.json"
    // → stem "2026-05-09-default-seed-llm-smoke".
    let stem = entry.name;
    if (stem.endsWith('-screenshots')) stem = stem.slice(0, -'-screenshots'.length);
    const dotIdx = stem.indexOf('.');
    if (dotIdx !== -1) stem = stem.slice(0, dotIdx);
    const mtime = statSync(path).mtimeMs;
    const existing = stems.get(stem) ?? { paths: [], maxMtime: 0 };
    existing.paths.push(path);
    existing.maxMtime = Math.max(existing.maxMtime, mtime);
    stems.set(stem, existing);
  }
  const sortedStems = [...stems.entries()].sort((a, b) => b[1].maxMtime - a[1].maxMtime);
  if (sortedStems.length <= RETENTION_KEEP) return;
  for (const [stem, group] of sortedStems.slice(RETENTION_KEEP)) {
    console.log(`[playtest-corpus-llm] pruning old run group: ${stem} (${group.paths.length} files/dirs)`);
    for (const p of group.paths) {
      try {
        const stat = statSync(p);
        if (stat.isDirectory()) rmSync(p, { recursive: true, force: true });
        else unlinkSync(p);
      } catch (err) {
        console.warn(`[playtest-corpus-llm]   failed to remove ${p}: ${err?.message ?? err}`);
      }
    }
  }
}

const corpus = parseCorpusLlmFile(readFileSync('playtest-corpus-llm.json', 'utf8'));
// Phase-6.A.3: per-invocation timestamped corpus dir. Prior format
// `output/corpus-llm/<date>/` overwrote prior runs on the same day —
// running the corpus twice in one day lost the first run's
// SUMMARY-LLM.md and envelope rollups. The HHmmss suffix gives each
// invocation its own directory; CI / dashboards glob the parent and
// pick the newest by mtime when one is needed.
const now = new Date();
const date = now.toISOString().slice(0, 10);
const hhmmss = `${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;
const corpusDir = `output/corpus-llm/${date}-${hhmmss}`;
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
  // Phase-6.A.3 (Codex impl-1 MED 4): include the per-invocation
  // HHMMSS so a same-day re-run doesn't clobber the prior run's
  // bundle/envelope/trace files.
  const out = `${playtestsRoot}/${date}-${hhmmss}-${run.name}`;
  const args = [
    'run', 'playtest:llm', '--',
    '--seed', run.seed,
    '--max-ticks', String(run.maxTicks),
    '--out', out,
  ];
  if (run.decisionInterval) args.push('--decision-interval', String(run.decisionInterval));
  if (run.owners) args.push('--owners', run.owners.join(','));
  if (run.costBudgetUsd) args.push('--cost-budget', String(run.costBudgetUsd));
  // Phase-6.B (impl-2 M7): forward omniscient (cheat-mode) when set.
  // Default behavior is visibility-gated; rows must explicitly opt in.
  if (run.omniscient) args.push('--omniscient');

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
    anyHigh = true; // missing envelope IS a regression — the runner crashed
    continue;
  }
  totalCost += env.totalCostUsd ?? 0;
  // Distinguish operational stops (cost-budget-exceeded) from real
  // regressions (engineHalt). Cost budget exhaustion is expected
  // operator-side cap behavior, not a CI gate signal (Codex impl-345
  // M6). engineHalt OR an unexpected errorMessage IS a regression.
  if (env.stopReason === 'engineHalt') anyHigh = true;
  else if (env.errorMessage && env.errorMessage !== 'cost-budget-exceeded') anyHigh = true;
  rows.push(
    `| ${run.name} | ${run.seed} | ${run.maxTicks} | ${env.stopReason} | ${env.ticksRun} | ${env.decisionsRun ?? '—'} | $${(env.totalCostUsd ?? 0).toFixed(4)} |`,
  );
}

rows.push('', `**Total cost across corpus: $${totalCost.toFixed(4)}**`);
writeFileSync(`${corpusDir}/SUMMARY-LLM.md`, rows.join('\n'));
console.log(`[playtest-corpus-llm] summary: ${corpusDir}/SUMMARY-LLM.md`);
process.exit(anyHigh ? 1 : 0);
