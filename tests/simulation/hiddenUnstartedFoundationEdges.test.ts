// The edges of "an unstarted foundation is hidden from the owner's enemies"
// (work 121; spec §12.2): what Spies shows, what a blast reaches, and an attack
// order an older save already holds.
//
// BOUND: one scene each on flat grass. Spies with nothing of the human's near
// the foundation, so only another player's eyes could show it. One Mangonel
// attack-ground order whose blast takes in the foundation's edge; a blast
// hurts units only here (spec §10.7), whatever a building's state, so the case
// pins that a hidden foundation is no exception, not a rule of its own. One
// Militia's attack order written into a save made before the rule.

import { describe, expect, it } from 'vitest';

import { unitCommandsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  HIDDEN_FOUNDATION_AWAY,
  HIDDEN_FOUNDATION_SITE,
  HIDDEN_SPIES_FOUNDATION,
  HIDDEN_SPIES_HOUSE,
  HIDDEN_SPLASH_FOUNDATION,
  HIDDEN_SPLASH_VILLAGER,
} from '../../src/game/simulation/fixtures/hiddenFoundation';
import {
  attackCommandOn,
  economyBuilding,
  idsOf,
  placeFoundationAs,
  stepTicks,
  type Bridge,
} from './hiddenUnstartedFoundation.helpers';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

function buildingAt(bridge: Bridge, cell: { x: number; y: number }) {
  return bridge.getEconomyState().buildings.find((building) => building.x === cell.x && building.y === cell.y);
}

function isDrawn(bridge: Bridge, id: number): boolean {
  return bridge.getRenderState().entities.some((entity) => entity.id === id);
}

describe('Spies shows no unstarted foundation of an enemy', () => {
  it('draws the House an enemy\'s villager sees, and not the foundation beside it', () => {
    const bridge = createSimulationBridge('hidden-foundation-spies-fixture');
    stepTicks(bridge, 5);
    const house = buildingAt(bridge, HIDDEN_SPIES_HOUSE)!;
    const foundation = buildingAt(bridge, HIDDEN_SPIES_FOUNDATION)!;
    expect(foundation.buildProgressTicks, 'premise: nobody has started it').toBe(0);
    // Premise: nothing of the human's is near, so Spies is what shows the House.
    expect(isDrawn(bridge, house.id), 'premise: Spies shows the enemy\'s House').toBe(true);
    expect(isDrawn(bridge, foundation.id)).toBe(false);
  }, 30_000);
});

describe('a blast beside an unstarted foundation of an enemy', () => {
  it('hurts the unit it lands on and not the foundation, as it hurts no building (spec §10.7)', () => {
    const bridge = createSimulationBridge('hidden-foundation-splash-fixture');
    const mangonel = idsOf(bridge, 1, 'mangonel')[0]!;
    const villager = idsOf(bridge, 2, 'villager')[0]!;
    const foundation = buildingAt(bridge, HIDDEN_SPLASH_FOUNDATION)!;
    const foundationHp = bridge.getEntityHealth(foundation.id)!.currentHp;
    const villagerHp = bridge.getEntityHealth(villager)!.currentHp;
    expect(bridge.selectUnitsByIds([mangonel])).toBe(true);
    expect(bridge.issueAttackGroundCommand(HIDDEN_SPLASH_VILLAGER.x, HIDDEN_SPLASH_VILLAGER.y)).toBe(true);
    // Premise: a stone landed, so the blast took in the foundation's edge.
    let landed = false;
    for (let tick = 0; tick < 400 && !landed; tick += 1) {
      bridge.step(100);
      landed = (bridge.getEntityHealth(villager)?.currentHp ?? 0) < villagerHp;
    }
    expect(landed, 'premise: the blast hurt the villager').toBe(true);
    expect(bridge.getEntityHealth(foundation.id)!.currentHp).toBe(foundationHp);
    expect(isDrawn(bridge, foundation.id)).toBe(false);
  }, 30_000);
});

describe('an attack an older save holds on an enemy\'s unstarted foundation', () => {
  it('is dropped, and the foundation takes nothing from it', () => {
    const bridge = createSimulationBridge('hidden-foundation-fixture');
    const builder = idsOf(bridge, 2, 'villager')[0]!;
    const foundationId = placeFoundationAs(bridge, builder, 'barracks', HIDDEN_FOUNDATION_SITE, HIDDEN_FOUNDATION_AWAY);
    const soldier = idsOf(bridge, 1, 'militia')[0]!;
    const site = economyBuilding(bridge, foundationId)!;
    const blob = asSchema2Blob(bridge.saveGame());
    const state = worldStateOf(blob);
    const commands = new Map((state[unitCommandsCodec.slot] ?? []) as Array<[number, unknown]>);
    commands.set(soldier, {
      type: 'attack',
      target: { x: site.x, y: site.y },
      targetEntityRef: { id: foundationId, generation: bridge.world.getEntityGeneration(foundationId) },
      targetEntityKind: 'building',
    });
    state[unitCommandsCodec.slot] = [...commands];

    const loaded = createSimulationBridge('hidden-foundation-fixture', { savedGame: blob });
    expect(attackCommandOn(loaded, soldier, HIDDEN_FOUNDATION_SITE), 'premise: the save carries the attack').toBe(true);
    const startHp = loaded.getEntityHealth(foundationId)!.currentHp;
    // Before the rule this order took the foundation from 120 to 68 in 150 ticks.
    stepTicks(loaded, 150);

    expect(attackCommandOn(loaded, soldier, HIDDEN_FOUNDATION_SITE), 'the order is dropped').toBe(false);
    expect(loaded.getEntityHealth(foundationId)!.currentHp).toBe(startHp);
  }, 30_000);
});
