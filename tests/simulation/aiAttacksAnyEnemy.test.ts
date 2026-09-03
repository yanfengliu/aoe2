import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { lastResortTargetFor, pickAttackTarget } from '../../src/game/simulation/bridge/systems/aiSystem';

// The AI used to attack `humanPlayerId` and nothing else: its target villager
// and its target Town Center were both looked up on that one owner. So an AI
// whose own owner IS the human slot had nobody to attack, and no AI ever
// attacked another AI — two AI players in a skirmish would build up forever and
// never fight, which is not a game.
//
// The rule now is "the nearest enemy", which is byte-identical for the ordinary
// human-versus-AI match (with two owners, the nearest enemy IS the human) and
// gives every AI a target in every other case.

type Bridge = ReturnType<typeof createSimulationBridge>;

function militaryOf(bridge: Bridge, owner: number) {
  return bridge.getEconomyState().units.filter(
    (unit) => unit.owner === owner && unit.unitType !== 'villager',
  );
}

/**
 * Run an all-AI match and report whether owner 1 — the forced-AI slot that used
 * to have no target — ever sent military into owner 2's half of the map.
 */
/**
 * Run the two-AI fixture and report the closest approach each owner's army made
 * to the OTHER owner's Town Center. The armies start 32 cells apart with vision
 * 4, so neither can see the other and auto-aggression cannot fire: any approach
 * at all is a deliberate march.
 */
function closestApproaches(maxSteps: number): { byOwner1: number; byOwner2: number } {
  const bridge = createSimulationBridge('ai-versus-ai-fixture', {
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
  });
  const townCenters = new Map(
    bridge.getEconomyState().buildings
      .filter((building) => building.buildingType === 'town-center')
      .map((building) => [building.owner, building]),
  );
  expect(townCenters.size).toBe(2);

  let byOwner1 = Number.POSITIVE_INFINITY;
  let byOwner2 = Number.POSITIVE_INFINITY;
  for (let step = 0; step < maxSteps; step += 1) {
    bridge.step(100);
    if (step % 10 !== 0) continue;
    for (const owner of [1, 2]) {
      const target = townCenters.get(owner === 1 ? 2 : 1)!;
      for (const unit of militaryOf(bridge, owner)) {
        const distance = Math.abs(unit.x - target.x) + Math.abs(unit.y - target.y);
        if (owner === 1) byOwner1 = Math.min(byOwner1, distance);
        else byOwner2 = Math.min(byOwner2, distance);
      }
    }
  }
  return { byOwner1, byOwner2 };
}

describe('an AI attacks the nearest enemy, not only the human slot', () => {
  it('sends the forced-AI owner’s army at the other AI', () => {
    const { byOwner1, byOwner2 } = closestApproaches(900);
    // Both AIs march: each army closes on the other's Town Center from 32 cells
    // away. Owner 1 is the one that could not before — it occupies the human
    // slot, so its target lookup found itself.
    expect({ byOwner1, byOwner2 }).toEqual({
      byOwner1: expect.any(Number),
      byOwner2: expect.any(Number),
    });
    expect(byOwner2).toBeLessThanOrEqual(12);
    expect(byOwner1).toBeLessThanOrEqual(12);
  }, 120_000);
});

describe('which enemy an AI picks', () => {
  const position = (x: number, y: number) => ({ x, y });

  it('picks the other player in an ordinary two-player match, as before', () => {
    // The human-versus-AI path this change must not disturb: with two owners
    // the nearest enemy IS the human, so the AI behaves exactly as it did when
    // it looked the target up on humanPlayerId directly.
    const townCenters = new Map([
      [1, { id: 10, position: position(8, 8) }],
      [2, { id: 20, position: position(40, 8) }],
    ]);
    expect(pickAttackTarget(2, townCenters)).toEqual({
      targetOwner: 1,
      targetTownCenterId: 10,
      targetTownCenterPosition: position(8, 8),
    });
    // And the owner in the human slot now has a target of its own.
    expect(pickAttackTarget(1, townCenters).targetOwner).toBe(2);
  });

  it('picks the NEAREST enemy when there are several', () => {
    const townCenters = new Map([
      [1, { id: 10, position: position(0, 0) }],
      [2, { id: 20, position: position(60, 0) }],
      [3, { id: 30, position: position(12, 0) }],
    ]);
    expect(pickAttackTarget(1, townCenters).targetOwner).toBe(3);
    expect(pickAttackTarget(2, townCenters).targetOwner).toBe(3);
    expect(pickAttackTarget(3, townCenters).targetOwner).toBe(1);
  });

  it('breaks ties on the lower owner id, so a replay picks the same enemy', () => {
    const townCenters = new Map([
      [3, { id: 30, position: position(10, 0) }],
      [1, { id: 10, position: position(0, 0) }],
      [2, { id: 20, position: position(20, 0) }],
    ]);
    // Owners 1 and 2 are both 10 cells from owner 3 — insertion order puts 3
    // first, so only the id sort makes this answer stable.
    expect(pickAttackTarget(3, townCenters).targetOwner).toBe(1);
  });

  it('reports no target when no enemy has a Town Center left', () => {
    const townCenters = new Map([[1, { id: 10, position: position(8, 8) }]]);
    expect(pickAttackTarget(1, townCenters)).toEqual({
      targetOwner: null,
      targetTownCenterId: null,
      targetTownCenterPosition: null,
    });
  });

  it('still picks an enemy when the AI has lost its own Town Center', () => {
    // Distance is unmeasurable without a home, and an AI with an army and no
    // base must still have somewhere to take it.
    const townCenters = new Map([[2, { id: 20, position: position(40, 8) }]]);
    expect(pickAttackTarget(1, townCenters).targetOwner).toBe(2);
  });
});

// A conquest match ends only when a player has NO UNITS AND NO BUILDINGS. The
// AI's march target was chosen from the map of owners that still HAVE a Town
// Center, so razing one removed that player from the target list entirely and
// its surviving buildings were attacked only if they wandered into vision.
//
// Measured on `gold-rush` at 60,000 ticks before the fallback existed: owner 2
// held zero units and no Town Center — it could never produce anything again —
// and kept a blacksmith and a house, byte-identical from tick 48,000 onward,
// while owner 1 stood beside it with an army of 90 and nothing to aim at. With
// the fallback the same seed ends in victory at tick 41,967.
describe('an enemy with no Town Center is still a target', () => {
  const at = (id: number, x: number, y: number) => ({ id, position: { x, y } });

  it('marches on a surviving building when the enemy has lost its Town Center', () => {
    const buildings = new Map([[2, at(77, 30, 30)]]);

    expect(lastResortTargetFor(1, { x: 4, y: 4 }, buildings, new Map())).toEqual({
      lastResortTargetId: 77,
      lastResortTargetPosition: { x: 30, y: 30 },
    });
  });

  it('takes the nearest of several, deterministically', () => {
    const buildings = new Map([[3, at(99, 40, 40)], [2, at(77, 8, 8)]]);

    expect(lastResortTargetFor(1, { x: 4, y: 4 }, buildings, new Map()).lastResortTargetId).toBe(77);
  });

  it('never targets an ally that has lost its Town Center', () => {
    const buildings = new Map([[2, at(77, 30, 30)]]);
    // Owners 1 and 2 on the same team.
    const teams = new Map([[1, 1], [2, 1]]);

    expect(lastResortTargetFor(1, { x: 4, y: 4 }, buildings, teams)).toEqual({
      lastResortTargetId: null,
      lastResortTargetPosition: null,
    });
  });

  it('leaves pickAttackTarget exactly as it was', () => {
    // The last resort is a SEPARATE field on purpose. Folding it into
    // `targetTownCenterPosition` regressed the age-up, because `aiFerryPhase`
    // reads that field and stands down discretionary building when it is set.
    const townCenters = new Map([[1, at(10, 4, 4)]]);

    expect(pickAttackTarget(1, townCenters, new Map())).toEqual({
      targetOwner: null,
      targetTownCenterId: null,
      targetTownCenterPosition: null,
    });
  });
});
