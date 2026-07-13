import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { monkTasksCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import {
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

describe('createSimulationBridge core systems', () => {
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

    bridge.step(100);

    const steppedSnapshot = bridge.getRenderState();
    const steppedRenderedScout = steppedSnapshot.entities.find((entity) => entity.id === enemyScout?.id);

    expect(steppedRenderedScout).toBeDefined();
    expect(steppedRenderedScout?.x).toBeGreaterThan(initialRenderedScout?.x ?? 0);
    expect(steppedRenderedScout?.x).toBeLessThan((initialRenderedScout?.x ?? 0) + 1);
    expect(Math.floor(steppedRenderedScout?.y ?? -1)).toBe(Math.floor(initialRenderedScout?.y ?? -1));
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
