#!/usr/bin/env node
// Did a change make the simulation slower? Steps the same match in TWO code
// trees, interleaved in ONE process, and reports the per-tick cost of the
// second tree as a RATIO of the first, with the machine's foreign load beside
// every number and a state digest of both worlds at every chunk.
//
//   npm run ai:tick-ab -- <scenario> <treeA> <treeB> [--chunk 1000] [--max-ticks N]
//
// scenarios: castle — the match `aiReachesCastleAge.test.ts` plays (boot map,
// both seats AI); lab — the no-attack coverage lab of
// `selfPlayContentCoverage.test.ts`; garrison and few — the two cases of
// `aiGarrisonedDefender.test.ts`. A tree is any checkout of this repo, e.g. a
// control worktree of the older commit made with
// `node scripts/controlWorktree.mjs create <name> <sha>`.
//
// WHY ONE PROCESS. This machine is shared: other sessions' suites come and go
// while a measurement runs, and on 2026-09-25 the foreign load swung from 5 to
// 29 busy logical CPUs inside one run. Two runs started one after the other
// measure two different machines. Interleaving puts both trees on the same
// machine, chunk by chunk, and a ratio of neighbouring chunks cancels what
// the machine did to both; alternating which tree goes first in each chunk
// cancels the order. The local rule this serves ("A feature's cost is its own
// share of tick time", docs/policies/local-rules.md) asks for interleaved
// samples as the sanity check beside a change's own profile share; nothing
// here produced one until the v0.3.235 question, when it was a one-off probe.
//
// WHY THE DIGESTS. A ratio compares equal WORK only if both trees simulate the
// same match. A change that alters the match (a bigger army, a lost Town
// Centre) changes the work, and its ratio then measures the match rather than
// the code. Both worlds are digested (civ-engine `stateDigest` over
// `world.serialize()`, which is read-only) after every chunk, and the first
// chunk where they differ is reported. Identical digests at the end are also
// the determinism proof for a change meant to be behaviour-neutral.
//
// READING IT. The first chunk is left out of the ratios: it carries each
// tree's module compilation and warm-up. CPU time is the process's
// (`process.cpuUsage`, all threads, ~15.6 ms granularity on Windows); wall
// time is `process.hrtime`. Foreign load is machine busy logical CPUs
// (os.cpus deltas) minus this process's own share, sampled over each chunk.
//
// BOUND. It measures the simulation step (`bridge.step(100)` per tick), not a
// test's own sampling around it. Its noise floor, measured on 2026-09-25 by
// running a tree against a second checkout of the same commit: the castle
// match read 0.971 (wall) and 0.977 (CPU) on its totals and 0.989 and 0.992
// on its medians, under 13-28 busy foreign CPUs; the garrison case read 0.998
// (wall) and 0.958 (CPU) on its 4,468-tick totals. CPU time over short
// chunks is the noisier of the two. A ratio inside that band is no difference.

import os from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Interleaves `arms` chunk by chunk. `step(n)` returns the ticks it ran;
 * `clock()` returns `{ wallMs, cpuMs }`, `busyCores()` the machine's busy
 * logical CPUs since its previous call, and `onChunk(row)`, if given, hears
 * each chunk as it finishes.
 * @param {{
 *   arms: Array<{ label: string, step: (n: number) => number, fingerprint: () => string }>,
 *   chunkTicks: number,
 *   maxTicks: number,
 *   clock: () => { wallMs: number, cpuMs: number },
 *   busyCores: () => number,
 *   onChunk?: (row: any) => void,
 * }} options
 */
export function runInterleaved({ arms, chunkTicks, maxTicks, clock, busyCores, onChunk }) {
  if (arms.length !== 2) throw new Error(`runInterleaved compares exactly two arms; got ${arms.length}`);
  const rows = [];
  let divergedAt = null;
  for (let chunk = 0, start = 0; start < maxTicks; chunk += 1) {
    const n = Math.min(chunkTicks, maxTicks - start);
    const order = chunk % 2 === 0 ? [0, 1] : [1, 0];
    const row = { chunk, startTick: start, n, order: order.map((i) => arms[i].label), arms: [null, null] };
    for (const i of order) {
      busyCores();
      const before = clock();
      const ran = arms[i].step(n);
      const after = clock();
      const wallMs = after.wallMs - before.wallMs;
      const cpuMs = after.cpuMs - before.cpuMs;
      row.arms[i] = { ran, wallMs, cpuMs, foreignCores: busyCores() - (wallMs > 0 ? cpuMs / wallMs : 0) };
    }
    row.fingerprints = arms.map((arm) => arm.fingerprint());
    if (divergedAt === null && row.fingerprints[0] !== row.fingerprints[1]) divergedAt = chunk;
    rows.push(row);
    onChunk?.(row);
    start += n;
    if (row.arms[0].ran < n || row.arms[1].ran < n) break; // a match resolved
  }
  return { rows, divergedAt };
}

const sortedCopy = (xs) => [...xs].sort((a, b) => a - b);
function median(xs) {
  const s = sortedCopy(xs);
  const m = s.length >> 1;
  return s.length === 0 ? Number.NaN : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Ratios of arm B to arm A over every chunk but the first. */
export function summarize({ rows, divergedAt }) {
  const steady = rows.filter((row) => row.chunk > 0 && row.arms[0].ran > 0 && row.arms[1].ran > 0);
  const total = (i, key) => steady.reduce((sum, row) => sum + row.arms[i][key], 0);
  const ticks = (i) => steady.reduce((sum, row) => sum + row.arms[i].ran, 0);
  const foreign = steady.flatMap((row) => row.arms.map((arm) => arm.foreignCores));
  return {
    chunks: rows.length,
    steadyChunks: steady.length,
    ticks: rows.reduce((sum, row) => sum + Math.max(row.arms[0].ran, row.arms[1].ran), 0),
    lockstep: divergedAt === null ? 'identical at every chunk' : `DIVERGED at chunk ${divergedAt}`,
    wallRatioMedian: median(steady.map((row) => row.arms[1].wallMs / row.arms[0].wallMs)),
    wallRatioTotal: total(1, 'wallMs') / total(0, 'wallMs'),
    cpuRatioMedian: median(steady.map((row) => row.arms[1].cpuMs / row.arms[0].cpuMs)),
    cpuRatioTotal: total(1, 'cpuMs') / total(0, 'cpuMs'),
    cpuMsPerTick: [total(0, 'cpuMs') / ticks(0), total(1, 'cpuMs') / ticks(1)],
    foreignCores: { median: median(foreign), max: Math.max(...foreign) },
  };
}

function realClock() {
  const usage = process.cpuUsage();
  return { wallMs: Number(process.hrtime.bigint()) / 1e6, cpuMs: (usage.user + usage.system) / 1000 };
}

function machineBusyCores() {
  let last = null;
  return () => {
    let idle = 0;
    let all = 0;
    for (const cpu of os.cpus()) {
      const t = cpu.times;
      idle += t.idle;
      all += t.user + t.nice + t.sys + t.idle + t.irq;
    }
    const busy = last === null || all === last.all ? 0 : (1 - (idle - last.idle) / (all - last.all)) * os.cpus().length;
    last = { idle, all };
    return busy;
  };
}

// The configurations each scenario's test plays, stepped the way it steps.
const SCENARIOS = {
  castle: { maxTicks: 45000, open: (create, human) => create('aoe2-prototype', { forceAiForOwners: new Set([human]) }) },
  lab: {
    maxTicks: 45000,
    open: (create, human) => create('aoe2-prototype', {
      forceAiForOwners: new Set([human]),
      disableAiAttacks: true,
      victory: 'conquest-only',
      resourcePreset: 'high',
      difficulty: 'hard',
    }),
  },
  garrison: { maxTicks: 8300, open: (create, human) => garrisoned(create('ai-garrisoned-defender-fixture', { forceAiForOwners: new Set([human]) })) },
  few: { maxTicks: 8300, open: (create, human) => garrisoned(create('ai-garrisoned-defender-few-fixture', { forceAiForOwners: new Set([human]) })) },
};

/** aiGarrisonedDefender.test.ts's setup: owner 2's villagers garrison its Town Centre. */
function garrisoned(bridge) {
  bridge.step(100);
  const start = bridge.getEconomyState();
  const townCentre = start.buildings.find((b) => b.owner === 2 && b.buildingType === 'town-center');
  if (!townCentre) throw new Error('the garrison fixture has no owner-2 Town Centre');
  for (const unit of start.units) {
    if (unit.owner !== 2 || unit.unitType !== 'villager') continue;
    bridge.pendingCommands.push({
      type: 'unit.contextAtEntity',
      data: { unitId: unit.id, targetEntityId: townCentre.id, garrison: true },
    });
  }
  return bridge;
}

async function openArm(label, tree, scenario, stateDigest) {
  const root = tree.replace(/[\\/]+$/, '');
  const { createSimulationBridge } = await import(pathToFileURL(`${root}/src/game/simulation/createSimulationBridge.ts`).href);
  const { HUMAN_PLAYER_ID } = await import(pathToFileURL(`${root}/src/game/simulation/prototypeScenario.ts`).href);
  const bridge = scenario.open(createSimulationBridge, HUMAN_PLAYER_ID);
  return {
    label,
    tree: root,
    bridge,
    step(n) {
      let ran = 0;
      for (; ran < n && bridge.getMatchState().outcome === 'running'; ran += 1) bridge.step(100);
      return ran;
    },
    fingerprint: () => `${bridge.world.tick}|${bridge.getMatchState().outcome}|${stateDigest(bridge.world.serialize())}`,
  };
}

async function main(argv) {
  const flag = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : Number(argv[i + 1]);
  };
  const positional = argv.filter((arg, i) => !arg.startsWith('--') && !argv[i - 1]?.startsWith('--'));
  const [scenarioName, treeA, treeB] = positional;
  const scenario = SCENARIOS[scenarioName];
  if (!scenario || !treeA || !treeB) {
    throw new Error(
      `usage: npm run ai:tick-ab -- <scenario> <treeA> <treeB> [--chunk 1000] [--max-ticks N]; `
      + `scenario is one of ${Object.keys(SCENARIOS).join(', ')} (got "${scenarioName ?? ''}"), `
      + 'and each tree is a checkout of this repository.',
    );
  }
  const { stateDigest } = await import('civ-engine');
  const arms = [await openArm('A', treeA, scenario, stateDigest), await openArm('B', treeB, scenario, stateDigest)];
  const busy = machineBusyCores();
  const chunkTicks = flag('chunk', 1000);
  const result = runInterleaved({
    arms,
    chunkTicks,
    maxTicks: flag('max-ticks', scenario.maxTicks),
    clock: realClock,
    busyCores: busy,
    onChunk(row) {
      const [a, b] = row.arms;
      process.stderr.write(`chunk ${row.chunk} @${row.startTick} A ${a.cpuMs.toFixed(0)} ms B ${b.cpuMs.toFixed(0)} ms `
        + `B/A ${(b.cpuMs / a.cpuMs).toFixed(3)} foreign ${a.foreignCores.toFixed(1)}/${b.foreignCores.toFixed(1)} `
        + `${row.fingerprints[0] === row.fingerprints[1] ? 'same state' : 'STATE DIFFERS'}\n`);
    },
  });
  const finalDigests = arms.map((arm) => stateDigest(arm.bridge.saveGame().worldSnapshot));
  const summary = {
    scenario: scenarioName,
    treeA: arms[0].tree,
    treeB: arms[1].tree,
    chunkTicks,
    ...summarize(result),
    finalSaveDigests: finalDigests,
    finalSaveDigestsEqual: finalDigests[0] === finalDigests[1],
  };
  mkdirSync('tmp/tick-ab', { recursive: true });
  const out = `tmp/tick-ab/${scenarioName}-${Date.now()}.json`;
  writeFileSync(out, JSON.stringify({ summary, rows: result.rows }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  console.log(`per-chunk rows: ${out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
