import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

const CLUSTER_CELLS = [
  { x: 11, y: 8 },
  { x: 10, y: 8 },
  { x: 11, y: 7 },
  { x: 11, y: 9 },
] as const;

const CORRIDOR_EAST_EXIT: { x: number; y: number } = { x: 26, y: 8 };

function humanVillagersSortedById(bridge: Bridge): Array<{ id: number; x: number; y: number }> {
  return bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
    .map((unit) => ({ id: unit.id, x: unit.x, y: unit.y }))
    .sort((a, b) => a.id - b.id);
}

function findVillagerAt(
  bridge: Bridge,
  x: number,
  y: number,
): { id: number; x: number; y: number } {
  const villager = humanVillagersSortedById(bridge).find((unit) => unit.x === x && unit.y === y);
  if (!villager) {
    throw new Error(`No human villager at (${x}, ${y})`);
  }
  return villager;
}

function positionOf(bridge: Bridge, unitId: number): { x: number; y: number } | null {
  const unit = bridge.getEconomyState().units.find((candidate) => candidate.id === unitId);
  return unit ? { x: unit.x, y: unit.y } : null;
}

describe('narrow corridor movement', () => {
  it('a villager ordered through a 1-cell-wide corridor past its neighbors reaches the far end', () => {
    const bridge = createSimulationBridge('narrow-corridor-fixture');
    const initialClusterCells = humanVillagersSortedById(bridge).map((unit) => ({ x: unit.x, y: unit.y }));

    expect(initialClusterCells).toEqual(expect.arrayContaining(CLUSTER_CELLS.map((cell) => ({ x: cell.x, y: cell.y }))));

    const mover = findVillagerAt(bridge, 11, 8);
    expect(bridge.selectEntityAtCell(mover.x, mover.y)).toBe(true);
    expect(bridge.issueMoveCommand(CORRIDOR_EAST_EXIT.x, CORRIDOR_EAST_EXIT.y)).toBe(true);

    const reached = stepBridgeUntil(
      bridge,
      () => {
        const position = positionOf(bridge, mover.id);
        return position !== null
          && Math.abs(position.x - CORRIDOR_EAST_EXIT.x) + Math.abs(position.y - CORRIDOR_EAST_EXIT.y) <= 1;
      },
      { maxSteps: 600 },
    );

    const final = positionOf(bridge, mover.id);
    expect(reached, `villager stuck at ${JSON.stringify(final)}`).toBe(true);
  });

  it('a stationary villager in the middle of the corridor does not stop a mover from passing through', () => {
    const bridge = createSimulationBridge('narrow-corridor-fixture');

    // Pick one villager out of the cluster, march it halfway into the corridor,
    // then leave it parked there. The remaining mover must still reach the far
    // end by walking past the parked villager inside the 1-cell-wide corridor.
    const blocker = findVillagerAt(bridge, 11, 7);
    expect(bridge.selectEntityAtCell(blocker.x, blocker.y)).toBe(true);
    expect(bridge.issueMoveCommand(18, 8)).toBe(true);

    stepBridgeUntil(
      bridge,
      () => {
        const position = positionOf(bridge, blocker.id);
        return position !== null && position.x === 18 && position.y === 8;
      },
      { maxSteps: 300 },
    );

    const blockerPosition = positionOf(bridge, blocker.id);
    expect(blockerPosition).toEqual({ x: 18, y: 8 });

    const mover = findVillagerAt(bridge, 11, 8);
    expect(bridge.selectEntityAtCell(mover.x, mover.y)).toBe(true);
    expect(bridge.issueMoveCommand(CORRIDOR_EAST_EXIT.x, CORRIDOR_EAST_EXIT.y)).toBe(true);

    const reached = stepBridgeUntil(
      bridge,
      () => {
        const position = positionOf(bridge, mover.id);
        return position !== null
          && Math.abs(position.x - CORRIDOR_EAST_EXIT.x) + Math.abs(position.y - CORRIDOR_EAST_EXIT.y) <= 1;
      },
      { maxSteps: 600 },
    );

    const moverFinal = positionOf(bridge, mover.id);
    expect(reached, `mover stuck at ${JSON.stringify(moverFinal)} while blocker sits in corridor`).toBe(true);
  });

  it('units ordered into the cluster from the far side still reach their destination despite the cluster plugging the corridor entrance', () => {
    const bridge = createSimulationBridge('narrow-corridor-fixture');

    // Park the 3 non-mover villagers of the cluster right at the corridor
    // entrance so that cell (12, 8) is already occupied and the cells
    // immediately west of it are full too. Then push a unit from the FAR
    // side of the corridor back west through that plug: the 1-cell-wide
    // way forward is now blocked by a dense clump of own-team villagers.
    const plug = findVillagerAt(bridge, 10, 8);
    expect(bridge.selectEntityAtCell(plug.x, plug.y)).toBe(true);
    expect(bridge.issueMoveCommand(12, 8)).toBe(true);
    stepBridgeUntil(
      bridge,
      () => {
        const position = positionOf(bridge, plug.id);
        return position !== null && position.x === 12 && position.y === 8;
      },
      { maxSteps: 200 },
    );

    const eastMover = findVillagerAt(bridge, 11, 8);
    expect(bridge.selectEntityAtCell(eastMover.x, eastMover.y)).toBe(true);
    expect(bridge.issueMoveCommand(CORRIDOR_EAST_EXIT.x, CORRIDOR_EAST_EXIT.y)).toBe(true);

    const reached = stepBridgeUntil(
      bridge,
      () => {
        const position = positionOf(bridge, eastMover.id);
        return position !== null
          && Math.abs(position.x - CORRIDOR_EAST_EXIT.x) + Math.abs(position.y - CORRIDOR_EAST_EXIT.y) <= 1;
      },
      { maxSteps: 800 },
    );

    const final = positionOf(bridge, eastMover.id);
    expect(reached, `mover stuck at ${JSON.stringify(final)} behind cluster of own-team villagers`).toBe(true);
  });

  it('ordering the whole cluster through the corridor advances every villager past the corridor entrance', () => {
    const bridge = createSimulationBridge('narrow-corridor-fixture');

    expect(bridge.selectOwnedUnitsByTypeInRect('villager', 10, 7, 11, 9)).toBe(true);
    expect(bridge.getSelectionState().selectedCount).toBe(CLUSTER_CELLS.length);
    expect(bridge.issueMoveCommand(CORRIDOR_EAST_EXIT.x, CORRIDOR_EAST_EXIT.y)).toBe(true);

    const allVillagerIds = humanVillagersSortedById(bridge).map((unit) => unit.id);
    const corridorEntranceX = 12;

    stepBridgeUntil(
      bridge,
      () =>
        allVillagerIds.every((id) => {
          const position = positionOf(bridge, id);
          return position !== null && position.x >= corridorEntranceX;
        }),
      { maxSteps: 1_000 },
    );

    const finalPositions = allVillagerIds.map((id) => ({ id, position: positionOf(bridge, id) }));
    for (const entry of finalPositions) {
      expect(
        entry.position && entry.position.x >= corridorEntranceX,
        `villager ${entry.id} stuck at ${JSON.stringify(entry.position)}`,
      ).toBe(true);
    }
  });
});
