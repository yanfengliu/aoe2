#!/usr/bin/env node
// PreToolUse hook (.claude/settings.json): a scratch probe under tmp/probes/
// must say which existing debug tool answers its question, or why none does,
// before it is written or run. ("Existing", not "engine": the first tool
// listed below is this repo's own script, and two engine probes that this
// message used to advertise do not serve this repo at all — see AGENTS.md,
// Debugging, and the 2026-09-06 asks in docs/engine-feedback/current.md.)
//
// The rule it enforces is in AGENTS.md ("Debugging"). It exists because the
// rule as prose was skipped twice — 2026-06-13 and 2026-09-05 — with the
// memory that states it loaded both times. A hook fires at the moment of the
// decision; a sentence read at session start does not.
//
// Accepts:  a line starting with `// harness:` or `# harness:` followed by
//           anything non-empty, e.g.
//             // harness: replay:inspect on a bundle from `npm run playtest -- --all-ai --max-ticks 45000`
//             // harness: none — asks why THIS unit chose THAT cell; a replay re-simulates plans from a snapshot, so only the live bridge answers it
// Refuses:  Write/Edit of a tmp/probes/*.{mjs,ts,js,py} whose content has no such line, and
//           Bash that runs one (node/tsx/npx tsx/python <path>) whose file has no such line.
// Exit 2 with the reason on stderr is the blocking form for PreToolUse.

import { existsSync, readFileSync } from 'node:fs';

const MARK = /^\s*(?:\/\/|#)\s*harness:\s*\S/m;
const PROBE_PATH = /(?:^|[\\/])tmp[\\/]probes[\\/].+\.(?:mjs|ts|js|py)$/i;
const RUN = /\b(?:npx\s+tsx|tsx|node|python3?)\s+"?([^\s"']*tmp[\\/]probes[\\/][^\s"']+\.(?:mjs|ts|js|py))"?/g;

const TOOLS = [
  '`bundleHotspots(bundle)` — which ticks are worth looking at (failures, duration outliers, markers); pure, builds no world, so it goes first',
  '`snapshotAtTick(bundle, tick)` — world state at any recorded tick, folded with ZERO World construction and no game code',
  '`npm run replay:inspect -- <bundle.json> --ticks a,b,c` — THIS repo\'s script (scripts/replay-inspect.mjs), not the engine\'s: aoe2-shaped per-owner rows from a recorded run (record one with `npm run playtest -- --all-ai --max-ticks N`)',
  '`diffBundles` / `SessionReplayer.forkAt` + `Divergence` — two recorded runs compared structurally (an A/B)',
  '`SessionReplayer.selfCheck()` — whether the recording is deterministic, before you trust anything read off it',
  '`WorldHistoryRecorder` + `summarizeWorldHistoryRange` — record and fold a LIVE world with no bundle at all',
  '`WorldDebugger` + `createVisibilityDebugProbe(key, visibility)` — type-compatible with the VisibilityMap built in simulation/createSimulationBridge.ts:84 (a local there; reaching it costs a one-line export)',
  '`bridge.getDebugSnapshot()` — who is blocking whom: per-unit cell and sub-cell position (`coarseVsFine`) and current move target (`unitPaths`)',
  'civ-engine\'s read-only MCP server (`node ../civ-engine/mcp/dist/cli.js --corpus <dir>`) — 14 tools over a bundle corpus',
];

// Deliberately NOT listed: `createOccupancyDebugProbe` takes an OccupancyGrid
// and this repo holds an OccupancyBinding whose grid is private, so it does not
// attach — and its payload is eight scalars, so it counts cells and names none.
// `createPathQueueDebugProbe` wants a path request queue; movement here is
// synchronous findGridPath plus a local cache, so it does not apply.

function refuse(path, why) {
  process.stderr.write(
    `${path}: ${why}\n`
    + 'A probe names the existing debug tool that answers its question, or why none does, on a line starting with `// harness:`.\n'
    + TOOLS.map((t) => `  - ${t}`).join('\n') + '\n'
    + '  - `// harness: none — <reason>` when the question lives in bridge closure state a replay would re-simulate (which cell a unit chose, and why).\n'
    + 'See AGENTS.md, Debugging.\n',
  );
  process.exit(2);
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // not our shape; never block on a parse failure
}
const tool = input.tool_name;
const ti = input.tool_input ?? {};

if ((tool === 'Write' || tool === 'Edit') && PROBE_PATH.test(ti.file_path ?? '')) {
  const onDisk = existsSync(ti.file_path) ? readFileSync(ti.file_path, 'utf8') : '';
  const text = tool === 'Write' ? (ti.content ?? '') : onDisk + '\n' + (ti.new_string ?? '');
  if (!MARK.test(text)) refuse(ti.file_path, 'has no `// harness:` line');
} else if (tool === 'Bash') {
  const cmd = ti.command ?? '';
  for (const match of cmd.matchAll(RUN)) {
    const rel = match[1];
    if (existsSync(rel) && !MARK.test(readFileSync(rel, 'utf8'))) {
      refuse(rel, 'is about to run and has no `// harness:` line');
    }
  }
}
process.exit(0);
