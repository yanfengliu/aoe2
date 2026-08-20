import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

// The fish fixture has a 3x3 pond at (11..13, 7..9), a villager, and 200 wood
// — exactly the Dock's cost.
const POND_X = 11;
const POND_Y = 7;

function beginDockPlacement(bridge: Bridge): void {
  expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
  expect(bridge.getSelectionState().buildOptions).toContain('dock');
  expect(bridge.beginBuildingPlacement('dock')).toBe(true);
}

describe('the Dock must be built on a shore', () => {
  it('offers the Dock from the Dark Age', () => {
    const bridge = createSimulationBridge('fish-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('dock');
  });

  it('refuses a placement with no water anywhere near it', () => {
    const bridge = createSimulationBridge('fish-fixture');
    beginDockPlacement(bridge);
    // Far from the pond, on open grass.
    const preview = bridge.getPlacementPreview(2, 20);
    expect(preview?.isValid).toBe(false);
    expect(bridge.confirmBuildingPlacement(2, 20)).toBe(false);
  });

  it('refuses a placement standing in the water', () => {
    const bridge = createSimulationBridge('fish-fixture');
    beginDockPlacement(bridge);
    expect(bridge.getPlacementPreview(POND_X, POND_Y)?.isValid).toBe(false);
    expect(bridge.confirmBuildingPlacement(POND_X, POND_Y)).toBe(false);
  });

  it('accepts a placement on the land beside the water, and builds it', () => {
    const bridge = createSimulationBridge('fish-fixture');
    beginDockPlacement(bridge);
    // A 3x3 footprint just EAST of the pond: its left column sits against the
    // water. (West of the pond is where the fixture parks its villager, and a
    // unit inside the footprint blocks placement for reasons unrelated to the
    // shore rule under test.)
    const anchor = { x: POND_X + 3, y: POND_Y };
    expect(bridge.getPlacementPreview(anchor.x, anchor.y)?.isValid).toBe(true);
    expect(bridge.confirmBuildingPlacement(anchor.x, anchor.y)).toBe(true);

    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().buildings.some(
        (building) => building.owner === 1
          && building.buildingType === 'dock'
          && building.isComplete,
      ),
      { maxSteps: 1_500 },
    )).toBe(true);
  }, 60_000);

});

describe('the Dock trains ships onto the water', () => {
  it('trains a Fishing Ship and places it on a water cell', () => {
    // naval-fixture has a Dock already standing on the bay's shore and the
    // wood to pay for ships; placing the Dock is covered above.
    const bridge = createSimulationBridge('naval-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('fishing-ship');
    expect(bridge.queueTrainUnit('fishing-ship')).toBe(true);

    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some(
        (unit) => unit.owner === 1 && unit.unitType === 'fishing-ship',
      ),
      { maxSteps: 1_500 },
    )).toBe(true);

    // A ship placed on land would be stranded — it cannot enter any cell it is
    // standing on, so it could never move again.
    const ship = bridge.getEconomyState().units
      .find((unit) => unit.owner === 1 && unit.unitType === 'fishing-ship');
    expect(ship).toBeDefined();
    const terrain = bridge.getRenderState().entities.find(
      (entity) => entity.layer === 'terrain'
        && entity.x === ship!.x && entity.y === ship!.y,
    );
    expect(terrain?.entityType).toBe('water');
  }, 90_000);

  it('lets a ship travel across the bay but never onto the land', () => {
    const bridge = createSimulationBridge('naval-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    expect(bridge.queueTrainUnit('fishing-ship')).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some(
        (unit) => unit.owner === 1 && unit.unitType === 'fishing-ship',
      ),
      { maxSteps: 1_500 },
    )).toBe(true);

    const ship = bridge.getEconomyState().units
      .find((unit) => unit.owner === 1 && unit.unitType === 'fishing-ship')!;
    const start = { x: ship.x, y: ship.y };
    expect(bridge.selectEntityAtCell(start.x, start.y)).toBe(true);
    // Order it to the far side of the bay.
    expect(bridge.issueMoveCommand(21, 15)).toBe(true);

    const waterCells = new Set(
      bridge.getRenderState().entities
        .filter((entity) => entity.layer === 'terrain' && entity.entityType === 'water')
        .map((entity) => `${String(entity.x)}:${String(entity.y)}`),
    );
    let moved = false;
    for (let step = 0; step < 400; step += 1) {
      bridge.step(100);
      const now = bridge.getEconomyState().units.find((unit) => unit.id === ship.id);
      if (!now) break;
      // The invariant under test: at no point is the hull on a land cell.
      expect(waterCells.has(`${String(now.x)}:${String(now.y)}`)).toBe(true);
      if (now.x !== start.x || now.y !== start.y) moved = true;
    }
    expect(moved).toBe(true);
  }, 90_000);
});

// v0.3.20: the nine warships shipped with the naval roster were trainable by
// the validator and fought correctly in fixtures, but the Dock train MENU still
// returned only the Fishing Ship — so no player could ever build one. Every
// naval test until now spawned its ships from a fixture, which is exactly why
// nothing caught it. These pin the menu itself.
describe('the Dock train menu reaches the warships', () => {
  it('offers the Galley line once out of the Dark Age', () => {
    const bridge = createSimulationBridge('naval-castle-age-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    const options = bridge.getSelectionState().trainOptions;
    expect(options).toContain('fishing-ship');
    expect(options).toContain('galley');
  });

  it('offers the Castle-Age warships once the owner reaches Castle Age', () => {
    const bridge = createSimulationBridge('naval-castle-age-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    const options = bridge.getSelectionState().trainOptions;
    expect(options).toContain('fire-ship');
    expect(options).toContain('demolition-ship');
  });

  it('keeps the Imperial-only Cannon Galleon out of a Castle-Age Dock', () => {
    const bridge = createSimulationBridge('naval-castle-age-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).not.toContain('cannon-galleon');
  });
});
