// The scene of the defect register's entry "A stone aimed at a deleted House
// hit the foundation that took its id" (2026-10-11), shared by the tests that
// play it live, across a save and in a replay. A Mangonel's stone is in the air
// at a House when the House's owner deletes it and one of its Villagers puts a
// new House foundation on the same spot; civ-engine gives the foundation the
// dead House's id. Everything here goes through real commands and reads the
// world's own state, so it drives a live match and a replay world alike.

import type { Position } from 'civ-engine';
import { expect } from 'vitest';

import { buildingHealthStatesCodec, projectilesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { ProjectileState } from '../../src/game/simulation/bridge/projectileTypes';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { BUILDING_SHOT_TARGETS } from '../../src/game/simulation/fixtures/buildingShotLanding';
import type { BuildingComponent, UnitComponent } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

export const STONE_SEED = 'building-shot-landing-fixture';
export const HOUSE_AT: Position = BUILDING_SHOT_TARGETS.find((t) => t.buildingType === 'house')!.at;

/** Owner 2's building standing at the House's spot, if any. */
export function buildingAtHouseSpot(world: GameWorld): number | undefined {
  for (const id of world.query('building', 'position')) {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    const at = world.getComponent<Position>(id, 'position');
    if (building?.owner === 2 && at?.x === HOUSE_AT.x && at.y === HOUSE_AT.y) return id;
  }
  return undefined;
}

/** The shots in the air, from the world's own slot. */
export function shotsInAir(world: GameWorld): readonly ProjectileState[] {
  return projectilesCodec.deserialize(world.getState(projectilesCodec.slot) as never).inFlight;
}

/** A building's hit points, from the world's own slot. */
export function buildingHp(world: GameWorld, id: number): number | undefined {
  return buildingHealthStatesCodec.deserialize(world.getState(buildingHealthStatesCodec.slot) as never).get(id)?.currentHp;
}

/** Owner 1's units to No Attack, as a player would set them, so nothing starts
 *  a fight of its own. Call it before the first step: a unit left on its
 *  default stance takes on owner 2's Villagers by itself. */
export function holdFire(bridge: Bridge): void {
  const own = bridge.getEconomyState().units.filter((u) => u.owner === 1).map((u) => u.id);
  expect(bridge.selectUnitsByIds(own)).toBe(true);
  expect(bridge.setSelectionStance('no-attack'), 'the stance could not be set').toBe(true);
}

/** Holds owner 1's fire, then gives the Mangonel its one order, at the House.
 *  Steps until its stone is in the air with room left to replace the House
 *  under it. */
export function stoneAtHouse(bridge: Bridge): { house: number; mangonel: number; shot: ProjectileState } {
  const house = buildingAtHouseSpot(bridge.world);
  if (house === undefined) throw new Error(`${STONE_SEED} has no building of owner 2 at (${HOUSE_AT.x}, ${HOUSE_AT.y})`);
  holdFire(bridge);
  const mangonel = bridge.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === 'mangonel');
  if (!mangonel) throw new Error(`${STONE_SEED} has no Mangonel of owner 1`);
  expect(bridge.selectUnitsByIds([mangonel.id])).toBe(true);
  expect(bridge.issueContextCommandAtEntity(house), 'the Mangonel was refused the attack').toBe(true);
  let shot: ProjectileState | undefined;
  for (let step = 0; step < 200 && !shot; step += 1) {
    bridge.step(100);
    shot = shotsInAir(bridge.world).find((s) => s.attackerId === mangonel.id);
  }
  if (!shot) throw new Error('the Mangonel loosed no stone at the House in 200 ticks');
  expect(shot.targetId).toBe(house);
  expect(shot.impactTick - bridge.world.tick, 'the stone lands too soon for the House to be replaced under it').toBeGreaterThan(3);
  return { house, mangonel: mangonel.id, shot };
}

/** Owner 2 deletes the House (the Delete key, a player's or an AI's), and one
 *  of its Villagers puts a new House foundation on the same spot. `step`
 *  advances one tick. Returns the foundation, which took the House's id. With
 *  `underShot`, it also holds that the shot is still in the air once the
 *  foundation stands, so the scene cannot pass by landing first. */
export function replaceHouse(world: GameWorld, step: () => void, house: number, underShot?: ProjectileState): number {
  expect(world.submitWithResult('entity.delete', { entityId: house, requestedBy: 2 }).accepted, 'owner 2 could not delete its House').toBe(true);
  step();
  expect(world.getEntityRef(house), 'the House was not deleted').toBeNull();
  const builder = [...world.query('unit')].find((id) => {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    return unit?.owner === 2 && unit.unitType === 'villager';
  });
  if (builder === undefined) throw new Error(`${STONE_SEED} has no Villager of owner 2`);
  const placed = world.submitWithResult('building.placeConfirm', { builderId: builder, buildingType: 'house', position: { ...HOUSE_AT } });
  expect(placed.accepted, `the foundation was refused: ${JSON.stringify(placed)}`).toBe(true);
  step();
  const foundation = buildingAtHouseSpot(world);
  expect(foundation, 'the premise: a foundation took the deleted House\'s id').toBe(house);
  if (underShot) {
    expect(shotsInAir(world).some((s) => s.id === underShot.id), 'the premise: the stone is still in the air when the foundation stands').toBe(true);
  }
  return house;
}

/** Steps until the shot has left the air. */
export function landShot(world: GameWorld, step: () => void, shot: ProjectileState): void {
  for (let n = 0; n < 100 && shotsInAir(world).some((s) => s.id === shot.id); n += 1) step();
  expect(shotsInAir(world).some((s) => s.id === shot.id), 'the stone never landed').toBe(false);
}
