#!/usr/bin/env node
// HTML dashboard for LLM-corpus runs. Option C (2026-06-10): no
// baseline comparison — thumbnails show the run's checkpoint
// screenshots only (a stochastic player has no "correct" reference
// image; render regressions are covered by the deterministic suites).
//
// Reads `output/corpus-llm/<dir>/SUMMARY-LLM.md` + sibling
// `output/playtests-llm/*.envelope.json` files (matched by run name)
// + the per-run `*-screenshots/` dirs, then emits a static
// `dashboard.html` next to SUMMARY-LLM.md. The dashboard surfaces:
//
// - Header: corpus run total cost, # runs, # halts.
// - Per-run table: name | seed | maxTicks | stopReason | ticks | decisions | cost | winner | findings count.
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
  const corpusDirAbs = dirname(summaryPath);
  const totals = runs.reduce(
    (acc, r) => {
      acc.cost += r.envelope.totalCostUsd ?? 0;
      acc.halts += r.envelope.stopReason === 'engineHalt' ? 1 : 0;
      acc.providerErrors += r.envelope.stopReason === 'providerError' ? 1 : 0;
      return acc;
    },
    { cost: 0, halts: 0, providerErrors: 0 },
  );
  const tableRows = runs
    .map((r) => renderRunRow(r))
    .join('\n');
  const thumbnailSections = runs
    .map((r) => renderThumbnails(r, corpusDirAbs))
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
    .warn { color: #b45309; font-weight: 600; }
    .ok { color: #15803d; }
    .summary { background: #f0f4f8; padding: 12px 16px; border-radius: 6px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 6px; }
    .grid figure { margin: 0; text-align: center; font-size: 0.8em; color: #555; }
    .grid img { width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; image-rendering: pixelated; }
  </style>
</head>
<body>
  <h1>LLM-agent corpus — ${escapeHtml(corpusName)}</h1>
  <div class="summary">
    <strong>${runs.length}</strong> run${runs.length === 1 ? '' : 's'},
    total cost <strong>$${totals.cost.toFixed(4)}</strong>,
    <strong>${totals.halts}</strong> engineHalt${totals.halts === 1 ? '' : 's'},
    <strong>${totals.providerErrors}</strong> providerError${totals.providerErrors === 1 ? '' : 's'}.
  </div>

  <h2>Runs</h2>
  <table>
    <thead><tr>
      <th>Run</th><th>Seed</th><th>maxTicks</th><th>stopReason</th><th>ticks</th><th>decisions</th><th>cost</th><th>winner</th><th>findings</th><th>screenshots</th>
    </tr></thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <h2>Visual checkpoints</h2>
  ${thumbnailSections.length === 0 ? '<p><em>No checkpoint screenshots in any run.</em></p>' : thumbnailSections}
</body>
</html>
`;
}

function renderRunRow(r) {
  const env = r.envelope;
  // provider-error-retry: providerError is neither a clean exit (green)
  // nor an engine fault (red) — colour it amber so a transient LLM-call
  // stop is honestly distinguished from a fully-clean run. The cell
  // already renders errorMessage as <small>, so the cause shows inline.
  let stopClass = 'ok';
  if (env.stopReason === 'engineHalt') stopClass = 'halted';
  else if (env.stopReason === 'providerError') stopClass = 'warn';
  // Codex impl-1 MED 3 / Claude impl-1 MED: every dynamic interpolation
  // — including formatWinner's output and integer ticks — flows
  // through escapeHtml. The current envelope shapes are well-typed,
  // but the script reads JSON from disk; treat it as untrusted.
  const winner = env.winner
    ? escapeHtml(formatWinner(env.winner))
    : '—';
  // Conformance findings count, merged into the envelope by
  // `playtest-findings.mjs` (replaces the removed fun verdict). Shows
  // how many objective gap/divergence findings the run surfaced.
  const findings = Array.isArray(env.findings)
    ? escapeHtml(env.findings.length)
    : '—';
  // Option C: screenshots column counts the run's persisted
  // checkpoint PNGs (dashboard-only; no diffing).
  let screenshotCount = 0;
  try {
    screenshotCount = readdirSync(r.screenshotsDir).filter((f) => f.endsWith('.png')).length;
  } catch {
    /* no screenshots dir */
  }
  return `<tr>
    <td>${escapeHtml(r.name)}</td>
    <td>${escapeHtml(env.seed ?? '')}</td>
    <td>${escapeHtml(env.maxTicks ?? '')}</td>
    <td class="${stopClass}">${escapeHtml(env.stopReason ?? '')}${env.errorMessage ? `<br><small>${escapeHtml(env.errorMessage)}</small>` : ''}</td>
    <td>${escapeHtml(env.ticksRun ?? '')}</td>
    <td>${escapeHtml(env.decisionsRun ?? '')}</td>
    <td>$${(env.totalCostUsd ?? 0).toFixed(4)}</td>
    <td>${winner}</td>
    <td>${findings}</td>
    <td>${escapeHtml(screenshotCount)}</td>
  </tr>`;
}

function formatWinner(w) {
  if (w.kind === 'winner') return `owner ${w.ownerId}`;
  if (w.kind === 'tie') return 'tie';
  if (w.kind === 'in-progress') return `in-progress (${(w.aliveOwners || []).join(', ')})`;
  return JSON.stringify(w);
}

function renderThumbnails(r, corpusDirAbs) {
  let ticks = [];
  try {
    ticks = readdirSync(r.screenshotsDir)
      .filter((f) => f.endsWith('.png'))
      .map((f) => Number(f.replace(/.png$/, '')))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  } catch {
    return '';
  }
  if (ticks.length === 0) return '';
  const figures = ticks
    .map((tick) => {
      const runPath = relPathFromCorpus(corpusDirAbs, join(r.screenshotsDir, `${tick}.png`));
      return `<figure><img src="${escapeHtml(runPath)}" alt="tick ${tick}"><figcaption>tick ${escapeHtml(tick)}</figcaption></figure>`;
    })
    .join('\n');
  return `<h2 style="margin-top:2em">${escapeHtml(r.name)}</h2>
      <div class="grid">
        ${figures}
      </div>`;
}

function relPathFromCorpus(corpusDirAbs, target) {
  // The dashboard.html lives at corpusDirAbs/dashboard.html; img src
  // paths must be relative to that. relative(corpusDirAbs, target)
  // gives a `..` walk that resolves against the dashboard's location.
  return relative(corpusDirAbs, target).split('\\').join('/');
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
