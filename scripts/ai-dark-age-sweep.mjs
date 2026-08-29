#!/usr/bin/env node
// Sweeps the AI's Dark-Age knobs and reports when each combination reaches
// Feudal. It exists because guessing failed twice on 2026-08-29: raising the
// villager cap alone moved Feudal LATER (tick 13,000 vs a 10,100 baseline),
// and the "villagers waste the age walking" theory died on a measurement
// showing 62% gathering / 0% idle. The two knobs only make sense together —
// extra villagers inherit the food/wood split, so more bodies at 57% food
// just buys more wood — and a sweep is the only honest way to see that.
//
// Usage:
//   npx tsx scripts/ai-dark-age-sweep.mjs [--ticks 20000] [--seeds a,b,c]
//
// THIS SWEEP PROPOSES; THE TEST SUITE DISPOSES. It ranks on one number — the
// tick Feudal arrives — and a single-objective search walks off cliffs that
// are not in its objective. It did exactly that on 2026-08-29: the 6:2 row won
// the table, was adopted, and `gatherDomain.test.ts` then caught that the AI
// could no longer afford the 60-wood farms it needs once the sheep are eaten.
// Faster to Feudal, dead by Castle. So treat the table as a SHORTLIST: adopt a
// row only after `npm test` and `npm run playtest:corpus` clear it.
//
// Prints a markdown table: for each (cap, food:wood) pair, the tick each owner
// reached Feudal ("—" for never inside the budget). Lower is better; the
// baseline row is marked (it matches whatever DARK_AGE_TUNING currently holds,
// so the marker disappears if you edit the tuning to a split outside the grid).
// Nothing is written to the repo — set DARK_AGE_TUNING by hand so the change
// is a deliberate, reviewable edit rather than a script's output.

import { createSimulationBridge } from '../src/game/simulation/createSimulationBridge.ts';
import { DARK_AGE_TUNING } from '../src/game/simulation/aiEconomyPlan.ts';
import { HUMAN_PLAYER_ID } from '../src/game/simulation/prototypeScenario.ts';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
// 20,000 rather than 14,000: at 14k a slow seed reads "never/never" for every
// row, which makes a REGRESSION look like a tie. On critic-seed-a the truth
// only appeared past 16k, where the food-heavy split was worse for both owners.
const TICKS = Number(arg('ticks', 20000));
// Multi-seed by DEFAULT, and `aoe2-prototype` leads because it is DEFAULT_SEED —
// the map a player actually boots. Tuning on one seed produced a row that won
// on `default-seed` and LOST on the shipped map (2026-08-29 review); a single
// -seed sweep is how that happens.
const SEEDS = String(arg('seeds', 'aoe2-prototype,default-seed,corpus-seed-b')).split(',');

// Cap × split grid. The splits are food:wood ratios written as the AI's
// weights; gold and stone stay 0 in the Dark Age exactly as the shipped plan
// has them (nothing in the Dark Age costs gold, and stone waits for Feudal).
const CAPS = [10, 13, 16, 22];
const SPLITS = [
  { food: 4, wood: 3 }, // shipped baseline, 57% food
  { food: 5, wood: 2 }, // 71% food
  { food: 6, wood: 3 }, // 67% food — shipped
  { food: 6, wood: 2 }, // 75% food
  { food: 7, wood: 1 }, // 88% food — houses/barracks may starve
];

/** Run one match and return the tick each owner first entered Feudal. */
function feudalTicks(seed, cap, split) {
  DARK_AGE_TUNING.villagerCap = cap;
  DARK_AGE_TUNING.weights = { ...split, gold: 0, stone: 0 };
  const bridge = createSimulationBridge(seed, {
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
  });
  const reached = {};
  for (let tick = 1; tick <= TICKS; tick += 1) {
    bridge.step(100);
    if (tick % 100 !== 0) continue;
    const ages = bridge.getEconomyState().ages ?? {};
    for (const owner of [1, 2]) {
      if (reached[owner] === undefined && String(ages[owner] ?? '') !== 'dark-age') {
        reached[owner] = tick;
      }
    }
    if (reached[1] !== undefined && reached[2] !== undefined) break;
  }
  return reached;
}

const baselineCap = DARK_AGE_TUNING.villagerCap;
const baselineSplit = { ...DARK_AGE_TUNING.weights };
const rows = [];
for (const cap of CAPS) {
  for (const split of SPLITS) {
    const perSeed = {};
    for (const seed of SEEDS) {
      perSeed[seed] = feudalTicks(seed, cap, split);
    }
    const isBaseline = cap === baselineCap
      && split.food === baselineSplit.food && split.wood === baselineSplit.wood;
    rows.push({ cap, split, perSeed, isBaseline });
    console.error(`  done cap=${cap} ${split.food}:${split.wood}`);
  }
}

// Rank on the WORST owner across ALL seeds, not the best owner on one seed.
// The old `min` ranking hid two things at once: a split that carries one AI
// while starving the other, and a split that wins on the seed it was tuned on
// while losing on the map the game boots. `Infinity - Infinity` is NaN, which
// made the comparator undefined whenever rows tied at "never" — so censored
// rows are scored with a finite sentinel above the budget instead.
const NEVER = TICKS * 10;
const scoreOf = (row) => {
  let worst = 0;
  for (const seed of SEEDS) {
    for (const owner of [1, 2]) worst = Math.max(worst, row.perSeed[seed][owner] ?? NEVER);
  }
  return worst;
};
for (const row of rows) row.score = scoreOf(row);
rows.sort((a, b) => a.score - b.score);
console.log(`
# AI Dark-Age sweep — seeds ${SEEDS.join(', ')}, budget ${TICKS} ticks
`);
const header = SEEDS.map((seed) => `${seed} (p1/p2)`).join(' | ');
console.log(`| cap | food:wood | ${header} | worst |`);
console.log(`| --- | --------- |${SEEDS.map(() => ' --- |').join('')} ----- |`);
for (const row of rows) {
  const mark = row.isBaseline ? ' (baseline)' : '';
  const cells = SEEDS.map((seed) => {
    const r = row.perSeed[seed];
    const one = (owner) => (r[owner] === undefined ? '—' : String(r[owner]));
    return `${one(1)}/${one(2)}`;
  }).join(' | ');
  const worst = row.score >= NEVER ? '—' : String(row.score);
  console.log(`| ${row.cap}${mark} | ${row.split.food}:${row.split.wood} | ${cells} | ${worst} |`);
}
console.log('');
console.log('Ranked by the WORST owner across all seeds. A row that beats the'
  + ' baseline on one seed and loses on another is not an improvement.');
console.log('Adopt by hand in aiEconomyPlan.ts, then let npm test + playtest:corpus veto it.');
