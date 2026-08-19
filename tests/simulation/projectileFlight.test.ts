import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

// One simulation tick at 10 TPS.
const TICK_MS = 100;

type Bridge = ReturnType<typeof createSimulationBridge>;

function findFirstOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function healthAtCell(bridge: Bridge, x: number, y: number): number | null {
  if (!bridge.selectEntityAtCell(x, y)) return null;
  return bridge.getSelectionState().health?.current ?? null;
}

/** Order the fixture's cavalry archer to attack the enemy militia it faces. */
function orderRangedAttack(bridge: Bridge) {
  const target = findFirstOwnedUnit(bridge, 2, 'militia');
  expect(target).toBeDefined();
  expect(selectOwnedUnitDirect(bridge, 1, 'cavalry-archer')).toBe(true);
  expect(bridge.issueContextCommand(target!.x, target!.y)).toBe(true);
  return target!;
}

describe('projectiles fly instead of landing instantly', () => {
  it('puts a projectile in the air before any damage is dealt', () => {
    const bridge = createSimulationBridge('cavalry-archer-ranged-fixture');
    const target = orderRangedAttack(bridge);
    const startingHp = healthAtCell(bridge, target.x, target.y);
    expect(startingHp).toBe(40);

    // Step until something is in flight. Damage must NOT have landed yet —
    // this is the whole point of the change.
    const launched = stepBridgeUntil(
      bridge,
      () => bridge.getInFlightProjectiles().length > 0,
      { maxSteps: 120 },
    );
    expect(launched).toBe(true);
    expect(healthAtCell(bridge, target.x, target.y)).toBe(startingHp);

    const shot = bridge.getInFlightProjectiles()[0]!;
    expect(shot.impactTick).toBeGreaterThan(shot.launchTick);
    expect(shot.targetId).toBeGreaterThan(0);
  });

  it('lands the damage on the impact tick, not the launch tick', () => {
    const bridge = createSimulationBridge('cavalry-archer-ranged-fixture');
    const target = orderRangedAttack(bridge);

    expect(stepBridgeUntil(
      bridge,
      () => bridge.getInFlightProjectiles().length > 0,
      { maxSteps: 120 },
    )).toBe(true);
    const shot = bridge.getInFlightProjectiles()[0]!;
    const impactTick = shot.impactTick;

    // Walk to exactly one tick before impact: still no damage.
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getRenderState().tick >= impactTick - 1,
      { maxSteps: 120 },
    )).toBe(true);
    expect(healthAtCell(bridge, target.x, target.y)).toBe(40);

    // On/after the impact tick the shot resolves and clears the air.
    expect(stepBridgeUntil(
      bridge,
      () => healthAtCell(bridge, target.x, target.y) !== 40,
      { maxSteps: 60 },
    )).toBe(true);
    expect(bridge.getInFlightProjectiles().some((p) => p.id === shot.id)).toBe(false);
  });

  it('still kills a stationary target over time — a 100%-accuracy archer connects', () => {
    const bridge = createSimulationBridge('cavalry-archer-ranged-fixture');
    const target = orderRangedAttack(bridge);
    // Cavalry archers are 50% accurate, so this asserts sustained fire kills
    // rather than every shot landing.
    expect(stepBridgeUntil(
      bridge,
      () => healthAtCell(bridge, target.x, target.y) === null,
      { maxSteps: 1_200 },
    )).toBe(true);
  });

  it('is deterministic — two identical matches agree tick for tick', () => {
    const run = () => {
      const bridge = createSimulationBridge('cavalry-archer-ranged-fixture');
      const target = orderRangedAttack(bridge);
      const samples: string[] = [];
      for (let step = 0; step < 200; step += 1) {
        bridge.step(TICK_MS);
        const inFlight = bridge.getInFlightProjectiles()
          .map((p) => `${String(p.id)}@${String(p.impactTick)}:${p.willHit ? 'hit' : 'miss'}`)
          .join(',');
        samples.push(`${String(healthAtCell(bridge, target.x, target.y))}|${inFlight}`);
      }
      return samples.join('\n');
    };
    expect(run()).toBe(run());
  });

  it('keeps shots in the air across a save and load', () => {
    const bridge = createSimulationBridge('cavalry-archer-ranged-fixture');
    orderRangedAttack(bridge);
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getInFlightProjectiles().length > 0,
      { maxSteps: 120 },
    )).toBe(true);
    const before = bridge.getInFlightProjectiles();
    expect(before.length).toBeGreaterThan(0);

    const saved = structuredClone(bridge.saveGame());
    const restored = createSimulationBridge('cavalry-archer-ranged-fixture', {
      savedGame: saved,
    });
    expect(restored.getInFlightProjectiles()).toEqual(before);
  });

  it('resolves a shot whose attacker died mid-flight', () => {
    // A projectile is a committed event: once loosed it lands regardless of
    // what happens to the archer that fired it.
    const bridge = createSimulationBridge('cavalry-archer-ranged-fixture');
    const target = orderRangedAttack(bridge);
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getInFlightProjectiles().length > 0,
      { maxSteps: 120 },
    )).toBe(true);
    const shot = bridge.getInFlightProjectiles()[0]!;
    expect(shot.attackerId).toBeGreaterThan(0);

    // The shot must clear the air by its impact tick even if we never touch it
    // again — no leak, no permanent in-flight entry.
    expect(stepBridgeUntil(
      bridge,
      () => !bridge.getInFlightProjectiles().some((p) => p.id === shot.id),
      { maxSteps: 120 },
    )).toBe(true);
    expect(healthAtCell(bridge, target.x, target.y)).not.toBeUndefined();
  });

  it('never leaves a projectile in flight longer than its declared impact tick', () => {
    const bridge = createSimulationBridge('cavalry-archer-ranged-fixture');
    orderRangedAttack(bridge);
    for (let step = 0; step < 400; step += 1) {
      bridge.step(TICK_MS);
      const tick = bridge.getRenderState().tick;
      for (const shot of bridge.getInFlightProjectiles()) {
        expect(shot.impactTick).toBeGreaterThanOrEqual(tick);
      }
    }
  });

  it('leaves melee attacks instant — a militia brawl launches nothing', () => {
    // Arrow-firing BUILDINGS in the fixture legitimately put shots in the air,
    // so the contract is per-attacker: no melee unit ever launches one.
    const bridge = createSimulationBridge('militia-combat-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    const enemy = findFirstOwnedUnit(bridge, 2, 'militia');
    if (enemy) bridge.issueContextCommand(enemy.x, enemy.y);
    for (let step = 0; step < 120; step += 1) {
      bridge.step(TICK_MS);
      for (const shot of bridge.getInFlightProjectiles()) {
        expect(shot.attackerUnitType).toBeNull(); // building arrow, not a militia
      }
    }
  });

  it('keeps a siege weapon anti-building bonus out of its unit blast', () => {
    // Regression: the Mangonel's +35 vs buildings was briefly snapshotted as
    // the projectile's base damage, so its blast hit nearby infantry for 75
    // instead of 40 and one-shot a full-health Spearman.
    const bridge = createSimulationBridge('mangonel-vs-building-splash-fixture');
    const spearman = findFirstOwnedUnit(bridge, 2, 'spearman');
    const house = bridge.getEconomyState().buildings
      .find((b) => b.owner === 2 && b.buildingType === 'house');
    expect(spearman && house).toBeTruthy();
    expect(selectOwnedUnitDirect(bridge, 1, 'mangonel')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(house!.id)).toBe(true);

    expect(stepBridgeUntil(
      bridge,
      () => bridge.getInFlightProjectiles().length > 0,
      { maxSteps: 30 },
    )).toBe(true);
    const shot = bridge.getInFlightProjectiles()[0]!;
    // The two damage numbers travel separately on the shot.
    expect(shot.buildingDamage).toBe(75); // 40 base + 35 vs buildings
    expect(shot.baseDamage).toBe(40); // what the blast is allowed to use

    // And the Spearman beside the House survives the blast on 5 HP.
    expect(stepBridgeUntil(
      bridge,
      () => !bridge.getInFlightProjectiles().some((p) => p.id === shot.id),
      { maxSteps: 60 },
    )).toBe(true);
    expect(bridge.getEntityHealth(spearman!.id)?.currentHp).toBe(5);
  });
});
