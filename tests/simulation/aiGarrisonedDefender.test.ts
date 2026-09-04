// An enemy who hides inside its buildings must still be finished off.
//
// BOUND: one map, one age (Castle), two attacker sizes, 8,000 ticks from a
// base of three buildings. It proves the attacking AI does not STALL on a
// target it cannot engage. It does not prove it wins, picks a good building,
// breaches a wall, or copes with a defender that shoots back with more than a
// Town Centre.
//
// The window is deliberately loose. With the fix the match resolves by tick
// 4,000; with either defect present the army is idle in every sample from tick
// 1,000 on and NOTHING resolves at any horizon, so doubling the window cannot
// turn a pass into a fail for a reason other than the defect.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

function runToResolution(seed: string): {
  outcome: string;
  standing: string[];
  attackers: number;
  idle: number;
  /** How close any attacker ever got to the enemy Town Centre. */
  closestApproach: number;
} {
  const bridge = createSimulationBridge(seed, {
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
  });
  bridge.step(100);

  const start = bridge.getEconomyState();
  const townCentre = start.buildings.find(
    (building) => building.owner === 2 && building.buildingType === 'town-center',
  );
  if (!townCentre) throw new Error('fixture has no owner-2 town centre');
  const villagerIds = start.units
    .filter((unit) => unit.owner === 2 && unit.unitType === 'villager')
    .map((unit) => unit.id);
  expect(villagerIds).toHaveLength(2);
  // Identity, not id: the engine recycles entity ids and `isAlive` takes a bare
  // id, so a dead villager whose id was reused reads as alive. A critic caught
  // this: an earlier version of this check reported `alive: false,true` for a
  // villager that had been killed. Refs carry the generation.
  const refs = villagerIds.map((id) => bridge.world.getEntityRef(id));

  // Put them inside, the way the town bell does. A garrisoned unit loses its
  // position component, which is exactly what an attacker cannot engage.
  for (const villagerId of villagerIds) {
    bridge.pendingCommands.push({
      type: 'unit.contextAtEntity',
      data: { unitId: villagerId, targetEntityId: townCentre.id, garrison: true },
    });
  }
  // The context command walks them to the door first, so give them time.
  for (let tick = 0; tick < 300; tick += 1) bridge.step(100);

  expect(
    bridge.getEconomyState().units.filter((unit) => unit.owner === 2),
    `${seed}: the fixture must leave owner 2 with nothing on the map`,
  ).toHaveLength(0);
  // …and HIDDEN rather than dead, or the attack phase would fall through for
  // the right answer for the wrong reason. Two independent readings: the exact
  // entities are still current, and owner 2's POPULATION still counts them,
  // which is what "garrisoned" means and what no recycled id can fake.
  expect(
    refs.every((ref) => ref !== null && bridge.world.isCurrent(ref)),
    `${seed}: both villagers must be garrisoned, not killed`,
  ).toBe(true);
  expect(
    bridge.getEconomyState().population[2]?.current,
    `${seed}: garrisoned villagers still cost population`,
  ).toBe(2);

  let closestApproach = Number.POSITIVE_INFINITY;
  for (let tick = 0; tick < 8000; tick += 1) {
    bridge.step(100);
    if (tick % 25 === 0) {
      for (const unit of bridge.getEconomyState().units) {
        if (unit.owner !== 1 || unit.unitType === 'villager') continue;
        closestApproach = Math.min(
          closestApproach,
          Math.abs(unit.x - townCentre.x) + Math.abs(unit.y - townCentre.y),
        );
      }
    }
    if (bridge.getMatchState().outcome !== 'running') break;
  }
  expect(bridge.getHudState().engineHalted, 'a halted bridge idles identically').toBeFalsy();

  const economy = bridge.getEconomyState();
  const attackers = economy.units.filter(
    (unit) => unit.owner === 1 && unit.unitType !== 'villager',
  );
  return {
    outcome: bridge.getMatchState().outcome,
    standing: economy.buildings
      .filter((building) => building.owner === 2)
      .map((building) => building.buildingType),
    attackers: attackers.length,
    idle: attackers.filter((unit) => unit.task === 'idle').length,
    closestApproach,
  };
}

describe('an AI whose enemy has only garrisoned units left', () => {
  it('razes the buildings instead of standing idle beside them', () => {
    const result = runToResolution('ai-garrisoned-defender-fixture');
    expect(
      result.outcome,
      `owner 2 still holds ${String(result.standing.length)} building(s) `
      + `(${result.standing.join(', ')}); ${String(result.idle)} of `
      + `${String(result.attackers)} attackers idle`,
    ).not.toBe('running');
  });

  // The attack-group threshold has nothing to hold back against an enemy with
  // no units on the map, and it used to gate every fallback including the
  // last-resort one written for exactly this case.
  //
  // This arm asks whether the army MARCHES, not whether it wins: four
  // Men-at-Arms lose to a Town Centre's arrows, and the arm is deliberately
  // broke so it cannot train replacements, so demanding a result here would be
  // demanding something the composition cannot do. Measured: with the
  // exception the closest approach is 1 cell and every attacker dies at the
  // enemy's door; without it, 20 — they never leave their own base.
  it('marches an army UNDER the attack-group threshold', () => {
    const result = runToResolution('ai-garrisoned-defender-few-fixture');
    expect(
      result.closestApproach,
      `four attackers against a Castle-age threshold of seven never reached the `
      + `enemy: closest approach ${String(result.closestApproach)} cells; owner 2 `
      + `still holds ${String(result.standing.length)} building(s); `
      + `${String(result.idle)} of ${String(result.attackers)} attackers idle`,
    ).toBeLessThanOrEqual(4);
  });
});
