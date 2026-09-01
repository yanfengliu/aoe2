#!/usr/bin/env node
// What an all-AI match actually EXERCISES, per owner, across seeds.
//
// This is the standing acceptance test for feature completeness — "does a game
// of this reach the content the game has?" — and it was run ad hoc several
// times before it was written down, which meant every run rebuilt the metric
// and one of them silently unioned both owners and could not show whether any
// single player had qualified for an age.
//
// Reports per OWNER, never merged: a union across players answers a different
// question and flatters the result.
//
// Usage:
//   npx tsx scripts/selfplay-audit.mjs [--seeds a,b,c] [--ticks 45000]

import { createSimulationBridge } from '../src/game/simulation/createSimulationBridge.ts';
import { HUMAN_PLAYER_ID } from '../src/game/simulation/prototypeScenario.ts';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const SEEDS = String(arg('seeds', 'aoe2-prototype,default-seed,corpus-seed-b')).split(',');
// 45,000 ticks — 75 minutes of game time — and the default is the whole point
// of this constant rather than a convenience.
//
// It was 24,000, and that window produced three wrong conclusions that all
// reached the register before anyone checked the instrument: that no player
// reaches the Imperial Age, that decided matches never resolve, and (at 34,000)
// that half the owner-slots are walled in Feudal. Measured to 60,000 on the
// same seeds, Imperial lands at ticks 40,250 and 41,250, matches DO resolve by
// conquest, and a slot can qualify as late as 53,250. A resignation feature was
// designed, built, reviewed and reverted for the second of those.
//
// The ages arrive at roughly 9,500 (Feudal), 21,500-30,000 (Castle) and
// 40,000-41,000 (Imperial), so a default under ~42,000 cannot see the game's
// last age at all and reports its absence as a defect. 45,000 clears Imperial
// with margin. Anything measuring WHEN something lands still needs its own
// horizon justified against that thing — see the lessons entry; this default
// only stops the common case from lying.
const TICKS = Number(arg('ticks', 45000));
const QUALIFYING = ['blacksmith', 'archery-range', 'stable', 'market'];

const pad = (s, n) => String(s).padEnd(n);
console.log(`# AI self-play audit — ${TICKS} ticks (${(TICKS / 600).toFixed(0)} min of game time)\n`);
console.log(`| ${pad('seed', 16)} | own | feudal | qualified | castle | imperial | bldgs | units | peak army |`);
console.log(`| ${'-'.repeat(16)} | --- | ------ | --------- | ------ | -------- | ----- | ----- | --------- |`);

const totals = { castle: 0, imperial: 0, bldg: 0, unit: 0, army: 0, owners: 0 };
for (const seed of SEEDS) {
  const bridge = createSimulationBridge(seed, { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) });
  const per = {};
  for (const o of [1, 2]) {
    per[o] = { b: new Set(), u: new Set(), age: {}, q: null, army: 0 };
  }
  let outcome = 'running';
  for (let tick = 1; tick <= TICKS; tick += 1) {
    bridge.step(100);
    if (bridge.getMatchState().outcome !== 'running') { outcome = bridge.getMatchState().outcome; break; }
    if (tick % 250) continue;
    const st = bridge.getEconomyState();
    for (const o of [1, 2]) {
      const p = per[o];
      let qualifying = 0;
      for (const b of st.buildings) {
        if (b.owner !== o || !b.isComplete) continue;
        p.b.add(b.buildingType);
        if (QUALIFYING.includes(b.buildingType)) qualifying += 1;
      }
      if (qualifying >= 2 && p.q === null) p.q = tick;
      let army = 0;
      for (const u of st.units) {
        if (u.owner !== o) continue;
        p.u.add(u.unitType);
        if (u.unitType !== 'villager') army += 1;
      }
      p.army = Math.max(p.army, army);
      const age = st.ages[o];
      if (age && p.age[age] === undefined) p.age[age] = tick;
    }
  }
  for (const o of [1, 2]) {
    const p = per[o];
    const at = (a) => (p.age[a] === undefined ? '-' : String(p.age[a]));
    console.log(`| ${pad(seed, 16)} | ${o}   | ${pad(at('feudal-age'), 6)} | ${pad(p.q ?? '-', 9)} `
      + `| ${pad(at('castle-age'), 6)} | ${pad(at('imperial-age'), 8)} | ${pad(p.b.size, 5)} `
      + `| ${pad(p.u.size, 5)} | ${pad(p.army, 9)} |`);
    totals.owners += 1;
    if (p.age['castle-age'] !== undefined) totals.castle += 1;
    if (p.age['imperial-age'] !== undefined) totals.imperial += 1;
    totals.bldg += p.b.size; totals.unit += p.u.size; totals.army += p.army;
  }
  if (outcome !== 'running') console.log(`| ${pad(seed, 16)} |     | match ended early: ${outcome}`);
}
console.log(`\n${totals.owners} owner-slots: ${totals.castle} reached Castle, ${totals.imperial} reached Imperial.`);
console.log(`Totals — building types ${totals.bldg}, unit types ${totals.unit}, peak army ${totals.army}.`);
