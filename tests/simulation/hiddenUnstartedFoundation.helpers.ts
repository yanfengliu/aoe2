// Shared steps for the hidden-foundation gates (work 121). Every order goes
// through the engine's command channel, the way the page and the AI issue them,
// so the foundation is made, abandoned and started by the game's own handlers.

import { expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { BuildableBuildingType } from '../../src/game/simulation/types';

export type Bridge = ReturnType<typeof createSimulationBridge>;
type Cell = { readonly x: number; readonly y: number };

export function stepTicks(bridge: Bridge, ticks: number): void {
  for (let tick = 0; tick < ticks; tick += 1) bridge.step(100);
}

export function idsOf(bridge: Bridge, owner: number, unitType: string): number[] {
  return bridge.getEconomyState().units
    .filter((unit) => unit.owner === owner && unit.unitType === unitType)
    .map((unit) => unit.id);
}

export function economyBuilding(bridge: Bridge, id: number) {
  return bridge.getEconomyState().buildings.find((building) => building.id === id);
}

export function footprintCells(anchor: Cell, size: number): Cell[] {
  const cells: Cell[] = [];
  for (let dy = 0; dy < size; dy += 1) {
    for (let dx = 0; dx < size; dx += 1) cells.push({ x: anchor.x + dx, y: anchor.y + dy });
  }
  return cells;
}

/** Whether the debug snapshot shows `unitId` under an attack order aimed at `anchor`. */
export function attackCommandOn(bridge: Bridge, unitId: number, anchor: Cell): boolean {
  const path = bridge.getDebugSnapshot().unitPaths.find((entry) => entry.id === unitId);
  return path?.commandType === 'attack' && path.toX === anchor.x && path.toY === anchor.y;
}

/**
 * `builderId` puts a `buildingType` foundation down at `anchor` through
 * `building.placeConfirm`, and in the same tick is ordered to `away`, so it
 * never strikes a blow on it. Returns the foundation's id, after checking it
 * stands with no progress.
 */
export function placeFoundationAs(
  bridge: Bridge,
  builderId: number,
  buildingType: BuildableBuildingType,
  anchor: Cell,
  away: Cell,
): number {
  const before = new Set(bridge.getEconomyState().buildings.map((building) => building.id));
  const placed = bridge.world.submitWithResult('building.placeConfirm', {
    builderId,
    buildingType,
    position: { x: anchor.x, y: anchor.y },
  });
  expect(placed.accepted, JSON.stringify(placed)).toBe(true);
  expect(bridge.world.submitWithResult('unit.move', { unitId: builderId, target: { ...away } }).accepted).toBe(true);
  bridge.step(100);
  const site = bridge.getEconomyState().buildings.find((building) => !before.has(building.id));
  expect(site, 'the foundation was not placed').toBeDefined();
  expect(site!.buildingType).toBe(buildingType);
  expect(site!.isComplete).toBe(false);
  expect(site!.buildProgressTicks).toBe(0);
  return site!.id;
}

/**
 * Sends `builderId` back to work on `foundationId` until the site has some
 * progress, then walks it to `away` again: the foundation is started and
 * nobody stands at it.
 */
export function startFoundationAs(
  bridge: Bridge,
  builderId: number,
  foundationId: number,
  away: Cell = { x: 40, y: 17 },
  maxTicks = 400,
): void {
  expect(bridge.world.submitWithResult('unit.contextAtEntity', {
    unitId: builderId,
    targetEntityId: foundationId,
  }).accepted).toBe(true);
  let progress = 0;
  for (let tick = 0; tick < maxTicks && progress <= 0; tick += 1) {
    bridge.step(100);
    progress = economyBuilding(bridge, foundationId)?.buildProgressTicks ?? 0;
  }
  expect(progress, 'the builder never started the foundation').toBeGreaterThan(0);
  expect(bridge.world.submitWithResult('unit.move', { unitId: builderId, target: { ...away } }).accepted).toBe(true);
  bridge.step(100);
}
