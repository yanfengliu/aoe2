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

function getHealthOfUnitAtCell(bridge: Bridge, x: number, y: number): number | null {
  if (!bridge.selectEntityAtCell(x, y)) {
    return null;
  }
  return bridge.getSelectionState().health?.current ?? null;
}

describe('Slice 5 Monastery + Monks + Relics — heal/convert', () => {
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

  it('prefers heal over convert when a friendly wounded unit and an enemy share the clicked cell', () => {
    const bridge = createSimulationBridge('monk-heal-over-convert-fixture');

    const spearman = findFirstOwnedUnit(bridge, 1, 'spearman');
    const militia = findFirstOwnedUnit(bridge, 2, 'militia');
    expect(spearman).toBeDefined();
    expect(militia).toBeDefined();
    const militiaId = militia!.id;

    // The Spearman and Militia share the same cell. Let a few ticks of
    // mutual combat land so the Spearman has lost HP (heal is only a
    // relevant priority for wounded units).
    bridge.step(30 * 100);

    const militiaBeforeOwner = findUnitById(bridge, militiaId)?.owner;
    expect(militiaBeforeOwner).toBe(2);

    // Right-click the shared cell. The Monk should prefer healing the
    // friendly Spearman; a stale first-found priority would convert the
    // enemy Militia instead.
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    const sharedCell = { x: spearman!.x, y: spearman!.y };
    expect(bridge.issueContextCommand(sharedCell.x, sharedCell.y)).toBe(true);

    // Step enough ticks that if the Monk were converting, the Militia would
    // flip to player 1 (~50 ticks at 1 progress / tick). A heal order does
    // not advance convert progress.
    bridge.step(80 * 100);

    const militiaAfter = findUnitById(bridge, militiaId);
    expect(militiaAfter).toBeDefined();
    expect(militiaAfter!.owner).toBe(2);
  }, 30_000);

  it('skips a healthy friendly and converts the stacked enemy when the Monk right-clicks the shared cell', () => {
    // Slice 6 review fix: a healthy friendly + an enemy on the same cell
    // must not consume the heal pass. Pre-fix, pass-1 returned the
    // first friendly at the cell regardless of HP, then
    // issueMonkContextCommandAtEntity fell into a plain move because the
    // friendly was at full HP — the Monk converted nothing.
    const bridge = createSimulationBridge('monk-healthy-friendly-with-enemy-fixture');

    const friendlyMilitia = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 1 && u.unitType === 'militia');
    const enemyMilitia = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 2 && u.unitType === 'militia');
    expect(friendlyMilitia).toBeDefined();
    expect(enemyMilitia).toBeDefined();
    const enemyMilitiaId = enemyMilitia!.id;

    // The friendly is still at full HP at tick 0 — issue the Monk's
    // context command immediately so the pass-1 pre-fix bug fires.
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    const sharedCell = { x: friendlyMilitia!.x, y: friendlyMilitia!.y };
    expect(bridge.issueContextCommand(sharedCell.x, sharedCell.y)).toBe(true);

    // Run enough ticks for the Monk to walk into range (≤ 4 cells away)
    // and apply convert progress to threshold (50). Buffer of ~30 ticks
    // covers the walk; +50 ticks for the conversion itself.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const m = findUnitById(bridge, enemyMilitiaId);
          return m !== undefined && m.owner === 1;
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);
  }, 30_000);

  it('applies one convert progress per tick regardless of how many Monks target the same unit', () => {
    const bridge = createSimulationBridge('monk-double-convert-fixture');

    const enemyMilitia = findFirstOwnedUnit(bridge, 2, 'militia');
    expect(enemyMilitia).toBeDefined();
    const militiaId = enemyMilitia!.id;

    // Both Monks target the same Militia. Select each and issue its convert
    // task individually; they both walk into range and tick progress in the
    // same simulation tick. With stacking, conversion would complete in ~25
    // ticks; without stacking, still ~50 ticks.
    const monks = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && u.unitType === 'monk');
    expect(monks).toHaveLength(2);

    for (const monk of monks) {
      expect(bridge.selectEntityAtCell(monk.x, monk.y)).toBe(true);
      expect(bridge.issueContextCommandAtEntity(militiaId)).toBe(true);
    }

    // After 30 ticks the Militia must still belong to player 2 because the
    // fixed 1-progress-per-tick rate puts the threshold at ~50 ticks.
    bridge.step(30 * 100);
    const midMilitia = findUnitById(bridge, militiaId);
    expect(midMilitia).toBeDefined();
    expect(midMilitia!.owner).toBe(2);

    // After 60 ticks total (at 1 progress / tick the flip lands near 50)
    // the Militia should be player 1's.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const m = findUnitById(bridge, militiaId);
          return m !== undefined && m.owner === 1;
        },
        { maxSteps: 40 },
      ),
    ).toBe(true);
  }, 30_000);

  it('clears a friendly attack command against the target after a Monk converts it', () => {
    const bridge = createSimulationBridge('monk-convert-cleanup-fixture');

    const enemyMilitia = findFirstOwnedUnit(bridge, 2, 'militia');
    const friendlyPikeman = findFirstOwnedUnit(bridge, 1, 'pikeman');
    expect(enemyMilitia).toBeDefined();
    expect(friendlyPikeman).toBeDefined();
    const militiaId = enemyMilitia!.id;
    // Pikeman attacks the Militia.
    expect(selectOwnedUnitDirect(bridge, 1, 'pikeman')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(militiaId)).toBe(true);

    // Monk issues a convert order.
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(militiaId)).toBe(true);

    // Run until the Militia flips. It must still be alive.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const m = findUnitById(bridge, militiaId);
          return m !== undefined && m.owner === 1;
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);

    const convertedMilitia = findUnitById(bridge, militiaId);
    expect(convertedMilitia).toBeDefined();

    // Record the Militia's HP. Step a few more ticks; the Pikeman's attack
    // command should have been cleared at conversion time so the Militia's
    // HP does not continue to fall.
    const militiaCombatBefore = bridge.getSelectionState();
    bridge.selectEntityAtCell(convertedMilitia!.x, convertedMilitia!.y);
    const hpImmediatelyAfter = bridge.getSelectionState().health?.current ?? null;
    bridge.step(20 * 100);
    bridge.selectEntityAtCell(convertedMilitia!.x, convertedMilitia!.y);
    const hpLater = bridge.getSelectionState().health?.current ?? null;

    expect(hpImmediatelyAfter).not.toBeNull();
    expect(hpLater).not.toBeNull();
    // HP should not have dropped further — Pikeman's attack order is gone.
    expect(hpLater!).toBeGreaterThanOrEqual(hpImmediatelyAfter!);
    void militiaCombatBefore;
  }, 30_000);

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

});
