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

    // Wound the spearman by pulling it into the selection and using the
    // command path to have an enemy attack it — easier: use an internal
    // backdoor via the combat state. Since we don't have a public "damage"
    // helper, we spawn an enemy attacker close by via an existing fixture
    // would overcomplicate; instead exercise the visible heal behaviour by
    // first letting some damage accrue via a manual workaround: the fixture
    // keeps the spearman at full HP, so we'll damage it via a short combat
    // with an attacker we insert by scripting a direct attack-command. Since
    // no such test hook exists either, we instead use selectEntityAtCell +
    // getSelectionState()'s health readout to sanity-check current health,
    // and rely on a sibling enemy-friendly combat case to prove the heal
    // loop increments the HP.
    //
    // For this test: damage the spearman by walking it into the enemy TC at
    // x=40 via an attack command on the enemy TC. The TC's defensive arrows
    // will pepper the spearman until we call off the attack. Once wounded,
    // issue the heal order on the Monk and assert HP recovers.

    const enemyTc = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 2 && b.buildingType === 'town-center',
    );
    expect(enemyTc).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'spearman')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(enemyTc!.id)).toBe(true);

    // Advance until the spearman has taken damage.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const s = findUnitById(bridge, spearmanId);
          if (!s) return false;
          const hp = getHealthOfUnitAtCell(bridge, s.x, s.y);
          return hp !== null && hp < 45 && hp > 5;
        },
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    const wounded = findUnitById(bridge, spearmanId);
    expect(wounded).toBeDefined();
    const woundedHp = getHealthOfUnitAtCell(bridge, wounded!.x, wounded!.y);
    expect(woundedHp).not.toBeNull();

    // Cancel the spearman's attack so it walks back to the Monk.
    expect(selectOwnedUnitDirect(bridge, 1, 'spearman')).toBe(true);
    const monk = findFirstOwnedUnit(bridge, 1, 'monk');
    expect(monk).toBeDefined();
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
        { maxSteps: 2000 },
      ),
    ).toBe(true);

    // Issue the Monk heal order.
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(spearmanId)).toBe(true);

    // Advance enough ticks for the heal to tick up the spearman HP.
    const healingSteps = 400;
    bridge.step(healingSteps * 100);

    const healed = findUnitById(bridge, spearmanId);
    expect(healed).toBeDefined();
    const healedHp = getHealthOfUnitAtCell(bridge, healed!.x, healed!.y);
    expect(healedHp).not.toBeNull();
    // Heal rate is 1 HP per 10 ticks => 40 HP over 400 ticks. The spearman
    // was certainly below 45 (max HP) and must have gained HP, capped at 45.
    expect(healedHp).toBeGreaterThan(woundedHp!);
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
