#!/usr/bin/env node
// CPU-profiles an AI self-play match and prints the hottest functions by SELF
// time, and by INCLUSIVE time per function and per source file. Written because
// tick cost measurably climbs with base size — 3.9 ms at 17 units, 13.1 ms at
// 34 on `aoe2-prototype` — and a projection from that curve reaches the 100 ms
// tick budget somewhere near a real DE population. Guessing which system is
// responsible has a poor record in this repo; this samples it instead.
//
// Self time says WHERE the process was; inclusive time says which caller the
// cost belongs to. The 2026-08-30 pass learned that the hard way: the top
// self-time function was cheap per call, and the cost was the number of calls
// its caller made (docs/devlog/detailed/2026-08-25_2026-08-30.md).
//
// Usage:
//   npx tsx scripts/profile-selfplay.mjs [--seed aoe2-prototype] [--warmup 12000] [--sample 1000]
//       [--config castle|lab] [--interval 100] [--top 25]
//       [--players 2] [--save <file>] [--load <file>]
//
// `--players n` plays an n-player free-for-all on the map size §4 gives that
// count, so a cost that grows with the number of bases can be read at scale.
//
// `--save <file>` writes the warm world as a saved game; `--load <file>` boots
// from one instead of warming up, and steps one tick before sampling so the
// load's own writes are not in the sample. An A/B of a change that alters play
// must load ONE saved world in BOTH arms. Warmed separately, the two arms play
// two different games: on 2026-09-24 the building-sight arm reached tick 30,000
// with 71 units against the control's 49, so a share of tick time compared the
// games, not the code. Both arms must load, not just one. A loaded world's
// visibility sets come back in sorted order, so the engine's sort on every
// `VisibilityMap.getState` costs about a quarter of what it costs in a world
// that grew live (0.9% of CPU against 3.8%, same world).
//
// --config castle (the default) plays the shipped configuration, as
// `tests/simulation/aiReachesCastleAge.test.ts` does; --config lab plays the
// no-attack coverage lab of `tests/simulation/selfPlayContentCoverage.test.ts`
// (attacks off, conquest only, high resources, hard AI). Sampling stops early
// if the match resolves. --interval is the sampling interval in microseconds;
// a whole 45,000-tick match wants 1000 or more, or the profile runs to
// hundreds of megabytes.
//
// Prints tables; nothing is written to the repo. The raw .cpuprofile goes to
// tmp/ (gitignored) if you want to open it in devtools.

import { Session } from 'node:inspector';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { createSimulationBridge } from '../src/game/simulation/createSimulationBridge.ts';
import { HUMAN_PLAYER_ID } from '../src/game/simulation/prototypeScenario.ts';
import { advanceMeasuredTicks, assertTickCount, profileTickLabel, profileWorldSeed, requireSampleTicks } from './selfplayMeasurement.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const SEED = String(arg('seed', 'aoe2-prototype'));
const WARMUP = Number(arg('warmup', 12000));
const SAMPLE = Number(arg('sample', 1000));
const CONFIG = String(arg('config', 'castle'));
const INTERVAL_US = Number(arg('interval', 100));
const TOP = Number(arg('top', 25));
const PLAYERS = arg('players', undefined);
const SAVE = arg('save', undefined);
const LOAD = arg('load', undefined);
assertTickCount(WARMUP, '--warmup');
assertTickCount(SAMPLE, '--sample', false);
assertTickCount(INTERVAL_US, '--interval', false);
assertTickCount(TOP, '--top', false);

const CONFIGS = {
  castle: { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) },
  lab: {
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
    disableAiAttacks: true,
    victory: 'conquest-only',
    resourcePreset: 'high',
    difficulty: 'hard',
  },
};
if (!(CONFIG in CONFIGS)) {
  throw new Error(`--config must be one of ${Object.keys(CONFIGS).join(', ')}; got "${CONFIG}"`);
}

const bridge = createSimulationBridge(SEED, {
  ...CONFIGS[CONFIG],
  ...(PLAYERS ? { playerCount: Number(PLAYERS) } : {}),
  ...(LOAD ? { savedGame: JSON.parse(readFileSync(LOAD, 'utf8')) } : {}),
});
const running = () => bridge.getMatchState().outcome === 'running';

if (LOAD) {
  console.error(`loaded ${LOAD}; stepping one tick before the sample…`);
  advanceMeasuredTicks(bridge, 1, 'loaded-world settle');
} else {
  console.error(`warming up ${WARMUP} ticks on ${SEED} (${CONFIG})…`);
  advanceMeasuredTicks(bridge, WARMUP, 'warm-up');
}
const eco = bridge.getEconomyState();
console.error(`warm: ${eco.units.length} units, ${eco.buildings.length} buildings`);
if (SAVE) {
  writeFileSync(SAVE, JSON.stringify(bridge.saveGame()));
  console.error(`saved the warm world to ${SAVE}`);
}
if (!running()) throw new Error('Profile sample did not run: the match resolved during warm-up; use an earlier saved world or fewer warm-up ticks.');

const session = new Session();
session.connect();
const post = (method, params) => new Promise((resolve, reject) => {
  session.post(method, params, (err, res) => (err ? reject(err) : resolve(res)));
});

let profile;
let sampleRange;
let elapsed;
try {
  await post('Profiler.enable');
  await post('Profiler.setSamplingInterval', { interval: INTERVAL_US });
  await post('Profiler.start');
  const started = Date.now();
  sampleRange = requireSampleTicks(advanceMeasuredTicks(bridge, SAMPLE, 'profile sample'));
  elapsed = Date.now() - started;
  ({ profile } = await post('Profiler.stop'));
} finally {
  session.disconnect();
}
const sampled = sampleRange.ticks;

mkdirSync('tmp', { recursive: true });
writeFileSync('tmp/selfplay.cpuprofile', JSON.stringify(profile));

const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parentOf = new Map();
for (const node of profile.nodes) {
  for (const child of node.children ?? []) parentOf.set(child, node.id);
}
const fileOf = (node) => (node.callFrame.url ? node.callFrame.url.replace(/^.*[\\/]/, '') : '(native)');
const nameOf = (node) => {
  const f = node.callFrame;
  return `${f.functionName || '(anonymous)'} @ ${fileOf(node)}:${f.lineNumber + 1}`;
};
// Idle, GC and the profiler's own frames are not the simulation's work.
const OVERHEAD = new Set(['(idle)', '(program)', '(garbage collector)', '(root)']);

const self = new Map();
const inclusiveFn = new Map();
const inclusiveFile = new Map();
let counted = 0;
let gc = 0;
for (const id of profile.samples) {
  const leaf = byId.get(id);
  if (!leaf) continue;
  const leafName = leaf.callFrame.functionName;
  if (leafName === '(garbage collector)') gc += 1;
  if (OVERHEAD.has(leafName)) continue;
  counted += 1;
  self.set(nameOf(leaf), (self.get(nameOf(leaf)) ?? 0) + 1);
  const seenFn = new Set();
  const seenFile = new Set();
  for (let node = leaf; node; node = byId.get(parentOf.get(node.id))) {
    if (OVERHEAD.has(node.callFrame.functionName)) continue;
    seenFn.add(nameOf(node));
    seenFile.add(fileOf(node));
  }
  for (const key of seenFn) inclusiveFn.set(key, (inclusiveFn.get(key) ?? 0) + 1);
  for (const key of seenFile) inclusiveFile.set(key, (inclusiveFile.get(key) ?? 0) + 1);
}
const total = counted || 1;
const table = (title, map) => {
  console.log(`\n## ${title}\n`);
  console.log('| share | where |');
  console.log('| ----- | ----- |');
  for (const [key, n] of [...map].sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
    console.log(`| ${((n / total) * 100).toFixed(1)}% | ${key} |`);
  }
};

console.log(`\n# CPU profile — ${profileWorldSeed(bridge)} (${CONFIG}), ${profileTickLabel(sampleRange)} in ${elapsed} ms `
  + `(${(elapsed / Math.max(1, sampled)).toFixed(2)} ms/tick), ${counted} samples at ${INTERVAL_US} us; `
  + `garbage collection ${((gc / Math.max(1, profile.samples.length)) * 100).toFixed(1)}% of all samples, `
  + 'excluded from the shares below');
table('Self time by function', self);
table('Inclusive time by function', inclusiveFn);
table('Inclusive time by file', inclusiveFile);
console.log('\nRaw profile: tmp/selfplay.cpuprofile');
