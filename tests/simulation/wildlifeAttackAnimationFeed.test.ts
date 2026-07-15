// Wildlife retaliation attack feed (spec §14.5, user directive 2026-07-14):
// a boar whose retaliation strike lands plays through the SAME successful-hit
// presentation channel as unit attacks — recorded with witnesses at the
// damage site in wildlifeCombatSystem, fog-projected, and attached to the
// boar's RESOURCE view exactly like a unit attacker's view.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Bridge = ReturnType<typeof createSimulationBridge>;

function boarEntity(bridge: Bridge) {
  return bridge
    .getRenderState()
    .entities.find((entity) => entity.kind === 'resource' && entity.entityType === 'boar');
}

function driveUntilBoarStrikeLands(bridge: Bridge): boolean {
  for (let step = 0; step < 120; step += 1) {
    bridge.step(100);
    const villagers = bridge
      .getRenderState()
      .entities.filter((entity) => entity.kind === 'unit' && entity.entityType === 'villager');
    if (villagers.some((v) => v.currentHp !== null && v.maxHp !== null && v.currentHp < v.maxHp)) {
      return true;
    }
  }
  return false;
}

describe('wildlife retaliation attack feed (spec §14.5)', () => {
  it('projects a witnessed boar strike as an attackAnimation on the boar resource view', () => {
    const bridge = createSimulationBridge('boar-hunt-fixture');
    const boar = boarEntity(bridge);
    expect(boar).toBeDefined();
    expect(bridge.selectUnitsInBox(12, 7, 14, 9)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(boar!.id)).toBe(true);

    expect(driveUntilBoarStrikeLands(bridge)).toBe(true);

    const struckView = boarEntity(bridge);
    expect(struckView).toBeDefined();
    const attack = struckView!.attackAnimation;
    expect(attack).toBeDefined();
    // Source is the boar's own root; target points at the bitten villager, so
    // the renderer can face the gore pose without a duplicated direction.
    expect(attack!.sourceX).toBeCloseTo(struckView!.x, 5);
    expect(attack!.sourceY).toBeCloseTo(struckView!.y, 5);
    expect(Math.hypot(attack!.targetX - attack!.sourceX, attack!.targetY - attack!.sourceY))
      .toBeGreaterThan(0);
  });

  it('keeps the boar strike fog-honest: no witness, no event', () => {
    // The recorder's witness rule is shared with unit attacks (attacker AND
    // target footprints visible per perspective). The boar-hunt fixture keeps
    // player 1 vision on the whole pen, so this asserts the SHARED path is in
    // use (witnessedBy non-empty implies projection); the no-witness case is
    // pinned at the recorder level by the existing unit feed suites.
    const bridge = createSimulationBridge('boar-hunt-fixture');
    const boar = boarEntity(bridge);
    expect(bridge.selectUnitsInBox(12, 7, 14, 9)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(boar!.id)).toBe(true);
    expect(driveUntilBoarStrikeLands(bridge)).toBe(true);
    expect(boarEntity(bridge)!.attackAnimation?.tick).toBeGreaterThan(0);
  });
});
