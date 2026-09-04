#!/usr/bin/env node
// WHY the AI is not fielding an army: attribute the block, per owner, per sample.
//
// Promoted out of a scratch probe on 2026-09-03 because the v0.3.199 fix cited
// its numbers in the changelog, the devlog and the defect register as an
// "identical invocation" before/after — and the probe lived under an ignored
// path, so the headline evidence was not re-runnable by anyone. A review caught
// that. Evidence that a tracked doc cites has to be a tracked instrument.
//
// READ THE PERCENTAGES AS FRACTIONS OF SAMPLES, and hold SAMPLE fixed across
// both arms of any comparison. `peakArmy` and `peakPopCap` are peaks OVER
// SAMPLES, so a coarse SAMPLE understates them: at SAMPLE=15000 this reported
// arena's cap as 50 against the true 145 and its army as 21 against the true
// 105 — a collapse big enough to look like a catastrophic regression from the
// code under test. Re-run the control; never remember it.
//
// The `food<1060` column assumes the CASTLE-age view, where the Imperial age-up
// reserves 1000 food in front of a 60-food militia. It is MEANINGLESS for an
// Imperial-age owner: `ageUpReserveCost` returns {} when there is no next age.
// Reading it against Imperial owners cost this repo a wrong root cause.
//
//   npm run ai:army-block
//   SEEDS=arena,fortress TICKS=60000 SAMPLE=500 npm run ai:army-block
import { createSimulationBridge } from '../src/game/simulation/createSimulationBridge.ts';
import { HUMAN_PLAYER_ID } from '../src/game/simulation/prototypeScenario.ts';

const SEEDS = (process.env.SEEDS ?? 'arena,fortress,gold-rush,coastal').split(',');
const TICKS = Number(process.env.TICKS ?? 60000);
const SAMPLE = Number(process.env.SAMPLE ?? 500);
// The cheapest thing each age can train, and the reserve that stands in front
// of it. Militia 60 food; the Imperial research is 1000 food / 800 gold.
const MILITIA_FOOD = 60;
const IMPERIAL_FOOD_RESERVE = 1000;

const pad = (value, width) => String(value).padStart(width);

const blank = () => ({
  samples: 0, popCapped: 0, villagersAtOrAboveCap: 0, foodBelowMilitia: 0,
  foodBelowMilitiaPlusImperial: 0, bothPopAndFood: 0, neitherBlocked: 0,
  peakArmy: 0, peakPopCap: 0, lastAge: '', lastFood: 0, lastVillagers: 0,
  lastArmy: 0, lastPop: '',
});

for (const seed of SEEDS) {
  // Both owners AI, exactly as `scripts/selfplay-audit.mjs` drives it — the
  // human slot left human measures a different match.
  const bridge = createSimulationBridge(seed, { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) });
  let outcome = 'running';
  let endedAt = TICKS;
  const rows = new Map();
  for (let tick = 1; tick <= TICKS; tick += 1) {
    bridge.step(100);
    if (bridge.getMatchState().outcome !== 'running') {
      outcome = bridge.getMatchState().outcome;
      endedAt = tick;
      break;
    }
    if (tick % SAMPLE !== 0) continue;
    const economy = bridge.getEconomyState();
    for (const owner of new Set(Object.keys(economy.ages).map(Number))) {
      const row = rows.get(owner) ?? blank();
      rows.set(owner, row);
      const resources = economy.playerResources[owner];
      const population = economy.population[owner];
      if (!resources || !population) continue;
      const units = economy.units.filter((unit) => unit.owner === owner);
      const villagers = units.filter((unit) => unit.unitType === 'villager').length;
      const army = units.length - villagers;
      const age = economy.ages[owner] ?? 'dark-age';
      const villagerCap = age === 'dark-age' ? 12 : age === 'feudal-age' ? 22 : age === 'castle-age' ? 40 : 60;

      const popCapped = population.current >= population.cap;
      const foodBelowMilitia = resources.food < MILITIA_FOOD;
      const foodBelowReserved = resources.food < MILITIA_FOOD + IMPERIAL_FOOD_RESERVE;

      row.samples += 1;
      if (popCapped) row.popCapped += 1;
      if (villagers >= villagerCap) row.villagersAtOrAboveCap += 1;
      if (foodBelowMilitia) row.foodBelowMilitia += 1;
      if (foodBelowReserved) row.foodBelowMilitiaPlusImperial += 1;
      if (popCapped && foodBelowReserved) row.bothPopAndFood += 1;
      if (!popCapped && !foodBelowMilitia) row.neitherBlocked += 1;
      row.peakArmy = Math.max(row.peakArmy, army);
      row.peakPopCap = Math.max(row.peakPopCap, population.cap);
      row.lastAge = age;
      row.lastFood = Math.round(resources.food);
      row.lastVillagers = villagers;
      row.lastArmy = army;
      row.lastPop = `${String(population.current)}/${String(population.cap)}`;
    }
  }
  // A HALTED bridge looks exactly like an idle AI from out here — `tryTick`
  // catches the engine's tick failure and every later step returns at once.
  const halted = bridge.getHudState().engineHalted;
  console.log(`${seed} — outcome ${outcome} at tick ${String(endedAt)}${halted ? ' [ENGINE HALTED — these numbers are not a measurement]' : ''}`);
  for (const [owner, row] of [...rows].sort((a, b) => a[0] - b[0])) {
    const pct = (n) => `${pad(Math.round((n / Math.max(1, row.samples)) * 100), 3)}%`;
    console.log(
      `${seed.padEnd(15)} o${owner}`
      + ` | age ${row.lastAge.padEnd(12)}`
      + ` | pop ${pad(row.lastPop, 6)} peakCap ${pad(row.peakPopCap, 3)}`
      + ` | vil ${pad(row.lastVillagers, 2)} army ${pad(row.lastArmy, 2)} peak ${pad(row.peakArmy, 2)}`
      + ` | food ${pad(row.lastFood, 5)}`
      + ` || popCapped ${pct(row.popCapped)}`
      + ` vilAtCap ${pct(row.villagersAtOrAboveCap)}`
      + ` food<60 ${pct(row.foodBelowMilitia)}`
      + ` food<1060 ${pct(row.foodBelowMilitiaPlusImperial)}`
      + ` bothBlocked ${pct(row.bothPopAndFood)}`
      + ` clear ${pct(row.neitherBlocked)}`,
    );
  }
}
