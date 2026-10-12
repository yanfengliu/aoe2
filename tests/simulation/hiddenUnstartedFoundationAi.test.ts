// What an AI opponent does with a foundation nobody has started building
// (work 121; spec §12.2, "An unstarted foundation is hidden from the owner's
// enemies"): it does not see one, so it neither picks one as a target nor
// marches on one, and an owner left with nothing else is out of the match
// (Definitive Edition update 46295: a Donjon foundation no longer kept its
// owner in). Once building starts, the foundation is a target as before.
//
// Read through the bridge's debug snapshot (`unitPaths`: each unit's order and
// where it points) and the match state, on fixtures that leave each AI choice
// exactly one candidate: the visible-building pick and the Aggressive stance
// (`hidden-foundation-ai-fixture`), the Town Center to march on
// (`-town-center-`), the last-resort building (`-last-resort-`), and conquest
// (`-conquest-`).
//
// BOUND — what a green run here does NOT prove:
//   * One AI owner against the human, standard difficulty, on flat grass.
//   * The Town Center case is a second Town Center placed while the first
//     stands; an owner whose only Town Center is an unstarted foundation is
//     covered by the last-resort case's rule, not by its own fixture.
//   * Conquest is read as the human's match state, so only the human's win is
//     observed, not one AI eliminating another.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  HIDDEN_AI_TOWER_HOUSE,
  HIDDEN_CONQUEST_FOUNDATION,
  HIDDEN_FOUNDATION_AWAY,
  HIDDEN_FOUNDATION_SITE,
  HIDDEN_LAST_RESORT_FOUNDATION,
  HIDDEN_LAST_RESORT_HOUSE,
  HIDDEN_TOWN_CENTER,
  HIDDEN_TOWER_FOUNDATION,
  HIDDEN_TOWN_CENTER_FOUNDATION,
} from '../../src/game/simulation/fixtures/hiddenFoundation';
import {
  attackCommandOn,
  economyBuilding,
  idsOf,
  placeFoundationAs,
  startFoundationAs,
  stepTicks,
  type Bridge,
} from './hiddenUnstartedFoundation.helpers';

function anyAttackOn(bridge: Bridge, unitIds: readonly number[], anchor: { x: number; y: number }): boolean {
  return unitIds.some((id) => attackCommandOn(bridge, id, anchor));
}

describe('an AI does not see the human\'s unstarted foundation', () => {
  it('its Militia beside the foundation leave it alone, and attack it once building starts', () => {
    const bridge = createSimulationBridge('hidden-foundation-ai-fixture');
    const builder = idsOf(bridge, 1, 'villager')[0]!;
    const soldiers = idsOf(bridge, 2, 'militia');
    const foundationId = placeFoundationAs(bridge, builder, 'barracks', HIDDEN_FOUNDATION_SITE, HIDDEN_FOUNDATION_AWAY);
    const startHp = bridge.getEntityHealth(foundationId)!.currentHp;

    for (let tick = 0; tick < 300; tick += 1) {
      bridge.step(100);
      expect(anyAttackOn(bridge, soldiers, HIDDEN_FOUNDATION_SITE), `tick ${tick}`).toBe(false);
    }
    expect(bridge.getEntityHealth(foundationId)!.currentHp).toBe(startHp);

    startFoundationAs(bridge, builder, foundationId);
    let attacked = false;
    for (let tick = 0; tick < 300 && !attacked; tick += 1) {
      bridge.step(100);
      attacked = anyAttackOn(bridge, soldiers, HIDDEN_FOUNDATION_SITE);
    }
    expect(attacked).toBe(true);
  }, 60_000);

  it('its attack phase picks the House it can see, not a tower foundation that would outrank it', () => {
    const bridge = createSimulationBridge('hidden-foundation-ai-tower-fixture');
    const soldiers = idsOf(bridge, 2, 'militia');
    let onHouse = false;
    for (let tick = 0; tick < 100 && !onHouse; tick += 1) {
      bridge.step(100);
      expect(anyAttackOn(bridge, soldiers, HIDDEN_TOWER_FOUNDATION), `tick ${tick}`).toBe(false);
      onHouse = anyAttackOn(bridge, soldiers, HIDDEN_AI_TOWER_HOUSE);
    }
    expect(onHouse).toBe(true);
  }, 60_000);

  it('marches on the Town Center that stands, not on a newer one nobody has started', () => {
    const bridge = createSimulationBridge('hidden-foundation-town-center-fixture');
    const soldiers = idsOf(bridge, 2, 'militia');
    const foundation = bridge.getEconomyState().buildings.find((building) =>
      building.x === HIDDEN_TOWN_CENTER_FOUNDATION.x && building.y === HIDDEN_TOWN_CENTER_FOUNDATION.y);
    // Premise: the second Town Center is an unstarted foundation.
    expect(foundation?.isComplete).toBe(false);
    expect(foundation?.buildProgressTicks).toBe(0);

    stepTicks(bridge, 20);
    expect(anyAttackOn(bridge, soldiers, HIDDEN_TOWN_CENTER_FOUNDATION)).toBe(false);
    expect(anyAttackOn(bridge, soldiers, HIDDEN_TOWN_CENTER)).toBe(true);
  }, 60_000);

  it('falls back on a building that stands, not on an unstarted foundation with a lower id', () => {
    const bridge = createSimulationBridge('hidden-foundation-last-resort-fixture');
    const soldiers = idsOf(bridge, 2, 'militia');
    const foundation = bridge.getEconomyState().buildings.find((building) =>
      building.x === HIDDEN_LAST_RESORT_FOUNDATION.x && building.y === HIDDEN_LAST_RESORT_FOUNDATION.y);
    const house = bridge.getEconomyState().buildings.find((building) =>
      building.x === HIDDEN_LAST_RESORT_HOUSE.x && building.y === HIDDEN_LAST_RESORT_HOUSE.y);
    // Premise: the foundation is the human's lowest-numbered building.
    expect(foundation!.id).toBeLessThan(house!.id);
    expect(foundation!.buildProgressTicks).toBe(0);

    stepTicks(bridge, 20);
    expect(anyAttackOn(bridge, soldiers, HIDDEN_LAST_RESORT_FOUNDATION)).toBe(false);
    expect(anyAttackOn(bridge, soldiers, HIDDEN_LAST_RESORT_HOUSE)).toBe(true);
  }, 60_000);
});

describe('an unstarted foundation does not keep its owner in the match', () => {
  function bootConquest(): { bridge: Bridge; villager: number; foundationId: number } {
    const bridge = createSimulationBridge('hidden-foundation-conquest-fixture');
    const villager = idsOf(bridge, 2, 'villager')[0]!;
    const foundation = bridge.getEconomyState().buildings.find((building) =>
      building.x === HIDDEN_CONQUEST_FOUNDATION.x && building.y === HIDDEN_CONQUEST_FOUNDATION.y);
    expect(foundation?.buildProgressTicks).toBe(0);
    return { bridge, villager, foundationId: foundation!.id };
  }

  function deleteVillager(bridge: Bridge, villager: number): void {
    expect(bridge.world.submitWithResult('entity.delete', { entityId: villager, requestedBy: 2 }).accepted).toBe(true);
  }

  it('an owner left with only an unstarted foundation is defeated', () => {
    const { bridge, villager } = bootConquest();
    stepTicks(bridge, 5);
    expect(bridge.getMatchState().outcome).toBe('running');
    deleteVillager(bridge, villager);
    stepTicks(bridge, 5);
    expect(bridge.getMatchState().outcome).toBe('victory');
  }, 60_000);

  it('a started foundation keeps its owner in, as before', () => {
    const { bridge, villager, foundationId } = bootConquest();
    expect(bridge.world.submitWithResult('unit.contextAtEntity', {
      unitId: villager,
      targetEntityId: foundationId,
    }).accepted).toBe(true);
    for (let tick = 0; tick < 200 && (economyBuilding(bridge, foundationId)?.buildProgressTicks ?? 0) <= 0; tick += 1) {
      bridge.step(100);
    }
    expect(economyBuilding(bridge, foundationId)!.buildProgressTicks).toBeGreaterThan(0);
    deleteVillager(bridge, villager);
    stepTicks(bridge, 20);
    expect(bridge.getMatchState().outcome).toBe('running');
  }, 60_000);
});
