#!/usr/bin/env node
// CPU-profiles an AI self-play match and prints the hottest functions by SELF
// time. Written because tick cost measurably climbs with base size — 3.9 ms at
// 17 units, 13.1 ms at 34 on `aoe2-prototype` — and a projection from that
// curve reaches the 100 ms tick budget somewhere near a real DE population.
// Guessing which system is responsible has a poor record in this repo; this
// samples it instead.
//
// Usage:
//   npx tsx scripts/profile-selfplay.mjs [--seed aoe2-prototype] [--warmup 12000] [--sample 1000] [--players 2] [--save <file>] [--load <file>]
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
// Prints a table of self-time by function. Nothing is written to the repo; the
// raw .cpuprofile goes to tmp/ (gitignored) if you want to open it in devtools.

import { Session } from 'node:inspector';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { createSimulationBridge } from '../src/game/simulation/createSimulationBridge.ts';
import { HUMAN_PLAYER_ID } from '../src/game/simulation/prototypeScenario.ts';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const SEED = String(arg('seed', 'aoe2-prototype'));
const WARMUP = Number(arg('warmup', 12000));
const SAMPLE = Number(arg('sample', 1000));
const PLAYERS = arg('players', undefined);
const SAVE = arg('save', undefined);
const LOAD = arg('load', undefined);

const bridge = createSimulationBridge(SEED, {
  forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
  ...(PLAYERS ? { playerCount: Number(PLAYERS) } : {}),
  ...(LOAD ? { savedGame: JSON.parse(readFileSync(LOAD, 'utf8')) } : {}),
});

if (LOAD) {
  console.error(`loaded ${LOAD}; stepping one tick before the sample…`);
  bridge.step(100);
} else {
  console.error(`warming up ${WARMUP} ticks on ${SEED}…`);
  for (let i = 0; i < WARMUP; i += 1) bridge.step(100);
}
const eco = bridge.getEconomyState();
console.error(`warm: ${eco.units.length} units, ${eco.buildings.length} buildings`);
if (SAVE) {
  writeFileSync(SAVE, JSON.stringify(bridge.saveGame()));
  console.error(`saved the warm world to ${SAVE}`);
}

const session = new Session();
session.connect();
const post = (method, params) => new Promise((resolve, reject) => {
  session.post(method, params, (err, res) => (err ? reject(err) : resolve(res)));
});

await post('Profiler.enable');
await post('Profiler.setSamplingInterval', { interval: 100 });
await post('Profiler.start');
const started = Date.now();
for (let i = 0; i < SAMPLE; i += 1) bridge.step(100);
const elapsed = Date.now() - started;
const { profile } = await post('Profiler.stop');
session.disconnect();

mkdirSync('tmp', { recursive: true });
writeFileSync('tmp/selfplay.cpuprofile', JSON.stringify(profile));

// Self time per node: each sample charges the node it landed on.
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const selfTicks = new Map();
for (const id of profile.samples) selfTicks.set(id, (selfTicks.get(id) ?? 0) + 1);

const rows = [];
for (const [id, ticks] of selfTicks) {
  const node = byId.get(id);
  if (!node) continue;
  const f = node.callFrame;
  const where = f.url ? f.url.replace(/^.*[\\/]/, '') : '(native)';
  rows.push({
    name: `${f.functionName || '(anonymous)'} @ ${where}:${f.lineNumber + 1}`,
    ticks,
  });
}
rows.sort((a, b) => b.ticks - a.ticks);
const total = rows.reduce((sum, r) => sum + r.ticks, 0) || 1;

console.log(`\n# CPU self time — ${SEED}, ${SAMPLE} ticks in ${elapsed} ms `
  + `(${(elapsed / SAMPLE).toFixed(2)} ms/tick)\n`);
console.log('| self % | function |');
console.log('| ------ | -------- |');
for (const row of rows.slice(0, 25)) {
  console.log(`| ${((row.ticks / total) * 100).toFixed(1)}% | ${row.name} |`);
}
console.log('\nRaw profile: tmp/selfplay.cpuprofile');
