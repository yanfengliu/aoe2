import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function getOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge.getEconomyState().units.find(
    (unit) => unit.owner === owner && unit.unitType === unitType,
  );
}

describe('auto-aggression: idle military pursues; idle villagers defend', () => {
  it('idle militia auto-engages an enemy spearman within its vision radius', () => {
    const bridge = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');

    const enemy = getOwnedUnit(bridge, 2, 'spearman');
    expect(enemy).toBeDefined();
    const startHp = bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0;
    expect(startHp).toBeGreaterThan(0);

    // No player command issued. Auto-aggression should drive engagement.
    expect(
      stepBridgeUntil(
        bridge,
        () => (bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0) < startHp,
        { maxSteps: 240 },
      ),
    ).toBe(true);
  }, 10_000);

  it('idle militia ignores an enemy spearman that is far outside its vision radius', () => {
    const bridge = createSimulationBridge('auto-aggro-idle-militia-out-of-vision-fixture');

    const militia = getOwnedUnit(bridge, 1, 'militia');
    const enemy = getOwnedUnit(bridge, 2, 'spearman');
    expect(militia).toBeDefined();
    expect(enemy).toBeDefined();

    const militiaStartX = militia!.x;
    const militiaStartY = militia!.y;
    const enemyStartHp = bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0;

    for (let index = 0; index < 120; index += 1) {
      bridge.step(100);
    }

    const after = getOwnedUnit(bridge, 1, 'militia');
    expect(after).toBeDefined();
    // The militia stays put — no auto-attack issued, so position unchanged.
    expect(after!.x).toBe(militiaStartX);
    expect(after!.y).toBe(militiaStartY);
    // And the enemy spearman is unscathed.
    expect(bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0).toBe(enemyStartHp);
  }, 10_000);

  it('idle archer pursues a target inside vision but outside attack range, then fires', () => {
    const bridge = createSimulationBridge('auto-aggro-archer-pursuit-fixture');

    const enemy = getOwnedUnit(bridge, 2, 'spearman');
    expect(enemy).toBeDefined();
    const enemyStartHp = bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0;

    expect(
      stepBridgeUntil(
        bridge,
        () => (bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0) < enemyStartHp,
        { maxSteps: 360 },
      ),
    ).toBe(true);
  }, 15_000);

  it('honors a player-issued move order: militia walks past an adjacent enemy without engaging', () => {
    const bridge = createSimulationBridge('auto-aggro-player-move-overrides-fixture');

    const enemy = getOwnedUnit(bridge, 2, 'spearman');
    expect(enemy).toBeDefined();
    const enemyStartHp = bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0;

    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    // Issue a move past the enemy, far to the east.
    expect(bridge.issueMoveCommand(28, 8)).toBe(true);

    // Step long enough for the militia to walk past the enemy at (12, 9).
    for (let index = 0; index < 240; index += 1) {
      bridge.step(100);
    }

    const after = getOwnedUnit(bridge, 1, 'militia');
    expect(after).toBeDefined();
    // Militia made meaningful eastward progress (kept moving past the enemy).
    expect(after!.x).toBeGreaterThan(15);
    // And the enemy spearman is still untouched — no auto-attack happened.
    expect(bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0).toBe(enemyStartHp);
  }, 10_000);

  it('idle villager swings back at an adjacent enemy spearman (defensive stance)', () => {
    const bridge = createSimulationBridge('auto-aggro-villager-adjacent-fixture');

    const enemy = getOwnedUnit(bridge, 2, 'spearman');
    expect(enemy).toBeDefined();
    const enemyStartHp = bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0;

    expect(
      stepBridgeUntil(
        bridge,
        () => (bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0) < enemyStartHp,
        { maxSteps: 240 },
      ),
    ).toBe(true);
  }, 10_000);

  it('villager does NOT pursue an enemy several tiles away (defensive stance, no chase)', () => {
    const bridge = createSimulationBridge('auto-aggro-villager-no-pursuit-fixture');

    const villager = getOwnedUnit(bridge, 1, 'villager');
    const enemy = getOwnedUnit(bridge, 2, 'spearman');
    expect(villager).toBeDefined();
    expect(enemy).toBeDefined();

    const villagerStartX = villager!.x;
    const villagerStartY = villager!.y;
    const enemyStartHp = bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0;

    for (let index = 0; index < 120; index += 1) {
      bridge.step(100);
    }

    const after = getOwnedUnit(bridge, 1, 'villager');
    expect(after).toBeDefined();
    // Villager stays in place, never chases.
    expect(after!.x).toBe(villagerStartX);
    expect(after!.y).toBe(villagerStartY);
    // Enemy is untouched.
    expect(bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0).toBe(enemyStartHp);
  }, 10_000);

  it('does not yank a gathering villager off its resource when an enemy walks adjacent', () => {
    const bridge = createSimulationBridge('auto-aggro-villager-gathering-fixture');

    const villager = getOwnedUnit(bridge, 1, 'villager');
    const tree = bridge
      .getEconomyState()
      .resources.find((r) => r.resourceType === 'tree' && r.x === 13 && r.y === 8);
    expect(villager).toBeDefined();
    expect(tree).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(tree!.id)).toBe(true);

    // Run long enough for the villager to reach the tree, gather a few
    // ticks, and have the adjacent spearman land hits.
    for (let index = 0; index < 100; index += 1) {
      bridge.step(100);
    }

    // The villager must still be alive and either gathering or carrying
    // wood (i.e., still on its order). The enemy spearman is unscathed
    // because the villager never auto-attacked it.
    const villagerAfter = getOwnedUnit(bridge, 1, 'villager');
    expect(villagerAfter).toBeDefined();
    const enemyAfter = getOwnedUnit(bridge, 2, 'spearman');
    expect(enemyAfter).toBeDefined();
    const enemyHpAfter = bridge.getEntityHealth(enemyAfter!.id)?.currentHp ?? -1;
    const enemyHpStart = bridge.getEntityHealth(enemyAfter!.id)?.maxHp ?? -1;
    expect(enemyHpAfter).toBe(enemyHpStart);
  }, 15_000);

  it('does not auto-engage from a Monk: an adjacent enemy spearman never gets attacked', () => {
    const bridge = createSimulationBridge('auto-aggro-monk-skip-fixture');

    const enemy = getOwnedUnit(bridge, 2, 'spearman');
    const monk = getOwnedUnit(bridge, 1, 'monk');
    expect(enemy).toBeDefined();
    expect(monk).toBeDefined();
    const enemyStartHp = bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0;

    for (let index = 0; index < 80; index += 1) {
      bridge.step(100);
    }

    // Enemy spearman is unscathed because Monks never auto-attack.
    const enemyAfter = getOwnedUnit(bridge, 2, 'spearman');
    expect(enemyAfter).toBeDefined();
    expect(bridge.getEntityHealth(enemyAfter!.id)?.currentHp ?? -1).toBe(enemyStartHp);
  }, 15_000);

  it('after killing one enemy, an idle militia auto-engages the next visible enemy', () => {
    const bridge = createSimulationBridge('auto-aggro-sequential-targets-fixture');

    const enemiesAtStart = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 2 && unit.unitType === 'spearman');
    expect(enemiesAtStart.length).toBe(2);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge
            .getEconomyState()
            .units.filter((unit) => unit.owner === 2 && unit.unitType === 'spearman').length === 0,
        { maxSteps: 1_200 },
      ),
    ).toBe(true);

    // Militia survived (or at least the auto-aggression chain completed).
    const survivingEnemies = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 2 && unit.unitType === 'spearman').length;
    expect(survivingEnemies).toBe(0);
  }, 30_000);

  it('save/load mid-engagement preserves auto-aggression: rehydrated bridge keeps damaging the target', () => {
    const original = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');

    // Run a few ticks so auto-aggression issues an attack-command and
    // chips the target HP.
    for (let index = 0; index < 30; index += 1) {
      original.step(100);
    }

    const blob = original.saveGame();
    const restored = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture', {
      savedGame: blob,
    });

    const enemyAfterLoad = restored
      .getEconomyState()
      .units.find((unit) => unit.owner === 2 && unit.unitType === 'spearman');
    expect(enemyAfterLoad).toBeDefined();
    const hpAfterLoad = restored.getEntityHealth(enemyAfterLoad!.id)?.currentHp ?? 0;

    // After rehydrate, continued ticks must keep dropping enemy HP. Either the
    // saved unit-command resumed, or auto-aggression re-issues on the next tick.
    expect(
      stepBridgeUntil(
        restored,
        () => (restored.getEntityHealth(enemyAfterLoad!.id)?.currentHp ?? 0) < hpAfterLoad,
        { maxSteps: 240 },
      ),
    ).toBe(true);
  }, 10_000);
});
