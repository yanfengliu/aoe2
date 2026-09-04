// An enemy who hides inside its buildings must still be finished off.
//
// BOUND: one fixture, one age (Castle), one attacker composition, 8,000 ticks
// from a base of three buildings. It proves the attacking AI does not STALL on
// a target it cannot engage, and it says nothing about a defender that shoots
// back with more than a Town Centre, about walls, or about siege.
//
// The window is deliberately loose. With the fix the match resolves by tick
// 4,000; with the defect the army is idle in every sample from tick 1,000 on
// and NOTHING resolves at any horizon, so doubling the window cannot turn a
// pass into a fail for a reason other than the defect.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

describe('an AI whose enemy has only garrisoned units left', () => {
  it('razes the buildings instead of standing idle beside them', () => {
    const bridge = createSimulationBridge('ai-garrisoned-defender-fixture', {
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
      'the fixture must leave owner 2 with nothing on the map',
    ).toHaveLength(0);
    // …and alive, so this is a HIDDEN target rather than a dead one. A dead
    // villager would let the attack phase fall through for the wrong reason.
    expect(
      villagerIds.every((id) => bridge.world.isAlive(id)),
      'both villagers must be garrisoned, not killed',
    ).toBe(true);

    for (let tick = 0; tick < 8000; tick += 1) {
      bridge.step(100);
      if (bridge.getMatchState().outcome !== 'running') break;
    }
    expect(bridge.getHudState().engineHalted, 'a halted bridge idles identically').toBeFalsy();

    const economy = bridge.getEconomyState();
    const standing = economy.buildings.filter((building) => building.owner === 2);
    const attackers = economy.units.filter(
      (unit) => unit.owner === 1 && unit.unitType !== 'villager',
    );
    const idle = attackers.filter((unit) => unit.task === 'idle').length;
    expect(
      bridge.getMatchState().outcome,
      `owner 2 still holds ${String(standing.length)} building(s) `
      + `(${standing.map((b) => b.buildingType).join(', ')}); `
      + `${String(idle)} of ${String(attackers.length)} attackers idle`,
    ).not.toBe('running');
  });
});
