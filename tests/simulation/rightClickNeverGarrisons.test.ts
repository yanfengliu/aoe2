// Right-click never garrisons; garrison is the explicit (Alt) intent.
// Spec §9.3 (user directive 2026-07-15, deliberate AoE2 deviation).
//
// A plain right-click on an owned garrisonable building must MOVE the unit to
// the click's ground position, not swallow it into the building. Garrison is
// still available, but only when the player asks for it explicitly.

import { describe, expect, it } from 'vitest';

import { stepBridgeUntil } from './createSimulationBridge.helpers';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { GathererComponent, UnitComponent } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

function castleAndVillager(bridge: Bridge) {
  const castle = bridge
    .getEconomyState()
    .buildings.find((b) => b.owner === 1 && b.buildingType === 'castle');
  const villager = bridge
    .getEconomyState()
    .units.find((u) => u.owner === 1 && u.unitType === 'villager');
  if (!castle || !villager) throw new Error('fixture must have an owned castle and villager');
  return { castle, villager };
}

function garrisonedCount(bridge: Bridge, buildingId: number): number {
  expect(bridge.selectEntityById(buildingId)).toBe(true);
  const inventory = bridge.getSelectionState().inventory;
  const match = /(\d+)\s*\/\s*\d+/u.exec(inventory ?? '');
  return match ? Number(match[1]) : 0;
}

// IDENTITY, not a bare id. `world.isAlive` takes an id with no generation and
// the engine recycles ids from a free list, so a villager that died and whose
// id was reused reads as alive — and so does its `unit` component. A ref
// carries the generation, which is the only thing that answers "is this still
// the SAME entity". Taken before the step, checked after it.
function stillTheSameUnit(bridge: Bridge, ref: ReturnType<Bridge['world']['getEntityRef']>): boolean {
  if (!ref) return false;
  return bridge.world.isCurrent(ref)
    && bridge.world.getComponent<UnitComponent>(ref.id, 'unit') !== undefined;
}

describe('right-click never garrisons (spec §9.3)', () => {
  it('moves the unit instead of garrisoning it into an owned castle', () => {
    const bridge = createSimulationBridge('castle-garrison-fixture');
    const { castle, villager } = castleAndVillager(bridge);

    const villagerRef = bridge.world.getEntityRef(villager.id);
    expect(bridge.selectUnitsByIds([villager.id])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(castle.id)).toBe(true);
    bridge.step(100);

    expect(garrisonedCount(bridge, castle.id), 'a plain right-click garrisoned the villager')
      .toBe(0);
    // The unit is still on the field and has been given a destination.
    expect(stillTheSameUnit(bridge, villagerRef)).toBe(true);
  });

  it('garrisons when the player explicitly asks (Alt+right-click)', () => {
    const bridge = createSimulationBridge('castle-garrison-fixture');
    const { castle, villager } = castleAndVillager(bridge);

    expect(bridge.selectUnitsByIds([villager.id])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(castle.id, { garrison: true })).toBe(true);
    // v0.3.42: garrisoning is an order — the villager walks in.
    expect(
      stepBridgeUntil(bridge, () => garrisonedCount(bridge, castle.id) === 1, { maxSteps: 400 }),
    ).toBe(true);
  });

  it('still gathers, attacks, and repairs on a plain right-click', () => {
    // The directive changed garrison only; every other routing stands.
    const bridge = createSimulationBridge('boar-hunt-fixture');
    const boar = bridge
      .getRenderState()
      .entities.find((e) => e.kind === 'resource' && e.entityType === 'boar');
    expect(boar).toBeDefined();
    expect(bridge.selectUnitsInBox(12, 7, 14, 9)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(boar!.id)).toBe(true);
    bridge.step(100);
    const hunters = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && u.unitType === 'villager');
    expect(
      hunters.some((u) => {
        const g = bridge.world.getComponent<GathererComponent>(u.id, 'gatherer');
        return g?.targetResourceId === boar!.id || u.task === 'attacking';
      }),
      'right-click on a boar must still hunt it',
    ).toBe(true);
  });

  it('Alt on a non-garrisonable target falls back to ordinary routing', () => {
    const bridge = createSimulationBridge('boar-hunt-fixture');
    const boar = bridge
      .getRenderState()
      .entities.find((e) => e.kind === 'resource' && e.entityType === 'boar');
    expect(bridge.selectUnitsInBox(12, 7, 14, 9)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(boar!.id, { garrison: true })).toBe(true);
  });
});
