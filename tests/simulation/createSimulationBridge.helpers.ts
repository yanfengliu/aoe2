import { UNIT_SUBGRID_STEP_PER_TICK } from '../../src/game/simulation/bridge/pureHelpers';
import { unitBaseSpeedPercent } from '../../src/game/simulation/prototypeUnitRules/unitBaseSpeed';
import type { UnitType } from '../../src/game/simulation/types';
import { expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { BuildableBuildingType } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

export function selectOwnedBuildingDirect(
  bridge: Bridge,
  owner: number,
  buildingType: string,
): boolean {
  const building = bridge
    .getEconomyState()
    .buildings.find((candidate) => candidate.owner === owner && candidate.buildingType === buildingType);
  if (!building) {
    return false;
  }

  for (let offsetY = 0; offsetY < building.footprintHeight; offsetY += 1) {
    for (let offsetX = 0; offsetX < building.footprintWidth; offsetX += 1) {
      if (bridge.selectEntityAtCell(building.x + offsetX, building.y + offsetY)) {
        const selectionState = bridge.getSelectionState();
        if (selectionState.selectedEntityType === buildingType) {
          return true;
        }
      }
    }
  }

  return false;
}

export function selectOwnedUnitDirect(
  bridge: Bridge,
  owner: number,
  unitType: string,
): boolean {
  const unit = bridge
    .getEconomyState()
    .units.find((candidate) => candidate.owner === owner && candidate.unitType === unitType);
  if (!unit) {
    return false;
  }

  if (bridge.selectOwnedUnitsByTypeInRect(unitType as never, unit.x, unit.y, unit.x, unit.y)) {
    const selectionState = bridge.getSelectionState();
    if (selectionState.selectedEntityType === unitType) {
      return true;
    }
  }

  return bridge.selectEntityAtCell(unit.x, unit.y);
}

export function placeBuildingNearTownCenter(
  bridge: Bridge,
  buildingType: BuildableBuildingType | 'town-center',
  owner = 1,
  preferredAnchors: Array<{ x: number; y: number }> = [],
): { x: number; y: number } {
  const townCenter = bridge
    .getEconomyState()
    .buildings.find((building) => building.owner === owner && building.buildingType === 'town-center');
  expect(townCenter).toBeDefined();
  expect(bridge.beginBuildingPlacement(buildingType)).toBe(true);

  for (const anchor of preferredAnchors) {
    const preview = bridge.getPlacementPreview(anchor.x, anchor.y);
    if (!preview?.isValid) {
      continue;
    }

    expect(bridge.confirmBuildingPlacement(anchor.x, anchor.y)).toBe(true);
    // Phase 1B building.placeConfirm: handler runs at start of next step's
    // processCommands (spend + addBuildingEntity + setUnitCommand build).
    // Step once so the foundation + resource spend land before callers
    // read state.
    bridge.step(100);
    return anchor;
  }

  for (let radius = 1; radius <= 12; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.abs(offsetX) !== radius && Math.abs(offsetY) !== radius) {
          continue;
        }

        const x = (townCenter?.x ?? 0) + offsetX;
        const y = (townCenter?.y ?? 0) + offsetY;
        const preview = bridge.getPlacementPreview(x, y);
        if (!preview?.isValid) {
          continue;
        }

        expect(bridge.confirmBuildingPlacement(x, y)).toBe(true);
        // Phase 1B building.placeConfirm: step once so the spend +
        // foundation land before callers read state.
        bridge.step(100);
        return { x, y };
      }
    }
  }

  throw new Error(`Expected a valid ${buildingType} placement near player ${owner}'s Town Center.`);
}

export function stepBridgeUntil(
  bridge: Bridge,
  predicate: () => boolean,
  options: {
    maxSteps?: number;
    stepMs?: number;
  } = {},
): boolean {
  const maxSteps = options.maxSteps ?? 1_000;
  const stepMs = options.stepMs ?? 100;
  if (predicate()) {
    return true;
  }

  for (let index = 0; index < maxSteps; index += 1) {
    bridge.step(stepMs);
    if (predicate()) {
      return true;
    }
  }

  return false;
}

/**
 * Steps until `unitId` is inside a building. Garrisoning is an ORDER since
 * v0.3.42 — the unit walks to the building and goes in on arrival — so a test
 * that garrisons from any distance has to let it get there. A garrisoned unit
 * has no position, so it drops out of the economy snapshot entirely.
 */
export function stepUntilGarrisoned(
  bridge: Bridge,
  unitId: number,
  maxSteps = 400,
): boolean {
  return stepBridgeUntil(
    bridge,
    () => !bridge.getEconomyState().units.some((unit) => unit.id === unitId),
    { maxSteps },
  );
}

/**
 * Steps until `owner` has a COMPLETE building of this type, or the cap runs
 * out. Prefer this over a fixed `for (let i = 0; i < 400; i += 1)` around a
 * construction: a fixed count silently encodes today's build time, and every
 * pacing change since has had to walk the suite bumping those numbers — the
 * DE build-time correction of 2026-09-02 broke a dozen at once (house 120 ->
 * 250 ticks, Barracks 240 -> 500, Town Center 300 -> 1500). Waiting on the
 * CONDITION says what the test means and survives the next retune.
 */
export function stepUntilBuildingComplete(
  bridge: Bridge,
  owner: number,
  buildingType: string,
  maxSteps = 3_000,
): boolean {
  return stepBridgeUntil(
    bridge,
    () => bridge.getEconomyState().buildings.some(
      (building) => building.owner === owner
        && building.buildingType === buildingType
        && building.isComplete,
    ),
    { maxSteps },
  );
}

/**
 * The most fine units a unit of this type can advance in one tick.
 *
 * Before per-unit base speeds every unit moved exactly UNIT_SUBGRID_STEP_PER_TICK
 * and tests could hard-code it. At the §12.4.2 clock (v0.3.160, base 0.32)
 * every ordinary unit's per-tick entitlement is FRACTIONAL — most ticks grant
 * 0 fine units and the carry banks the rest — so the per-tick ceiling is 1
 * for everything at or under 312%, and a smooth-motion assertion still has
 * to ask what THIS unit is entitled to rather than hard-coding.
 */
export function maxFineStepPerTick(unitType: UnitType): number {
  return Math.ceil((UNIT_SUBGRID_STEP_PER_TICK * unitBaseSpeedPercent(unitType)) / 100);
}
