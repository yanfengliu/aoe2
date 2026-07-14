import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  monkTasksCodec,
  playerResourcesCodec,
  populationCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import {
  UNIT_SUBGRID_RESOLUTION,
  UNIT_SUBGRID_STEP_PER_TICK,
} from '../../src/game/simulation/bridge/pureHelpers';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import type {
  PlayerResources,
  PopulationState,
  UnitTransformComponent,
} from '../../src/game/simulation/types';
import {
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import { worldStateOf } from './saveBlobTestUtils';

describe('createSimulationBridge core systems', () => {
  it('starts a cardinal move from the allocated spawn slot without perpendicular recentering', () => {
    const bridge = createSimulationBridge('fog-memory-fixture');
    const scout = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
    const initial = bridge.world.getComponent<UnitTransformComponent>(
      scout?.id ?? -1,
      'unitTransform',
    );

    expect(scout).toBeDefined();
    expect(initial).toBeDefined();
    expect(bridge.selectEntityById(scout?.id ?? -1)).toBe(true);
    expect(bridge.issueMoveCommand(10, 9)).toBe(true);
    bridge.step(100);

    const moved = bridge.world.getComponent<UnitTransformComponent>(
      scout?.id ?? -1,
      'unitTransform',
    );
    expect(moved?.fineX).toBe(initial?.fineX);
    expect((initial?.fineY ?? 0) - (moved?.fineY ?? 0)).toBe(UNIT_SUBGRID_STEP_PER_TICK);
  });

  it('restores a saved fine-grid slot before the first loaded cardinal move', () => {
    const original = createSimulationBridge('fog-memory-fixture');
    const scout = original
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
    const transform = original.world.getComponent<UnitTransformComponent>(
      scout?.id ?? -1,
      'unitTransform',
    );

    expect(scout).toBeDefined();
    expect(transform).toBeDefined();
    if (!scout || !transform) return;

    // Emulate a schema-v2 save written before fresh spawns were aligned to
    // their engine-allocated occupancy slot. Load must make the serialized
    // fine root authoritative when rebuilding occupancy; otherwise the first
    // northward step visibly recenters west before advancing north.
    const legacyTransform = {
      ...transform,
      fineX: transform.fineX + 1,
    };
    delete legacyTransform.occupancySlotX;
    delete legacyTransform.occupancySlotY;
    original.world.setComponent(scout.id, 'unitTransform', legacyTransform);
    const loaded = createSimulationBridge('fog-memory-fixture', {
      savedGame: original.saveGame(),
    });
    const loadedStart = loaded.world.getComponent<UnitTransformComponent>(
      scout.id,
      'unitTransform',
    );

    expect(loadedStart?.fineX).toBe(transform.fineX + 1);
    expect(loaded.selectEntityById(scout.id)).toBe(true);
    expect(loaded.issueMoveCommand(scout.x, scout.y - 1)).toBe(true);
    loaded.step(100);

    const loadedMoved = loaded.world.getComponent<UnitTransformComponent>(
      scout.id,
      'unitTransform',
    );
    expect(loadedMoved?.fineX).toBe(loadedStart?.fineX);
    expect((loadedStart?.fineY ?? 0) - (loadedMoved?.fineY ?? 0))
      .toBe(UNIT_SUBGRID_STEP_PER_TICK);
  });

  it('continues toward the same crowded-cell slot after a mid-movement save/load', () => {
    const seeded = createSimulationBridge('unit-sharing-fixture', {
      disableAiForOwners: new Set([2]),
    });
    const richSave = structuredClone(seeded.saveGame());
    const state = worldStateOf(richSave);
    const resources = state[playerResourcesCodec.slot] as Array<[number, PlayerResources]>;
    const playerResources = resources.find(([owner]) => owner === 1)?.[1];
    const populations = state[populationCodec.slot] as Array<[number, PopulationState]>;
    const playerPopulation = populations.find(([owner]) => owner === 1)?.[1];

    expect(playerResources).toBeDefined();
    expect(playerPopulation).toBeDefined();
    if (!playerResources || !playerPopulation) return;
    playerResources.food = 10_000;
    playerPopulation.cap = 200;
    playerPopulation.rawSupply = 200;

    const bridge = createSimulationBridge('ignored', { savedGame: richSave });
    const townCenter = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 1 && building.buildingType === 'town-center');
    expect(townCenter).toBeDefined();
    expect(bridge.selectEntityById(townCenter?.id ?? -1)).toBe(true);

    for (let count = 0; count < 15; count += 1) {
      const unitCount = bridge.getEconomyState().units.filter((unit) => unit.owner === 1).length;
      expect(bridge.queueTrainUnit('villager')).toBe(true);
      expect(stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().units.filter((unit) => unit.owner === 1).length > unitCount,
        { maxSteps: 1_000 },
      )).toBe(true);
    }

    const units = bridge.getEconomyState().units.filter((unit) => unit.owner === 1);
    const scout = units.find((unit) => unit.unitType === 'scout');
    const slotTwin = units.find(
      (unit) => unit.id !== scout?.id && unit.id % 16 === (scout?.id ?? -1) % 16,
    );
    expect(scout).toBeDefined();
    expect(slotTwin).toBeDefined();
    if (!scout || !slotTwin) return;

    const issueMove = (unitId: number): void => {
      bridge.clearSelection();
      expect(bridge.selectEntityById(unitId)).toBe(true);
      expect(bridge.issueMoveCommand(20, 10)).toBe(true);
    };
    issueMove(slotTwin.id);
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some(
        (unit) => unit.id === slotTwin.id && unit.x === 20 && unit.y === 10 && unit.task === 'idle',
      ),
      { maxSteps: 1_000 },
    )).toBe(true);
    issueMove(scout.id);
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some(
        (unit) => unit.id === scout.id && unit.x === 20 && unit.y === 10 && unit.task === 'moving',
      ),
      { maxSteps: 1_000 },
    )).toBe(true);

    const loaded = createSimulationBridge('ignored', {
      savedGame: structuredClone(bridge.saveGame()),
    });
    bridge.step(100);
    loaded.step(100);

    expect(loaded.world.getComponent(scout.id, 'unitTransform'))
      .toEqual(bridge.world.getComponent(scout.id, 'unitTransform'));
    expect(loaded.getEconomyState().units.find((unit) => unit.id === scout.id)?.task)
      .toBe(bridge.getEconomyState().units.find((unit) => unit.id === scout.id)?.task);
  }, 30_000);

  it('renders unit motion on a finer sub-grid while buildings stay coarse-snapped', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const initialEconomyState = bridge.getEconomyState();
    const initialRenderState = bridge.getRenderState();
    const scout = initialEconomyState.units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'scout',
    );
    const townCenter = initialRenderState.entities.find(
      (entity) => entity.owner === 1 && entity.entityType === 'town-center',
    );
    const initialScoutRender = initialRenderState.entities.find((entity) => entity.id === scout?.id);

    expect(scout).toBeDefined();
    expect(townCenter).toBeDefined();
    expect(initialScoutRender).toBeDefined();

    // Pick a move target a few cells away so the scout is still moving
    // after a single tick. Both directions may run into starting-
    // resource or TC-footprint blockers in the procedural default map,
    // so we only assert that the scout's render state advanced on the
    // sub-grid while the TC (a building) stayed integer-snapped.
    const scoutX = scout?.x ?? 0;
    const scoutY = scout?.y ?? 0;
    expect(bridge.selectEntityAtCell(scoutX, scoutY)).toBe(true);
    expect(bridge.issueMoveCommand(Math.max(scoutX - 5, 0), scoutY)).toBe(true);

    bridge.step(100);

    const tickOneState = bridge.getRenderState();
    const tickOneRenderScout = tickOneState.entities.find((entity) => entity.id === scout?.id);
    const tickOneTownCenter = tickOneState.entities
      .find((entity) => entity.owner === 1 && entity.entityType === 'town-center');
    const previousScout = tickOneState.previousPositionFrame?.positions.find((position) => (
      position.id === scout?.id && position.generation === initialScoutRender?.generation
    ));

    // After one 100ms tick the scout's render position must differ from
    // its starting render position (it is moving on the sub-grid) but
    // must not have advanced a full cell's worth. The TC, a building,
    // never moves on the sub-grid and keeps an integer render position.
    expect(tickOneRenderScout?.x).not.toBe(initialScoutRender?.x);
    expect(
      Math.abs((tickOneRenderScout?.x ?? 0) - (initialScoutRender?.x ?? 0)),
    ).toBeLessThan(1);
    expect(tickOneTownCenter?.x).toBe(townCenter?.x);
    expect(Number.isInteger(tickOneTownCenter?.x ?? NaN)).toBe(true);
    expect(tickOneState.previousPositionFrame?.tick).toBe(initialRenderState.tick);
    expect(previousScout).toMatchObject({
      x: initialScoutRender?.x,
      y: initialScoutRender?.y,
    });
  });

  it('does not publish monkTasks diffs for ordinary unit moves with no prior Monk task', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const scout = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
    expect(scout).toBeDefined();

    expect(bridge.selectEntityAtCell(scout?.x ?? 0, scout?.y ?? 0)).toBe(true);
    expect(bridge.issueMoveCommand(Math.max((scout?.x ?? 0) - 5, 0), scout?.y ?? 0)).toBe(true);

    bridge.step(100);

    expect(bridge.world.getDiff()?.state.set).not.toHaveProperty(monkTasksCodec.slot);
  });

  it('does not publish monkTasks diffs for idle Monk context-move fallback', () => {
    const bridge = createSimulationBridge('monk-relic-fixture');
    const monk = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'monk');
    expect(monk).toBeDefined();

    expect(bridge.selectEntityAtCell(monk?.x ?? 0, monk?.y ?? 0)).toBe(true);
    expect(bridge.issueContextCommand(14, 14)).toBe(true);

    bridge.step(100);

    expect(bridge.world.getDiff()?.state.set).not.toHaveProperty(monkTasksCodec.slot);
  });

  it('relocates an initial unit spawn if the requested cell would trap it', () => {
    const bridge = createSimulationBridge('isolated-scout-spawn-fixture');

    const scout = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');

    expect(scout).toBeDefined();
    expect(scout).not.toMatchObject({ x: 12, y: 10 });
    expect(bridge.selectEntityAtCell(scout?.x ?? 0, scout?.y ?? 0)).toBe(true);
    expect(bridge.issueMoveCommand(16, 10)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const movedScout = bridge
            .getEconomyState()
            .units.find((unit) => unit.id === scout?.id);
          return (
            movedScout !== undefined
            && Math.abs(movedScout.x - 16) + Math.abs(movedScout.y - 10) <= 1
          );
        },
        { maxSteps: 240 },
      ),
    ).toBe(true);
  });

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
      expect(Math.abs((steppedRenderedScout?.x ?? 0) - (previousRenderedScout?.x ?? 0)))
        .toBeLessThanOrEqual(0.5);
      expect(Math.abs((steppedRenderedScout?.y ?? 0) - (previousRenderedScout?.y ?? 0)))
        .toBeLessThanOrEqual(0.5);
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

    expect(bridge.selectUnitsInBox(5, 9, 8, 11)).toBe(true);
    expect(bridge.issueMoveCommand(7, 10)).toBe(true);

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
        UNIT_SUBGRID_STEP_PER_TICK / UNIT_SUBGRID_RESOLUTION,
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
