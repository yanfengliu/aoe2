// A shot at a building lands on the building's centre (defect register, "A
// blast landed where DE's does not", 2026-09-26; spec §10.7).
//
// THE DEFECT: a projectile at a building was aimed at the building's position,
// which in this game is its anchor, the top-left cell of its footprint. So a
// Mangonel's stone on a House came down on its north-west cell, and its blast
// reached the units at the House's north and west sides and never those at its
// south and east. In Definitive Edition a unit fires "at the exact centre of
// its target" and a mangonel's blast is centred on "the targeted point" (the
// DE modding guide, ugc.aoe2.rocks, attribute 11), and a building's position is
// the centre of its footprint (DE's data gives a House a collision half-size of
// 1, a Dock 1.5 and a Town Centre 2).
//
// THE CLASS: where any shot at any building lands. Every shooter reaches it
// through one function (`deliverUnitAttackOnBuilding`), so the test fires one
// of each kind of shot, an arrow, a stone that blasts and the widest blast,
// at one building of each footprint size, and reads where each shot is aimed.
//
// BOUNDS: the first shot of each attack, with no technology. Tower and Town
// Centre arrows are at units only, and a detonation fires no shot, so neither
// is here. The ring check asks only that the blast treat every side of a
// House alike; how far it reaches is measured from the centre to each unit's
// cell, as every blast here is, and a unit beside a House is 1.58 or more from
// its centre, beyond the Siege Onager's 1.5 (§10.7 records what the grid
// leaves out).
import type { Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { getBuildingFootprint } from '../../src/game/content/buildingFootprints';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  BUILDING_SHOT_ATTACKERS,
  BUILDING_SHOT_TARGETS,
  buildingShotRingAroundHouse,
} from '../../src/game/simulation/fixtures/buildingShotLanding';
import type { UnitType } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

const SEED = 'building-shot-landing-fixture';
/** Long enough for the slowest shooter to walk into range and loose a shot. */
const MAX_TICKS = 400;

function ownUnit(bridge: Bridge, unitType: UnitType) {
  const unit = bridge.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === unitType);
  if (!unit) throw new Error(`${SEED} has no ${unitType} of owner 1`);
  return unit;
}

/** The whole side to No Attack, as a player would set it, so no idle shooter
 *  starts a fight of its own with the Villagers; then one order. */
function orderAttack(bridge: Bridge, unitType: UnitType, targetId: number): number {
  const own = bridge.getEconomyState().units.filter((u) => u.owner === 1).map((u) => u.id);
  expect(bridge.selectUnitsByIds(own)).toBe(true);
  expect(bridge.setSelectionStance('no-attack'), 'the stance could not be set').toBe(true);
  const attacker = ownUnit(bridge, unitType);
  expect(bridge.selectUnitsByIds([attacker.id]), `the ${unitType} could not be selected`).toBe(true);
  expect(bridge.issueContextCommandAtEntity(targetId), `the ${unitType} was refused the attack`).toBe(true);
  return attacker.id;
}

function buildingAt(bridge: Bridge, at: Position) {
  const building = bridge.getEconomyState().buildings.find((b) => b.owner === 2 && b.x === at.x && b.y === at.y);
  if (!building) throw new Error(`${SEED} has no building of owner 2 at (${at.x}, ${at.y})`);
  return building;
}

/** Steps until the attacker has a shot in the air, and returns it. */
function firstShot(bridge: Bridge, attackerId: number) {
  for (let step = 0; step < MAX_TICKS; step += 1) {
    bridge.step(100);
    const shot = bridge.getInFlightProjectiles().find((s) => s.attackerId === attackerId);
    if (shot) return shot;
  }
  return undefined;
}

describe('a shot at a building lands on the building\'s centre', () => {
  it('has one building of each footprint size, so the check covers them all', () => {
    const sizes = BUILDING_SHOT_TARGETS.map((t) => getBuildingFootprint(t.buildingType).width);
    expect(sizes).toEqual([1, 2, 3, 4]);
  });

  for (const { unitType } of BUILDING_SHOT_ATTACKERS) {
    for (const { buildingType, at } of BUILDING_SHOT_TARGETS) {
      it(`a ${unitType}'s shot at a ${buildingType}`, () => {
        const bridge = createSimulationBridge(SEED);
        const building = buildingAt(bridge, at);
        const attackerId = orderAttack(bridge, unitType, building.id);
        const shot = firstShot(bridge, attackerId);
        expect(shot, `the ${unitType} loosed no shot at the ${buildingType} in ${MAX_TICKS} ticks`).toBeDefined();
        const footprint = getBuildingFootprint(buildingType);
        const centre = { x: at.x + (footprint.width - 1) / 2, y: at.y + (footprint.height - 1) / 2 };
        expect({ x: shot!.aimX, y: shot!.aimY }, `the ${unitType}'s shot at the ${footprint.width}x${footprint.height} `
          + `${buildingType} anchored at (${at.x}, ${at.y}) is aimed somewhere other than its centre`).toEqual(centre);
      }, 30_000);
    }
  }

  it('a Siege Onager\'s stone on a House treats every side of it alike, sparing all of them', () => {
    const bridge = createSimulationBridge(SEED);
    const house = BUILDING_SHOT_TARGETS.find((t) => t.buildingType === 'house')!.at;
    const houseId = buildingAt(bridge, house).id;
    const ring = buildingShotRingAroundHouse().map((cell) => {
      const villager = bridge.getEconomyState().units.find((u) => u.owner === 2 && u.x === cell.x && u.y === cell.y);
      if (!villager) throw new Error(`${SEED} has no Villager at (${cell.x}, ${cell.y})`);
      return { id: villager.id, cell, hp: bridge.getEntityHealth(villager.id)!.currentHp };
    });
    const houseHp = () => bridge.getEntityHealth(houseId)?.currentHp ?? 0;
    const houseBefore = houseHp();
    const attackerId = orderAttack(bridge, 'siege-onager', houseId);
    const shot = firstShot(bridge, attackerId);
    expect(shot, 'the Siege Onager loosed no shot at the House').toBeDefined();
    for (let step = 0; step < MAX_TICKS && houseHp() === houseBefore; step += 1) bridge.step(100);
    expect(houseHp(), 'the stone never landed on the House').toBeLessThan(houseBefore);

    // A blast centred on the House treats every side alike, and here that
    // means it spares them all: each cell around a 2x2 is 1.58 or more from
    // its centre, beyond the Siege Onager's 1.5. On the anchor, the stone
    // hurt the north and west sides and spared the south and east.
    const hurt = ring.filter((v) => (bridge.getEntityHealth(v.id)?.currentHp ?? 0) < v.hp).map((v) => `(${v.cell.x}, ${v.cell.y})`);
    expect(hurt, `the stone landed at (${shot!.aimX}, ${shot!.aimY}) and hurt these Villagers around the House, `
      + 'every one 1.58 or more from its centre').toEqual([]);
  }, 30_000);
});
