import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { UNIT_SUBGRID_RESOLUTION } from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitTransformComponent } from '../../src/game/simulation/types';
import {
  maxFineStepPerTick,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

// Split out of ./createSimulationBridge.unitMovement.test.ts for the 500-LOC
// budget. These cover what happens when units get in each OTHER'S way:
// wandering scouts, blockers, shared cells, and arrival slots.
describe('createSimulationBridge movement under crowding', () => {
  it('renders wandering enemy scouts on a sub-grid instead of snapping them back to coarse cells each tick', () => {
    const bridge = createSimulationBridge('moving-enemy-attack-fixture');
    const initialSnapshot = bridge.getRenderState();
    const enemyScout = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 2 && unit.unitType === 'scout');
    const initialRenderedScout = initialSnapshot.entities.find((entity) => entity.id === enemyScout?.id);

    expect(enemyScout).toBeDefined();
    expect(initialRenderedScout).toBeDefined();

    let previousRenderedScout = initialRenderedScout;
    let visibleSamples = 0;
    let maxRenderedDisplacement = 0;
    for (let tick = 0; tick < 4; tick += 1) {
      bridge.step(100);

      const steppedRenderedScout = bridge
        .getRenderState()
        .entities.find((entity) => entity.id === enemyScout?.id);
      const transform = bridge.world.getComponent<UnitTransformComponent>(
        enemyScout?.id ?? -1,
        'unitTransform',
      );

      expect(transform).toBeDefined();
      expect(bridge.world.getDiff()?.components.unitTransform?.set)
        .toContainEqual([enemyScout?.id, transform]);
      if (!steppedRenderedScout) continue;
      visibleSamples += 1;
      maxRenderedDisplacement = Math.max(
        maxRenderedDisplacement,
        Math.hypot(
          (steppedRenderedScout.x ?? 0) - (initialRenderedScout?.x ?? 0),
          (steppedRenderedScout.y ?? 0) - (initialRenderedScout?.y ?? 0),
        ),
      );
      expect(steppedRenderedScout?.x)
        .toBeCloseTo((transform?.fineX ?? 0) / UNIT_SUBGRID_RESOLUTION);
      expect(steppedRenderedScout?.y)
        .toBeCloseTo((transform?.fineY ?? 0) / UNIT_SUBGRID_RESOLUTION);
      // A Scout covers 3 fine units a tick (150% of a villager), so its
      // per-tick render displacement is 0.75 cells, not the flat 0.5 every unit
      // shared before per-unit base speeds.
      const scoutCellStep = maxFineStepPerTick('scout') / UNIT_SUBGRID_RESOLUTION;
      expect(Math.abs((steppedRenderedScout?.x ?? 0) - (previousRenderedScout?.x ?? 0)))
        .toBeLessThanOrEqual(scoutCellStep);
      expect(Math.abs((steppedRenderedScout?.y ?? 0) - (previousRenderedScout?.y ?? 0)))
        .toBeLessThanOrEqual(scoutCellStep);
      previousRenderedScout = steppedRenderedScout;
    }

    expect(visibleSamples).toBeGreaterThan(0);
    expect(maxRenderedDisplacement).toBeGreaterThan(0);
  });

  it('routes units around impassable terrain and resource blockers without treating other units as hard blockers', () => {
    const bridge = createSimulationBridge('blocking-rules-fixture');

    expect(bridge.selectEntityAtCell(6, 13)).toBe(true);
    expect(bridge.issueMoveCommand(10, 13)).toBe(true);

    const blockedCells = new Set(['8,13', '10,5', '12,5', '14,5']);

    for (let index = 0; index < 80; index += 1) {
      bridge.step(100);
      const scout = bridge
        .getEconomyState()
        .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
      expect(scout).toBeDefined();
      expect(blockedCells.has(`${scout?.x},${scout?.y}`)).toBe(false);
    }

    const scout = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
    expect(scout).toMatchObject({
      x: 10,
      y: 13,
    });
  });

  it('lets multiple friendly units share the same coarse cell while keeping distinct sub-grid render positions', () => {
    const bridge = createSimulationBridge('unit-sharing-fixture');

    // Ordered INDIVIDUALLY rather than as a box selection. Since v0.3.25 a
    // group order arrives in formation, which deliberately spreads its units
    // across neighbouring cells — the exact opposite of what this test is
    // about. Two separate orders to the same cell still exercise sub-grid
    // sharing, which is the subject here.
    const owned = bridge.getEconomyState().units
      .filter((unit) => unit.owner === 1 && unit.x >= 5 && unit.x <= 8
        && unit.y >= 9 && unit.y <= 11)
      .slice(0, 2);
    expect(owned).toHaveLength(2);
    for (const unit of owned) {
      expect(bridge.selectEntityById(unit.id)).toBe(true);
      expect(bridge.issueMoveCommand(7, 10)).toBe(true);
    }

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const sharedCellUnits = bridge
            .getEconomyState()
            .units.filter((unit) => unit.owner === 1 && unit.x === 7 && unit.y === 10);
          return sharedCellUnits.length === 2;
        },
        { maxSteps: 80 },
      ),
    ).toBe(true);

    const sharedCellUnits = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.x === 7 && unit.y === 10);
    expect(sharedCellUnits).toHaveLength(2);

    const renderedUnits = bridge
      .getRenderState()
      .entities.filter(
        (entity) =>
          entity.kind === 'unit'
          && entity.owner === 1
          && Math.floor(entity.x) === 7
          && Math.floor(entity.y) === 10,
      );
    expect(renderedUnits).toHaveLength(2);
    expect(
      Math.abs((renderedUnits[0]?.x ?? 0) - (renderedUnits[1]?.x ?? 0))
      + Math.abs((renderedUnits[0]?.y ?? 0) - (renderedUnits[1]?.y ?? 0)),
    ).toBeGreaterThan(0.05);
  });

  it('publishes every fine-grid move and reaches the allocated arrival slot without a hidden snap', () => {
    const bridge = createSimulationBridge('unit-sharing-fixture');
    const movingUnit = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.x === 6 && unit.y === 10);

    expect(movingUnit).toBeDefined();
    expect(bridge.selectEntityById(movingUnit?.id ?? -1)).toBe(true);
    expect(bridge.issueMoveCommand(7, 10)).toBe(true);

    let previousRoot = bridge
      .getRenderState()
      .entities.find((entity) => entity.id === movingUnit?.id);
    expect(previousRoot).toBeDefined();

    let arrived = false;
    for (let tick = 0; tick < 20; tick += 1) {
      bridge.step(100);
      const transform = bridge.world.getComponent<UnitTransformComponent>(
        movingUnit?.id ?? -1,
        'unitTransform',
      );
      const rendered = bridge
        .getRenderState()
        .entities.find((entity) => entity.id === movingUnit?.id);

      expect(transform).toBeDefined();
      expect(rendered).toBeDefined();
      expect(rendered?.x).toBeCloseTo((transform?.fineX ?? 0) / UNIT_SUBGRID_RESOLUTION);
      expect(rendered?.y).toBeCloseTo((transform?.fineY ?? 0) / UNIT_SUBGRID_RESOLUTION);
      const rootStep = Math.hypot(
        (rendered?.x ?? 0) - (previousRoot?.x ?? 0),
        (rendered?.y ?? 0) - (previousRoot?.y ?? 0),
      );
      expect(rootStep).toBeLessThanOrEqual(
        maxFineStepPerTick(movingUnit?.unitType ?? 'villager') / UNIT_SUBGRID_RESOLUTION,
      );
      previousRoot = rendered;

      const current = bridge.getEconomyState().units.find((unit) => unit.id === movingUnit?.id);
      if (current?.x === 7 && current.y === 10 && current.task === 'idle') {
        arrived = true;
        break;
      }
    }

    expect(arrived).toBe(true);
    const arrivedRoot = previousRoot;
    bridge.step(100);
    const stableTransform = bridge.world.getComponent<UnitTransformComponent>(
      movingUnit?.id ?? -1,
      'unitTransform',
    );
    const stableRoot = bridge
      .getRenderState()
      .entities.find((entity) => entity.id === movingUnit?.id);
    expect(stableRoot).toMatchObject({
      x: 7.5,
      y: 10,
    });
    expect(arrivedRoot).toMatchObject({ x: 7.5, y: 10 });
    expect(stableRoot?.x).toBeCloseTo((stableTransform?.fineX ?? 0) / UNIT_SUBGRID_RESOLUTION);
    expect(stableRoot?.y).toBeCloseTo((stableTransform?.fineY ?? 0) / UNIT_SUBGRID_RESOLUTION);

    bridge.clearSelection();
    expect(bridge.selectEntityById(movingUnit?.id ?? -1)).toBe(true);
    const refreshedRoot = bridge
      .getRenderState()
      .entities.find((entity) => entity.id === movingUnit?.id);
    expect(refreshedRoot).toMatchObject({
      x: stableRoot?.x,
      y: stableRoot?.y,
    });
  });

  it('moves to the nearest reachable cell instead of entering a blocked resource tile', () => {
    const bridge = createSimulationBridge('blocking-rules-fixture');

    expect(bridge.selectEntityAtCell(6, 13)).toBe(true);
    expect(bridge.issueMoveCommand(12, 5)).toBe(true);

    for (let index = 0; index < 120; index += 1) {
      bridge.step(100);
    }

    const scout = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
    expect(scout).toBeDefined();
    expect(scout).not.toMatchObject({
      x: 12,
      y: 5,
    });
    expect(Math.abs((scout?.x ?? 0) - 12) + Math.abs((scout?.y ?? 0) - 5)).toBe(1);
  });
});
