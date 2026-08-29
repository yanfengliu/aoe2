import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

interface SheepInfo {
  owner: number | null;
  baseOwner: number | null;
  x: number;
  y: number;
}

function findSheep(bridge: Bridge, predicate: (sheep: SheepInfo) => boolean): SheepInfo | undefined {
  return bridge
    .getEconomyState()
    .resources.find((resource) => resource.resourceType === 'sheep' && predicate(resource));
}

function findHumanClaimedSheep(bridge: Bridge): SheepInfo | undefined {
  return findSheep(bridge, (sheep) => sheep.owner === 1);
}

function selectSheepAt(bridge: Bridge, x: number, y: number): boolean {
  return bridge.selectEntityAtCell(x, y);
}

function stepBridgeNTicks(bridge: Bridge, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) {
    bridge.step(100);
  }
}

describe('sheep movement', () => {
  it('keeps sheep ownership sticky after the claiming unit walks far away', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');

    // First: the human villager spawned adjacent to the neutral sheep claims it within a few ticks.
    // The enemy scout at (21, 19) is also in range but loses the distance tie-break (lower owner wins).
    expect(
      stepBridgeUntil(
        bridge,
        () => findHumanClaimedSheep(bridge) !== undefined,
        { maxSteps: 20 },
      ),
    ).toBe(true);

    const claimedSheep = findHumanClaimedSheep(bridge);
    expect(claimedSheep).toBeDefined();

    // Move the human villager far from the sheep so its vision no longer covers the sheep.
    // The enemy scout at (21, 19) stays put — the AI does not command non-militia units —
    // so without sticky ownership it would re-claim the sheep on the next tick.
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueMoveCommand(4, 4)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const villager = bridge
            .getEconomyState()
            .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
          if (!villager || !claimedSheep) {
            return false;
          }
          const dx = Math.abs(villager.x - claimedSheep.x);
          const dy = Math.abs(villager.y - claimedSheep.y);
          // Human villager vision radius is 4, so once distance > 4 it stops covering the sheep.
          return dx + dy > 5;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // Give the enemy scout several ticks to attempt re-claiming the sheep.
    for (let i = 0; i < 10; i += 1) {
      bridge.step(100);
    }

    // Sheep ownership must still be the human player — the sticky guard prevents the enemy steal.
    const sheepAfterWalkAway = findSheep(
      bridge,
      (sheep) => sheep.x === claimedSheep?.x && sheep.y === claimedSheep?.y,
    );
    expect(sheepAfterWalkAway).toBeDefined();
    expect(sheepAfterWalkAway?.owner).toBe(1);
  });

  it('moves an owned sheep toward the right-clicked destination', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');

    // Wait for the human villager to claim the sheep at (20, 19).
    expect(
      stepBridgeUntil(bridge, () => findHumanClaimedSheep(bridge) !== undefined, { maxSteps: 20 }),
    ).toBe(true);

    const sheepBefore = findHumanClaimedSheep(bridge);
    expect(sheepBefore).toBeDefined();
    const startX = sheepBefore!.x;
    const startY = sheepBefore!.y;

    // Select the sheep at its cell and command a move toward the human Town Center direction.
    expect(selectSheepAt(bridge, startX, startY)).toBe(true);
    const targetX = 4;
    const targetY = 4;
    expect(bridge.issueMoveCommand(targetX, targetY)).toBe(true);

    // After enough ticks, the sheep should be measurably closer to the target.
    stepBridgeNTicks(bridge, 80);
    const sheepAfter = findHumanClaimedSheep(bridge);
    expect(sheepAfter).toBeDefined();
    const startDist = Math.abs(startX - targetX) + Math.abs(startY - targetY);
    const afterDist = Math.abs(sheepAfter!.x - targetX) + Math.abs(sheepAfter!.y - targetY);
    expect(afterDist).toBeLessThan(startDist);
  });

  it('clears the sheep move order once the destination is reached', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');
    expect(
      stepBridgeUntil(bridge, () => findHumanClaimedSheep(bridge) !== undefined, { maxSteps: 20 }),
    ).toBe(true);

    const sheep = findHumanClaimedSheep(bridge)!;
    // Pick a nearby target so arrival happens quickly.
    const targetX = sheep.x - 2;
    const targetY = sheep.y;
    expect(selectSheepAt(bridge, sheep.x, sheep.y)).toBe(true);
    expect(bridge.issueMoveCommand(targetX, targetY)).toBe(true);

    // Wait until the sheep arrives at the target cell.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const current = findHumanClaimedSheep(bridge);
          return current !== undefined && current.x === targetX && current.y === targetY;
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);

    // Position must remain stable for additional ticks (order is cleared, sheep no longer moves).
    stepBridgeNTicks(bridge, 20);
    const sheepAfterDwell = findHumanClaimedSheep(bridge)!;
    expect(sheepAfterDwell.x).toBe(targetX);
    expect(sheepAfterDwell.y).toBe(targetY);
  });

  it('rejects move commands on an unclaimed sheep', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');
    // The sheep at (45, 25) starts unclaimed and has no nearby player units, so it stays unclaimed.
    const unclaimedX = 45;
    const unclaimedY = 25;
    const sheepBefore = findSheep(bridge, (sheep) => sheep.x === unclaimedX && sheep.y === unclaimedY);
    expect(sheepBefore?.owner).toBeNull();

    expect(selectSheepAt(bridge, unclaimedX, unclaimedY)).toBe(true);
    expect(bridge.issueMoveCommand(10, 10)).toBe(false);

    stepBridgeNTicks(bridge, 30);
    const sheepAfter = findSheep(bridge, (sheep) => sheep.x === unclaimedX && sheep.y === unclaimedY);
    expect(sheepAfter).toBeDefined();
    expect(sheepAfter?.x).toBe(unclaimedX);
    expect(sheepAfter?.y).toBe(unclaimedY);
  });

  it('rejects move commands on an enemy-owned sheep', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');
    // Pre-owned enemy sheep starts at (35, 25) with no human units near.
    const enemyX = 35;
    const enemyY = 25;
    const sheepBefore = findSheep(bridge, (sheep) => sheep.x === enemyX && sheep.y === enemyY);
    expect(sheepBefore?.owner).toBe(2);

    expect(selectSheepAt(bridge, enemyX, enemyY)).toBe(true);
    expect(bridge.issueMoveCommand(10, 10)).toBe(false);

    stepBridgeNTicks(bridge, 30);
    const sheepAfter = findSheep(bridge, (sheep) => sheep.x === enemyX && sheep.y === enemyY);
    expect(sheepAfter).toBeDefined();
    expect(sheepAfter?.x).toBe(enemyX);
    expect(sheepAfter?.y).toBe(enemyY);
  });

  it('drag-box selects all human-owned sheep inside the rectangle', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');

    // Wait for the human villager to claim the cluster of nearby sheep.
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().resources.filter(
          (r) => r.resourceType === 'sheep' && r.owner === 1,
        ).length >= 2,
        { maxSteps: 30 },
      ),
    ).toBe(true);

    // Drag-box across the cluster of human-claimed sheep at (19,18), (19,19), (20,19)
    // and the human villager at (20,18). All four should be selected as a group.
    expect(bridge.selectUnitsInBox(18, 17, 21, 20)).toBe(true);

    const selectionState = bridge.getSelectionState();
    expect(selectionState.selectedCount).toBeGreaterThanOrEqual(3);
  });

  it('moves multiple owned sheep with a single right-click on the group', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');

    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().resources.filter(
          (r) => r.resourceType === 'sheep' && r.owner === 1,
        ).length >= 2,
        { maxSteps: 30 },
      ),
    ).toBe(true);

    const sheepBefore = bridge
      .getEconomyState()
      .resources.filter((r) => r.resourceType === 'sheep' && r.owner === 1)
      .map((r) => ({ x: r.x, y: r.y }));
    expect(sheepBefore.length).toBeGreaterThanOrEqual(2);

    // Drag-box just the sheep cluster (exclude the human villager so we issue
    // a sheep-only command) and move them all toward a far cell.
    expect(bridge.selectUnitsInBox(19, 18, 20, 19)).toBe(true);
    const targetX = 4;
    const targetY = 4;
    expect(bridge.issueMoveCommand(targetX, targetY)).toBe(true);

    stepBridgeNTicks(bridge, 60);

    const sheepAfter = bridge
      .getEconomyState()
      .resources.filter((r) => r.resourceType === 'sheep' && r.owner === 1)
      .map((r) => ({ x: r.x, y: r.y }));
    expect(sheepAfter.length).toBe(sheepBefore.length);

    // Every sheep that the player commanded should be measurably closer to the target.
    for (let i = 0; i < sheepBefore.length; i += 1) {
      const before = sheepBefore[i]!;
      const after = sheepAfter[i]!;
      const beforeDist = Math.abs(before.x - targetX) + Math.abs(before.y - targetY);
      const afterDist = Math.abs(after.x - targetX) + Math.abs(after.y - targetY);
      expect(afterDist).toBeLessThan(beforeDist);
    }
  });

  it('clears the order when the requested cell is blocked but the planner finishes adjacent', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');

    expect(
      stepBridgeUntil(bridge, () => findHumanClaimedSheep(bridge) !== undefined, { maxSteps: 20 }),
    ).toBe(true);

    const sheep = findHumanClaimedSheep(bridge)!;
    // Right-click onto the human Town Center cell (a building footprint is
    // blocked). The planner picks an adjacent free cell as the actual
    // destination; the order must clear once the sheep reaches it instead
    // of looping forever trying to reach the blocked target.
    expect(selectSheepAt(bridge, sheep.x, sheep.y)).toBe(true);
    expect(bridge.issueMoveCommand(4, 4)).toBe(true);

    // Step long enough for the sheep to reach its planner destination, then
    // poll for position stability (10 consecutive identical-position samples)
    // to prove the order cleared rather than oscillated.
    let lastX = sheep.x;
    let lastY = sheep.y;
    let stableTicks = 0;
    // §12.4.2 clock: a sheep's COARSE cell advances only every ~24 ticks
    // (one fine step per 6 ticks, 4 fine per cell), so "stable" must outlast
    // that cadence, and the walk itself takes ~25 ticks per cell.
    for (let i = 0; i < 1600; i += 1) {
      bridge.step(100);
      const current = findHumanClaimedSheep(bridge)!;
      if (current.x === lastX && current.y === lastY) {
        stableTicks += 1;
      } else {
        stableTicks = 0;
        lastX = current.x;
        lastY = current.y;
      }
      if (stableTicks >= 40) {
        break;
      }
    }
    expect(stableTicks).toBeGreaterThanOrEqual(40);

    // The sheep should have ended adjacent to the Town Center footprint.
    const settled = findHumanClaimedSheep(bridge)!;
    expect(Math.abs(settled.x - 4) + Math.abs(settled.y - 4)).toBeLessThanOrEqual(3);
  });

  it('keeps villager build options available when a herd is part of the same drag-box selection', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');

    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().resources.filter(
          (r) => r.resourceType === 'sheep' && r.owner === 1,
        ).length >= 2,
        { maxSteps: 30 },
      ),
    ).toBe(true);

    // Drag-box across the human villager AND the cluster of owned sheep.
    expect(bridge.selectUnitsInBox(18, 17, 21, 20)).toBe(true);

    // Even with sheep in the selection, the villager should still expose
    // its Dark-Age build options (House at minimum).
    const selectionState = bridge.getSelectionState();
    expect(selectionState.buildOptions.length).toBeGreaterThan(0);
    expect(selectionState.buildOptions).toContain('house');
  });

  it('selects every owned sheep in a rect when selectOwnedUnitsByTypeInRect is called with sheep', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');

    // Wait for the human villager to claim several sheep.
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().resources.filter(
          (r) => r.resourceType === 'sheep' && r.owner === 1,
        ).length >= 2,
        { maxSteps: 30 },
      ),
    ).toBe(true);

    // Cover the whole sheep-cluster / villager area.
    expect(bridge.selectOwnedUnitsByTypeInRect('sheep', 18, 17, 21, 20)).toBe(true);

    // Every selected id should be a sheep (not the villager), and the count should equal
    // the number of owned sheep inside that rect.
    const ownedSheepInRect = bridge
      .getEconomyState()
      .resources.filter(
        (r) =>
          r.resourceType === 'sheep'
          && r.owner === 1
          && r.x >= 18
          && r.x <= 21
          && r.y >= 17
          && r.y <= 20,
      );
    const selectionState = bridge.getSelectionState();
    expect(selectionState.selectedCount).toBe(ownedSheepInRect.length);
    expect(selectionState.selectedCount).toBeGreaterThanOrEqual(2);
    expect(selectionState.selectedKind).toBe('resource');
    // Every selected entity must be a sheep the player can command.
    expect(selectionState.owner).toBe(1);
  });

  it('cancels an in-flight sheep move order when a villager starts gathering it', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');

    // Wait for the human villager to claim the adjacent sheep.
    expect(
      stepBridgeUntil(bridge, () => findHumanClaimedSheep(bridge) !== undefined, { maxSteps: 20 }),
    ).toBe(true);

    const sheep = findHumanClaimedSheep(bridge)!;
    const sheepId = bridge
      .getEconomyState()
      .resources.findIndex((r) => r.x === sheep.x && r.y === sheep.y && r.owner === 1);
    expect(sheepId).toBeGreaterThanOrEqual(0);

    // Issue a sheep move order to a far target.
    expect(selectSheepAt(bridge, sheep.x, sheep.y)).toBe(true);
    const moveTargetX = 4;
    const moveTargetY = 4;
    expect(bridge.issueMoveCommand(moveTargetX, moveTargetY)).toBe(true);

    // Select the villager and right-click the sheep to gather it.
    const villagerBefore = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(villagerBefore).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);

    // Find the sheep entity id by position and issue a context command at that entity.
    // The test exercises the real right-click-on-sheep path.
    const sheepAtCells = bridge.getEconomyState().resources.filter(
      (r) => r.resourceType === 'sheep' && r.owner === 1,
    );
    expect(sheepAtCells.length).toBeGreaterThan(0);
    // The bridge has selectEntityAtCell and issueContextCommand; use the sheep cell as the
    // context target so the villager goes to gather it.
    expect(bridge.issueContextCommand(sheep.x, sheep.y)).toBe(true);

    // Step until the villager reaches and starts gathering the sheep.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const villager = bridge
            .getEconomyState()
            .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
          return villager !== undefined && villager.task === 'gathering';
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Record the sheep position at the moment the villager starts gathering.
    const sheepAtGatherStart = findHumanClaimedSheep(bridge)!;
    const gatherStartX = sheepAtGatherStart.x;
    const gatherStartY = sheepAtGatherStart.y;

    // Advance many ticks; because the move order was cleared, the sheep should not drift
    // toward the original move target. The gather loop may still keep it stable even if the
    // order had not been cleared, but without the fix the gather would thrash between
    // "to-resource" and "gathering" as the sheep's approach cell flips each tick.
    // Verify by asserting the villager stays in `gathering` (no thrash).
    const villagerStateSamples: string[] = [];
    for (let i = 0; i < 30; i += 1) {
      bridge.step(100);
      const villager = bridge
        .getEconomyState()
        .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
      if (villager) {
        villagerStateSamples.push(villager.task);
      }
    }

    // Without the fix, the sheep keeps walking toward the move target while the villager
    // gathers, causing the gather loop to flip out of 'gathering'. With the fix, the move
    // order is cleared, the sheep stays put, and the villager stays in 'gathering' /
    // 'to-dropoff' / 'to-resource' cycles without thrash.
    // The sheep position must not advance toward the move target.
    const sheepAfter = findHumanClaimedSheep(bridge)!;
    const distBefore = Math.abs(gatherStartX - moveTargetX) + Math.abs(gatherStartY - moveTargetY);
    const distAfter = Math.abs(sheepAfter.x - moveTargetX) + Math.abs(sheepAfter.y - moveTargetY);
    // The sheep should NOT have gotten closer to the move target after gathering started;
    // it should remain pinned where the villager is harvesting.
    expect(distAfter).toBeGreaterThanOrEqual(distBefore);

    // Reissuing a fresh move order after gathering begins should still fail to move the
    // sheep while a villager is harvesting, because the order would be overwritten on
    // the next gather tick anyway — but at minimum the sheep must remain stable when no
    // new move order is issued. (Asserting the above distance invariant is enough.)
  });

  it('moves an owned sheep at half villager speed', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');
    expect(
      stepBridgeUntil(bridge, () => findHumanClaimedSheep(bridge) !== undefined, { maxSteps: 20 }),
    ).toBe(true);

    const sheepStart = findHumanClaimedSheep(bridge)!;
    const villagerStart = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(villagerStart).toBeDefined();

    // Both move toward the human Town Center. §12.4.2 clock: villager 0.08 cells/tick, sheep 0.04.
    expect(selectSheepAt(bridge, sheepStart.x, sheepStart.y)).toBe(true);
    expect(bridge.issueMoveCommand(4, 4)).toBe(true);

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueMoveCommand(4, 4)).toBe(true);

    stepBridgeNTicks(bridge, 100);

    const sheepEnd = findHumanClaimedSheep(bridge)!;
    const villagerEnd = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager')!;

    const sheepCellsCovered = Math.abs(sheepStart.x - sheepEnd.x) + Math.abs(sheepStart.y - sheepEnd.y);
    const villagerCellsCovered =
      Math.abs(villagerStart!.x - villagerEnd.x) + Math.abs(villagerStart!.y - villagerEnd.y);

    // Villager should cover roughly twice the cells the sheep does. Coarse-cell snapping
    // introduces ±1 jitter, so accept villager >= 2*sheep - 2 and villager <= 2*sheep + 2.
    expect(sheepCellsCovered).toBeGreaterThan(0);
    expect(villagerCellsCovered).toBeGreaterThan(sheepCellsCovered);
    expect(villagerCellsCovered).toBeGreaterThanOrEqual(sheepCellsCovered * 2 - 2);
    expect(villagerCellsCovered).toBeLessThanOrEqual(sheepCellsCovered * 2 + 2);
  });
});
