#!/usr/bin/env node
// AI economy trajectory. Runs an AI-vs-AI match headlessly and samples every
// owner's whole economy every SAMPLE ticks.
//
// Judge a change on WINDOWS THAT CHANGED, not on the ending pile: a big
// stockpile at the end rewards an AI that FROZE while rich (the 2026-08-20
// finding). And read the per-owner rows together with "owners still on the map"
// — a metric built to detect a stall cannot tell a frozen match from a decided
// one, since both look still (2026-08-23).
//
//   npm run ai:trajectory                          # 30000 ticks, samples of 1000
//   MAX_TICKS=12000 SAMPLE=2000 npm run ai:trajectory
//   SEED=aoe2-prototype OWNERS=2 OUT=tmp/run.json npm run ai:trajectory
import { writeFileSync } from 'node:fs';
import { createSimulationBridge } from '../src/game/simulation/createSimulationBridge.ts';
import { HUMAN_PLAYER_ID } from '../src/game/simulation/prototypeScenario.ts';

const seed = process.env.SEED ?? 'default-seed';
const maxTicks = Number(process.env.MAX_TICKS ?? 30000);
const sample = Number(process.env.SAMPLE ?? 1000);
const seatedOwners = process.env.PLAYERS
  ? Array.from({ length: Number(process.env.PLAYERS) }, (_unused, index) => String(index + 1)).join(',')
  : '1,2';
const owners = (process.env.OWNERS ?? seatedOwners).split(',').map(Number);
const out = process.env.OUT ?? 'tmp/ai-trajectory.json';

// PLAYERS=n runs an n-player free-for-all instead of the 1v1, on the rung of
// §4's size ladder that count is played on (2..8).
const playerCount = process.env.PLAYERS ? Number(process.env.PLAYERS) : undefined;
const bridge = createSimulationBridge(seed, {
  forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
  ...(playerCount ? { playerCount } : {}),
});

const rows = [];
const start = bridge.world.tick;
const t0 = Date.now();
while (bridge.world.tick - start < maxTicks) {
  bridge.step(100);
  const elapsed = bridge.world.tick - start;
  if (elapsed % sample !== 0) continue;
  const eco = bridge.getEconomyState();
  const perOwner = owners.map((owner) => {
  const res = eco.playerResources[owner];
  const vills = eco.villagers.filter((v) => v.owner === owner);
  const byDesire = {};
  const byTask = {};
  for (const v of vills) {
    byDesire[v.desiredResource] = (byDesire[v.desiredResource] ?? 0) + 1;
    byTask[v.task] = (byTask[v.task] ?? 0) + 1;
  }
  const units = eco.units.filter((u) => u.owner === owner);
  const buildings = (eco.buildings ?? []).filter((b) => b.owner === owner);
  const buildingKinds = {};
  for (const b of buildings) buildingKinds[b.buildingType] = (buildingKinds[b.buildingType] ?? 0) + 1;
  return {
    owner,
    tick: elapsed,
    age: eco.ages[owner],
    food: Math.round(res?.food ?? 0),
    wood: Math.round(res?.wood ?? 0),
    gold: Math.round(res?.gold ?? 0),
    stone: Math.round(res?.stone ?? 0),
    villagers: vills.length,
    units: units.length,
    buildings: buildings.length,
    byDesire,
    byTask,
    buildingKinds,
  };
  });
  rows.push(perOwner);
  console.log(`t=${String(elapsed).padStart(6)} ` + perOwner.map((r) => (
    `[p${r.owner} ${(r.age ?? '?').replace('-age', '').padEnd(8)} `
    + `f=${String(r.food).padStart(4)} w=${String(r.wood).padStart(4)} `
    + `g=${String(r.gold).padStart(4)} s=${String(r.stone).padStart(4)} `
    + `vil=${String(r.villagers).padStart(2)} u=${String(r.units).padStart(2)} `
    + `b=${String(r.buildings).padStart(2)}]`
  )).join(' '));
}

// Windows that changed: how many samples differ from the one before on the
// state that matters. A frozen AI scores near 0 no matter how big its pile is.
const key = (r) => JSON.stringify([r.age, r.food, r.wood, r.gold, r.stone, r.villagers, r.units, r.buildings]);
const changedPerOwner = owners.map((owner, index) => {
  let changed = 0;
  for (let i = 1; i < rows.length; i += 1) if (key(rows[i][index]) !== key(rows[i - 1][index])) changed += 1;
  return { owner, changed };
});
const last = rows.at(-1) ?? [];
const alive = last.filter((r) => r.units > 0 || r.buildings > 0).map((r) => r.owner);
console.log('windows changed: ' + changedPerOwner.map((c) => `p${c.owner}=${c.changed}/${rows.length - 1}`).join(' '));
console.log(`owners still on the map at the end: ${alive.join(',') || 'none'}  (elapsed ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
writeFileSync(out, JSON.stringify({ seed, maxTicks, sample, owners, changedPerOwner, alive, windows: rows.length - 1, rows }, null, 2));
console.log(`wrote ${out}`);
