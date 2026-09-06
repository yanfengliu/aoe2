#!/usr/bin/env node
// Loops `playtest` + `run-oracles` over playtest-corpus.json; aggregates a
// SUMMARY.md; exits non-zero on any HIGH oracle violation across the corpus.
// Run via `tsx scripts/playtest-corpus.mjs` (set up by `npm run playtest:corpus`).

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { SessionReplayer } from 'civ-engine';
import { readBundleFile } from '../src/game/playtest/bundleIo.ts';
import { parseCorpusFile } from '../src/game/playtest/corpusSchema.ts';
import { checkAgeProgression, checkEveryOwnerAgeProgression } from '../src/game/playtest/progressionCheck.ts';
import { createReplayWorldOnly } from '../src/game/simulation/replay/createReplayWorldOnly.ts';
import { makeReplayBridge } from '../src/game/simulation/replay/makeReplayBridge.ts';

// Replays a recorded bundle to its final tick and returns per-owner ages + the
// set of living owners, for the economy-progression gate. Opens at the bundle's
// ABSOLUTE final recorded tick (`metadata.endTick`) — NOT the run's elapsed-tick
// delta (`envelope.ticksRun = world.tick - startTick`), which differ if the
// scenario started at a nonzero tick. May throw (malformed bundle / replay
// failure); the caller handles that (fails the gate loud rather than crashing).
function readEndStateFromBundle(bundlePath) {
  // Streamed read: a full-length run's bundle is past V8's max string length,
  // so `JSON.parse(readFileSync(...))` would turn the progression gate into an
  // ERROR row on exactly the long runs it exists to check.
  const bundle = readBundleFile(bundlePath);
  if (bundle.metadata && (bundle.metadata.endTick ?? 0) <= 0) {
    const recordedMax = Math.max(
      bundle.metadata.persistedEndTick ?? 0,
      ...(bundle.ticks ?? []).map((t) => t.tick ?? 0),
    );
    bundle.metadata.endTick = recordedMax;
    bundle.metadata.durationTicks = recordedMax - (bundle.metadata.startTick ?? 0);
  }
  const replayer = SessionReplayer.fromBundle(bundle, {
    worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
    skipRegistrationCheck: true,
  });
  const world = replayer.openAt(bundle.metadata.endTick);
  const eco = makeReplayBridge(world, { fogOwner: 1 }).getEconomyState();
  // "Living" owner = has any unit or building. Relics are resources (not units
  // or buildings), so a relic-only owner reads as eliminated — matching the
  // winnerOracle precedent, and correct here (a relic alone isn't a live economy).
  const owners = new Set();
  for (const u of eco.units) if (u.owner != null) owners.add(u.owner);
  for (const b of eco.buildings) if (b.owner != null) owners.add(b.owner);
  return { ages: eco.ages ?? {}, aliveOwners: [...owners] };
}

// Resolve npm shim explicitly per platform. On Windows we MUST set
// shell: true: CVE-2024-27980's mitigation (Node 18.20.2 / 20.12.2 /
// 22.0.0+) refuses to spawn .cmd / .bat files without a shell and returns
// EINVAL. cmd.exe does not glob-expand `[]` so a bracketed model name is
// safe; per-row thresholds are still passed via tempfile +
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

  // Economy-progression gate: a long run must see at least one LIVING owner
  // reach the required age, else the economy stalled (the drop-off-freeze
  // class). Replay-based, so it runs only for rows that opt in.
  let progressionNote = '';
  if (run.requireAgeByEnd) {
    try {
      const { ages, aliveOwners } = readEndStateFromBundle(`${out}.json`);
      const result = checkAgeProgression(ages, aliveOwners, run.requireAgeByEnd);
      if (!result.ok) {
        totalHigh += 1;
        progressionNote = ` progression: FAIL (${result.message})`;
        console.error(`corpus: run ${run.name} progression gate FAILED — ${result.message}`);
      } else {
        progressionNote = ` progression: ok (${result.reached.map((r) => `${r.owner}:${r.age}`).join(', ')})`;
      }
      // The strict companion, when the row opts in. Appended AFTER the
      // any-owner note so it cannot be overwritten by it: a match where one
      // side never plays passes the check above, which is exactly how a frozen
      // AI on the boot map stayed invisible for a whole session.
      if (run.requireAgeForEveryOwner) {
        const strict = checkEveryOwnerAgeProgression(
          ages, aliveOwners, run.requireAgeForEveryOwner,
        );
        if (!strict.ok) {
          totalHigh += 1;
          progressionNote += ` everyOwner: FAIL (${strict.message})`;
          console.error(`corpus: run ${run.name} every-owner gate FAILED — ${strict.message}`);
        } else {
          progressionNote += ' everyOwner: ok';
        }
      }
    } catch (err) {
      // A bundle that can't be replayed can't be progression-checked. Fail the
      // gate LOUD (a HIGH) rather than crashing the whole corpus or silently
      // skipping the check.
      totalHigh += 1;
      const why = err instanceof Error ? err.message : String(err);
      progressionNote = ` progression: ERROR (${why})`;
      console.error(`corpus: run ${run.name} progression replay FAILED — ${why}`);
    }
  }
  rows.push(
    `| ${run.name} | ${run.seed} | ${run.maxTicks} | ${env.stopReason} | ${env.ticksRun} | ${high} | ${medium} | ${low} |${progressionNote}`,
  );
}

writeFileSync(`${corpusDir}/SUMMARY.md`, rows.join('\n'));
console.log(`summary: ${corpusDir}/SUMMARY.md`);
// Non-zero exit on any HIGH oracle violation across the corpus, so CI fails
// loud rather than silently uploading a SUMMARY.md with red rows.
process.exit(totalHigh > 0 ? 1 : 0);
