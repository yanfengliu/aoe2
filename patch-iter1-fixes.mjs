import { readFileSync, writeFileSync } from 'node:fs';

function patch(f, pairs) {
  let s = readFileSync(f, 'utf8');
  for (const [re, to] of pairs) {
    if (!re.test(s)) throw new Error(`${f} missing ${re.source.slice(0, 50)}`);
    s = s.replace(re, to);
  }
  writeFileSync(f, s);
  console.log('patched', f);
}

// 2. Corpus dangling comment.
patch('scripts/playtest-corpus-llm.mjs', [
  [/ {2}\/\/ Visual column format: `\{H\}H\/\{V\}V\/\{M\}M` — high-severity violations \/ total\r?\n/, ''],
]);

// 3. Dashboard header rejoin + dead CSS.
let d = readFileSync('scripts/playtest-corpus-llm-dashboard.mjs', 'utf8');
const headStart = d.indexOf('// HTML dashboard for LLM-corpus runs');
const headEnd = d.indexOf('\n', d.indexOf('// player has no "correct" reference image).'));
if (headStart < 0 || headEnd < 0) throw new Error('dashboard header anchors missing');
const headBlock = d.slice(headStart, headEnd);
const middleLines = headBlock
  .split(/\r?\n/)
  .filter((l) => !/option C|comparison — thumbnails|reference image\)|HTML dashboard for LLM-corpus/.test(l));
d = d.slice(0, headStart)
  + `// HTML dashboard for LLM-corpus runs. Option C (2026-06-10): no
// baseline comparison — thumbnails show the run's checkpoint
// screenshots only (a stochastic player has no "correct" reference
// image; render regressions are covered by the deterministic suites).
${middleLines.join('\n')}`
  + d.slice(headEnd);
d = d.replace(/ *\.delta(-medium|-high)? \{[^}]*\}\r?\n/g, '');
d = d.replace(/ *\.delta \{[^}]*\}\r?\n/g, '');
writeFileSync('scripts/playtest-corpus-llm-dashboard.mjs', d);
console.log('patched dashboard');

// 4. llmRunner stale comments.
patch('src/game/playtest/llmRunner.ts', [
  [/  \/\/ playtest-fixes C: freeze the sim before the first decision\. The\r?\n  \/\/ host's advanceTicks then becomes the sole tick source — tickAfter\r?\n  \/\/ tracks ticksRun exactly, maxTicks regains exact semantics, and\r?\n  \/\/ baseline checkpoints \(multiples of decisionIntervalTicks\) align\./,
   `  // playtest-fixes C: freeze the sim before the first decision. The
  // host's advanceTicks then becomes the sole tick source — tickAfter
  // tracks ticksRun exactly, maxTicks regains exact semantics, and
  // screenshot checkpoints (multiples of decisionIntervalTicks) align.`],
  [/ {6}\/\/ exactly on a checkpoint tick \(dashboard thumbnails; no baseline diffing\)\.\r?\n {6}\/\/ If the advance\r?\n {6}\/\/ overshoots a checkpoint \(decisionInterval doesn't divide the\r?\n {6}\/\/ checkpoint\), the checkpoint is SKIPPED \(logged warn\) — the\r?\n {6}\/\/ visual oracle then surfaces it as `missingTicks` rather than\r?\n {6}\/\/ matching against a wrong-tick screenshot which would\r?\n {6}\/\/ generate false diffs \(Codex impl-1 MED 1\)\./,
   `      // exactly on a checkpoint tick (dashboard thumbnails; no baseline
      // diffing). If the advance overshoots a checkpoint
      // (decisionInterval doesn't divide it), the checkpoint is
      // SKIPPED with a warn — better no thumbnail than a wrong-tick
      // one.`],
  [/ {12}\/\/ Misaligned: the advance overshot the checkpoint\. Skip\r?\n {12}\/\/ the capture; the visual oracle will see it as a\r?\n {12}\/\/ missingTick which is honest signal\. \(playtest-fixes E:\r?\n {12}\/\/ name the two real causes instead of asserting\r?\n {12}\/\/ non-divisibility — the 2026-06-09 run hit this for every\r?\n {12}\/\/ checkpoint purely from real-time drift\.\)/,
   `            // Misaligned: the advance overshot the checkpoint —
            // skip the capture (warn-only; playtest-fixes E named the
            // two real causes instead of asserting non-divisibility).`],
]);

// 4b. playtest-llm.mjs advanceTicks comment + 5. CLI doc block.
patch('scripts/playtest-llm.mjs', [
  [/ {6}\/\/ the requested count exactly and baseline checkpoints\r?\n {6}\/\/ \(multiples of decisionIntervalTicks\) land precisely\./,
   `      // the requested count exactly and screenshot checkpoints
      // (multiples of decisionIntervalTicks) land precisely.`],
  [/\/\/ {3}--no-screenshot {13}disable screenshot capture \(token-only mode\)\r?\n/,
   `//   --no-screenshot              disable screenshot capture (token-only mode)
//   --screenshot-every <ticks>   dashboard checkpoint screenshots cadence
//                                (default 1000; 0 disables; use multiples of
//                                --decision-interval so captures land)
`],
]);

// 6. Spec intro.
patch('design/spec-final.md', [
  [/drives the simulation through a Claude-based agent and checks for gameplay\/visual regressions\./,
   'drives the simulation through a Claude-based agent and checks for gameplay regressions (with advisory visual observation — no pixel-level gating).'],
]);
