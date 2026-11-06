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
// Villager death census (2026-09-02): the register's open defect was thirty
// villagers shot under the enemy Town Centre, and nothing in this table could
// see it — a villager count is not a column here and a peak army hides an
// economy that died late. Every villager death is now recorded from the
// bridge's death feed with the villager's last known task and its distance to
// the nearest enemy static defence, and two columns count them per owner:
// `vill lost`, and `under def` — killed within an enemy Town Centre's, tower's
// or Castle's fully-upgraded reach (its base range from the building rules
// plus the Blacksmith's three arrow technologies) plus the one-cell margin
// the gather rule keeps. Pass `--ledger` to print every death.
//
// Relic play (work 128, 2026-10-15): the computer had never stored a relic in
// a full match, and nothing here could show it. Three columns now count it per
// owner — `monastery` and `monk`, the first sample with a complete Monastery
// and with a Monk, and `relics`, the relics stored in its Monasteries when the
// run ended — and a line per relic gives the sample each seat first SAW it on
// (its own vision), every pickup by a Monk and the owner, and every store.
//
// Siege (work 141, 2026-11-04): under DE's building armor (work 140) only siege
// takes buildings at any pace, so two columns count it per owner — `siege`, the
// first sample holding a unit in the siege armor class (`isSiegeUnit`: the ram,
// mangonel and scorpion lines, the Bombard Cannon and the Trebuchet), and
// `peak siege`, the most it held at one sample. `Castle bldg` is the first
// sample with a complete Castle building (`castle` is the Castle Age), because
// the AI's Castle Age split gathers no stone (work 141 M2a). A peak hides an
// army that stopped growing, so a line per seed also gives each owner's army
// every 5,000 ticks: the AI's spending rules hold resources back from it (work
// 141's escrow), and a held army shows there as a flat run.
//
// The economy (work 144): a second table gives each owner's age clicks (the
// first 25-tick sample with that age's research queued), the villagers held at
// the Feudal and Castle clicks, at 5, 10, 15 and 20 minutes, and the first
// complete farm. DE's AI trains 25 villagers and more before its Feudal click
// (Promisory units.per 328-386), which the first table cannot show.
//
// The match itself is played and measured by `scripts/selfplayAuditMatch.mjs`,
// which `scripts/selfplay-ab.mjs` shares: that one plays several seeds per map
// in two trees and reports each column's spread, because one seed per map
// cannot tell a change from the noise of a chaotic match (work 144). This
// script plays this checkout's game, one record per seed, and prints it.
//
// `--config castle` (the default) plays the match
// `tests/simulation/aiReachesCastleAge.test.ts` plays: the shipped configuration
// with the Wonder and Relic victories off (work 128; that test's header says
// why). `--config standard` plays it under the shipped Standard rules, every
// victory on, as `tests/simulation/aiRelicsSelfPlay.test.ts` does; a match it
// plays can end in a Relic or Wonder victory before the late game.
// `--config lab` plays the no-attack coverage lab of
// `tests/simulation/selfPlayContentCoverage.test.ts` (attacks off, conquest
// only, high resources, hard AI). `--config idle` plays the boot match at the
// lobby's defaults with the human seat not played, and prints owner 2 only.
// `scripts/profile-selfplay.mjs` and `scripts/aiTickAb.mjs` name castle and lab
// the same way.
//
// Usage:
//   npx tsx scripts/selfplay-audit.mjs [--seeds a,b,c] [--ticks 45000] [--config castle|standard|lab|idle] [--ledger]

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIGS, loadGame, playAuditMatch, VILLAGER_MINUTES } from './selfplayAuditMatch.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const SEEDS = String(arg('seeds', 'aoe2-prototype,default-seed,corpus-seed-b')).split(',');
const CONFIG = String(arg('config', 'castle'));
if (!(CONFIG in CONFIGS)) {
  throw new Error(`--config must be one of ${Object.keys(CONFIGS).join(', ')}; got "${CONFIG}"`);
}
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
const PRINT_LEDGER = process.argv.includes('--ledger');
const OWNERS = CONFIGS[CONFIG].owners;

const game = await loadGame(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const pad = (s, n) => String(s).padEnd(n);
console.log(`# AI self-play audit — ${CONFIG} configuration, ${TICKS} ticks (${(TICKS / 600).toFixed(0)} min of game time)\n`);
console.log(`| ${pad('seed', 16)} | own | feudal | qualified | castle | imperial | bldgs | units | peak army | vill lost | under def | monastery | monk  | relics | siege  | peak siege | Castle bldg |`);
console.log(`| ${'-'.repeat(16)} | --- | ------ | --------- | ------ | -------- | ----- | ----- | --------- | --------- | --------- | --------- | ----- | ------ | ------ | ---------- | ----------- |`);

const totals = { castle: 0, imperial: 0, bldg: 0, unit: 0, army: 0, owners: 0, lost: 0, underDefence: 0, relics: 0 };
const records = [];
for (const seed of SEEDS) {
  const record = playAuditMatch(game, { seed, config: CONFIG, ticks: TICKS });
  records.push(record);
  for (const o of OWNERS) {
    const p = record.owners[o];
    console.log(`| ${pad(seed, 16)} | ${o}   | ${pad(p.feudal ?? '-', 6)} | ${pad(p.qualified ?? '-', 9)} `
      + `| ${pad(p.castle ?? '-', 6)} | ${pad(p.imperial ?? '-', 8)} | ${pad(p.buildings.length, 5)} `
      + `| ${pad(p.units.length, 5)} | ${pad(p.peakArmy, 9)} | ${pad(p.villagersLost, 9)} | ${pad(p.underDefence, 9)} `
      + `| ${pad(p.monastery ?? '-', 9)} | ${pad(p.monk ?? '-', 5)} | ${pad(p.relics, 6)} `
      + `| ${pad(p.siege ?? '-', 6)} | ${pad(p.siegePeak, 10)} | ${pad(p.castleBuilding ?? '-', 11)} |`);
    totals.owners += 1;
    if (p.castle !== null) totals.castle += 1;
    if (p.imperial !== null) totals.imperial += 1;
    totals.bldg += p.buildings.length; totals.unit += p.units.length; totals.army += p.peakArmy;
    totals.lost += p.villagersLost; totals.underDefence += p.underDefence;
    totals.relics += p.relics;
  }
  const { outcome } = record;
  if (outcome.state !== 'running') {
    console.log(`| ${pad(seed, 16)} |     | match ended early: ${outcome.state} for owner 1 by ${outcome.by ?? '?'} at tick ${outcome.endedAt}`);
  }
  console.log(`| ${pad(seed, 16)} |     | army every 5,000 ticks: ${OWNERS.map((o) => `o${o} ${record.owners[o].armyByTick.join(',') || '-'}`).join('; ')}`);
  for (const r of record.relics) {
    const seen = [1, 2].map((o) => `o${o} ${r.seen[o] ?? '-'}`).join(', ');
    const picked = r.picked.map((p) => `o${p.owner} ${p.tick}`).join(', ') || '-';
    console.log(`| ${pad(seed, 16)} |     | relic ${r.id} at ${r.x ?? '?'},${r.y ?? '?'}: seen ${seen}; picked up ${picked}`);
  }
  const stores = record.relicStores.map((s) => `o${s.owner} ${s.tick} (holds ${s.total})`).join(', ') || 'none';
  console.log(`| ${pad(seed, 16)} |     | relics stored: ${stores}`);
  if (record.ledger.length > 0) {
    const byTask = {};
    for (const d of record.ledger) byTask[d.task] = (byTask[d.task] ?? 0) + 1;
    const tasks = Object.entries(byTask).map(([task, n]) => `${task} ${n}`).join(', ');
    console.log(`| ${pad(seed, 16)} |     | villager deaths by last task: ${tasks}`);
    if (PRINT_LEDGER) {
      for (const d of record.ledger) {
        const near = d.nearest === null
          ? 'no enemy defence'
          : `${d.nearest.distance} from o${d.nearest.defenceOwner} ${d.nearest.defence}`;
        console.log(`|   t=${pad(d.tick, 6)} o${d.owner} villager at ${pad(`${d.x},${d.y}`, 6)} `
          + `${pad(d.task, 12)} ${near}${d.underDefence ? ' UNDER' : ''}`);
      }
    }
  }
}
console.log(`\n${totals.owners} owner-slots: ${totals.castle} reached Castle, ${totals.imperial} reached Imperial.`);
console.log(`Totals — building types ${totals.bldg}, unit types ${totals.unit}, peak army ${totals.army}, `
  + `villagers lost ${totals.lost} (${totals.underDefence} under enemy defences), relics stored ${totals.relics}.`);

console.log(`\n| ${pad('seed', 16)} | own | feudal click | vills then | castle click | vills then | imperial click | ${VILLAGER_MINUTES.map((m) => `vills ${m}:00`).join(' | ')} | first farm |`);
console.log(`| ${'-'.repeat(16)} | --- | ------------ | ---------- | ------------ | ---------- | -------------- | ${VILLAGER_MINUTES.map((m) => '-'.repeat(`vills ${m}:00`.length)).join(' | ')} | ---------- |`);
for (const record of records) {
  for (const o of OWNERS) {
    const p = record.owners[o];
    console.log(`| ${pad(record.seed, 16)} | ${o}   | ${pad(p.feudalClick ?? '-', 12)} | ${pad(p.villagersAtFeudalClick ?? '-', 10)} `
      + `| ${pad(p.castleClick ?? '-', 12)} | ${pad(p.villagersAtCastleClick ?? '-', 10)} | ${pad(p.imperialClick ?? '-', 14)} `
      + `| ${VILLAGER_MINUTES.map((m) => pad(p.villagersAt[m] ?? '-', `vills ${m}:00`.length)).join(' | ')} | ${pad(p.firstFarm ?? '-', 10)} |`);
  }
}
