#!/usr/bin/env node
// Replay a recorded LLM-playtest bundle with the engine's SessionReplayer
// and inspect the ACTUAL per-owner ground-truth state at sampled ticks.
// This is the engine debugging tool for "what really happened" — it
// verifies conformance findings against the real recorded run instead of
// trusting the agent's (possibly mistaken) trace narration or a synthetic
// repro. Resources, villager tasks, units, and buildings come straight
// from getEconomyState() (not fog-filtered).
//
//   tsx scripts/replay-inspect.mjs <bundle.json> [--ticks 0,500,900,...]
//
// Example (was the agent's wood flat because gather is broken, or because
// its villagers were being killed?):
//   npm run replay:inspect -- output/playtests-llm/campaign-4.json

import { readFileSync } from 'node:fs';

import { SessionReplayer } from 'civ-engine';
import { createReplayWorldOnly } from '../src/game/simulation/replay/createReplayWorldOnly.ts';
import { fromEngineWorld, toEngineWorld } from '../src/game/simulation/bridge/pureHelpers.ts';
import { makeReplayBridge } from '../src/game/simulation/replay/makeReplayBridge.ts';

const argv = process.argv.slice(2);
const bundlePath = argv.find((a) => !a.startsWith('--'));
if (!bundlePath) {
  console.error('usage: replay-inspect <bundle.json> [--ticks a,b,c]');
  process.exit(2);
}
const ti = argv.indexOf('--ticks');
const ticks = ti >= 0
  ? argv[ti + 1].split(',').map(Number)
  : [0, 250, 500, 700, 900, 1200, 1800, 2500, 3500, 5000, 7000, 9000];

const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
// Workaround for an LLM-harness recording bug: campaign bundles export
// metadata.endTick = 0 (durationTicks 0) even though the run is fully
// recorded (ticks/executions/snapshots all reach persistedEndTick). The
// engine's SessionReplayer.openAt clamps to endTick, so without this the
// replayer refuses any tick > 0. Repair endTick from persistedEndTick (or
// the highest recorded tick) so the recorded run is actually replayable.
if (bundle.metadata && (bundle.metadata.endTick ?? 0) <= 0) {
  const recordedMax = Math.max(
    bundle.metadata.persistedEndTick ?? 0,
    ...(bundle.ticks ?? []).map((t) => t.tick ?? 0),
  );
  bundle.metadata.endTick = recordedMax;
  bundle.metadata.durationTicks = recordedMax - (bundle.metadata.startTick ?? 0);
  console.log(`[replay-inspect] repaired bundle endTick 0 -> ${recordedMax} (harness recording bug)\n`);
}
const replayer = SessionReplayer.fromBundle(bundle, {
  worldFactory: (snapshot) => toEngineWorld(createReplayWorldOnly(snapshot)),
  skipRegistrationCheck: true,
});

const owners = [1, 2];
const pad = (s, n) => String(s).padStart(n);
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

console.log(`Replay inspection: ${bundlePath}`);
console.log('owner 2 = LLM agent (campaign default); owner 1 = AI enemy.\n');
console.log('tick  | own | age     | vills (wood) | military | bldgs |  wood | food | gold | stone | enemyMilNearBase');
console.log('------|-----|---------|--------------|----------|-------|-------|------|------|-------|-----------------');

for (const tick of ticks) {
  let eco;
  try {
    const world = fromEngineWorld(replayer.openAt(tick));
    eco = makeReplayBridge(world, { fogOwner: 1 }).getEconomyState();
  } catch (err) {
    console.log(`${pad(tick, 5)} | openAt failed: ${err?.message ?? err}`);
    continue;
  }
  for (const o of owners) {
    const vills = eco.villagers.filter((v) => v.owner === o);
    const onWood = vills.filter((v) => v.desiredResource === 'wood' || v.carriedResource === 'wood').length;
    const military = eco.units.filter((u) => u.owner === o && u.unitType !== 'villager');
    const bldgs = eco.buildings.filter((b) => b.owner === o);
    const r = eco.playerResources[o] ?? { wood: 0, food: 0, gold: 0, stone: 0 };
    const age = eco.ages?.[o] ?? '?';
    // Enemy military within 6 cells of this owner's first Town Center.
    const tc = bldgs.find((b) => b.buildingType === 'town-center') ?? bldgs[0];
    const enemyNear = tc
      ? eco.units.filter((u) => u.owner !== o && u.owner != null && u.unitType !== 'villager' && dist(u, tc) <= 6).length
      : 0;
    console.log(
      `${pad(tick, 5)} | ${pad(o, 3)} | ${pad(age, 7)} | ${pad(vills.length, 4)} (${pad(onWood, 4)}) | ${pad(military.length, 8)} | ${pad(bldgs.length, 5)} | ${pad(r.wood, 5)} | ${pad(r.food, 4)} | ${pad(r.gold, 4)} | ${pad(r.stone, 5)} | ${pad(enemyNear, 15)}`,
    );
  }
  console.log('------|-----|---------|--------------|----------|-------|-------|------|------|-------|-----------------');
}

// Optional deep dive for one owner at one tick: villager task/carry
// histogram + nearby wood resources (are the woodcutters actually
// chopping, or stuck at depleted/unreachable trees?).
const di = argv.indexOf('--detail');
if (di >= 0) {
  const detailTick = Number(argv[di + 1]);
  const detailOwner = Number(argv[di + 2] ?? 2);
  const eco = makeReplayBridge(fromEngineWorld(replayer.openAt(detailTick)), { fogOwner: 1 }).getEconomyState();
  const vills = eco.villagers.filter((v) => v.owner === detailOwner);
  console.log(`\n=== DETAIL: owner ${detailOwner} at tick ${detailTick} (${vills.length} villagers) ===`);
  const byTask = {};
  const byDesired = {};
  let carriedWood = 0;
  for (const v of vills) {
    byTask[v.task] = (byTask[v.task] ?? 0) + 1;
    byDesired[v.desiredResource] = (byDesired[v.desiredResource] ?? 0) + 1;
    if (v.carriedResource === 'wood') carriedWood += v.carriedAmount;
  }
  console.log('villager task histogram:', JSON.stringify(byTask));
  console.log('villager desiredResource histogram:', JSON.stringify(byDesired));
  console.log('total wood carried by villagers (not yet deposited):', carriedWood);
  const tc = eco.buildings.find((b) => b.owner === detailOwner && b.buildingType === 'town-center');
  const lumberCamps = eco.buildings.filter((b) => b.owner === detailOwner && b.buildingType === 'lumber-camp');
  console.log(`drop-off: TC at ${tc ? `(${tc.x},${tc.y})` : 'NONE'}; lumber-camps: ${lumberCamps.map((c) => `(${c.x},${c.y})`).join(', ') || 'NONE'}`);
  const trees = eco.resources.filter((r) => r.resourceType === 'tree' || r.resourceType === 'wood');
  const nearTrees = tc ? trees.filter((t) => dist(t, tc) <= 14).sort((a, b) => dist(a, tc) - dist(b, tc)) : trees;
  console.log(`wood resources within 14 cells of TC: ${nearTrees.length} (of ${trees.length} total)`);
  console.log('nearest 12 trees [amount/max @ (x,y) dist]:');
  for (const t of nearTrees.slice(0, 12)) {
    console.log(`  ${t.amount}/${t.maxAmount} @ (${t.x},${t.y}) d=${tc ? dist(t, tc) : '?'}`);
  }
}
