import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function countOwnedUnits(bridge: Bridge, owner: number, unitType: string): number {
  return bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === owner && unit.unitType === unitType).length;
}

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

function getHealthOfUnitAtCell(bridge: Bridge, x: number, y: number): number | null {
  if (!bridge.selectEntityAtCell(x, y)) {
    return null;
  }
  return bridge.getSelectionState().health?.current ?? null;
}

describe('Slice 5 Monastery + Monks + Relics', () => {
  it('exposes Monastery in a villager placement menu at Castle Age', () => {
    const bridge = createSimulationBridge('monastery-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const buildOptions = bridge.getSelectionState().buildOptions;
    expect(buildOptions).toContain('monastery');
  });

  it('does not offer Monastery while still in Feudal Age', () => {
    const bridge = createSimulationBridge('feudal-blacksmith-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const buildOptions = bridge.getSelectionState().buildOptions;
    expect(buildOptions).not.toContain('monastery');
  });

  it('exposes Monk in the Monastery train menu at Castle Age', () => {
    const bridge = createSimulationBridge('monastery-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'monastery')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toContain('monk');
  });

  it('trains a Monk when the Monastery is selected and the train command is issued', () => {
    const bridge = createSimulationBridge('monastery-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'monastery')).toBe(true);
    expect(bridge.queueTrainUnit('monk')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'monk') === 1,
        { maxSteps: 700 },
      ),
    ).toBe(true);

    const monk = findFirstOwnedUnit(bridge, 1, 'monk');
    expect(monk).toMatchObject({
      unitType: 'monk',
      attackDamage: 0,
    });
  }, 40_000);

  it('heals a friendly wounded unit over ticks when a Monk is ordered to heal it', () => {
    const bridge = createSimulationBridge('monk-heal-fixture');
    const spearmanBefore = findFirstOwnedUnit(bridge, 1, 'spearman');
    expect(spearmanBefore).toBeDefined();
    const spearmanId = spearmanBefore!.id;

    // Wolf auto-aggros on the Spearman; Spearman's default idle state does
    // not fight back. Let the wolf work the Spearman's HP down.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const s = findUnitById(bridge, spearmanId);
          if (!s) return false;
          const hp = getHealthOfUnitAtCell(bridge, s.x, s.y);
          return hp !== null && hp < 35 && hp > 5;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Kill the wolf by ordering the Spearman to attack it. That stops the
    // incoming damage so the heal can catch up.
    const wolf = bridge.getEconomyState().resources.find((r) => r.resourceType === 'wolf');
    expect(wolf).toBeDefined();
    // Resolve the wolf entity id via selectEntityAtCell — economy state does
    // not expose ids.
    expect(bridge.selectEntityAtCell(wolf!.x, wolf!.y)).toBe(true);
    const wolfId = bridge.getSelectionState().selectedEntityId!;

    expect(selectOwnedUnitDirect(bridge, 1, 'spearman')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(wolfId)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().resources.find((r) => r.resourceType === 'wolf') === undefined,
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Move the Spearman back adjacent to the Monk so heal range covers.
    const monk = findFirstOwnedUnit(bridge, 1, 'monk');
    expect(monk).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, 1, 'spearman')).toBe(true);
    expect(bridge.issueMoveCommand(monk!.x + 1, monk!.y)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const s = findUnitById(bridge, spearmanId);
          return (
            s !== undefined
            && Math.abs(s.x - monk!.x) + Math.abs(s.y - monk!.y) <= 2
          );
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Record HP just before the heal order.
    const prehealUnit = findUnitById(bridge, spearmanId);
    expect(prehealUnit).toBeDefined();
    const prehealHp = getHealthOfUnitAtCell(bridge, prehealUnit!.x, prehealUnit!.y);
    expect(prehealHp).not.toBeNull();
    expect(prehealHp).toBeLessThan(45);

    // Issue the Monk heal order.
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(spearmanId)).toBe(true);

    // 300 ticks → up to 30 HP at 1 HP / 10 ticks, capped at 45.
    bridge.step(300 * 100);

    const healed = findUnitById(bridge, spearmanId);
    expect(healed).toBeDefined();
    const healedHp = getHealthOfUnitAtCell(bridge, healed!.x, healed!.y);
    expect(healedHp).not.toBeNull();
    expect(healedHp).toBeGreaterThan(prehealHp!);
    expect(healedHp).toBeLessThanOrEqual(45);
  }, 60_000);

  it('converts an enemy unit when a Monk is ordered to convert it', () => {
    const bridge = createSimulationBridge('monk-convert-fixture');

    const enemyMilitia = findFirstOwnedUnit(bridge, 2, 'militia');
    expect(enemyMilitia).toBeDefined();
    const militiaId = enemyMilitia!.id;

    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(militiaId)).toBe(true);

    // Conversion takes 50 ticks (1 progress per tick). Step more than that
    // with margin to let the flip land.
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
  }, 20_000);

  it('cancels an active Monk heal task when the player right-clicks open ground', () => {
    const bridge = createSimulationBridge('monk-heal-fixture');

    const spearman = findFirstOwnedUnit(bridge, 1, 'spearman');
    expect(spearman).toBeDefined();
    const spearmanId = spearman!.id;

    // Wound the Spearman by letting the wolf chew on him for a while.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const s = findUnitById(bridge, spearmanId);
          if (!s) return false;
          const hp = getHealthOfUnitAtCell(bridge, s.x, s.y);
          return hp !== null && hp < 35 && hp > 5;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Stop the wolf so heal can stick.
    const wolf = bridge.getEconomyState().resources.find((r) => r.resourceType === 'wolf');
    expect(wolf).toBeDefined();
    expect(bridge.selectEntityAtCell(wolf!.x, wolf!.y)).toBe(true);
    const wolfId = bridge.getSelectionState().selectedEntityId!;
    expect(selectOwnedUnitDirect(bridge, 1, 'spearman')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(wolfId)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().resources.find((r) => r.resourceType === 'wolf') === undefined,
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Put the Spearman next to the Monk so heal range covers.
    const monk = findFirstOwnedUnit(bridge, 1, 'monk');
    expect(monk).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, 1, 'spearman')).toBe(true);
    expect(bridge.issueMoveCommand(monk!.x + 1, monk!.y)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const s = findUnitById(bridge, spearmanId);
          return (
            s !== undefined
            && Math.abs(s.x - monk!.x) + Math.abs(s.y - monk!.y) <= 2
          );
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Issue the Monk heal order. Confirm heal started by watching HP tick up.
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(spearmanId)).toBe(true);
    bridge.step(30 * 100);
    const healStarted = findUnitById(bridge, spearmanId);
    expect(healStarted).toBeDefined();
    const hpMidHeal = getHealthOfUnitAtCell(bridge, healStarted!.x, healStarted!.y);
    expect(hpMidHeal).not.toBeNull();

    // Now cancel the heal by right-clicking open ground far from the target.
    // Without the fix, the stale monkTasks entry re-triggers next tick and
    // the Monk walks back to keep healing.
    const monkBeforeMove = findFirstOwnedUnit(bridge, 1, 'monk');
    expect(monkBeforeMove).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    const destinationX = 2;
    const destinationY = 2;
    expect(bridge.issueMoveCommand(destinationX, destinationY)).toBe(true);

    // Advance generously. A cancelled Monk walks to the destination at
    // ~1 cell every two ticks; a Monk still being pulled back to its heal
    // target oscillates in place. Require the Monk to close most of the
    // distance so an oscillation cannot pass the assertion by a single
    // substep nudge.
    bridge.step(200 * 100);
    const monkAfter = findFirstOwnedUnit(bridge, 1, 'monk');
    expect(monkAfter).toBeDefined();
    const distanceToDestination =
      Math.abs(monkAfter!.x - destinationX) + Math.abs(monkAfter!.y - destinationY);
    const distanceBefore =
      Math.abs(monkBeforeMove!.x - destinationX) + Math.abs(monkBeforeMove!.y - destinationY);
    // The Monk should have closed most of the distance to (2, 2). With a
    // lingering heal task the Monk oscillates near the Spearman and never
    // gets close to the destination.
    expect(distanceToDestination).toBeLessThan(Math.floor(distanceBefore / 2));
  }, 60_000);

  it('does not start a convert task when a Monk right-clicks a fog-hidden enemy cell', () => {
    const bridge = createSimulationBridge('monk-fog-fixture');

    // Enemy Militia at (25, 10) — outside the Monk's radius-2 vision.
    const enemyMilitia = findFirstOwnedUnit(bridge, 2, 'militia');
    expect(enemyMilitia).toBeDefined();
    const militiaCell = { x: enemyMilitia!.x, y: enemyMilitia!.y };

    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    const monkBefore = findFirstOwnedUnit(bridge, 1, 'monk');
    expect(monkBefore).toBeDefined();

    // Right-click the cell the enemy Militia occupies. The scene would
    // normally issue a cell-based context command because the renderer does
    // not emit a live entity for fog-hidden enemies.
    expect(bridge.issueContextCommand(militiaCell.x, militiaCell.y)).toBe(true);

    // Advance a few ticks. The Monk must NOT be flagged for a convert task;
    // the fallback path is a plain move, which leaves the Militia unconverted.
    for (let i = 0; i < 80; i += 1) {
      bridge.step(100);
    }

    const militiaAfter = findUnitById(bridge, enemyMilitia!.id);
    expect(militiaAfter).toBeDefined();
    expect(militiaAfter!.owner).toBe(2);
  }, 30_000);

  it('reassigns visionSource playerId when a Monk converts an enemy unit', () => {
    const bridge = createSimulationBridge('monk-convert-vision-fixture');

    const enemyScout = findFirstOwnedUnit(bridge, 2, 'scout');
    expect(enemyScout).toBeDefined();
    const scoutId = enemyScout!.id;
    const scoutCell = { x: enemyScout!.x, y: enemyScout!.y };

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
    const relicEntityId = bridge.getEconomyState().resources
      ? undefined
      : undefined; // resources array does not expose id; we'll resolve via selectEntityAtCell

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
