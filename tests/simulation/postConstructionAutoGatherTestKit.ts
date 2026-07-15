// Shared helpers for the automatic post-construction mining tests
// (spec §6.2). Both the behavioral suite and the persistence/replay suite
// drive the same `auto-mine-camp-fixture` geometry, so the lookup and
// stepping helpers live here (mirrors the saveBlobTestUtils pattern).

import { expect } from 'vitest';

import type { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { GathererComponent } from '../../src/game/simulation/types';

export type Bridge = ReturnType<typeof createSimulationBridge>;

// Camp anchors that steer the fixture's mine geometry per test:
// nearest-harvestable, exact-distance tie, no-mine-in-radius, owner-2 parity.
export const CAMP_NEAREST_ANCHOR = { x: 16, y: 15 };
export const CAMP_TIE_ANCHOR = { x: 14, y: 14 };
export const CAMP_NO_MINE_ANCHOR = { x: 10, y: 26 };
export const CAMP_OWNER2_ANCHOR = { x: 30, y: 14 };

export function villagerIdsOf(bridge: Bridge, owner: number): number[] {
  return bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === owner && unit.unitType === 'villager')
    .map((unit) => unit.id)
    .sort((a, b) => a - b);
}

export function mineIdAt(bridge: Bridge, x: number, y: number): number {
  const mine = bridge
    .getEconomyState()
    .resources.find(
      (resource) =>
        (resource.resourceType === 'gold-mine' || resource.resourceType === 'stone-mine')
        && resource.x === x
        && resource.y === y,
    );
  if (!mine) throw new Error(`Expected a mine at (${x},${y}).`);
  return mine.id;
}

export function gathererOf(bridge: Bridge, unitId: number): GathererComponent {
  const gatherer = bridge.world.getComponent<GathererComponent>(unitId, 'gatherer');
  if (!gatherer) throw new Error(`Expected unit ${unitId} to have a gatherer component.`);
  return gatherer;
}

export function placeCampWithVillagers(
  bridge: Bridge,
  builderIds: number[],
  anchor: { x: number; y: number },
  buildingType: 'mining-camp' | 'house' = 'mining-camp',
): void {
  expect(bridge.selectUnitsByIds(builderIds)).toBe(true);
  expect(bridge.beginBuildingPlacement(buildingType)).toBe(true);
  expect(bridge.confirmBuildingPlacement(anchor.x, anchor.y)).toBe(true);
}

export function campAt(bridge: Bridge, anchor: { x: number; y: number }) {
  return bridge
    .getEconomyState()
    .buildings.find(
      (building) =>
        building.buildingType === 'mining-camp'
        && building.x === anchor.x
        && building.y === anchor.y,
    );
}

export function stepUntil(bridge: Bridge, predicate: () => boolean, maxSteps: number): boolean {
  for (let step = 0; step < maxSteps; step += 1) {
    if (predicate()) return true;
    bridge.step(100);
  }
  return predicate();
}

export function stepUntilCampComplete(
  bridge: Bridge,
  anchor: { x: number; y: number },
  maxSteps = 800,
): void {
  const done = stepUntil(bridge, () => campAt(bridge, anchor)?.isComplete === true, maxSteps);
  expect(done).toBe(true);
}
