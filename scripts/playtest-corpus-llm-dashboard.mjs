#!/usr/bin/env node
// Phase-6.C.1: HTML dashboard for cross-corpus baseline drift.
//
// Reads `output/corpus-llm/<dir>/SUMMARY-LLM.md` + sibling
// `output/playtests-llm/*.envelope.json` files (matched by run name)
// + the per-run `*-screenshots/` dirs, then emits a static
// `dashboard.html` next to SUMMARY-LLM.md. The dashboard surfaces:
//
// - Header: corpus run total cost, # runs, # halts.
// - Per-run table: name | seed | maxTicks | stopReason | ticks | decisions | cost | winner | observation verdict.
// - Per-run-per-checkpoint thumbnails: 3-up grid (baseline / run / diff-mask).
//
// Pure script — no game-code changes. The dashboard is self-contained
// HTML+CSS, no JS dependencies; thumbnails are referenced by relative
// `<img src=>` paths so the file works directly in the browser when
// opened from the corpus-llm dir.
//
// Run via `npm run playtest:corpus-dashboard -- <corpus-dir>`. When
// no arg is passed, picks the newest `output/corpus-llm/<dir>` by
// mtime.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';

function main() {
  const argDir = process.argv[2];
  const corpusDir = resolveCorpusDir(argDir);
  if (!corpusDir) {
    console.error(
      '[dashboard] no corpus dir found. Run `npm run playtest:corpus-llm` first, '
        + 'or pass the dir explicitly: `npm run playtest:corpus-dashboard -- output/corpus-llm/2026-05-09-141500`',
    );
    process.exit(1);
  }
  const summaryPath = join(corpusDir, 'SUMMARY-LLM.md');
  if (!existsSync(summaryPath)) {
    console.error(`[dashboard] no SUMMARY-LLM.md in ${corpusDir}`);
    process.exit(1);
  }
  const corpusName = basename(corpusDir);
  const runs = collectRuns(corpusDir);
  const html = renderDashboard({ corpusName, summaryPath, runs });
  const outPath = join(corpusDir, 'dashboard.html');
  writeFileSync(outPath, html);
  console.log(`[dashboard] wrote ${outPath} (${runs.length} run${runs.length === 1 ? '' : 's'})`);
}

function resolveCorpusDir(argDir) {
  if (argDir) {
    return existsSync(argDir) ? argDir : null;
  }
  const root = 'output/corpus-llm';
  if (!existsSync(root)) return null;
  const subdirs = readdirSync(root)
    .map((name) => join(root, name))
    .filter((p) => statSync(p).isDirectory())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return subdirs[0] ?? null;
}

// Discover envelopes by walking output/playtests-llm/ for files whose
// stem prefixes match the corpus dir's date stamp. The corpus runner
// writes per-row outputs as `output/playtests-llm/<date>-<HHMMSS>-<name>.envelope.json`.
function collectRuns(corpusDir) {
  const playtestsRoot = 'output/playtests-llm';
  if (!existsSync(playtestsRoot)) return [];
  // Corpus dir basename is `<date>-<HHMMSS>` — match envelope stems
  // that begin with the same prefix to avoid mixing runs from other
  // corpus invocations on the same day.
  const stamp = basename(corpusDir);
  const entries = readdirSync(playtestsRoot)
    .filter((f) => f.endsWith('.envelope.json'))
    .filter((f) => f.startsWith(stamp));
  const runs = [];
  for (const file of entries) {
    const fullPath = join(playtestsRoot, file);
    let envelope;
    try {
      envelope = JSON.parse(readFileSync(fullPath, 'utf8'));
    } catch (err) {
      console.warn(`[dashboard] failed to read ${fullPath}: ${err?.message ?? err}`);
      continue;
    }
    const stem = file.replace(/\.envelope\.json$/, '');
    // Run name is everything after the stamp prefix + '-'.
    const name = stem.startsWith(stamp + '-') ? stem.slice(stamp.length + 1) : stem;
    runs.push({
      name,
      stem,
      envelopePath: fullPath,
      screenshotsDir: join(playtestsRoot, `${stem}-screenshots`),
      envelope,
    });
  }
  runs.sort((a, b) => a.name.localeCompare(b.name));
  return runs;
}

function renderDashboard({ corpusName, summaryPath, runs }) {
  const baselineRoot = (seed) => `tests/playtest/baselines/${seed}`;
  const corpusDirAbs = dirname(summaryPath);
  const totals = runs.reduce(
    (acc, r) => {
      acc.cost += r.envelope.totalCostUsd ?? 0;
      acc.halts += r.envelope.stopReason === 'engineHalt' ? 1 : 0;
      return acc;
    },
    { cost: 0, halts: 0 },
  );
  const tableRows = runs
    .map((r) => renderRunRow(r))
    .join('\n');
  const thumbnailSections = runs
    .map((r) => renderThumbnails(r, baselineRoot(r.envelope.seed ?? extractSeedFromName(r.name)), corpusDirAbs))
    .filter((s) => s.length > 0)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>LLM-agent corpus dashboard — ${escapeHtml(corpusName)}</title>
  <style>
    body { font-family: -apple-system, system-ui, Segoe UI, sans-serif; max-width: 1100px; margin: 24px auto; color: #1a1a1a; }
    h1 { font-size: 1.4em; margin-bottom: 0.2em; }
    h2 { font-size: 1.1em; margin-top: 1.6em; border-bottom: 1px solid #ddd; padding-bottom: 0.2em; }
    h3 { font-size: 0.95em; margin-top: 1.2em; color: #555; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9em; }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    th { background: #f7f7f7; font-weight: 600; }
    .halted { color: #b91c1c; font-weight: 600; }
    .ok { color: #15803d; }
    .summary { background: #f0f4f8; padding: 12px 16px; border-radius: 6px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 6px; }
    .grid figure { margin: 0; text-align: center; font-size: 0.8em; color: #555; }
    .grid img { width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; image-rendering: pixelated; }
    .delta { font-family: monospace; font-size: 0.85em; }
    .delta-medium { color: #b45309; font-weight: 600; }
    .delta-high { color: #b91c1c; font-weight: 700; }
  </style>
</head>
<body>
  <h1>LLM-agent corpus — ${escapeHtml(corpusName)}</h1>
  <div class="summary">
    <strong>${runs.length}</strong> run${runs.length === 1 ? '' : 's'},
    total cost <strong>$${totals.cost.toFixed(4)}</strong>,
    <strong>${totals.halts}</strong> engineHalt${totals.halts === 1 ? '' : 's'}.
  </div>

  <h2>Runs</h2>
  <table>
    <thead><tr>
      <th>Run</th><th>Seed</th><th>maxTicks</th><th>stopReason</th><th>ticks</th><th>decisions</th><th>cost</th><th>winner</th><th>observation</th><th>visual</th>
    </tr></thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <h2>Visual checkpoints</h2>
  ${thumbnailSections.length === 0 ? '<p><em>No visual-oracle data in any run envelope.</em></p>' : thumbnailSections}
</body>
</html>
`;
}

function renderRunRow(r) {
  const env = r.envelope;
  const stopClass = env.stopReason === 'engineHalt' ? 'halted' : 'ok';
  // Codex impl-1 MED 3 / Claude impl-1 MED: every dynamic interpolation
  // — including formatWinner's output and integer ticks — flows
  // through escapeHtml. The current envelope shapes are well-typed,
  // but the script reads JSON from disk; treat it as untrusted.
  const winner = env.winner
    ? escapeHtml(formatWinner(env.winner))
    : '—';
  const observation = env.observation
    ? escapeHtml(env.observation.verdict)
    : '—';
  // Claude impl-2 O2: visual column surfaces high-severity violations
  // and missingTicks counts so operators see the regression-gate
  // signal (and the "no captures" failure mode) without opening JSON.
  const visualHighCount = (env.visualOracle?.violations ?? []).filter(
    (v) => v.severity === 'high',
  ).length;
  const visualTotalViolations = (env.visualOracle?.violations ?? []).length;
  const visualMissingCount = (env.visualOracle?.missingTicks ?? []).length;
  const visualSummary = env.visualOracle
    ? `${visualHighCount}H/${visualTotalViolations}V/${visualMissingCount}M`
    : '—';
  const visualCellClass = visualHighCount > 0 ? 'halted' : '';
  return `<tr>
    <td>${escapeHtml(r.name)}</td>
    <td>${escapeHtml(env.seed ?? '')}</td>
    <td>${escapeHtml(env.maxTicks ?? '')}</td>
    <td class="${stopClass}">${escapeHtml(env.stopReason ?? '')}${env.errorMessage ? `<br><small>${escapeHtml(env.errorMessage)}</small>` : ''}</td>
    <td>${escapeHtml(env.ticksRun ?? '')}</td>
    <td>${escapeHtml(env.decisionsRun ?? '')}</td>
    <td>$${(env.totalCostUsd ?? 0).toFixed(4)}</td>
    <td>${winner}</td>
    <td>${observation}</td>
    <td class="${visualCellClass}">${escapeHtml(visualSummary)}</td>
  </tr>`;
}

function formatWinner(w) {
  if (w.kind === 'winner') return `owner ${w.ownerId}`;
  if (w.kind === 'tie') return 'tie';
  if (w.kind === 'in-progress') return `in-progress (${(w.aliveOwners || []).join(', ')})`;
  return JSON.stringify(w);
}

function renderThumbnails(r, baselineDir, corpusDirAbs) {
  const env = r.envelope;
  const deltas = env.visualOracle?.deltas ?? [];
  if (deltas.length === 0) return '';
  const rows = deltas
    .map((d) => {
      const baselinePath = relPathFromCorpus(corpusDirAbs, join(baselineDir, `${d.tick}.png`));
      const runPath = relPathFromCorpus(corpusDirAbs, join(r.screenshotsDir, `${d.tick}.png`));
      // Diff PNGs aren't currently persisted by the runner script —
      // visualOracle constructs them in-memory only. For now, show
      // baseline + run side-by-side; placeholder for the diff column
      // so the grid alignment holds.
      const cls =
        d.diffFraction >= 0.05 ? 'delta-high'
          : d.diffFraction >= 0.005 ? 'delta-medium'
            : '';
      return `<h3>tick ${escapeHtml(d.tick)} <span class="delta ${cls}">${(d.diffFraction * 100).toFixed(2)}%</span></h3>
      <div class="grid">
        <figure><img src="${escapeHtml(baselinePath)}" alt="baseline"><figcaption>baseline</figcaption></figure>
        <figure><img src="${escapeHtml(runPath)}" alt="run"><figcaption>run</figcaption></figure>
        <figure><div style="background:#eee;border-radius:4px;height:100%;display:flex;align-items:center;justify-content:center;color:#888;font-size:0.85em;">diff overlay (not persisted)</div><figcaption>diff</figcaption></figure>
      </div>`;
    })
    .join('\n');
  return `<h2 style="margin-top:2em">${escapeHtml(r.name)}</h2>${rows}`;
}

function relPathFromCorpus(corpusDirAbs, target) {
  // The dashboard.html lives at corpusDirAbs/dashboard.html; img src
  // paths must be relative to that. relative(corpusDirAbs, target)
  // gives a `..` walk that resolves against the dashboard's location.
  return relative(corpusDirAbs, target).split('\\').join('/');
}

function extractSeedFromName(name) {
  // Best-effort: corpus row names typically encode the seed (e.g.
  // `default-seed-llm-smoke`). Fall back to undefined when no clear
  // mapping exists.
  return undefined;
}

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

main();
