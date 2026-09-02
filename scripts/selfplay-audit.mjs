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
// Usage:
//   npx tsx scripts/selfplay-audit.mjs [--seeds a,b,c] [--ticks 45000] [--ledger]

import { createSimulationBridge } from '../src/game/simulation/createSimulationBridge.ts';
import { createBuildingCombatState } from '../src/game/simulation/prototypeBuildingRules.ts';
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
const PRINT_LEDGER = process.argv.includes('--ledger');
const QUALIFYING = ['blacksmith', 'archery-range', 'stable', 'market'];

// The most the Blacksmith's arrow technologies (Fletching, Bodkin Arrow,
// Bracer) add to a building's range, and the one-cell margin the assignment
// rule keeps clear. A Keep or a Korean tower reaches one or two further; the
// ledger prints the distance so those show.
const ARROW_TECH_RANGE_MAX = 3;
const DEFENCE_MARGIN = 1;
// The feed keeps a death for ten ticks and prunes only when the next one
// lands, so reading it every tick and de-duplicating by unit id sees them all;
// the task is sampled less often because a gather trip lasts hundreds of ticks.
const TASK_SAMPLE_INTERVAL = 25;

function upgradedReach(buildingType) {
  const combat = createBuildingCombatState(buildingType);
  return combat === null ? null : combat.attackRange + ARROW_TECH_RANGE_MAX + DEFENCE_MARGIN;
}

function footprintDistance(b, x, y) {
  const nx = Math.min(Math.max(x, b.x), b.x + b.footprintWidth - 1);
  const ny = Math.min(Math.max(y, b.y), b.y + b.footprintHeight - 1);
  return Math.abs(x - nx) + Math.abs(y - ny);
}

// Returns the NEAREST enemy defence (for the ledger line) and, separately,
// whether ANY of them covers the cell. Those are different questions: a
// Castle two cells further off reaches two cells further than a Town Centre,
// so asking only the nearest one under-counts.
function nearestEnemyDefence(buildings, owner, x, y) {
  let best = null;
  let covered = false;
  for (const b of buildings) {
    if (b.owner === owner || !b.isComplete) continue;
    const reach = upgradedReach(b.buildingType);
    if (reach === null) continue;
    const distance = footprintDistance(b, x, y);
    if (distance <= reach) covered = true;
    if (best === null || distance < best.distance) {
      best = { defence: b.buildingType, defenceOwner: b.owner, distance, reach };
    }
  }
  return best === null ? null : { ...best, covered };
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`# AI self-play audit — ${TICKS} ticks (${(TICKS / 600).toFixed(0)} min of game time)\n`);
console.log(`| ${pad('seed', 16)} | own | feudal | qualified | castle | imperial | bldgs | units | peak army | vill lost | under def |`);
console.log(`| ${'-'.repeat(16)} | --- | ------ | --------- | ------ | -------- | ----- | ----- | --------- | --------- | --------- |`);

const totals = { castle: 0, imperial: 0, bldg: 0, unit: 0, army: 0, owners: 0, lost: 0, underDefence: 0 };
for (const seed of SEEDS) {
  const bridge = createSimulationBridge(seed, { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) });
  const per = {};
  for (const o of [1, 2]) {
    per[o] = { b: new Set(), u: new Set(), age: {}, q: null, army: 0, lost: 0, underDefence: 0 };
  }
  const lastTask = new Map();
  const deathsSeen = new Set();
  const ledger = [];
  let outcome = 'running';
  for (let tick = 1; tick <= TICKS; tick += 1) {
    bridge.step(100);
    for (const death of bridge.getRecentUnitDeaths()) {
      const key = `${death.id}:${death.tick}`;
      if (deathsSeen.has(key)) continue;
      deathsSeen.add(key);
      if (death.unitType !== 'villager') continue;
      const x = Math.floor(death.x);
      const y = Math.floor(death.y);
      const nearest = nearestEnemyDefence(bridge.getEconomyState().buildings, death.owner, x, y);
      const underDefence = nearest !== null && nearest.covered;
      ledger.push({ tick: death.tick, owner: death.owner, x, y, task: lastTask.get(death.id) ?? '?', nearest, underDefence });
      const p = per[death.owner];
      if (p) {
        p.lost += 1;
        if (underDefence) p.underDefence += 1;
      }
    }
    if (bridge.getMatchState().outcome !== 'running') { outcome = bridge.getMatchState().outcome; break; }
    if (tick % TASK_SAMPLE_INTERVAL === 0) {
      for (const u of bridge.getEconomyState().units) {
        if (u.unitType === 'villager') lastTask.set(u.id, u.task);
      }
    }
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
      + `| ${pad(p.u.size, 5)} | ${pad(p.army, 9)} | ${pad(p.lost, 9)} | ${pad(p.underDefence, 9)} |`);
    totals.owners += 1;
    if (p.age['castle-age'] !== undefined) totals.castle += 1;
    if (p.age['imperial-age'] !== undefined) totals.imperial += 1;
    totals.bldg += p.b.size; totals.unit += p.u.size; totals.army += p.army;
    totals.lost += p.lost; totals.underDefence += p.underDefence;
  }
  if (outcome !== 'running') console.log(`| ${pad(seed, 16)} |     | match ended early: ${outcome}`);
  if (ledger.length > 0) {
    const byTask = {};
    for (const d of ledger) byTask[d.task] = (byTask[d.task] ?? 0) + 1;
    const tasks = Object.entries(byTask).map(([task, n]) => `${task} ${n}`).join(', ');
    console.log(`| ${pad(seed, 16)} |     | villager deaths by last task: ${tasks}`);
    if (PRINT_LEDGER) {
      for (const d of ledger) {
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
  + `villagers lost ${totals.lost} (${totals.underDefence} under enemy defences).`);
