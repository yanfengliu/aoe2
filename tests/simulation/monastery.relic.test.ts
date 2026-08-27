import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function findFirstOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function findUnitById(bridge: Bridge, id: number) {
  return bridge.getEconomyState().units.find((unit) => unit.id === id);
}

function findFirstResource(bridge: Bridge, resourceType: string) {
  return bridge
    .getEconomyState()
    .resources.find((r) => r.resourceType === resourceType);
}

describe('Slice 5 Monastery + Monks + Relics — vision/population/relics', () => {
  it('reassigns visionSource playerId when a Monk converts an enemy unit', () => {
    const bridge = createSimulationBridge('monk-convert-vision-fixture');

    const enemyTarget = findFirstOwnedUnit(bridge, 2, 'militia');
    expect(enemyTarget).toBeDefined();
    const scoutId = enemyTarget!.id;
    const scoutCell = { x: enemyTarget!.x, y: enemyTarget!.y };

    // Sanity: a cell just outside every known player 1 vision source starts
    // fog-hidden. The enemy Scout's visionSource belongs to player 2, so
    // player 1 should not currently see that cell.
    const mapWidth = 60;
    const probeCell = { x: scoutCell.x + 3, y: scoutCell.y };
    const probeIndex = probeCell.y * mapWidth + probeCell.x;
    const visibleBefore = new Set(
      bridge.getRenderState().frame?.visibleCells ?? [],
    );
    expect(visibleBefore.has(probeIndex)).toBe(false);

    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(scoutId)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const scout = findUnitById(bridge, scoutId);
          return scout !== undefined && scout.owner === 1;
        },
        { maxSteps: 80 },
      ),
    ).toBe(true);

    // Let visibility sync on the next tick.
    bridge.step(100);

    const scoutAfter = findUnitById(bridge, scoutId);
    expect(scoutAfter).toBeDefined();
    // The probe cell is 3 cells away from the converted Scout. The Scout
    // has vision radius 6; only its visionSource (now playerId = 1) can
    // cover the probe cell for player 1 because no other player 1 vision
    // source reaches that far.
    const visibleAfter = new Set(
      bridge.getRenderState().frame?.visibleCells ?? [],
    );
    const scoutIndex = scoutAfter!.y * mapWidth + scoutAfter!.x;
    expect(visibleAfter.has(scoutIndex)).toBe(true);
    const probeAfterIndex = scoutAfter!.y * mapWidth + (scoutAfter!.x + 3);
    expect(visibleAfter.has(probeAfterIndex)).toBe(true);
  }, 20_000);

  it('syncs population counts when a Monk converts an enemy unit', () => {
    const bridge = createSimulationBridge('monk-convert-fixture');

    const enemyMilitia = findFirstOwnedUnit(bridge, 2, 'militia');
    expect(enemyMilitia).toBeDefined();
    const militiaId = enemyMilitia!.id;

    const humanPopBefore = bridge.getPopulationState(1).current;
    const enemyPopBefore = bridge.getPopulationState(2).current;

    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(militiaId)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const militia = findUnitById(bridge, militiaId);
          return militia !== undefined && militia.owner === 1;
        },
        { maxSteps: 80 },
      ),
    ).toBe(true);

    const humanPopAfter = bridge.getPopulationState(1).current;
    const enemyPopAfter = bridge.getPopulationState(2).current;
    expect(humanPopAfter - humanPopBefore).toBe(1);
    expect(enemyPopBefore - enemyPopAfter).toBe(1);
  }, 20_000);

  it('picks up a neutral relic and keeps the relic position tracking the Monk each tick', () => {
    const bridge = createSimulationBridge('monk-relic-fixture');

    const relic = findFirstResource(bridge, 'relic');
    expect(relic).toBeDefined();
    const monk = findFirstOwnedUnit(bridge, 1, 'monk');
    expect(monk).toBeDefined();
    expect(bridge.selectEntityAtCell(relic!.x, relic!.y)).toBe(true);
    const selection = bridge.getSelectionState();
    expect(selection.selectedEntityId).not.toBeNull();
    const relicId = selection.selectedEntityId!;

    // Re-select Monk and issue pickup order.
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(relicId)).toBe(true);

    // Advance until the relic is being carried (i.e. relic position is
    // exactly at the Monk's cell) and then a bit more to confirm the relic
    // stays glued to the Monk even as he moves.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const r = findFirstResource(bridge, 'relic');
          const m = findFirstOwnedUnit(bridge, 1, 'monk');
          return (
            r !== undefined
            && m !== undefined
            && r.x === m.x
            && r.y === m.y
          );
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);

    // Move the Monk off somewhere; relic should track.
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueMoveCommand(12, 12)).toBe(true);
    bridge.step(30 * 100);
    const rAfter = findFirstResource(bridge, 'relic');
    const mAfter = findFirstOwnedUnit(bridge, 1, 'monk');
    expect(rAfter).toBeDefined();
    expect(mAfter).toBeDefined();
    expect(rAfter!.x).toBe(mAfter!.x);
    expect(rAfter!.y).toBe(mAfter!.y);
  }, 30_000);

  it('preserves every relic when the Monastery is destroyed in a fully blocked footprint', () => {
    // Slice 6 review fix: pre-fix, the relic-drop loop deleted the
    // relicsInMonastery entry up front and only spawned relics for
    // approach cells that were free in the radius-2 search. With the
    // approach cells walled off, NO relics spawned. Post-fix, the
    // search either grows outward to find more cells or falls back to
    // anchor-stacking — every relic is guaranteed to make it to the
    // world.
    const bridge = createSimulationBridge('monk-relic-drop-cramped-fixture');

    const monastery = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 2 && b.buildingType === 'monastery');
    expect(monastery).toBeDefined();
    const monasteryId = monastery!.id;

    // Sanity: 2 relics are deposited inside the Monastery and no
    // relic entity exists yet in the world.
    expect(
      bridge.getEconomyState().resources.filter((r) => r.resourceType === 'relic'),
    ).toHaveLength(0);

    // Mangonel attacks the Monastery from outside the tree ring.
    expect(selectOwnedUnitDirect(bridge, 1, 'mangonel')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(monasteryId)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const still = bridge
            .getEconomyState()
            .buildings.find((b) => b.id === monasteryId);
          return still === undefined;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Both relics must exist somewhere in the world. Position is
    // intentionally not asserted — anchor-stacking is acceptable per
    // the fix design.
    const droppedRelics = bridge
      .getEconomyState()
      .resources.filter((r) => r.resourceType === 'relic');
    expect(droppedRelics).toHaveLength(2);
  }, 60_000);

  it('drops deposited relics back onto the map when the Monastery is destroyed', () => {
    const bridge = createSimulationBridge('monk-relic-drop-fixture');

    const monastery = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 2 && b.buildingType === 'monastery');
    expect(monastery).toBeDefined();
    const monasteryAnchor = { x: monastery!.x, y: monastery!.y };
    const monasteryId = monastery!.id;

    // Sanity: no relic entity exists in the world yet (it is deposited
    // inside the Monastery via the scenario's startingRelicsInMonastery
    // hook).
    expect(findFirstResource(bridge, 'relic')).toBeUndefined();

    // Pikeman attacks the low-HP Monastery. The Monastery starts at 10 HP
    // so the Pikeman's first hit drops it below zero and destroys it.
    expect(selectOwnedUnitDirect(bridge, 1, 'pikeman')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(monasteryId)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const still = bridge
            .getEconomyState()
            .buildings.find(
              (b) =>
                b.owner === 2
                && b.buildingType === 'monastery'
                && b.x === monasteryAnchor.x
                && b.y === monasteryAnchor.y,
            );
          return still === undefined;
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);

    // Destroyed Monastery must have dropped its relic back to the map
    // near where it stood.
    const droppedRelic = findFirstResource(bridge, 'relic');
    expect(droppedRelic).toBeDefined();
    const distance =
      Math.abs(droppedRelic!.x - monasteryAnchor.x)
      + Math.abs(droppedRelic!.y - monasteryAnchor.y);
    expect(distance).toBeLessThanOrEqual(4);
  }, 30_000);

  it('deposits a carried relic in a friendly Monastery and earns +1 gold per tick afterwards', () => {
    const bridge = createSimulationBridge('monk-relic-fixture');

    const relic = findFirstResource(bridge, 'relic');
    expect(relic).toBeDefined();

    expect(bridge.selectEntityAtCell(relic!.x, relic!.y)).toBe(true);
    const relicId = bridge.getSelectionState().selectedEntityId!;

    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(relicId)).toBe(true);

    // Wait until the Monk is carrying the relic (co-located).
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const r = findFirstResource(bridge, 'relic');
          const m = findFirstOwnedUnit(bridge, 1, 'monk');
          return (
            r !== undefined
            && m !== undefined
            && r.x === m.x
            && r.y === m.y
          );
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);

    // Deposit: right-click the Monastery.
    const monastery = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 1 && b.buildingType === 'monastery',
    );
    expect(monastery).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(monastery!.id)).toBe(true);

    // Wait for the relic to disappear (deposited into the Monastery).
    expect(
      stepBridgeUntil(
        bridge,
        () => findFirstResource(bridge, 'relic') === undefined,
        { maxSteps: 300 },
      ),
    ).toBe(true);

    const goldBefore = bridge.getHudState().playerResources.gold;
    bridge.step(20 * 100);
    const goldAfter = bridge.getHudState().playerResources.gold;
    // +1 per tick for 20 ticks => +20.
    expect(goldAfter - goldBefore).toBe(20);
  }, 40_000);
});
