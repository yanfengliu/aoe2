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

function getHealthOfUnitAtCell(bridge: Bridge, x: number, y: number): number | null {
  if (!bridge.selectEntityAtCell(x, y)) {
    return null;
  }
  return bridge.getSelectionState().health?.current ?? null;
}


/**
 * Step one tick at a time until `shotId` leaves the air, and return the unit
 * snapshot taken immediately BEFORE that step — i.e. where everyone stood, and
 * what HP they had, when the stone came down.
 */
function snapshotAtImpact(bridge: Bridge, shotId: number) {
  for (let step = 0; step < 90; step += 1) {
    const before = bridge.getEconomyState().units.map((u) => ({
      id: u.id,
      owner: u.owner,
      unitType: u.unitType,
      x: u.x,
      y: u.y,
      hp: bridge.getEntityHealth(u.id)?.currentHp ?? null,
    }));
    bridge.step(100);
    if (!bridge.getInFlightProjectiles().some((p) => p.id === shotId)) return before;
  }
  throw new Error(`Projectile ${String(shotId)} never landed within 90 ticks.`);
}

describe('Mangonel blast/splash (spec §10.7)', () => {
  it('splashes units around the impact (enemy + friendly fire), sparing those outside the radius', () => {
    const bridge = createSimulationBridge('mangonel-vs-clustered-infantry-fixture');
    const units = bridge.getEconomyState().units;
    const primary = units.find((u) => u.owner === 2 && u.unitType === 'spearman' && u.x === 18 && u.y === 8);
    expect(primary).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'mangonel')).toBe(true);
    expect(bridge.issueContextCommand(primary!.x, primary!.y)).toBe(true);

    // Spec §10.4: the stone spends ~12 ticks in the air, and the cluster keeps
    // fighting and shuffling underneath it. So measure the blast itself — the
    // HP each unit loses on the single tick the stone lands — against where
    // each unit actually stood at that moment, not against spawn cells.
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getInFlightProjectiles().length > 0,
      { maxSteps: 30 },
    )).toBe(true);
    const shot = bridge.getInFlightProjectiles()[0]!;
    expect(shot.isArea).toBe(true);
    const snapshot = snapshotAtImpact(bridge, shot.id).map((u) => ({
      ...u,
      distance: Math.hypot(u.x - shot.aimX, u.y - shot.aimY),
    }));

    // Blast radius 1 (Mangonel). Inside it, everyone takes the hit; outside,
    // nobody does.
    const inRadius = snapshot.filter((u) => u.distance <= 1);
    const outside = snapshot.filter((u) => u.distance > 1 && u.unitType !== 'mangonel');
    expect(inRadius.length).toBeGreaterThanOrEqual(2);
    expect(outside.length).toBeGreaterThanOrEqual(1);
    // Friendly fire is the point: the owner-1 villager standing in the cluster
    // is inside the radius and takes its own Mangonel's blast.
    expect(inRadius.some((u) => u.owner === 1)).toBe(true);

    for (const before of inRadius) {
      const after = bridge.getEntityHealth(before.id)?.currentHp ?? null;
      // Base 40 pierce less the target's pierce armor (Spearman 0, Militia 1,
      // Villager 0). A unit whose remaining HP was under that simply dies —
      // which is itself proof it took at least that much.
      if (after === null) continue;
      expect(before.hp! - after).toBeGreaterThanOrEqual(39);
    }
    for (const before of outside) {
      const after = bridge.getEntityHealth(before.id)?.currentHp ?? null;
      // Outside the radius the only HP change possible on this tick is melee,
      // which cannot reach blast magnitude.
      if (after !== null) expect(before.hp! - after).toBeLessThan(39);
    }
  }, 10_000);

  it('splashes a unit adjacent to a building the Mangonel is shelling', () => {
    const bridge = createSimulationBridge('mangonel-vs-building-splash-fixture');
    const spearman = findFirstOwnedUnit(bridge, 2, 'spearman');
    const house = bridge.getEconomyState().buildings.find((b) => b.owner === 2 && b.buildingType === 'house');
    expect(spearman && house).toBeTruthy();
    expect(getHealthOfUnitAtCell(bridge, spearman!.x, spearman!.y)).toBe(45);

    expect(selectOwnedUnitDirect(bridge, 1, 'mangonel')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(house!.id)).toBe(true);

    // The shot is aimed at the House; when it lands (spec §10.4) its blast is
    // centered on the impact cell, so a unit standing beside the House at that
    // moment is caught by it.
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getInFlightProjectiles().length > 0,
      { maxSteps: 30 },
    )).toBe(true);
    const shot = bridge.getInFlightProjectiles()[0]!;
    const atImpact = snapshotAtImpact(bridge, shot.id).find((u) => u.id === spearman!.id);
    expect(atImpact).toBeDefined();
    expect(Math.hypot(atImpact!.x - shot.aimX, atImpact!.y - shot.aimY)).toBeLessThanOrEqual(1);
    const hpAfter = bridge.getEntityHealth(spearman!.id)?.currentHp ?? 0;
    // Base 40 pierce, Spearman 0 pierce armor.
    expect(atImpact!.hp! - hpAfter).toBe(40);
  }, 10_000);
});
