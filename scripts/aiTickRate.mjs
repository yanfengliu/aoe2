#!/usr/bin/env node
// How fast is the simulation actually running? Reports ticks per second over
// successive windows of an AI-vs-AI match, so a cost that only appears in a
// crowded base shows up as a falling rate rather than as one average.
//
// Reach for this the moment a measurement run seems to hang: twice on
// 2026-08-23 a stalled run looked like a performance regression in code changed
// that day, and both times this said 210-530 ticks/s throughout — the machine
// was busy with leftover processes from earlier runs.
//
//   npm run ai:tickrate
//   MAX_TICKS=20000 WINDOW=2000 npm run ai:tickrate
import { createSimulationBridge } from '../src/game/simulation/createSimulationBridge.ts';
import { HUMAN_PLAYER_ID } from '../src/game/simulation/prototypeScenario.ts';

const bridge = createSimulationBridge(process.env.SEED ?? 'default-seed', {
  forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
});
const maxTicks = Number(process.env.MAX_TICKS ?? 8000);
const windowSize = Number(process.env.WINDOW ?? 1000);
const start = bridge.world.tick;
let windowStart = Date.now();
while (bridge.world.tick - start < maxTicks) {
  // `step` returns WITHOUT advancing once the match has an outcome, so a loop
  // that only watches the tick spins forever the moment one side is wiped out
  // — measured hanging indefinitely, killed at 60s. `runPlaytest` has had this
  // check all along; these two did not.
  if (bridge.getMatchState().outcome !== 'running') {
    console.error(`match ended (${bridge.getMatchState().outcome}) at tick `
      + `${bridge.world.tick - start} of ${maxTicks} — stopping early`);
    break;
  }
  bridge.step(100);
  const elapsed = bridge.world.tick - start;
  if (elapsed % windowSize !== 0) continue;
  const seconds = (Date.now() - windowStart) / 1000;
  const eco = bridge.getEconomyState();
  console.log(
    `t=${String(elapsed).padStart(5)} ${(windowSize / seconds).toFixed(0)} ticks/s `
    + `(${seconds.toFixed(1)}s) units=${eco.units.length} buildings=${(eco.buildings ?? []).length}`,
  );
  windowStart = Date.now();
}
