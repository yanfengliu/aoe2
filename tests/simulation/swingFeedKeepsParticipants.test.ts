// The swing feed keeps `participants`, although nothing reads them since
// v0.3.235 (defect register 2026-09-24, the independent review of the hit
// feed). The attack warning reads the hit feed now (`playerHitFeed.ts`). But
// the swing feed is copied into replay snapshots (`aoe2.replayUnitAttacks`, by
// `tier3SyncSystem.ts`), so a bundle recorded before v0.3.235 holds the field.
// A re-simulation that dropped it would diverge from that bundle's own
// snapshots. The first draft of v0.3.235 did drop it, and only the review saw
// the cost. This pins what a live swing is recorded with, and what the replay
// slot is written with, so a later cleanup of an "unread" field goes red here.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('the swing feed', () => {
  it('records who a swing was between, and copies it into the replay slot', () => {
    const bridge = createSimulationBridge('militia-combat-fixture');
    const units = bridge.getEconomyState().units;
    const militia = units.find((unit) => unit.owner === 1 && unit.unitType === 'militia');
    const scout = units.find((unit) => unit.owner === 2 && unit.unitType === 'scout');
    if (!militia || !scout) throw new Error('militia-combat-fixture must hold owner 1\'s militia and owner 2\'s scout');
    expect(bridge.selectUnitsByIds([militia.id])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(scout.id)).toBe(true);

    let swing = null as ReturnType<typeof bridge.getRecentUnitAttacks>[number] | null;
    for (let step = 0; step < 480 && swing === null; step += 1) {
      bridge.step(100);
      swing = bridge.getRecentUnitAttacks().find((attack) => attack.attackerId === militia.id) ?? null;
    }
    expect(swing, 'the militia never swung at the scout').not.toBeNull();
    const who = { attackerOwner: 1, targetOwner: 2, targetIsEconomy: false };
    expect(swing!.participants).toEqual(who);

    // The slot a replay snapshot carries is written at the end of each tick.
    bridge.step(100);
    const slot = (bridge.world.getState('aoe2.replayUnitAttacks') ?? []) as Array<{ attackerId: number; participants?: unknown }>;
    const copied = slot.find((attack) => attack.attackerId === militia.id);
    expect(copied, 'the swing never reached the replay slot').toBeDefined();
    expect(copied!.participants).toEqual(who);
  });
});
